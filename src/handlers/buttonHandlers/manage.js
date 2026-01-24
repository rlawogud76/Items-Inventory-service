// 물품/품목 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { formatQuantity, getItemIcon, getTimeoutSettings } from '../../utils.js';

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
    const itemName = parts[parts.length - 3]; // 마지막에서 세번째가 아이템명
    const type = parts[4]; // 'inventory' or 'crafting'
    const category = parts.slice(5, -3).join('_'); // 중간이 카테고리
    
    // Step 2 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`add_item_modal_step2_${type}_${category}_${itemName}_${initialTotal}_${itemType}`)
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
    const itemName = parts[parts.length - 2]; // 마지막에서 두번째가 아이템명
    const category = parts.slice(5, -2).join('_'); // 중간 부분이 카테고리
    
    // 물품 유형 선택 메뉴 생성
    const { StringSelectMenuBuilder } = await import('discord.js');
    const itemTypeSelect = new StringSelectMenuBuilder()
      .setCustomId(`select_item_type_${type}_${category}_${itemName}_${initialTotal}`)
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
    
    console.log(`🔀 순서 변경 시작: ${type}/${category}`);
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const { infoTimeout } = getTimeoutSettings(inventory);
    
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
      .setCustomId(`select_reorder_first_${type}_${category}`)
      .setPlaceholder('이동할 항목을 선택하세요 (1단계)')
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_reorder_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_reorder_${type}_${category}_${page}`)
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
    
    let contentMessage = `🔀 **${category}** 카테고리 순서 변경\n\n`;
    contentMessage += `**현재 순서:**\n`;
    items.slice(0, 10).forEach((item, idx) => {
      contentMessage += `${idx + 1}. ${item}\n`;
    });
    if (items.length > 10) {
      contentMessage += `... 외 ${items.length - 10}개\n`;
    }
    contentMessage += `\n이동할 항목을 선택하세요 (1/2 단계)`;
    
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.reply({
      content: contentMessage,
      components: rows,
      ephemeral: true
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 순서 변경 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
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
