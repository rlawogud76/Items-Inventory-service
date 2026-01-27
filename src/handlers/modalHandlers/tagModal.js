// 태그 modal 핸들러
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, updateSettings } from '../../database.js';
import { getItemIcon, getItemTag, getTimeoutSettings, encodeCustomIdPart, decodeCustomIdPart } from '../../utils.js';
import { normalizeTagsData } from '../../services/tagService.js';

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
    const customId = interaction.customId;
    const raw = customId.startsWith('tag_name_input_')
      ? customId.replace('tag_name_input_', '')
      : customId.replace('tag_create_modal_', '');
    const parts = raw.split('_');
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
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
      await updateSettings({ tags: normalized.tags });
    }
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    
    if (normalized.tags?.[type]?.[category]?.[tagName]) {
      return await interaction.reply({
        content: `❌ "${tagName}" 태그가 이미 존재합니다. 태그 편집 메뉴를 사용해주세요.`,
        ephemeral: true
      });
    }
    
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
    
    // Discord 제한: 최대 25개 옵션 - 페이지네이션
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const page = 0; // 첫 페이지
    const startIdx = page * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_items_create_${type}_${category}_${encodeCustomIdPart(tagName)}`)
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
      .setCustomId(`select_tag_color_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setPlaceholder('태그 색상을 선택하세요')
      .addOptions(colorOptions);
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(colorSelectMenu);
    
    const confirmButton = new ButtonBuilder()
      .setCustomId(`tag_items_confirm_create_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setLabel('✅ 선택 완료')
      .setStyle(ButtonStyle.Success);
    
    const clearButton = new ButtonBuilder()
      .setCustomId(`tag_items_clear_create_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setLabel('🧹 선택 초기화')
      .setStyle(ButtonStyle.Secondary);
    
    const row3 = new ActionRowBuilder().addComponents(confirmButton, clearButton);
    const rows = [row2, row1, row3];
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_tag_items_create_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_tag_items_create_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
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
    
    // 페이지네이션 버튼 추가 (2페이지 이상일 때)
    if (totalPages > 1) {
      const prevButton = new ButtonBuilder()
        .setCustomId(`page_prev_tag_items_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 0);
      
      const nextButton = new ButtonBuilder()
        .setCustomId(`page_next_tag_items_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
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
    
    // 세션 초기화
    global.tagSessions = global.tagSessions || {};
    const sessionKey = `${interaction.user.id}_${type}_${category}_${tagName}_create`;
    global.tagSessions[sessionKey] = {
      type,
      category,
      tagName,
      mode: 'create',
      selectedItems: [],
      color: 'default',
      updatedAt: Date.now()
    };
    
    let contentMessage = `🏷️ **태그: ${tagName}**\n\n1️⃣ 태그 색상을 선택하세요\n2️⃣ "${tagName}" 태그에 추가할 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.\n\n✅ 현재 선택: 0개`;
    if (totalPages > 1) {
      contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${itemOptions.length}개 항목)`;
    }
    contentMessage += `\n\n_이 메시지는 30초 후 자동 삭제됩니다_`;
    
    await interaction.reply({
      content: contentMessage,
      components: rows, // 색상 선택을 먼저
      ephemeral: true
    });
    
    // 설정된 시간 후 자동 삭제
    const { selectTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 태그 이름 입력 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 검색 모달 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagSearchModal(interaction) {
  try {
    const parts = interaction.customId.replace('tag_search_modal_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    const query = interaction.fields.getTextInputValue('tag_query').trim();
    
    if (!query) {
      return await interaction.reply({
        content: '❌ 검색어를 입력해주세요.',
        ephemeral: true
      });
    }
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
      await updateSettings({ tags: normalized.tags });
    }
    
    const tags = normalized.tags?.[type]?.[category] || {};
    const results = Object.entries(tags)
      .map(([tagName, tagData]) => {
        const items = tagData.items || [];
        const matchedItems = items.filter(item => item.toLowerCase().includes(query.toLowerCase()));
        const matchesTag = tagName.toLowerCase().includes(query.toLowerCase());
        return { tagName, matchedItems, totalItems: items.length, matchesTag, color: tagData.color || 'default' };
      })
      .filter(r => r.matchesTag || r.matchedItems.length > 0);
    
    if (results.length === 0) {
      return await interaction.reply({
        content: `❌ "${query}"에 해당하는 태그/항목을 찾을 수 없습니다.`,
        ephemeral: true
      });
    }
    
    const colorEmoji = {
      'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
      'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
    };
    
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`🔎 태그 검색 결과 - ${category}`)
      .setDescription(`검색어: **${query}**`);
    
    results.slice(0, 10).forEach(result => {
      const emoji = colorEmoji[result.color] || '🏷️';
      const matched = result.matchedItems.slice(0, 5).map(item => `• ${item}`).join('\n');
      embed.addFields({
        name: `${emoji} ${result.tagName} (${result.totalItems}개)` ,
        value: matched || '태그명 일치',
        inline: false
      });
    });
    
    if (results.length > 10) {
      embed.setFooter({ text: `외 ${results.length - 10}개 결과가 더 있습니다.` });
    }
    
    const { infoTimeout } = getTimeoutSettings(inventory);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
  } catch (error) {
    console.error('❌ 태그 검색 모달 에러:', error);
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
    const itemName = decodeCustomIdPart(parts.slice(2).join('_'));
    
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
    
    // DB 저장 (새 스키마)
    await updateSettings({ tags: inventory.tags });
    
    const icon = getItemIcon(itemName, inventory);
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 태그 설정 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `${icon} **${itemName}**`,
        `🏷️ **태그:** ${tagName}`,
        oldTag ? `\n🔄 기존 태그 "${oldTag}"에서 이동됨` : '',
        ``,
        `_이 메시지는 15초 후 자동 삭제됩니다_`
      ].filter(Boolean).join('\n'));
    
    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 태그 이름 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
