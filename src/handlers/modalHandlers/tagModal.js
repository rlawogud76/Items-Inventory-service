// 태그 modal 핸들러
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database.js';
import { getItemIcon, getItemTag } from '../../utils.js';

// 색상 옵션 정의
const COLOR_OPTIONS = {
  'default': { name: '기본', ansi: '', description: '기본 색상' },
  'red': { name: '빨강', ansi: '[2;31m', description: '빨간색 텍스트' },
  'green': { name: '초록', ansi: '[2;32m', description: '초록색 텍스트' },
  'blue': { name: '파랑', ansi: '[2;34m', description: '파란색 텍스트' },
  'yellow': { name: '노랑', ansi: '[2;33m', description: '노란색 텍스트' },
  'purple': { name: '보라', ansi: '[2;35m', description: '보라색 텍스트' },
  'cyan': { name: '청록', ansi: '[2;36m', description: '청록색 텍스트' },
  'white': { name: '흰색', ansi: '[2;37m', description: '흰색 텍스트' }
};

/**
 * 태그 이름 입력 modal 핸들러 (태그 생성)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagNameInputModal(interaction) {
  try {
    const parts = interaction.customId.replace('tag_name_input_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    
    const tagName = interaction.fields.getTextInputValue('tag_name').trim();
    
    if (!tagName) {
      return await interaction.reply({ 
        content: '❌ 태그 이름을 입력해주세요.', 
        ephemeral: true 
      });
    }
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.reply({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        ephemeral: true
      });
    }
    
    const items = Object.keys(targetData[category]);
    const itemOptions = items.map(item => {
      const currentTag = getItemTag(item, category, type, inventory);
      const icon = getItemIcon(item, inventory);
      return {
        label: item,
        value: item,
        emoji: icon,
        description: currentTag ? `현재: ${currentTag}` : '태그 없음'
      };
    });
    
    // Discord 제한: 최대 25개 옵션
    const limitedOptions = itemOptions.slice(0, 25);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_items_${type}_${category}_${tagName}`)
      .setPlaceholder(`"${tagName}" 태그에 추가할 항목을 선택하세요 (여러 개 가능)`)
      .setMinValues(1)
      .setMaxValues(Math.min(limitedOptions.length, 25))
      .addOptions(limitedOptions);
    
    // 색상 선택 메뉴 추가
    const colorOptions = Object.entries(COLOR_OPTIONS).map(([key, value]) => ({
      label: value.name,
      value: key,
      description: value.description,
      emoji: key === 'red' ? '🔴' : key === 'green' ? '🟢' : key === 'blue' ? '🔵' : 
             key === 'yellow' ? '🟡' : key === 'purple' ? '🟣' : key === 'cyan' ? '🔵' : 
             key === 'white' ? '⚪' : '⚫'
    }));
    
    const colorSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_color_${type}_${category}_${tagName}`)
      .setPlaceholder('태그 색상을 선택하세요')
      .addOptions(colorOptions);
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(colorSelectMenu);
    
    let contentMessage = `🏷️ **태그: ${tagName}**\n\n1️⃣ 태그 색상을 선택하세요\n2️⃣ "${tagName}" 태그에 추가할 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
    
    await interaction.reply({
      content: contentMessage,
      components: [row2, row1], // 색상 선택을 먼저
      ephemeral: true
    });
    
    // 30초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 30000);
    
  } catch (error) {
    console.error('❌ 태그 이름 입력 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 이름 modal 핸들러 (개별 항목 태그 설정)
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagNameModal(interaction) {
  try {
    const parts = interaction.customId.replace('tag_name_modal_', '').split('_');
    const type = parts[0];
    const category = parts[1];
    const itemName = parts.slice(2).join('_');
    
    const tagName = interaction.fields.getTextInputValue('tag_name').trim();
    
    if (!tagName) {
      return await interaction.reply({ 
        content: '❌ 태그 이름을 입력해주세요.', 
        ephemeral: true 
      });
    }
    
    const inventory = await loadInventory();
    
    // 태그 구조 초기화
    if (!inventory.tags) inventory.tags = { inventory: {}, crafting: {} };
    if (!inventory.tags[type]) inventory.tags[type] = {};
    if (!inventory.tags[type][category]) inventory.tags[type][category] = {};
    
    // 기존 태그에서 제거
    const oldTag = getItemTag(itemName, category, type, inventory);
    if (oldTag && inventory.tags[type][category][oldTag]) {
      const oldTagData = inventory.tags[type][category][oldTag];
      if (Array.isArray(oldTagData)) {
        // 기존 형식 (배열)
        inventory.tags[type][category][oldTag] = oldTagData.filter(item => item !== itemName);
        if (inventory.tags[type][category][oldTag].length === 0) {
          delete inventory.tags[type][category][oldTag];
        }
      } else if (oldTagData.items) {
        // 새 형식 (객체)
        oldTagData.items = oldTagData.items.filter(item => item !== itemName);
        if (oldTagData.items.length === 0) {
          delete inventory.tags[type][category][oldTag];
        }
      }
    }
    
    // 새 태그에 추가
    if (!inventory.tags[type][category][tagName]) {
      inventory.tags[type][category][tagName] = {
        items: [],
        color: 'default'
      };
    } else if (Array.isArray(inventory.tags[type][category][tagName])) {
      // 기존 배열 형식을 객체 형식으로 변환
      inventory.tags[type][category][tagName] = {
        items: inventory.tags[type][category][tagName],
        color: 'default'
      };
    }
    
    if (!inventory.tags[type][category][tagName].items.includes(itemName)) {
      inventory.tags[type][category][tagName].items.push(itemName);
    }
    
    await saveInventory(inventory);
    
    const icon = getItemIcon(itemName, inventory);
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 태그 설정 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `${icon} **${itemName}**`,
        `🏷️ **태그:** ${tagName}`,
        oldTag ? `\n🔄 기존 태그 "${oldTag}"에서 이동됨` : ''
      ].filter(Boolean).join('\n'));
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
  } catch (error) {
    console.error('❌ 태그 이름 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
