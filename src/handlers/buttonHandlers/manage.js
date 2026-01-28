// 물품/품목 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, updateItemsOrder } from '../../database.js';
import { formatQuantity, getItemIcon, getTimeoutSettings, addHistory, safeDeleteReply, safeErrorReply, encodeCustomIdPart, decodeCustomIdPart, getDisplayName } from '../../utils.js';

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
    
    const typeButton = new ButtonBuilder()
      .setCustomId(`manage_type_${type}_${category}`)
      .setLabel('🔄 유형 변경')
      .setStyle(ButtonStyle.Primary);
    
    const tagButton = new ButtonBuilder()
      .setCustomId(`manage_tag_${type}_${category}`)
      .setLabel('🏷️ 태그 관리')
      .setStyle(ButtonStyle.Primary);
    
    const removeButton = new ButtonBuilder()
      .setCustomId(`manage_remove_${type}_${category}`)
      .setLabel(type === 'inventory' ? '➖ 물품 삭제' : '➖ 품목 삭제')
      .setStyle(ButtonStyle.Danger);
    
    const reorderButton = new ButtonBuilder()
      .setCustomId(`manage_reorder_${type}_${category}`)
      .setLabel('🔀 순서 변경')
      .setStyle(ButtonStyle.Secondary);
    
    const row1 = new ActionRowBuilder().addComponents(addButton, editButton, removeButton);
    const row2 = new ActionRowBuilder().addComponents(typeButton, tagButton, reorderButton);
    
    // 타이머 설정 가져오기
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    await interaction.reply({
      content: `📝 **${category}** 카테고리 ${type === 'inventory' ? '물품' : '품목'} 관리\n\n원하는 작업을 선택하세요:\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`,
      components: [row1, row2],
      ephemeral: true
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
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
    
    // 1단계 모달: 이름과 초기 수량
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_step1_${type}_${category}`)
      .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 (1/2) - ${category}`);
    
    const nameInput = new TextInputBuilder()
      .setCustomId('item_name')
      .setLabel(type === 'inventory' ? '아이템 이름' : '제작품 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 다이아몬드')
      .setRequired(true);
    
    const initialBoxesInput = new TextInputBuilder()
      .setCustomId('initial_boxes')
      .setLabel('초기 수량 - 상자 (1상자 = 54세트 = 3456개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    const initialSetsInput = new TextInputBuilder()
      .setCustomId('initial_sets')
      .setLabel('초기 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    const initialItemsInput = new TextInputBuilder()
      .setCustomId('initial_items')
      .setLabel('초기 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(initialBoxesInput),
      new ActionRowBuilder().addComponents(initialSetsInput),
      new ActionRowBuilder().addComponents(initialItemsInput)
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
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
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
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
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
 * Step 2 버튼 핸들러 - 목표 수량 입력 모달 표시
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemStep2Button(interaction) {
  try {
    // add_item_step2_btn_inventory_해양_산호_1234_material 형식
    const parts = interaction.customId.split('_');
    const itemType = parts[parts.length - 1]; // 마지막이 물품 유형 (material/intermediate/final)
    const initialTotal = parts[parts.length - 2]; // 마지막에서 두번째가 초기 수량
    const itemName = decodeCustomIdPart(parts[parts.length - 3]); // 마지막에서 세번째가 아이템명
    const type = parts[4]; // 'inventory' or 'crafting'
    const category = parts.slice(5, -3).join('_'); // 중간이 카테고리
    
    // Step 2 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_step2_${type}_${category}_${encodeCustomIdPart(itemName)}_${initialTotal}_${itemType}`)
      .setTitle(`➕ ${type === 'inventory' ? '물품' : '품목'} 추가 (2/2) - ${category}`);
    
    const requiredBoxesInput = new TextInputBuilder()
      .setCustomId('required_boxes')
      .setLabel('목표 수량 - 상자 (1상자 = 54세트 = 3456개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    const requiredSetsInput = new TextInputBuilder()
      .setCustomId('required_sets')
      .setLabel('목표 수량 - 세트 (1세트 = 64개)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    const requiredItemsInput = new TextInputBuilder()
      .setCustomId('required_items')
      .setLabel('목표 수량 - 낱개')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 0')
      .setRequired(false);
    
    modal.addComponents(
      new ActionRowBuilder().addComponents(requiredBoxesInput),
      new ActionRowBuilder().addComponents(requiredSetsInput),
      new ActionRowBuilder().addComponents(requiredItemsInput)
    );
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ Step 2 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ Step 2 버튼 에러 응답 실패:', err);
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
/**
 * 물품 유형 선택 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleAddItemTypeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[4]; // 'inventory' or 'crafting'
    const initialTotal = parseInt(parts[parts.length - 1]); // 마지막 부분이 초기 수량
    const itemName = decodeCustomIdPart(parts[parts.length - 2]); // 마지막에서 두번째가 아이템명 (인코딩 해제)
    const category = parts.slice(5, -2).join('_'); // 중간 부분이 카테고리
    
    // 물품 유형 선택 메뉴 생성
    const { StringSelectMenuBuilder } = await import('discord.js');
    const itemTypeSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_item_type_${type}_${category}_${encodeCustomIdPart(itemName)}_${initialTotal}`)
      .setPlaceholder('물품 유형을 선택하세요')
      .addOptions([
        {
          label: '📦 재료',
          value: 'material',
          description: '채굴/수집하는 기본 재료 (재고에만 등록)',
          emoji: '📦'
        },
        {
          label: '🔄 중간 제작품',
          value: 'intermediate', 
          description: '제작하며, 다른 제작의 재료로도 사용 (재고+제작 연동)',
          emoji: '🔄'
        },
        {
          label: '⭐ 최종 제작품',
          value: 'final',
          description: '최종 완성품, 재료로 사용 안함 (제작에만 등록)',
          emoji: '⭐'
        }
      ]);
    
    const row = new ActionRowBuilder().addComponents(itemTypeSelect);
    
    const { EmbedBuilder } = await import('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🔄 Step 1.5: 물품 유형 선택`)
      .setDescription([
        `**아이템:** ${itemName}`,
        `**카테고리:** ${category}`,
        ``,
        `물품의 용도에 따라 유형을 선택하세요:`,
        ``,
        `📦 **재료** - 기본 재료 (철광석, 나무 등)`,
        `🔄 **중간 제작품** - 제작하면서 재료로도 사용 (철괴, 판자 등)`,
        `⭐ **최종 제작품** - 완성품 (검, 갑옷, 음식 등)`
      ].join('\n'));
    
    await interaction.update({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error('❌ 물품 유형 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
/**
 * 물품 유형 변경 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageTypeButton(interaction) {
  try {
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
      const itemData = targetData[category][item];
      const currentType = itemData.itemType || (type === 'inventory' ? 'material' : 'final');
      const typeEmoji = {
        'material': '📦',
        'intermediate': '🔄',
        'final': '⭐'
      }[currentType] || '❓';
      
      const typeName = {
        'material': '재료',
        'intermediate': '중간제작품',
        'final': '최종제작품'
      }[currentType] || '미설정';
      
      return {
        label: item,
        value: item,
        description: `현재: ${typeName}`,
        emoji: typeEmoji
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
      .setCustomId(`select_type_change_${type}_${category}`)
      .setPlaceholder('유형을 변경할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_type_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_type_${type}_${category}_${page}`)
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
    
    let contentMessage = `🔄 **${category}** 카테고리에서 유형을 변경할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:\n\n📦 재료 | 🔄 중간제작품 | ⭐ 최종제작품`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 유형 변경 선택 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 유형 변경 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageTypePageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_type_' : 'page_prev_type_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    const itemOptions = items.map(item => {
      const itemData = targetData[category][item];
      const currentType = itemData.itemType || (type === 'inventory' ? 'material' : 'final');
      const typeEmoji = {
        'material': '📦',
        'intermediate': '🔄',
        'final': '⭐'
      }[currentType] || '❓';
      
      const typeName = {
        'material': '재료',
        'intermediate': '중간제작품',
        'final': '최종제작품'
      }[currentType] || '미설정';
      
      return {
        label: item,
        value: item,
        description: `현재: ${typeName}`,
        emoji: typeEmoji
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
      .setCustomId(`select_type_change_${type}_${category}`)
      .setPlaceholder('유형을 변경할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_type_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_type_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🔄 **${category}** 카테고리에서 유형을 변경할 ${type === 'inventory' ? '물품' : '품목'}을 선택하세요:\n\n📦 재료 | 🔄 중간제작품 | ⭐ 최종제작품`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 유형 변경 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch((err) => {
      console.error('❌ 유형 변경 페이지 이동 에러 응답 실패:', err);
    });
  }
}

/**
 * 순서 변경 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageReorderButton(interaction) {
  try {
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    console.log(`🔀 순서 관리 시작: ${type}/${category}`);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const { infoTimeout, selectTimeout } = getTimeoutSettings(inventory);
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.reply({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    const items = Object.keys(targetData[category]);
    
    if (items.length < 2) {
      return await interaction.reply({
        content: `❌ 순서를 변경하려면 최소 2개 이상의 항목이 필요합니다.\n\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`,
        ephemeral: true
      }).then(() => {
        setTimeout(async () => {
          try {
            await interaction.deleteReply();
          } catch (error) {}
        }, infoTimeout);
      });
    }
    
    // 방법 선택 버튼
    const moveButton = new ButtonBuilder()
      .setCustomId(`reorder_move_${type}_${category}`)
      .setLabel('↕️ 위/아래 이동')
      .setStyle(ButtonStyle.Primary);
    
    const sortButton = new ButtonBuilder()
      .setCustomId(`reorder_sort_${type}_${category}`)
      .setLabel('🔤 자동 정렬')
      .setStyle(ButtonStyle.Success);
    
    const tagGroupButton = new ButtonBuilder()
      .setCustomId(`reorder_tag_${type}_${category}`)
      .setLabel('🏷️ 태그 묶음 이동')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder().addComponents(moveButton, sortButton, tagGroupButton);
    
    // 현재 순서 표시
    let contentMessage = `🔀 **${category}** 카테고리 순서 관리\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 15).forEach((item, idx) => {
      contentMessage += `${idx + 1}. ${item}\n`;
    });
    if (items.length > 15) {
      contentMessage += `... 외 ${items.length - 15}개\n`;
    }
    contentMessage += `\n**방법을 선택하세요:**\n`;
    contentMessage += `↕️ **위/아래 이동** - 항목을 선택해서 위/아래로 이동\n`;
    contentMessage += `🔤 **자동 정렬** - 이름순, 수량순, 목표순 등으로 자동 정렬`;
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.reply({
      content: contentMessage,
      components: [row],
      ephemeral: true
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 순서 관리 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 위/아래 이동 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderMoveButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    // 현재 순서를 번호와 함께 표시
    const itemOptions = items.map((item, index) => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: `${index + 1}. ${item}`,
        value: `${index}`,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`.substring(0, 100)
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0;
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_reorder_move_${type}_${category}`)
      .setPlaceholder('이동할 항목을 선택하세요')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_reorder_move_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_reorder_move_${type}_${category}_${page}`)
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
    
    let contentMessage = `↕️ **${category}** 카테고리 위/아래 이동\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      contentMessage += `${idx + 1}. ${item}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동할 항목을 선택하세요`;
    
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 위/아래 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 자동 정렬 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderSortButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    // 정렬 옵션 선택 메뉴
    const { StringSelectMenuBuilder } = await import('discord.js');
    const sortMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_sort_option_${type}_${category}`)
      .setPlaceholder('정렬 방식을 선택하세요')
      .addOptions([
        {
          label: '🗂️ 카테고리별 (가나다)',
          value: 'category_asc',
          description: '전체 카테고리를 가나다순으로 정렬',
          emoji: '🗂️'
        },
        {
          label: '🗂️ 카테고리별 (역순)',
          value: 'category_desc',
          description: '전체 카테고리를 역순으로 정렬',
          emoji: '🗂️'
        },
        {
          label: '🔤 이름순 (가나다)',
          value: 'name_asc',
          description: '이름을 가나다순으로 정렬',
          emoji: '🔤'
        },
        {
          label: '🔡 이름순 (역순)',
          value: 'name_desc',
          description: '이름을 역순으로 정렬',
          emoji: '🔡'
        },
        {
          label: '🏷️ 태그별 (가나다)',
          value: 'tag_asc',
          description: '태그별로 묶어서 가나다순 정렬',
          emoji: '🏷️'
        },
        {
          label: '🏷️ 태그별 (역순)',
          value: 'tag_desc',
          description: '태그별로 묶어서 역순 정렬',
          emoji: '🏷️'
        },
        {
          label: '📊 현재 수량순 (많은순)',
          value: 'quantity_desc',
          description: '현재 수량이 많은 순서대로',
          emoji: '📊'
        },
        {
          label: '📉 현재 수량순 (적은순)',
          value: 'quantity_asc',
          description: '현재 수량이 적은 순서대로',
          emoji: '📉'
        },
        {
          label: '🎯 목표 수량순 (많은순)',
          value: 'required_desc',
          description: '목표 수량이 많은 순서대로',
          emoji: '🎯'
        },
        {
          label: '🎲 목표 수량순 (적은순)',
          value: 'required_asc',
          description: '목표 수량이 적은 순서대로',
          emoji: '🎲'
        }
      ]);
    
    const row = new ActionRowBuilder().addComponents(sortMenu);
    
    let contentMessage = `🔤 **${category}** 카테고리 자동 정렬\n\n`;
    contentMessage += `정렬 방식을 선택하면 자동으로 순서가 변경됩니다.\n`;
    contentMessage += `\n**정렬 옵션:**\n`;
    contentMessage += `• 이름순 (가나다/역순)\n`;
    contentMessage += `• 태그별 (같은 태그끼리 묶어서 정렬)\n`;
    contentMessage += `• 현재 수량순 (많은순/적은순)\n`;
    contentMessage += `• 목표 수량순 (많은순/적은순)`;
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: contentMessage,
      components: [row]
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 자동 정렬 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 순서 변경 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageReorderPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_reorder_' : 'page_prev_reorder_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    
    const itemOptions = items.map((item, index) => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      return {
        label: `${index + 1}. ${item}`,
        value: `${index}`,
        description: `현재: ${formatted.items}개/${formatted.sets}세트/${formatted.boxes}상자`.substring(0, 100)
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
      .setCustomId(`select_reorder_first_${type}_${category}`)
      .setPlaceholder('이동할 항목을 선택하세요 (1단계)')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_reorder_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_reorder_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🔀 **${category}** 카테고리 순서 변경\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      contentMessage += `${idx + 1}. ${item}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동할 항목을 선택하세요 (1/2 단계)`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 순서 변경 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 순서 변경 두 번째 단계 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageReorderSecondPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_reorder_second_' : 'page_prev_reorder_second_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const currentPage = parseInt(parts[parts.length - 1]);
    const firstIndex = parseInt(parts[parts.length - 2]);
    const category = parts.slice(1, -2).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category]) {
      return await interaction.update({
        content: `❌ 카테고리를 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const items = Object.keys(targetData[category]);
    const selectedItem = items[firstIndex];
    
    const itemOptions = items.map((item, index) => {
      const formatted = formatQuantity(targetData[category][item].quantity);
      const isCurrent = index === firstIndex;
      return {
        label: `${index + 1}. ${item}${isCurrent ? ' (현재 위치)' : ''}`,
        value: `${index}`,
        description: isCurrent ? '현재 선택된 항목' : `이 위치로 이동 (${formatted.items}개)`.substring(0, 100)
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
      .setCustomId(`select_reorder_second_${type}_${category}_${firstIndex}`)
      .setPlaceholder('이동할 위치를 선택하세요 (2단계)')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_reorder_second_${type}_${category}_${firstIndex}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_reorder_second_${type}_${category}_${firstIndex}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🔀 **${category}** 카테고리 순서 변경\n\n`;
    contentMessage += `**선택한 항목:** ${firstIndex + 1}. ${selectedItem}\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      const marker = idx === firstIndex ? ' ← 선택됨' : '';
      contentMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동할 위치를 선택하세요 (2/2 단계)`;
    contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages}`;
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 순서 변경 두 번째 단계 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 항목 이동 실행 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleMoveItemButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const direction = parts[2]; // 'top', 'up5', 'up1', 'down1', 'down5', 'bottom'
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4, -1).join('_');
    const currentIndex = parseInt(parts[parts.length - 1]);
    
    const inventory = await loadInventory();
    const { infoTimeout } = getTimeoutSettings(inventory);
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    const selectedItem = items[currentIndex];
    
    // 새로운 인덱스 계산
    let newIndex = currentIndex;
    switch (direction) {
      case 'top':
        newIndex = 0;
        break;
      case 'up5':
        newIndex = Math.max(0, currentIndex - 5);
        break;
      case 'up1':
        newIndex = Math.max(0, currentIndex - 1);
        break;
      case 'down1':
        newIndex = Math.min(items.length - 1, currentIndex + 1);
        break;
      case 'down5':
        newIndex = Math.min(items.length - 1, currentIndex + 5);
        break;
      case 'bottom':
        newIndex = items.length - 1;
        break;
    }
    
    // 순서 변경
    items.splice(currentIndex, 1);
    items.splice(newIndex, 0, selectedItem);
    
    // 데이터베이스 업데이트 - 새로운 순서로 모든 아이템 업데이트
    const itemsToUpdate = items.map((itemName, index) => ({
      name: itemName,
      order: index
    })); 
    
    await updateItemsOrder(type, category, itemsToUpdate);
    
    // 히스토리 기록
    const directionNames = {
      'top': '맨 위로',
      'up5': '위로 5칸',
      'up1': '위로 1칸',
      'down1': '아래로 1칸',
      'down5': '아래로 5칸',
      'bottom': '맨 아래로'
    };
    await addHistory(type, category, selectedItem, 'reorder', `${directionNames[direction]} (${currentIndex + 1} → ${newIndex + 1})`, getDisplayName(interaction));
    
    // 성공 메시지
    let successMessage = `✅ **${selectedItem}**을(를) **${directionNames[direction]}** 이동했습니다!\n`;
    successMessage += `(${currentIndex + 1}번 → ${newIndex + 1}번)\n\n`;
    successMessage += `**새로운 순서:**\n`;
    items.slice(0, 15).forEach((item, idx) => {
      const marker = idx === newIndex ? ' ← 이동됨' : '';
      successMessage += `${idx + 1}. ${item}${marker}\n`;
    });
    if (items.length > 15) {
      successMessage += `... 외 ${items.length - 15}개\n`;
    }
    successMessage += `\n_이 메시지는 ${infoTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.update({
      content: successMessage,
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
    console.log(`✅ 항목 이동 완료: ${type}/${category}/${selectedItem} - ${directionNames[direction]} (${currentIndex + 1} → ${newIndex + 1})`);
    
  } catch (error) {
    console.error('❌ 항목 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}


/**
 * 지정 위치로 이동 버튼 핸들러 (모달 표시)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleMoveItemPositionButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3]; // 'inventory' or 'crafting'
    const category = parts.slice(4, -1).join('_');
    const currentIndex = parseInt(parts[parts.length - 1]);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData[category]);
    const selectedItem = items[currentIndex];
    
    // 모달 생성
    const modal = new ModalBuilder()
      .setCustomId(`move_position_modal_${type}_${category}_${currentIndex}`)
      .setTitle(`지정 위치로 이동 - ${category}`);
    
    const positionInput = new TextInputBuilder()
      .setCustomId('target_position')
      .setLabel(`이동할 위치 (1-${items.length})`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`현재: ${currentIndex + 1}번`)
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(String(items.length).length);
    
    modal.addComponents(new ActionRowBuilder().addComponents(positionInput));
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ 지정 위치 이동 모달 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 묶음 이동 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderTagButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category] || {};
    const tagNames = Object.keys(tags);
    
    if (tagNames.length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 생성된 태그가 없습니다.\n먼저 태그를 생성하고 항목을 추가해주세요.`,
        components: []
      });
    }

    // 태그 목록 페이지네이션
    await renderReorderTagPage(interaction, type, category, 0);
    
  } catch (error) {
    console.error('❌ 태그 묶음 이동 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 태그 묶음 이동 페이지 렌더링 함수
 * @param {Interaction} interaction
 * @param {string} type
 * @param {string} category
 * @param {number} page
 */
async function renderReorderTagPage(interaction, type, category, page) {
  const inventory = await loadInventory();
  const tags = inventory.tags?.[type]?.[category] || {};
  const tagNames = Object.keys(tags);
  
  // 태그 목록 옵션 생성
  const tagOptions = tagNames.map(tagName => {
    const tagData = tags[tagName];
    const items = Array.isArray(tagData) ? tagData : tagData.items || [];
    const color = Array.isArray(tagData) ? 'default' : tagData.color || 'default';
    const colorEmoji = {
      'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
      'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
    }[color] || '🏷️';
    
    return {
      label: tagName,
      value: tagName,
      description: `색상: ${color} (${items.length}개 항목)`,
      emoji: colorEmoji
    };
  });
  
  const pageSize = 25;
  const totalPages = Math.ceil(tagOptions.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = startIdx + pageSize;
  const limitedOptions = tagOptions.slice(startIdx, endIdx);
  
  const { StringSelectMenuBuilder } = await import('discord.js');
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_reorder_tag_first_${type}_${category}`)
    .setPlaceholder('이동할 태그 묶음을 선택하세요')
    .addOptions(limitedOptions);
  
  const rows = [new ActionRowBuilder().addComponents(selectMenu)];
  
  // 페이지네이션 버튼
  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_reorder_tag_${type}_${category}_${page}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_reorder_tag_${type}_${category}_${page}`)
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
  
  let contentMessage = `🏷️ **태그 묶음 이동**\n\n이동할 태그를 선택하세요.\n선택한 태그에 포함된 모든 항목이 함께 이동합니다.`;
  if (totalPages > 1) {
    contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${tagOptions.length}개 태그)`;
  }
  
  const { selectTimeout } = getTimeoutSettings(inventory);
  contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;

  if (interaction.replied || interaction.deferred) {
    await interaction.editReply({
      content: contentMessage,
      components: rows
    });
  } else {
    await interaction.update({
      content: contentMessage,
      components: rows
    });
  }
}

/**
 * 태그 묶음 이동 페이지 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleReorderTagPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_reorder_tag_' : 'page_prev_reorder_tag_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    await renderReorderTagPage(interaction, type, category, newPage);
    
  } catch (error) {
    console.error('❌ 태그 묶음 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
