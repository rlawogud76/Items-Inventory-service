// 태그 select 핸들러
import { EmbedBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { getItemIcon, getItemTag } from '../../utils.js';

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
    
    await saveInventory(inventory);
    
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
      content: '✅ 태그 설정이 완료되었습니다!',
      embeds: [successEmbed], 
      components: [] 
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
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
    
    await saveInventory(inventory);
    
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
      content: '✅ 태그가 제거되었습니다!',
      embeds: [successEmbed], 
      components: [] 
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
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
    
    await saveInventory(inventory);
    
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
      content: `✅ **"${tagName}" 태그 색상 변경 완료!**\n\n새로운 색상: ${colorName}\n\n이제 해당 태그의 모든 아이템이 새로운 색상으로 표시됩니다.`,
      components: []
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
  } catch (error) {
    console.error('❌ 태그 색상 변경 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}