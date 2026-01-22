// 태그 select 핸들러
import { EmbedBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
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
    if (!inventory.tags[type][category][tagName]) {
      inventory.tags[type][category][tagName] = [];
    }
    
    let addedCount = 0;
    let movedCount = 0;
    
    for (const itemName of selectedItems) {
      // 기존 태그에서 제거
      const oldTag = getItemTag(itemName, category, type, inventory);
      if (oldTag && oldTag !== tagName && inventory.tags[type][category][oldTag]) {
        inventory.tags[type][category][oldTag] = inventory.tags[type][category][oldTag].filter(item => item !== itemName);
        // 빈 태그 삭제
        if (inventory.tags[type][category][oldTag].length === 0) {
          delete inventory.tags[type][category][oldTag];
        }
        movedCount++;
      }
      
      // 새 태그에 추가 (중복 방지)
      if (!inventory.tags[type][category][tagName].includes(itemName)) {
        inventory.tags[type][category][tagName].push(itemName);
        addedCount++;
      }
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
    
    const itemCount = inventory.tags[type][category][tagName].length;
    
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
