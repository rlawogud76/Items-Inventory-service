// 태그 modal 핸들러
import { EmbedBuilder, ActionRowBuilder } from 'discord.js';
import { loadInventory, saveInventory } from '../../database-old.js';
import { getItemIcon, getItemTag } from '../../utils.js';

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
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_items_${type}_${category}_${tagName}`)
      .setPlaceholder(`"${tagName}" 태그에 추가할 항목을 선택하세요 (여러 개 가능)`)
      .setMinValues(1)
      .setMaxValues(Math.min(limitedOptions.length, 25))
      .addOptions(limitedOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    let contentMessage = `🏷️ **태그: ${tagName}**\n\n"${tagName}" 태그에 추가할 항목을 선택하세요.\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
    
    await interaction.reply({
      content: contentMessage,
      components: [row],
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
      inventory.tags[type][category][oldTag] = inventory.tags[type][category][oldTag].filter(item => item !== itemName);
      // 빈 태그 삭제
      if (inventory.tags[type][category][oldTag].length === 0) {
        delete inventory.tags[type][category][oldTag];
      }
    }
    
    // 새 태그에 추가
    if (!inventory.tags[type][category][tagName]) {
      inventory.tags[type][category][tagName] = [];
    }
    
    if (!inventory.tags[type][category][tagName].includes(itemName)) {
      inventory.tags[type][category][tagName].push(itemName);
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
