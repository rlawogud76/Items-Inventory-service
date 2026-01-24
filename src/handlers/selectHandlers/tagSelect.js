// 태그 select 핸들러
import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { loadInventory, updateSettings, updateItemDetails, addItem } from '../../database.js';
import { getItemIcon, getItemTag, getLinkedItem, getTimeoutSettings } from '../../utils.js';

/**
 * 태그 항목 선택 핸들러 (태그에 추가할 항목들)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagItemsSelect(interaction) {
  try {
    // 먼저 응답 지연 처리
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('select_tag_items_', '').split('_');
    const tagName = parts[parts.length - 1];
    const type = parts[0];
    const category = parts.slice(1, -1).join('_');
    
    const selectedItems = interaction.values;
    
    if (!selectedItems || selectedItems.length === 0) {
      return await interaction.editReply({ 
        content: '❌ 항목을 선택해주세요.', 
        components: []
      });
    }
    
    const inventory = await loadInventory();
    
    // 태그 구조 초기화
    if (!inventory.tags) inventory.tags = { inventory: {}, crafting: {} };
    if (!inventory.tags[type]) inventory.tags[type] = {};
    if (!inventory.tags[type][category]) inventory.tags[type][category] = {};
    
    // 선택된 항목들을 태그에 추가
    const selectedColor = global.tempTagColors?.[`${type}_${category}_${tagName}`] || 'default';
    
    if (!inventory.tags[type][category][tagName]) {
      inventory.tags[type][category][tagName] = {
        items: [],
        color: selectedColor
      };
    } else if (Array.isArray(inventory.tags[type][category][tagName])) {
      // 기존 배열 형식을 객체 형식으로 변환
      inventory.tags[type][category][tagName] = {
        items: inventory.tags[type][category][tagName],
        color: selectedColor
      };
    }
    
    let addedCount = 0;
    let movedCount = 0;
    
    for (const itemName of selectedItems) {
      // 기존 태그에서 제거
      const oldTag = getItemTag(itemName, category, type, inventory);
      if (oldTag && oldTag !== tagName && inventory.tags[type][category][oldTag]) {
        const oldTagData = inventory.tags[type][category][oldTag];
        if (Array.isArray(oldTagData)) {
          inventory.tags[type][category][oldTag] = oldTagData.filter(item => item !== itemName);
          if (inventory.tags[type][category][oldTag].length === 0) {
            delete inventory.tags[type][category][oldTag];
          }
        } else if (oldTagData.items) {
          oldTagData.items = oldTagData.items.filter(item => item !== itemName);
          if (oldTagData.items.length === 0) {
            delete inventory.tags[type][category][oldTag];
          }
        }
        movedCount++;
      }
      
      // 새 태그에 추가 (중복 방지)
      if (!inventory.tags[type][category][tagName].items.includes(itemName)) {
        inventory.tags[type][category][tagName].items.push(itemName);
        addedCount++;
      }
    }
    
    // 임시 색상 정보 삭제
    if (global.tempTagColors) {
      delete global.tempTagColors[`${type}_${category}_${tagName}`];
    }
    
    // DB 저장 (새 스키마)
    await updateSettings({ tags: inventory.tags });
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 태그 설정 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `🏷️ **태그:** ${tagName}`,
        ``,
        `📦 **추가된 항목:** ${addedCount}개`,
        movedCount > 0 ? `🔄 **이동된 항목:** ${movedCount}개 (기존 태그에서 제거됨)` : '',
        ``,
        `**항목 목록:**`,
        selectedItems.map(item => `• ${getItemIcon(item, inventory)} ${item}`).join('\n')
      ].filter(Boolean).join('\n'));
    
    await interaction.editReply({ 
      content: '✅ 태그 설정이 완료되었습니다!\n\n_이 메시지는 15초 후 자동 삭제됩니다_',
      embeds: [successEmbed], 
      components: [] 
    });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 태그 항목 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 태그 항목 선택 에러 응답 실패:', err);
    });
  }
}

/**
 * 태그 제거 확인 select 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleConfirmTagRemoveSelect(interaction) {
  try {
    // 먼저 응답 지연 처리
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('confirm_tag_remove_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    
    const tagName = interaction.values[0];
    
    const inventory = await loadInventory();
    
    if (!inventory.tags?.[type]?.[category]?.[tagName]) {
      return await interaction.editReply({ 
        content: `❌ 태그 "${tagName}"을 찾을 수 없습니다.`,
        components: []
      });
    }
    
    const tagData = inventory.tags[type][category][tagName];
    const itemCount = Array.isArray(tagData) ? tagData.length : tagData.items?.length || 0;
    
    // 태그 제거
    delete inventory.tags[type][category][tagName];
    
    await updateSettings({ tags: inventory.tags });
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 태그 제거 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `🏷️ **제거된 태그:** ${tagName}`,
        `📦 **영향받은 항목:** ${itemCount}개`,
        ``,
        `⚠️ 항목은 유지되며, 태그만 제거되었습니다.`
      ].join('\n'));
    
    await interaction.editReply({ 
      content: '✅ 태그가 제거되었습니다!\n\n_이 메시지는 15초 후 자동 삭제됩니다_',
      embeds: [successEmbed], 
      components: [] 
    });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 태그 제거 확인 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 태그 제거 확인 에러 응답 실패:', err);
    });
  }
}


/**
 * 태그 항목 선택 핸들러 (개별 항목에 태그 설정)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagItemSelect(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[3];
    const category = parts.slice(4).join('_');
    const selectedItem = interaction.values[0];
    
    // 태그 이름 입력 모달
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = await import('discord.js');
    
    const modal = new ModalBuilder()
      .setCustomId(`tag_name_modal_${type}_${category}_${selectedItem}`)
      .setTitle(`🏷️ 태그 설정: ${selectedItem}`);
    
    const inventory = await loadInventory();
    const currentTag = getItemTag(selectedItem, category, type, inventory);
    
    const tagInput = new TextInputBuilder()
      .setCustomId('tag_name')
      .setLabel('태그 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 산호, 광석, 블럭')
      .setValue(currentTag || '')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(tagInput));
    
    await interaction.showModal(modal);
    
    // 모달 표시 후 원래 메시지는 유지 (모달 제출 후 삭제됨)
    
  } catch (error) {
    console.error('❌ 태그 아이템 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 태그 아이템 선택 에러 응답 실패:', err);
    });
  }
}
/**
 * 태그 색상 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagColorSelect(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('select_tag_color_', '').split('_');
    const tagName = parts[parts.length - 1];
    const type = parts[0];
    const category = parts.slice(1, -1).join('_');
    
    const selectedColor = interaction.values[0];
    
    // 색상 정보 저장 (임시로 interaction에 저장)
    const colorInfo = {
      type,
      category, 
      tagName,
      color: selectedColor
    };
    
    // 색상 선택 완료 메시지 업데이트
    const COLOR_NAMES = {
      'default': '기본',
      'red': '빨강 🔴',
      'green': '초록 🟢', 
      'blue': '파랑 🔵',
      'yellow': '노랑 🟡',
      'purple': '보라 🟣',
      'cyan': '청록 🔵',
      'white': '흰색 ⚪'
    };
    
    const colorName = COLOR_NAMES[selectedColor] || selectedColor;
    
    await interaction.editReply({
      content: `🏷️ **태그: ${tagName}** (색상: ${colorName})\n\n✅ 색상이 선택되었습니다!\n이제 "${tagName}" 태그에 추가할 항목을 선택하세요.\n💡 여러 개를 한 번에 선택할 수 있습니다.`,
      components: interaction.message.components.slice(1) // 색상 선택 메뉴 제거, 아이템 선택 메뉴만 유지
    });
    
    // 선택된 색상을 전역 변수나 캐시에 임시 저장
    global.tempTagColors = global.tempTagColors || {};
    global.tempTagColors[`${type}_${category}_${tagName}`] = selectedColor;
    
  } catch (error) {
    console.error('❌ 태그 색상 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 색상 변경할 태그 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagForColorSelect(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('select_tag_for_color_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    const selectedTag = interaction.values[0];
    
    // 색상 선택 메뉴 생성
    const colorOptions = [
      { label: '기본', value: 'default', emoji: '🏷️', description: '기본 색상' },
      { label: '빨강', value: 'red', emoji: '🔴', description: '빨간색' },
      { label: '초록', value: 'green', emoji: '🟢', description: '초록색' },
      { label: '파랑', value: 'blue', emoji: '🔵', description: '파란색' },
      { label: '노랑', value: 'yellow', emoji: '🟡', description: '노란색' },
      { label: '보라', value: 'purple', emoji: '🟣', description: '보라색' },
      { label: '청록', value: 'cyan', emoji: '🔵', description: '청록색' },
      { label: '흰색', value: 'white', emoji: '⚪', description: '흰색' }
    ];
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const colorSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`change_tag_color_${type}_${category}_${selectedTag}`)
      .setPlaceholder('새로운 색상을 선택하세요')
      .addOptions(colorOptions);
    
    const row = new ActionRowBuilder().addComponents(colorSelectMenu);
    
    await interaction.editReply({
      content: `🎨 **"${selectedTag}" 태그 색상 변경**\n\n새로운 색상을 선택하세요:`,
      components: [row]
    });
    
  } catch (error) {
    console.error('❌ 태그 색상 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 색상 변경 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleChangeTagColor(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('change_tag_color_', '').split('_');
    const tagName = parts[parts.length - 1];
    const type = parts[0];
    const category = parts.slice(1, -1).join('_');
    const newColor = interaction.values[0];
    
    const inventory = await loadInventory();
    
    if (!inventory.tags?.[type]?.[category]?.[tagName]) {
      return await interaction.editReply({
        content: `❌ 태그 "${tagName}"을 찾을 수 없습니다.`,
        components: []
      });
    }
    
    // 태그 색상 업데이트
    const tagData = inventory.tags[type][category][tagName];
    if (Array.isArray(tagData)) {
      // 기존 배열 형식을 객체 형식으로 변환
      inventory.tags[type][category][tagName] = {
        items: tagData,
        color: newColor
      };
    } else {
      // 이미 객체 형식
      tagData.color = newColor;
    }
    
    await updateSettings({ tags: inventory.tags });
    
    const colorNames = {
      'default': '기본 🏷️',
      'red': '빨강 🔴',
      'green': '초록 🟢',
      'blue': '파랑 🔵',
      'yellow': '노랑 🟡',
      'purple': '보라 🟣',
      'cyan': '청록 🔵',
      'white': '흰색 ⚪'
    };
    
    const colorName = colorNames[newColor] || newColor;
    
    await interaction.editReply({
      content: `✅ **"${tagName}" 태그 색상 변경 완료!**\n\n새로운 색상: ${colorName}\n\n이제 해당 태그의 모든 아이템이 새로운 색상으로 표시됩니다.\n\n_이 메시지는 15초 후 자동 삭제됩니다_`,
      components: []
    });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 태그 색상 변경 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
/**
 * 물품 유형 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleItemTypeSelect(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('select_item_type_', '').split('_');
    const type = parts[0]; // 'inventory' or 'crafting'
    const initialTotal = parseInt(parts[parts.length - 1]); // 마지막 부분이 초기 수량
    const itemName = parts[parts.length - 2]; // 마지막에서 두번째가 아이템명
    const category = parts.slice(1, -2).join('_'); // 중간 부분이 카테고리
    
    const selectedItemType = interaction.values[0]; // 'material', 'intermediate', 'final'
    
    // 물품 유형에 따른 처리 로직
    let targetType = type; // 기본값
    let showTargetModal = true;
    
    if (selectedItemType === 'material') {
      // 재료 → 재고에만 등록
      targetType = 'inventory';
    } else if (selectedItemType === 'final') {
      // 최종 제작품 → 제작에만 등록
      targetType = 'crafting';
    } else if (selectedItemType === 'intermediate') {
      // 중간 제작품 → 원래 선택한 곳에 등록하고 연동 설정
      targetType = type;
    }
    
    // Step 2로 넘어가는 버튼 생성
    const { ButtonBuilder, ButtonStyle, ActionRowBuilder, EmbedBuilder } = await import('discord.js');
    const continueButton = new ButtonBuilder()
      .setCustomId(`add_item_step2_btn_${targetType}_${category}_${itemName}_${initialTotal}_${selectedItemType}`)
      .setLabel('➡️ 다음: 목표 수량 입력')
      .setStyle(ButtonStyle.Primary);
    
    const row = new ActionRowBuilder().addComponents(continueButton);
    
    const typeNames = {
      'material': '📦 재료',
      'intermediate': '🔄 중간 제작품', 
      'final': '⭐ 최종 제작품'
    };
    
    const typeDescriptions = {
      'material': '재고에만 등록됩니다',
      'intermediate': type === 'inventory' ? '재고에 등록되며, 제작 레시피도 추가할 수 있습니다' : '제작에 등록되며, 재고와 연동됩니다',
      'final': '제작에만 등록됩니다'
    };
    
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`✅ Step 1.5 완료`)
      .setDescription([
        `**아이템:** ${itemName}`,
        `**카테고리:** ${category}`,
        `**유형:** ${typeNames[selectedItemType]}`,
        ``,
        `📋 **처리 방식:** ${typeDescriptions[selectedItemType]}`,
        ``,
        `다음 버튼을 눌러 목표 수량을 입력하세요.`
      ].join('\n'));
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error('❌ 물품 유형 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
/**
 * 유형 변경할 아이템 선택 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTypeChangeSelect(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('select_type_change_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    const selectedItem = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const itemData = targetData[category][selectedItem];
    const currentType = itemData.itemType || (type === 'inventory' ? 'material' : 'final');
    
    // 유형 선택 메뉴 생성
    const { StringSelectMenuBuilder, EmbedBuilder } = await import('discord.js');
    const typeOptions = [
      {
        label: '📦 재료',
        value: 'material',
        description: '채굴/수집하는 기본 재료 (재고에만)',
        emoji: '📦'
      },
      {
        label: '🔄 중간 제작품',
        value: 'intermediate',
        description: '제작하며 재료로도 사용 (재고+제작 연동)',
        emoji: '🔄'
      },
      {
        label: '⭐ 최종 제작품',
        value: 'final',
        description: '최종 완성품 (제작에만)',
        emoji: '⭐'
      }
    ];
    
    const typeSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`confirm_type_change_${type}_${category}_${selectedItem}`)
      .setPlaceholder('새로운 유형을 선택하세요')
      .addOptions(typeOptions);
    
    const row = new ActionRowBuilder().addComponents(typeSelectMenu);
    
    const typeNames = {
      'material': '📦 재료',
      'intermediate': '🔄 중간 제작품',
      'final': '⭐ 최종 제작품'
    };
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🔄 물품 유형 변경`)
      .setDescription([
        `**아이템:** ${selectedItem}`,
        `**카테고리:** ${category}`,
        `**현재 유형:** ${typeNames[currentType] || '미설정'}`,
        ``,
        `새로운 유형을 선택하세요:`,
        ``,
        `📦 **재료** - 기본 재료만`,
        `🔄 **중간 제작품** - 제작하며 재료로도 사용 (자동 연동)`,
        `⭐ **최종 제작품** - 완성품만`
      ].join('\n'));
    
    await interaction.editReply({ embeds: [embed], components: [row] });
    
  } catch (error) {
    console.error('❌ 유형 변경 선택 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 유형 변경 확인 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleConfirmTypeChange(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('confirm_type_change_', '').split('_');
    const itemName = parts[parts.length - 1];
    const type = parts[0];
    const category = parts.slice(1, -1).join('_');
    const newType = interaction.values[0];
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const itemData = targetData[category][itemName];
    const oldType = itemData.itemType || (type === 'inventory' ? 'material' : 'final');
    
    if (oldType === newType) {
      return await interaction.editReply({
        content: `ℹ️ "${itemName}"의 유형이 이미 ${newType}입니다.`,
        embeds: [],
        components: []
      });
    }
    
    // 유형 변경
    const updates = { itemType: newType };
    
    // 중간 제작품으로 변경 시 연동 설정
    if (newType === 'intermediate') {
      if (type === 'inventory') {
        // 재고 → 제작 연동 생성
        try {
          await addItem({
            name: itemName,
            category: category,
            type: 'crafting',
            itemType: 'intermediate',
            quantity: itemData.quantity,
            required: itemData.required,
            linkedItem: `inventory/${category}/${itemName}`,
            emoji: itemData.emoji
          });
        } catch (e) {
          console.warn('Linked item creation failed (may exist):', e.message);
        }
        updates.linkedItem = `crafting/${category}/${itemName}`;
      } else {
        // 제작 → 재고 연동 생성
        try {
          await addItem({
            name: itemName,
            category: category,
            type: 'inventory',
            itemType: 'intermediate',
            quantity: itemData.quantity,
            required: itemData.required,
            linkedItem: `crafting/${category}/${itemName}`,
            emoji: itemData.emoji
          });
        } catch (e) {
          console.warn('Linked item creation failed (may exist):', e.message);
        }
        updates.linkedItem = `inventory/${category}/${itemName}`;
      }
    } else {
      // 중간 제작품이 아니면 연동 해제
      if (itemData.linkedItem) {
        const parts = itemData.linkedItem.split('/');
        if (parts.length === 3) {
          const [lType, lCategory, lName] = parts;
          // 연동된 아이템의 링크 해제
          try {
            await updateItemDetails(lType, lCategory, lName, { linkedItem: null });
          } catch (e) {
            console.warn('Unlinking failed:', e.message);
          }
        }
      }
      updates.linkedItem = null;
    }
    
    // DB 저장 (새 스키마)
    await updateItemDetails(type, category, itemName, updates);
    
    const typeNames = {
      'material': '📦 재료',
      'intermediate': '🔄 중간 제작품',
      'final': '⭐ 최종 제작품'
    };
    
    const { EmbedBuilder } = await import('discord.js');
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 유형 변경 완료')
      .setDescription([
        `**아이템:** ${itemName}`,
        `**카테고리:** ${category}`,
        ``,
        `${typeNames[oldType]} → ${typeNames[newType]}`,
        ``,
        newType === 'intermediate' ? '🔗 자동 연동이 설정되었습니다!' : oldType === 'intermediate' ? '🔓 연동이 해제되었습니다.' : '',
        ``,
        `_이 메시지는 15초 후 자동 삭제됩니다_`
      ].filter(Boolean).join('\n'));
    
    await interaction.editReply({ embeds: [successEmbed], components: [] });
    
    // 설정된 시간 후 자동 삭제
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 유형 변경 확인 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
