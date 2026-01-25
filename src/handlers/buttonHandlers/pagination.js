// 페이지네이션 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getItemIcon, getTimeoutSettings, validateEmoji } from '../../utils.js';

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
 * 페이지 점프 버튼 핸들러 (모달 표시)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handlePageJump(interaction) {
  try {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    // customId 형식: page_jump_embed_inventory_해양_2_10 (현재페이지_총페이지)
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const totalPages = parseInt(parts[parts.length - 1]);
    const currentPage = parseInt(parts[parts.length - 2]);
    const category = parts.slice(4, -2).join('_');
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    const modal = new ModalBuilder()
      .setCustomId(`page_jump_modal_${type}_${category}_${totalPages}`)
      .setTitle('페이지 이동');
    
    const pageInput = new TextInputBuilder()
      .setCustomId('page_number')
      .setLabel(`이동할 페이지 (1-${totalPages})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`현재: ${currentPage + 1}페이지`)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(String(totalPages).length);
    
    modal.addComponents(new ActionRowBuilder().addComponents(pageInput));
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ 페이지 점프 모달 에러:', error);
    await interaction.reply({ content: '페이지 이동 모달을 표시하는 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
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


/**
 * 페이지 점프 모달 제출 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handlePageJumpModal(interaction) {
  try {
    // customId 형식: page_jump_modal_inventory_해양_10 (총페이지)
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const totalPages = parseInt(parts[parts.length - 1]);
    const category = parts.slice(4, -1).join('_');
    
    const pageInput = interaction.fields.getTextInputValue('page_number').trim();
    const targetPage = parseInt(pageInput);
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    // 페이지 번호 검증
    if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
      return await interaction.reply({
        content: `❌ 잘못된 페이지 번호입니다. 1부터 ${totalPages}까지 입력해주세요.\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const newPage = targetPage - 1; // 0-based index
    
    const uiMode = inventory.settings?.uiMode || 'normal';
    const barLength = inventory.settings?.barLength || 15;
    
    let embed;
    
    if (type === 'crafting') {
      const crafting = inventory.crafting || { categories: {}, crafting: {} };
      embed = createCraftingEmbed(crafting, category, uiMode, barLength, newPage, inventory);
    } else {
      embed = createInventoryEmbed(inventory, category, uiMode, barLength, newPage);
    }
    
    const buttons = createButtons(category, true, type, uiMode, barLength, inventory, interaction.user.id, newPage, totalPages);
    
    await interaction.update({ embeds: [embed], components: buttons });
    
    // 활성 메시지의 페이지 번호 업데이트
    const messageId = interaction.message.id;
    const messageData = global.activeMessages?.get(messageId);
    if (messageData) {
      messageData.page = newPage;
      messageData.timestamp = Date.now();
      global.activeMessages.set(messageId, messageData);
      console.log(`🔢 페이지 점프: ${targetPage}페이지로 이동 (메시지 ${messageId} 페이지 상태 저장)`);
    } else {
      console.log(`🔢 페이지 점프: ${targetPage}페이지로 이동`);
    }
  } catch (error) {
    console.error('❌ 페이지 점프 모달 제출 에러:', error);
    await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}


/**
 * 범용 페이지 점프 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleGenericPageJump(interaction) {
  try {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    // customId 형식: page_quantity_inventory_해양_jump_0_4
    // parts: ['page', 'quantity', 'inventory', '해양', 'jump', '0', '4']
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    const currentPage = parseInt(parts[parts.length - 2]);
    
    // jump의 실제 위치 찾기
    const jumpIndex = parts.indexOf('jump');
    
    // baseId는 처음 2개: 'page_quantity'
    const baseId = parts.slice(0, 2).join('_');
    
    // suffix는 jump 이전의 나머지: 'inventory_해양'
    const suffix = parts.slice(2, jumpIndex).join('_');
    
    console.log(`🔢 페이지 점프 버튼 클릭:
  - customId: ${interaction.customId}
  - parts: ${parts.join(', ')}
  - jumpIndex: ${jumpIndex}
  - baseId: ${baseId}
  - suffix: ${suffix}
  - currentPage: ${currentPage}, totalPages: ${totalPages}`);
    
    // 모달 customId에 baseId와 suffix를 모두 포함
    const modal = new ModalBuilder()
      .setCustomId(`generic_page_jump_modal_${baseId}_${suffix}_${totalPages}`)
      .setTitle('페이지 이동');
    
    const pageInput = new TextInputBuilder()
      .setCustomId('page_number')
      .setLabel(`이동할 페이지 (1-${totalPages})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`현재: ${currentPage + 1}페이지`)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(String(totalPages).length);
    
    const row = new ActionRowBuilder().addComponents(pageInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ 범용 페이지 점프 모달 에러:', error);
    await interaction.reply({ content: '페이지 이동 모달을 표시하는 중 오류가 발생했습니다.', flags: 64 }).catch(() => {});
  }
}

/**
 * 범용 페이지 점프 모달 제출 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleGenericPageJumpModal(interaction) {
  try {
    const { StringSelectMenuBuilder, ActionRowBuilder } = await import('discord.js');
    const { paginateItems, createPaginationButtons, getPaginationInfo } = await import('../../paginationUtils.js');
    const { getItemIcon, getTimeoutSettings } = await import('../../utils.js');
    
    // customId 형식: generic_page_jump_modal_page_quantity_inventory_해양_10
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    
    // 'generic_page_jump_modal_' 제거 (4개 요소)
    const remainingParts = parts.slice(4);
    
    // 마지막(totalPages) 제외
    const dataParts = remainingParts.slice(0, -1);
    
    // baseId는 처음 2개: 'page_quantity'
    const baseId = dataParts.slice(0, 2).join('_');
    
    // suffix는 나머지: 'inventory_해양'
    const suffix = dataParts.slice(2).join('_');
    
    const pageInput = interaction.fields.getTextInputValue('page_number').trim();
    const targetPage = parseInt(pageInput);
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    
    // 페이지 번호 검증
    if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
      return await interaction.reply({
        content: `❌ 잘못된 페이지 번호입니다. 1부터 ${totalPages}까지 입력해주세요.\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`,
        flags: 64
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const newPage = targetPage - 1; // 0-based index
    
    console.log(`🔢 범용 페이지 점프:
  - baseId: ${baseId}
  - suffix: ${suffix}
  - targetPage: ${targetPage} (0-based: ${newPage})`);
    
    // 각 페이지네이션 타입별로 직접 처리
    if (baseId === 'page_quantity') {
      // page_quantity_inventory_해양 형식
      const typeParts = suffix.split('_');
      const type = typeParts[0]; // 'inventory' or 'crafting'
      const category = typeParts.slice(1).join('_'); // '해양'
      
      // 수량 관리 페이지 점프 처리
      function validateEmoji(emoji) {
        if (!emoji) return '📦';
        if (emoji.startsWith('<') || emoji.length > 10) return '📦';
        return emoji;
      }
      
      const targetData = type === 'inventory' ? inventory : inventory.crafting;
      const items = Object.keys(targetData?.categories?.[category] || {});
      
      if (items.length === 0) {
        return await interaction.update({
          content: `❌ "${category}" 카테고리에 아이템이 없습니다.`,
          components: []
        });
      }
      
      const itemOptions = items.map(item => {
        const itemData = targetData?.categories?.[category]?.[item];
        if (!itemData) return null;
        
        const customEmoji = itemData?.emoji;
        let description = `현재: ${itemData.quantity}개 / 목표: ${itemData.required}개`;
        if (description.length > 100) {
          description = description.substring(0, 97) + '...';
        }
        
        const emoji = validateEmoji(customEmoji || getItemIcon(item, inventory));
        
        return {
          label: item,
          value: item,
          emoji: emoji,
          description: description
        };
      }).filter(item => item !== null);
      
      const { pagedItems, totalPages: calcTotalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
      
      if (pagedItems.length === 0) {
        return await interaction.update({
          content: `❌ 해당 페이지에 아이템이 없습니다.`,
          components: []
        });
      }
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_quantity_${type}_${category}`)
        .setPlaceholder('수량을 관리할 아이템을 선택하세요')
        .addOptions(pagedItems);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      if (calcTotalPages > 1) {
        const paginationRow = createPaginationButtons(`page_quantity_${type}_${category}`, newPage, calcTotalPages);
        rows.push(paginationRow);
      }
      
      const paginationInfo = getPaginationInfo(newPage, calcTotalPages, itemOptions.length, startIndex, endIndex);
      const { selectTimeout } = getTimeoutSettings(inventory);
      
      await interaction.update({
        content: `📊 **${category}** 카테고리 수량 관리\n${paginationInfo}\n\n수량을 관리할 아이템을 선택하세요:\n\n_이 메시지는 ${selectTimeout / 1000}초 후 자동 삭제됩니다_`,
        components: rows
      });
      
      console.log(`✅ 수량 관리 페이지 점프 완료: ${targetPage}페이지로 이동`);
    } 
    // 초기화 (reset) 페이지네이션
    else if (baseId === 'page_reset') {
      const typeParts = suffix.split('_');
      const type = typeParts[0];
      const category = typeParts.slice(1).join('_');
      
      const targetData = type === 'inventory' ? inventory : inventory.crafting;
      const items = Object.keys(targetData?.categories?.[category] || {});
      
      if (items.length === 0) {
        return await interaction.reply({
          content: `❌ "${category}" 카테고리에 아이템이 없습니다.`,
          ephemeral: true
        });
      }
      
      const itemOptions = items.map(item => {
        const itemData = targetData?.categories?.[category]?.[item];
        if (!itemData) return null;
        
        const customEmoji = itemData?.emoji;
        const fallbackEmoji = getItemIcon(item, inventory);
        const validEmoji = customEmoji && !customEmoji.startsWith('<') && customEmoji.length <= 10 ? customEmoji : (fallbackEmoji && !fallbackEmoji.startsWith('<') && fallbackEmoji.length <= 10 ? fallbackEmoji : '📦');
        
        return {
          label: item,
          value: item,
          emoji: validEmoji,
          description: `현재: ${itemData.quantity}개`
        };
      }).filter(item => item !== null);
      
      const { pagedItems, totalPages: calcTotalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_reset_${type}_${category}`)
        .setPlaceholder('초기화할 항목을 선택하세요')
        .addOptions(pagedItems);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      if (calcTotalPages > 1) {
        const paginationRow = createPaginationButtons(`page_reset_${type}_${category}`, newPage, calcTotalPages);
        rows.push(paginationRow);
      }
      
      const paginationInfo = getPaginationInfo(newPage, calcTotalPages, itemOptions.length, startIndex, endIndex);
      
      await interaction.update({
        content: `🔄 **${category}** 카테고리에서 초기화할 ${type === 'inventory' ? '아이템' : '제작품'}을 선택하세요:\n${paginationInfo}`,
        components: rows
      });
      
      console.log(`✅ 초기화 페이지 점프 완료: ${targetPage}페이지로 이동`);
    }
    // 삭제 (remove) 페이지네이션
    else if (baseId === 'page_remove') {
      const typeParts = suffix.split('_');
      const type = typeParts[0];
      const category = typeParts.slice(1).join('_');
      
      const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
      const items = Object.keys(targetData?.[category] || {});
      
      if (items.length === 0) {
        return await interaction.reply({
          content: `❌ "${category}" 카테고리에 아이템이 없습니다.`,
          ephemeral: true
        });
      }
      
      const { formatQuantity } = await import('../../utils.js');
      
      const itemOptions = items.map(item => {
        const formatted = formatQuantity(targetData[category][item].quantity);
        return {
          label: item,
          value: item,
          description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`
        };
      });
      
      const { pagedItems, totalPages: calcTotalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_remove_${type}_${category}`)
        .setPlaceholder('삭제할 항목을 선택하세요')
        .addOptions(pagedItems);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      if (calcTotalPages > 1) {
        const paginationRow = createPaginationButtons(`page_remove_${type}_${category}`, newPage, calcTotalPages);
        rows.push(paginationRow);
      }
      
      const paginationInfo = getPaginationInfo(newPage, calcTotalPages, itemOptions.length, startIndex, endIndex);
      
      await interaction.update({
        content: `🗑️ **${category}** 카테고리에서 삭제할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:\n${paginationInfo}`,
        components: rows
      });
      
      console.log(`✅ 삭제 페이지 점프 완료: ${targetPage}페이지로 이동`);
    }
    // 수정 (edit) 페이지네이션
    else if (baseId === 'page_edit') {
      const typeParts = suffix.split('_');
      const type = typeParts[0];
      const category = typeParts.slice(1).join('_');
      
      const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
      const items = Object.keys(targetData?.[category] || {});
      
      if (items.length === 0) {
        return await interaction.reply({
          content: `❌ "${category}" 카테고리에 아이템이 없습니다.`,
          ephemeral: true
        });
      }
      
      const { formatQuantity } = await import('../../utils.js');
      
      const itemOptions = items.map(item => {
        const formatted = formatQuantity(targetData[category][item].quantity);
        return {
          label: item,
          value: item,
          description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`
        };
      });
      
      const { pagedItems, totalPages: calcTotalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_edit_${type}_${category}`)
        .setPlaceholder('이름을 수정할 항목을 선택하세요')
        .addOptions(pagedItems);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      if (calcTotalPages > 1) {
        const paginationRow = createPaginationButtons(`page_edit_${type}_${category}`, newPage, calcTotalPages);
        rows.push(paginationRow);
      }
      
      const paginationInfo = getPaginationInfo(newPage, calcTotalPages, itemOptions.length, startIndex, endIndex);
      
      await interaction.update({
        content: `✏️ **${category}** 카테고리에서 이름을 수정할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:\n${paginationInfo}`,
        components: rows
      });
      
      console.log(`✅ 수정 페이지 점프 완료: ${targetPage}페이지로 이동`);
    }
    // 유형 변경 (type) 페이지네이션
    else if (baseId === 'page_type') {
      const typeParts = suffix.split('_');
      const type = typeParts[0];
      const category = typeParts.slice(1).join('_');
      
      const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
      const items = Object.keys(targetData?.[category] || {});
      
      if (items.length === 0) {
        return await interaction.reply({
          content: `❌ "${category}" 카테고리에 아이템이 없습니다.`,
          ephemeral: true
        });
      }
      
      const itemOptions = items.map(item => {
        const itemData = targetData[category][item];
        const currentType = itemData.itemType || (type === 'inventory' ? 'material' : 'final');
        const typeEmoji = { 'material': '📦', 'intermediate': '🔄', 'final': '⭐' }[currentType] || '❓';
        const typeName = { 'material': '재료', 'intermediate': '중간제작품', 'final': '최종제작품' }[currentType] || '미설정';
        
        return {
          label: item,
          value: item,
          description: `현재: ${typeName}`,
          emoji: typeEmoji
        };
      });
      
      const { pagedItems, totalPages: calcTotalPages, startIndex, endIndex } = paginateItems(itemOptions, newPage);
      
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_type_change_${type}_${category}`)
        .setPlaceholder('유형을 변경할 항목을 선택하세요')
        .addOptions(pagedItems);
      
      const rows = [new ActionRowBuilder().addComponents(selectMenu)];
      
      if (calcTotalPages > 1) {
        const paginationRow = createPaginationButtons(`page_type_${type}_${category}`, newPage, calcTotalPages);
        rows.push(paginationRow);
      }
      
      const paginationInfo = getPaginationInfo(newPage, calcTotalPages, itemOptions.length, startIndex, endIndex);
      
      await interaction.update({
        content: `🔄 **${category}** 카테고리에서 유형을 변경할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:\n📦 재료 | 🔄 중간제작품 | ⭐ 최종제작품\n${paginationInfo}`,
        components: rows
      });
      
      console.log(`✅ 유형 변경 페이지 점프 완료: ${targetPage}페이지로 이동`);
    }
    else {
      // 다른 타입들은 아직 미구현 - 버튼 유지하며 에러 메시지만 표시
      await interaction.reply({
        content: `⚠️ 이 페이지네이션 타입(${baseId})의 페이지 점프는 아직 지원되지 않습니다.\n이전/다음 버튼을 사용해주세요.`,
        ephemeral: true
      });
      console.log(`⚠️ 미지원 페이지 점프 타입: ${baseId}`);
    }
  } catch (error) {
    console.error('❌ 범용 페이지 점프 모달 제출 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}
