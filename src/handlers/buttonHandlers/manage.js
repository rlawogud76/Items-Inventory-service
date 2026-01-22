// 물품/품목 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon } from '../../utils.js';

/**
 * 관리 메인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[1]; // 'inventory' or 'crafting'
    const category = parts.length > 2 ? parts.slice(2).join('_') : null;
    
    if (!category) {
      return await interaction.reply({ 
        content: '❌ 카테고리를 선택한 후 사용해주세요.',
        ephemeral: true
      });
    }
    
    // 추가/수정/삭제/태그 선택 버튼
    const addButton = new ButtonBuilder()
      .setCustomId(`manage_add_${type}_${category}`)
      .setLabel(type === 'inventory' ? '➕ 물품 추가' : '➕ 품목 추가')
      .setStyle(ButtonStyle.Success);
    
    const editButton = new ButtonBuilder()
      .setCustomId(`manage_edit_${type}_${category}`)
      .setLabel('✏️ 이름 수정')
      .setStyle(ButtonStyle.Primary);
    
    const tagButton = new ButtonBuilder()
      .setCustomId(`manage_tag_${type}_${category}`)
      .setLabel('🏷️ 태그 관리')
      .setStyle(ButtonStyle.Primary);
    
    const removeButton = new ButtonBuilder()
      .setCustomId(`manage_remove_${type}_${category}`)
      .setLabel(type === 'inventory' ? '➖ 물품 삭제' : '➖ 품목 삭제')
      .setStyle(ButtonStyle.Danger);
    
    const row1 = new ActionRowBuilder().addComponents(addButton, editButton, removeButton);
    const row2 = new ActionRowBuilder().addComponents(tagButton);
    
    await interaction.reply({
      content: `📝 **${category}** 카테고리 ${type === 'inventory' ? '물품' : '품목'} 관리\n\n원하는 작업을 선택하세요:`,
      components: [row1, row2],
      ephemeral: true
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 관리 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 관리 버튼 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 물품/품목 추가 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageAddButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_${type}_${category}`)
      .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 - ${category}`);
    
    const nameInput = new TextInputBuilder()
      .setCustomId('item_name')
      .setLabel(type === 'inventory' ? '아이템 이름' : '제작품 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 다이아몬드')
      .setRequired(true);
    
    const initialSetsInput = new TextInputBuilder()
      .setCustomId('initial_sets')
      .setLabel('초기 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const initialItemsInput = new TextInputBuilder()
      .setCustomId('initial_items')
      .setLabel('초기 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setValue('0')
      .setRequired(false);
    
    const requiredSetsInput = new TextInputBuilder()
      .setCustomId('required_sets')
      .setLabel('충족 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 10')
      .setRequired(false);
    
    const requiredItemsInput = new TextInputBuilder()
      .setCustomId('required_items')
      .setLabel('충족 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 32')
      .setRequired(false);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(initialSetsInput),
      new ActionRowBuilder().addComponents(initialItemsInput),
      new ActionRowBuilder().addComponents(requiredSetsInput),
      new ActionRowBuilder().addComponents(requiredItemsInput)
    );
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ 추가 모달 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 추가 모달 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 물품/품목 삭제 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageRemoveButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자 / 목표: ${targetData[category][item].required}개`
      };
    });
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0; // 첫 페이지
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_remove_${type}_${category}`)
      .setPlaceholder('삭제할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_remove_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_remove_${type}_${category}_${page}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1);
      
      const pageInfo = new ButtonBuilder()
        .setCustomId(`page_info_${page}`)
        .setLabel(`${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);
      
      rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    }
    
    let contentMessage = `🗑️ **${category}** 카테고리에서 삭제할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 삭제 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 삭제 선택 에러 응답 실패:', err);
      });
    }
  }
}

/**
 * 물품/품목 이름 수정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageEditButton(interaction) {
  try {
    // 이미 응답했는지 확인
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`
      };
    });
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0; // 첫 페이지
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_edit_${type}_${category}`)
      .setPlaceholder('이름을 수정할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_edit_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_edit_${type}_${category}_${page}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === totalPages - 1);
      
      const pageInfo = new ButtonBuilder()
        .setCustomId(`page_info_${page}`)
        .setLabel(`${page + 1} / ${totalPages}`)
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true);
      
      rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    }
    
    let contentMessage = `✏️ **${category}** 카테고리에서 이름을 수정할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 이름 수정 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
        console.error('❌ 이름 수정 선택 에러 응답 실패:', err);
      });
    }
  }
}


/**
 * 삭제 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageRemovePageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_remove_' : 'page_prev_remove_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자 / 목표: ${targetData[category][item].required}개`
      };
    });
    
    // 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_remove_${type}_${category}`)
      .setPlaceholder('삭제할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_remove_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_remove_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🗑️ **${category}** 카테고리에서 삭제할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 삭제 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 삭제 페이지 이동 에러 응답 실패:', err);
    });
  }
}

/**
 * 수정 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageEditPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_edit_' : 'page_prev_edit_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    const itemOptions = items.map(item => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: item,
        value: item,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`
      };
    });
    
    // 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_edit_${type}_${category}`)
      .setPlaceholder('이름을 수정할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_edit_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_edit_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `✏️ **${category}** 카테고리에서 이름을 수정할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 수정 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 수정 페이지 이동 에러 응답 실패:', err);
    });
  }
}
