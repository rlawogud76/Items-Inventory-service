// 선택 메뉴 페이지네이션 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory } from '../../database-old.js';
import { getItemIcon } from '../../utils.js';

/**
 * 레시피 재료 선택 페이지네이션
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialPagination(interaction) {
  try {
    // customId 형식: page_prev_recipe_material_해양_아이템명_1_0 또는 page_next_recipe_material_edit_해양_아이템명_1_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const isEdit = parts[4] === 'edit';
    
    let category, itemName, step, currentPage;
    
    if (isEdit) {
      // page_prev_recipe_material_edit_해양_아이템명_1_0
      category = parts[5];
      step = parseInt(parts[parts.length - 2]);
      currentPage = parseInt(parts[parts.length - 1]);
      itemName = parts.slice(6, -2).join('_');
    } else {
      // page_prev_recipe_material_해양_아이템명_1_0
      category = parts[4];
      step = parseInt(parts[parts.length - 2]);
      currentPage = parseInt(parts[parts.length - 1]);
      itemName = parts.slice(5, -2).join('_');
    }
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const materials = Object.keys(inventory.categories[category] || {});
    
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: getItemIcon(mat, inventory)
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(isEdit 
        ? `select_recipe_material_edit_${category}_${itemName}_${step}`
        : `select_recipe_material_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(isEdit
          ? `page_prev_recipe_material_edit_${category}_${itemName}_${step}_${newPage}`
          : `page_prev_recipe_material_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(isEdit
          ? `page_info_recipe_material_edit_${category}_${itemName}_${step}_${newPage}`
          : `page_info_recipe_material_${category}_${itemName}_${step}_${newPage}`)
        .setLabel(`페이지 ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(isEdit
          ? `page_next_recipe_material_edit_${category}_${itemName}_${step}_${newPage}`
          : `page_next_recipe_material_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    await interaction.update({
      content: `${isEdit ? '✏️' : '📝'}\n# ${itemName}\n레시피 ${isEdit ? '수정' : '추가'}\n\n**${step}단계:** ${step}번째 재료를 선택하세요 (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)`,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 레시피 재료 페이지네이션 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 재료 페이지네이션 응답 실패:', err);
    });
  }
}

/**
 * 레시피 수정 제작품 선택 페이지네이션
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeEditPagination(interaction) {
  try {
    // customId 형식: page_prev_recipe_edit_해양_0 또는 page_next_recipe_edit_해양_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const category = parts[4];
    const currentPage = parseInt(parts[5]);
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const items = Object.keys(inventory.crafting.categories[category]);
    
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);
    
    const itemOptions = pageItems.map(item => ({
      label: item,
      value: item,
      emoji: getItemIcon(item, inventory)
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_edit_${category}`)
      .setPlaceholder('레시피를 수정할 제작품을 선택하세요')
      .addOptions(itemOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_edit_${category}_${newPage}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_edit_${category}_${newPage}`)
        .setLabel(`페이지 ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_edit_${category}_${newPage}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    await interaction.update({
      content: `✏️ **${category}** 카테고리에서 레시피를 수정할 제작품을 선택하세요 (${items.length}개 중 ${startIndex + 1}-${endIndex}번째):`,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 레시피 수정 페이지네이션 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수정 페이지네이션 응답 실패:', err);
    });
  }
}
