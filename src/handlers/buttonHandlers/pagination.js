// 페이지네이션 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory } from '../../database.js';
import { createCraftingEmbed, createInventoryEmbed, createButtons } from '../../embeds.js';
import { getItemIcon, getTimeoutSettings } from '../../utils.js';

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
    
    // customId 형식: page_quantity_jump_inventory_해양_2_10 (현재페이지_총페이지)
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    const currentPage = parseInt(parts[parts.length - 2]);
    
    // baseId 추출 (jump 이전까지)
    const jumpIndex = parts.indexOf('jump');
    const baseId = parts.slice(0, jumpIndex).join('_');
    const suffix = parts.slice(jumpIndex + 1, -2).join('_');
    
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
    await interaction.reply({ content: '페이지 이동 모달을 표시하는 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 범용 페이지 점프 모달 제출 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleGenericPageJumpModal(interaction) {
  try {
    // customId 형식: generic_page_jump_modal_page_quantity_inventory_해양_10
    const parts = interaction.customId.split('_');
    const totalPages = parseInt(parts[parts.length - 1]);
    
    // baseId 추출: 'modal' 다음부터 마지막 1개 제외
    // generic_page_jump_modal_page_quantity_inventory_해양_10
    // -> page_quantity_inventory_해양
    const modalIndex = parts.indexOf('modal');
    const baseIdParts = parts.slice(modalIndex + 1, -1);
    const baseId = baseIdParts[0]; // 'page'
    const paginationType = baseIdParts[1]; // 'quantity', 'prev', 'next' 등
    const suffix = baseIdParts.slice(2).join('_'); // 'inventory_해양' 등
    
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
    
    // 원래 핸들러로 리다이렉트 (페이지 번호만 변경)
    // 예: page_quantity_inventory_해양 -> page_quantity_next_inventory_해양_newPage
    const redirectCustomId = `${baseId}_${paginationType}_next_${suffix}_${newPage}`;
    
    // customId 변경하여 원래 핸들러 호출
    const modifiedInteraction = {
      ...interaction,
      customId: redirectCustomId,
      replied: false,
      deferred: false
    };
    
    // 적절한 핸들러 호출
    if (paginationType === 'quantity') {
      const { handleQuantityPageButton } = await import('./quantity.js');
      await handleQuantityPageButton(modifiedInteraction);
    } else if (paginationType === 'prev' || paginationType === 'next') {
      // page_prev_remove_, page_next_edit_ 등
      const actionType = suffix.split('_')[0]; // 'remove', 'edit', 'type', 'reorder' 등
      
      if (actionType === 'remove') {
        const { handleManageRemovePageButton } = await import('./manage.js');
        await handleManageRemovePageButton(modifiedInteraction);
      } else if (actionType === 'edit') {
        const { handleManageEditPageButton } = await import('./manage.js');
        await handleManageEditPageButton(modifiedInteraction);
      } else if (actionType === 'type') {
        const { handleManageTypePageButton } = await import('./manage.js');
        await handleManageTypePageButton(modifiedInteraction);
      } else if (actionType === 'reorder') {
        if (suffix.includes('_second_')) {
          const { handleManageReorderSecondPageButton } = await import('./manage.js');
          await handleManageReorderSecondPageButton(modifiedInteraction);
        } else {
          const { handleManageReorderPageButton } = await import('./manage.js');
          await handleManageReorderPageButton(modifiedInteraction);
        }
      } else if (actionType === 'reset') {
        const { handleResetPageButton } = await import('./reset.js');
        await handleResetPageButton(modifiedInteraction);
      } else if (actionType === 'collecting' || actionType === 'crafting') {
        const { handleWorkPageButton } = await import('./work.js');
        await handleWorkPageButton(modifiedInteraction);
      } else if (actionType === 'recipe') {
        // recipe_material, recipe_add, recipe_edit 등
        if (suffix.includes('_material_')) {
          if (suffix.includes('_standalone_')) {
            await handleRecipeMaterialStandalonePageNavigation(modifiedInteraction);
          } else {
            await handleRecipeMaterialPageNavigation(modifiedInteraction);
          }
        } else if (suffix.includes('_add_')) {
          await handleRecipeAddPageNavigation(modifiedInteraction);
        } else if (suffix.includes('_edit_')) {
          const { handleRecipeEditPagination } = await import('./recipe.js');
          await handleRecipeEditPagination(modifiedInteraction);
        }
      }
    }
    
    console.log(`🔢 범용 페이지 점프: ${targetPage}페이지로 이동 (${paginationType})`);
  } catch (error) {
    console.error('❌ 범용 페이지 점프 모달 제출 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '페이지 이동 중 오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}
