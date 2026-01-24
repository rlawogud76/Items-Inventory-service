// 태그 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { getItemIcon, getTimeoutSettings } from '../../utils.js';

/**
 * 태그 관리 메인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleManageTagButton(interaction) {
  try {
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ 이미 응답한 인터랙션, 무시');
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2]; // 'inventory' or 'crafting'
    const category = parts.slice(3).join('_');
    
    // 태그 관리 옵션 버튼
    const setTagButton = new ButtonBuilder()
      .setCustomId(`tag_set_${type}_${category}`)
      .setLabel('🏷️ 태그 설정')
      .setStyle(ButtonStyle.Primary);
    
    const removeTagButton = new ButtonBuilder()
      .setCustomId(`tag_remove_${type}_${category}`)
      .setLabel('🗑️ 태그 제거')
      .setStyle(ButtonStyle.Secondary);
    
    const colorTagButton = new ButtonBuilder()
      .setCustomId(`tag_color_${type}_${category}`)
      .setLabel('🎨 색상 변경')
      .setStyle(ButtonStyle.Secondary);
    
    const viewTagsButton = new ButtonBuilder()
      .setCustomId(`tag_view_${type}_${category}`)
      .setLabel('👁️ 태그 보기')
      .setStyle(ButtonStyle.Secondary);
    
    const row1 = new ActionRowBuilder().addComponents(setTagButton, removeTagButton);
    const row2 = new ActionRowBuilder().addComponents(colorTagButton, viewTagsButton);
    
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    await interaction.update({
      content: `🏷️ **${category}** 카테고리 태그 관리\n\n태그를 사용하면 관련 물품들을 그룹으로 묶을 수 있습니다.\n예: "산호 블럭", "뇌 산호 블럭" → "산호" 태그\n\n원하는 작업을 선택하세요:\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`,
      components: [row1, row2]
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 태그 관리 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 태그 설정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagSetButton(interaction) {
  try {
    if (interaction.replied || interaction.deferred) {
      return;
    }
    
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (!targetData?.[category] || Object.keys(targetData[category]).length === 0) {
      return await interaction.update({
        content: `❌ "${category}" 카테고리에 ${type === 'inventory' ? '아이템' : '제작품'}이 없습니다.`,
        components: []
      });
    }
    
    // 태그 이름 입력 모달 표시
    const modal = new ModalBuilder()
      .setCustomId(`tag_name_input_${type}_${category}`)
      .setTitle(`🏷️ 태그 생성 - ${category}`);
    
    const tagNameInput = new TextInputBuilder()
      .setCustomId('tag_name')
      .setLabel('태그 이름')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('예: 산호, 광석, 블럭')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(tagNameInput));
    
    await interaction.showModal(modal);
    
  } catch (error) {
    console.error('❌ 태그 설정 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 태그 제거 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagRemoveButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category];
    
    if (!tags || Object.keys(tags).length === 0) {
      return await interaction.update({ 
        content: `❌ "${category}" 카테고리에 태그가 없습니다.`,
        components: []
      });
    }
    
    // 태그 선택 메뉴 생성
    const tagOptions = Object.entries(tags).map(([tagName, tagData]) => {
      const items = Array.isArray(tagData) ? tagData : tagData.items || [];
      return {
        label: tagName,
        value: tagName,
        description: `${items.length}개 항목`,
        emoji: '🏷️'
      };
    });
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`confirm_tag_remove_${type}_${category}`)
      .setPlaceholder('제거할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(tagOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    await interaction.update({
      content: `🗑️ **태그 제거**\n\n제거할 태그를 선택하세요.\n⚠️ 태그만 제거되며, 항목은 유지됩니다.\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`,
      components: [row]
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 태그 제거 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 태그 보기 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagViewButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category] || {};
    
    if (Object.keys(tags).length === 0) {
      return await interaction.update({
        content: `📋 **${category}** 카테고리에 설정된 태그가 없습니다.`,
        components: []
      });
    }
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🏷️ ${category} 카테고리 태그 목록`)
      .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    for (const [tagName, tagData] of Object.entries(tags)) {
      // 새 형식과 기존 형식 모두 지원
      const items = Array.isArray(tagData) ? tagData : tagData.items || [];
      const color = Array.isArray(tagData) ? 'default' : tagData.color || 'default';
      
      const itemList = items.map(item => {
        const icon = getItemIcon(item, inventory);
        return `${icon} ${item}`;
      }).join('\n');
      
      const colorEmoji = {
        'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
        'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
      }[color] || '🏷️';
      
      embed.addFields({
        name: `${colorEmoji} **${tagName}** (${items.length}개)`,
        value: itemList || '없음',
        inline: false
      });
    }
    
    await interaction.update({
      embeds: [embed],
      components: []
    });
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 태그 보기 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}
/**
 * 태그 색상 변경 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagColorButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category];
    
    if (!tags || Object.keys(tags).length === 0) {
      return await interaction.update({ 
        content: `❌ "${category}" 카테고리에 태그가 없습니다.`,
        components: []
      });
    }
    
    // 태그 선택 메뉴 생성
    const tagOptions = Object.entries(tags).map(([tagName, tagData]) => {
      const items = Array.isArray(tagData) ? tagData : tagData.items || [];
      const color = Array.isArray(tagData) ? 'default' : tagData.color || 'default';
      
      const colorEmoji = {
        'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
        'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
      }[color] || '🏷️';
      
      return {
        label: tagName,
        value: tagName,
        description: `현재: ${color} (${items.length}개 항목)`,
        emoji: colorEmoji
      };
    });
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_for_color_${type}_${category}`)
      .setPlaceholder('색상을 변경할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(tagOptions);
    
    const row = new ActionRowBuilder().addComponents(selectMenu);
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    await interaction.update({
      content: `🎨 **태그 색상 변경**\n\n색상을 변경할 태그를 선택하세요.\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`,
      components: [row]
    });
    
    // 설정된 시간 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 태그 색상 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
    }
  }
}