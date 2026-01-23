// 레시피 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { loadInventory } from '../../database-old.js';
import { getItemIcon } from '../../utils.js';

/**
 * 레시피 메인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'crafting'
    const category = parts.slice(2).join('_');
    
    // 레시피 관리 버튼 생성
    const viewButton = new ButtonBuilder()
      .setCustomId(`recipe_view_${category}`)
      .setLabel('📖 조회')
      .setStyle(ButtonStyle.Primary);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`recipe_edit_${category}`)
      .setLabel('✏️ 수정')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(viewButton, editButton);
    
    await interaction.reply({
      content: `📋 **${category}** 카테고리 레시피 관리\n\n원하는 작업을 선택하세요:`,
      components: [row],
      ephemeral: true
    });
    
  } catch (error) {
    console.error('❌ 레시피 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 레시피 버튼 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 레시피 조회 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeViewButton(interaction) {
  try {
    const category = interaction.customId.replace('recipe_view_', '');
    const inventory = await loadInventory();
    
    if (!inventory.crafting?.recipes?.[category] || Object.keys(inventory.crafting.recipes[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 레시피가 없습니다.`,
        components: []
      });
    }
    
    const recipes = inventory.crafting.recipes[category];
    const recipeCount = Object.keys(recipes).length;
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 ${category} 레시피북`)
      .setDescription(`총 **${recipeCount}개**의 레시피가 등록되어 있습니다.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      .setColor(0xFFA500)
      .setTimestamp()
      .setFooter({ text: '✅ 제작 가능 | ⚠️ 재료 부족' });
    
    for (const [itemName, materials] of Object.entries(recipes)) {
      const icon = getItemIcon(itemName, inventory);
      
      // 제작 가능 여부 확인
      let canCraft = true;
      const materialLines = materials.map(m => {
        const matIcon = getItemIcon(m.name, inventory);
        const materialData = inventory.categories[m.category]?.[m.name];
        const currentQty = materialData?.quantity || 0;
        const hasEnough = currentQty >= m.quantity;
        
        if (!hasEnough) canCraft = false;
        
        const statusIcon = hasEnough ? '✅' : '❌';
        const qtyDisplay = hasEnough 
          ? `${m.quantity}개` 
          : `${m.quantity}개 (보유: ${currentQty}개)`;
        
        return `${statusIcon} ${matIcon} # ${m.name} × ${qtyDisplay}`;
      });
      
      const statusEmoji = canCraft ? '✅' : '⚠️';
      const statusText = canCraft ? '제작 가능' : '재료 부족';
      
      const fieldValue = [
        `**${statusEmoji} ${statusText}**`,
        '',
        ...materialLines,
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      ].join('\n');
      
      embed.addFields({
        name: `${icon} ${itemName}`,
        value: fieldValue,
        inline: false
      });
    }
    
    await interaction.update({
      embeds: [embed],
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 20000);
    
  } catch (error) {
    console.error('❌ 레시피 조회 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 조회 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 수정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeEditButton(interaction) {
  try {
    const category = interaction.customId.replace('recipe_edit_', '');
    const inventory = await loadInventory();
    
    if (!inventory.crafting?.categories?.[category] || Object.keys(inventory.crafting.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 제작품이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(inventory.crafting.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(items.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
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
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_edit_${category}_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_edit_${category}_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_edit_${category}_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `✏️ **${category}** 카테고리에서 레시피를 수정할 제작품을 선택하세요${totalPages > 1 ? ` (${items.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}:`,
      components: rows
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 레시피 수정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 수정 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가/스킵 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeAddSkipButton(interaction) {
  try {
    const isSkip = interaction.customId.startsWith('skip_recipe_');
    const prefix = isSkip ? 'skip_recipe_' : 'add_recipe_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const category = parts[0];
    const itemName = parts.slice(1).join('_');
    
    if (isSkip) {
      await interaction.update({
        content: `✅ # ${itemName}\n제작품이 추가되었습니다. 나중에 \`/레시피수정\` 명령어로 레시피를 추가할 수 있습니다.`,
        embeds: [],
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
      return;
    }
    
    // 레시피 추가 - 재료 선택 메뉴 표시
    const inventory = await loadInventory();
    
    // 같은 카테고리의 재고 아이템 목록 가져오기
    if (!inventory.categories[category] || Object.keys(inventory.categories[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 재료가 없습니다. 먼저 재고 목록에 재료를 추가해주세요.`,
        embeds: [],
        components: []
      });
    }
    
    const materials = Object.keys(inventory.categories[category]);
    const page = 0; // 첫 페이지
    const itemsPerPage = 25;
    const totalPages = Math.ceil(materials.length / itemsPerPage);
    const startIndex = page * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, materials.length);
    const pageMaterials = materials.slice(startIndex, endIndex);
    
    const materialOptions = pageMaterials.map(mat => ({
      label: mat,
      value: mat,
      emoji: getItemIcon(mat, inventory)
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material_${category}_${itemName}_1`)
      .setPlaceholder('재료 1을 선택하세요 (필수)')
      .addOptions(materialOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (25개 초과 시)
    if (totalPages > 1) {
      const pageButtons = [];
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_prev_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_info_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel(`페이지 ${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`page_next_recipe_material_${category}_${itemName}_1_${page}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1)
      );
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    await interaction.update({
      content: `📝 # ${itemName}\n레시피 추가\n\n**1단계:** 첫 번째 재료를 선택하세요${totalPages > 1 ? ` (${materials.length}개 중 ${startIndex + 1}-${endIndex}번째)` : ''}`,
      embeds: [],
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 레시피 추가 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 추가 버튼 에러 응답 실패:', err);
    });
  }
}

/**
 * 레시피 추가 더하기/완료 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleRecipeMoreFinishButton(interaction) {
  try {
    const isFinish = interaction.customId.startsWith('finish_recipe_');
    const isEdit = interaction.customId.includes('_edit_');
    
    let prefix, parts, category, step, itemName;
    
    if (isEdit) {
      prefix = isFinish ? 'finish_recipe_edit_' : 'add_more_recipe_edit_';
      parts = interaction.customId.replace(prefix, '').split('_');
      category = parts[0];
      step = isFinish ? null : parseInt(parts[parts.length - 1]);
      itemName = isFinish ? parts.slice(1).join('_') : parts.slice(1, -1).join('_');
    } else {
      prefix = isFinish ? 'finish_recipe_' : 'add_more_recipe_';
      parts = interaction.customId.replace(prefix, '').split('_');
      category = parts[0];
      step = isFinish ? null : parseInt(parts[parts.length - 1]);
      itemName = isFinish ? parts.slice(1).join('_') : parts.slice(1, -1).join('_');
    }
    
    const inventory = await loadInventory();
    
    if (isFinish) {
      const recipe = inventory.crafting.recipes?.[category]?.[itemName] || [];
      const recipeText = recipe
        .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
        .join('\n');
      
      await interaction.update({
        content: `✅ # ${itemName}\n레시피 ${isEdit ? '수정' : '추가'} 완료!\n\n**${isEdit ? '새 ' : ''}레시피:**\n${recipeText}`,
        components: []
      });
      
      setTimeout(async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {}
      }, 15000);
      return;
    }
    
    // 다음 재료 선택
    const materials = Object.keys(inventory.categories[category]);
    const materialOptions = materials.map(mat => ({
      label: mat,
      value: mat,
      emoji: getItemIcon(mat, inventory)
    }));
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_recipe_material${isEdit ? '_edit' : ''}_${category}_${itemName}_${step}`)
      .setPlaceholder(`재료 ${step}을 선택하세요`)
      .addOptions(materialOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const currentRecipe = inventory.crafting.recipes[category][itemName]
      .map(m => `${getItemIcon(m.name, inventory)} ${m.name} x${m.quantity}`)
      .join('\n');
    
    await interaction.update({
      content: `${isEdit ? '✏️' : '📝'} # ${itemName}\n레시피 ${isEdit ? '수정' : '추가'}\n\n**현재 레시피:**\n${currentRecipe}\n\n**${step}단계:** ${step}번째 재료를 선택하세요`,
      components: [row]
    });
    
  } catch (error) {
    console.error('❌ 레시피 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 레시피 버튼 에러 응답 실패:', err);
    });
  }
}
