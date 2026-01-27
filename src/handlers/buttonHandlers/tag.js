// 태그 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory } from '../../database.js';
import { getItemIcon, getItemTag, getTimeoutSettings, encodeCustomIdPart, decodeCustomIdPart } from '../../utils.js';

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
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(tagOptions.length / pageSize);
    const page = 0;
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = tagOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`confirm_tag_remove_${type}_${category}`)
      .setPlaceholder('제거할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_tag_remove_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_tag_remove_${type}_${category}_${page}`)
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
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    let contentMessage = `🗑️ **태그 제거**\n\n제거할 태그를 선택하세요.\n⚠️ 태그만 제거되며, 항목은 유지됩니다.`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${tagOptions.length}개 태그)`;
    }
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
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(tagOptions.length / pageSize);
    const page = 0;
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = tagOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_for_color_${type}_${category}`)
      .setPlaceholder('색상을 변경할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_tag_color_${type}_${category}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_tag_color_${type}_${category}_${page}`)
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
    
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    let contentMessage = `🎨 **태그 색상 변경**\n\n색상을 변경할 태그를 선택하세요.`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${tagOptions.length}개 태그)`;
    }
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
    console.error('❌ 태그 색상 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
    }
  }
}

/**
 * 태그 제거 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagRemovePageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_tag_remove_' : 'page_prev_tag_remove_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category] || {};
    
    const tagOptions = Object.entries(tags).map(([tagName, tagData]) => {
      const items = Array.isArray(tagData) ? tagData : tagData.items || [];
      return {
        label: tagName,
        value: tagName,
        description: `${items.length}개 항목`,
        emoji: '🏷️'
      };
    });
    
    const pageSize = 25;
    const totalPages = Math.ceil(tagOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = tagOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`confirm_tag_remove_${type}_${category}`)
      .setPlaceholder('제거할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_remove_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_remove_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🗑️ **태그 제거**\n\n제거할 태그를 선택하세요.\n⚠️ 태그만 제거되며, 항목은 유지됩니다.`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${tagOptions.length}개 태그)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 태그 제거 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 색상 변경 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagColorPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_tag_color_' : 'page_prev_tag_color_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const tags = inventory.tags?.[type]?.[category] || {};
    
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
    
    const pageSize = 25;
    const totalPages = Math.ceil(tagOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = tagOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_for_color_${type}_${category}`)
      .setPlaceholder('색상을 변경할 태그를 선택하세요')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(limitedOptions);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_color_${type}_${category}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_color_${type}_${category}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🎨 **태그 색상 변경**\n\n색상을 변경할 태그를 선택하세요.`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${tagOptions.length}개 태그)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 태그 색상 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 아이템 선택 페이지 이동 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagItemsPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_tag_items_' : 'page_prev_tag_items_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const tagNameEncoded = parts[parts.length - 2];
    const category = parts.slice(1, -2).join('_');
    const tagName = decodeCustomIdPart(tagNameEncoded);
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    const items = Object.keys(targetData?.[category] || {});
    
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
    
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_items_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setPlaceholder(`"${tagName}" 태그에 추가할 항목을 선택하세요 (여러 개 가능)`)
      .setMinValues(1)
      .setMaxValues(Math.min(limitedOptions.length, 25))
      .addOptions(limitedOptions);
    
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
    
    const colorSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_color_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setPlaceholder('태그 색상을 선택하세요')
      .addOptions(colorOptions);
    
    const rows = [
      new ActionRowBuilder().addComponents(colorSelectMenu),
      new ActionRowBuilder().addComponents(selectMenu)
    ];
    
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_items_${type}_${category}_${encodeCustomIdPart(tagName)}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_items_${type}_${category}_${encodeCustomIdPart(tagName)}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🏷️ **태그: ${tagName}**\n\n1️⃣ 태그 색상을 선택하세요\n2️⃣ "${tagName}" 태그에 추가할 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${newPage + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    
    await interaction.update({
      content: contentMessage,
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 태그 아이템 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}