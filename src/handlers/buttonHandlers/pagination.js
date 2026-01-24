// 페이지네이션 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getItemIcon } from '../../utils.js';

/**
 * 이모지 검증 함수 - Select Menu는 유니코드 이모지만 허용
 * @param {string} emoji - 검증할 이모지
 * @returns {string} - 유효한 이모지 또는 기본 이모지
 */
function validateEmoji(emoji) {
  if (!emoji) return '📦';
  // 커스텀 Discord 이모지 형식(<:name:id> 또는 <a:name:id>)이거나 잘못된 형식이면 기본 이모지 사용
  if (emoji.startsWith('<') || emoji.length > 10) {
    return '📦';
  }
  return emoji;
}

export async function handlePageNavigation(interaction) {
  try {
    // customId 형식: page_prev_embed_inventory_해양_0 또는 page_next_embed_crafting_채광_2
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    // parts[2]는 'embed'
    const type = parts[3]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    let embed, items, totalPages;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      items = Object.entries(crafting.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, newPage, inventory);
    } else {
      items = Object.entries(inventory.categories[category] || {});
      totalPages = Math.ceil(items.length / 25);
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, newPage);
    }
    
    const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, newPage, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    
    // 활성 메시지의 페이지 번호 업데이트
    const messageId = interaction.message.id;
    const messageData = global.activeMessages?.get(messageId);
    if (messageData) {
      messageData.page = newPage;
      messageData.timestamp = Date.now(); // 타임스탬프도 갱신
      global.activeMessages.set(messageId, messageData);
      console.log(`📄 임베드 페이지 이동: ${currentPage + 1} → ${newPage + 1} (메시지 ${messageId} 페이지 상태 저장)`);
    } else {
      console.log(`📄 임베드 페이지 이동: ${currentPage + 1} → ${newPage + 1}`);
    }
  } catch (error) {
    console.error('❌ 페이지 이동 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', flags: 64 }).catch((err) => {
        console.error('❌ 페이지 이동 에러 응답 실패:', err);
      });
    }
  }
}


/**
 * 레시피 재료 선택 페이지네이션 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialPageNavigation(interaction) {
  try {
    // customId 형식: page_prev_recipe_material_해양_아이템명_2_0 또는 page_next_recipe_material_edit_해양_아이템명_2_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const isEdit = parts[4] === 'edit'; // parts[4]가 'edit'인지 확인 (parts[3]은 항상 'material')
    
    let category, itemName, step, currentPage;
    
    if (isEdit) {
      // page_prev_recipe_material_edit_category_itemName_step_page
      category = parts[5];
      currentPage = parseInt(parts[parts.length - 1]);
      step = parseInt(parts[parts.length - 2]);
      itemName = parts.slice(6, -2).join('_');
    } else {
      // page_prev_recipe_material_category_itemName_step_page
      category = parts[4];
      currentPage = parseInt(parts[parts.length - 1]);
      step = parseInt(parts[parts.length - 2]);
      itemName = parts.slice(5, -2).join('_');
    }
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    
    // 카테고리 존재 확인
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel(`페이지 ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe.length > 0
      ? currentRecipe.map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`).join('\n')
      : '없음';
    
    await interaction.update({
      content: `${isEdit ? '✏️' : '📝'} ${itemName}\n레시피 ${isEdit ? '수정' : '추가'}\n\n**현재 레시피:**\n${recipeText}\n\n**${step}단계:** ${step}번째 재료를 선택하세요 (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)`,
      components: rows
    });
    
    console.log(`📄 레시피 재료 페이지 이동: ${currentPage + 1} → ${newPage + 1}`);
  } catch (error) {
    console.error('❌ 레시피 재료 페이지 이동 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 레시피 재료 페이지 이동 에러 응답 실패:', err);
      });
    }
  }
}


/**
 * 레시피 추가 재료 선택 페이지네이션 핸들러 (독립 실행)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMaterialStandalonePageNavigation(interaction) {
  try {
    // customId 형식: page_prev_recipe_material_standalone_해양_아이템명_2_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    
    // parts[4] = 'standalone'이므로 실제 카테고리는 parts[5]부터
    const category = parts[5];
    const currentPage = parseInt(parts[parts.length - 1]);
    const step = parseInt(parts[parts.length - 2]);
    const itemName = parts.slice(6, -2).join('_');
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    
    // 카테고리 존재 확인
    if (!inventory.categories?.[category]) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: validateEmoji(getItemIcon(mat, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_standalone_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel(`페이지 ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_material_standalone_${category}_${itemName}_${step}_${newPage}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    const currentRecipe = inventory.crafting?.recipes?.[category]?.[itemName] || [];
    const recipeText = currentRecipe
      .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
      .join('\n');
    
    await interaction.update({
      content: `📝 ${itemName}\n레시피 추가\n\n**현재 레시피:**\n${recipeText || '없음'}\n\n**${step}단계:** ${step}번째 재료를 선택하세요 (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)`,
      components: rows
    });
    
    console.log(`📄 레시피 추가 재료 페이지 이동: ${currentPage + 1} → ${newPage + 1}`);
  } catch (error) {
    console.error('❌ 레시피 추가 재료 페이지 이동 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 레시피 추가 재료 페이지 이동 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 레시피 추가 제작품 선택 페이지네이션 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeAddPageNavigation(interaction) {
  try {
    // customId 형식: page_prev_recipe_add_해양_0
    const parts = interaction.customId.split('_');
    const direction = parts[1]; // 'prev' or 'next'
    const category = parts[3];
    const currentPage = parseInt(parts[parts.length - 1]);
    
    const newPage = direction === 'prev' ? currentPage - 1 : currentPage + 1;
    
    const inventory = await loadInventory();
    const items = Object.keys(inventory.crafting?.categories?.[category] || {});
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = newPage * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, items.length);
    const pageItems = items.slice(startIndex, endIndex);
    
    const itemOptions = pageItems.map(item => ({
      label: item,
      value: item,
      emoji: validateEmoji(getItemIcon(item, inventory))
    }));
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_add_${category}`)
      .setPlaceholder('레시피를 추가할 제작품을 선택하세요')
      .addOptions(itemOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const pageButtons = [];
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_prev_recipe_add_${category}_${newPage}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage === 0)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_info_recipe_add_${category}_${newPage}`)
        .setLabel(`페이지 ${newPage + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`page_next_recipe_add_${category}_${newPage}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(newPage >= totalPages - 1)
    );
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
    
    await interaction.update({
      content: `➕ **${category}** 카테고리에서 레시피를 추가할 제작품을 선택하세요 (${items.length}개 중 ${startIndex + 1}-${endIndex}번째):`,
      components: rows
    });
    
    console.log(`📄 레시피 추가 제작품 페이지 이동: ${currentPage + 1} → ${newPage + 1}`);
  } catch (error) {
    console.error('❌ 레시피 추가 제작품 페이지 이동 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 레시피 추가 제작품 페이지 이동 에러 응답 실패:', err);
      });
    }
  }
}
