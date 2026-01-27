// 태그 관리 핸들러
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { loadInventory, updateSettings } from '../../database.js';
import { getItemIcon, getItemTag, getTimeoutSettings, encodeCustomIdPart, decodeCustomIdPart } from '../../utils.js';
import { normalizeTagsData, listTags, addItemsToTag, removeItemsFromTag, deleteTag, setTagColor, mergeTags, cleanupEmptyTags } from '../../services/tagService.js';

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
    const createTagButton = new ButtonBuilder()
      .setCustomId(`tag_create_${type}_${category}`)
      .setLabel('🏷️ 태그 생성')
      .setStyle(ButtonStyle.Primary);
    
    const editTagButton = new ButtonBuilder()
      .setCustomId(`tag_edit_${type}_${category}`)
      .setLabel('✏️ 태그 편집')
      .setStyle(ButtonStyle.Secondary);
    
    const deleteTagButton = new ButtonBuilder()
      .setCustomId(`tag_delete_${type}_${category}`)
      .setLabel('🗑️ 태그 삭제')
      .setStyle(ButtonStyle.Secondary);
    
    const colorTagButton = new ButtonBuilder()
      .setCustomId(`tag_color_${type}_${category}`)
      .setLabel('🎨 색상 변경')
      .setStyle(ButtonStyle.Secondary);
    
    const viewTagsButton = new ButtonBuilder()
      .setCustomId(`tag_view_${type}_${category}`)
      .setLabel('👁️ 태그 보기')
      .setStyle(ButtonStyle.Secondary);
    
    const searchTagButton = new ButtonBuilder()
      .setCustomId(`tag_search_${type}_${category}`)
      .setLabel('🔎 태그 검색')
      .setStyle(ButtonStyle.Secondary);
    
    const mergeTagButton = new ButtonBuilder()
      .setCustomId(`tag_merge_${type}_${category}`)
      .setLabel('🔀 태그 병합')
      .setStyle(ButtonStyle.Secondary);
    
    const cleanupTagButton = new ButtonBuilder()
      .setCustomId(`tag_cleanup_${type}_${category}`)
      .setLabel('🧹 빈 태그 정리')
      .setStyle(ButtonStyle.Secondary);
    
    const row1 = new ActionRowBuilder().addComponents(createTagButton, editTagButton, deleteTagButton);
    const row2 = new ActionRowBuilder().addComponents(colorTagButton, viewTagsButton, searchTagButton);
    const row3 = new ActionRowBuilder().addComponents(mergeTagButton, cleanupTagButton);
    
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    await interaction.update({
      content: `🏷️ **${category}** 카테고리 태그 관리\n\n태그를 사용하면 관련 물품들을 그룹으로 묶을 수 있습니다.\n예: "산호 블럭", "뇌 산호 블럭" → "산호" 태그\n\n원하는 작업을 선택하세요:\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`,
      components: [row1, row2, row3]
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
      .setCustomId(`tag_create_modal_${type}_${category}`)
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
    
    await showTagActionSelect(interaction, {
      type,
      category,
      action: 'delete',
      title: '🗑️ 태그 삭제',
      placeholder: '삭제할 태그를 선택하세요'
    });
    
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
    
    await renderTagViewPage(interaction, type, category, 0);
    
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
    
    await showTagActionSelect(interaction, {
      type,
      category,
      action: 'color',
      title: '🎨 태그 색상 변경',
      placeholder: '색상을 변경할 태그를 선택하세요'
    });
    
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
    const hasMode = parts[0] !== 'inventory' && parts[0] !== 'crafting';
    const mode = hasMode ? parts[0] : 'create';
    const type = hasMode ? parts[1] : parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const tagNameEncoded = parts[parts.length - 2];
    const category = hasMode ? parts.slice(2, -2).join('_') : parts.slice(1, -2).join('_');
    const tagName = decodeCustomIdPart(tagNameEncoded);
    
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
      await updateSettings({ tags: normalized.tags });
    }
    
    const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
    let items = Object.keys(targetData?.[category] || {});
    if (mode === 'remove') {
      items = inventory.tags?.[type]?.[category]?.[tagName]?.items || [];
    }
    
    if (items.length === 0) {
      return await interaction.update({
        content: `❌ "${tagName}" 태그에 ${mode === 'remove' ? '제거할 항목' : '추가할 항목'}이 없습니다.`,
        components: []
      });
    }
    
    const itemOptions = items.map(item => {
      const currentTag = getItemTag(item, category, type, inventory);
      const icon = getItemIcon(item, inventory);
      
      // 커스텀 이모지 처리 (ID만 추출)
      const emojiMatch = icon.match(/<a?:.+?:(\d+)>/);
      const emoji = emojiMatch ? emojiMatch[1] : icon;
      
      return {
        label: item,
        value: item,
        emoji: emoji,
        description: mode === 'remove' ? '태그에 포함됨' : (currentTag ? `현재: ${currentTag}` : '태그 없음')
      };
    });
    
    const pageSize = 25;
    const totalPages = Math.ceil(itemOptions.length / pageSize);
    const startIdx = newPage * pageSize;
    const endIdx = startIdx + pageSize;
    const limitedOptions = itemOptions.slice(startIdx, endIdx);
    
    const { StringSelectMenuBuilder } = await import('discord.js');
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`select_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setPlaceholder(`"${tagName}" 태그에 ${mode === 'remove' ? '제거할' : '추가할'} 항목을 선택하세요 (여러 개 가능)`)
      .setMinValues(1)
      .setMaxValues(Math.min(limitedOptions.length, 25))
      .addOptions(limitedOptions);
    
    const confirmButton = new ButtonBuilder()
      .setCustomId(`tag_items_confirm_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setLabel('✅ 선택 완료')
      .setStyle(ButtonStyle.Success);
    
    const clearButton = new ButtonBuilder()
      .setCustomId(`tag_items_clear_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
      .setLabel('🧹 선택 초기화')
      .setStyle(ButtonStyle.Secondary);
    
    const rows = [
      new ActionRowBuilder().addComponents(selectMenu),
      new ActionRowBuilder().addComponents(confirmButton, clearButton)
    ];
    
    if (mode === 'create') {
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
      rows.unshift(new ActionRowBuilder().addComponents(colorSelectMenu));
    }
    
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}_${newPage}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}_${newPage}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(newPage === totalPages - 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${newPage}`)
      .setLabel(`${newPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
    
    let contentMessage = `🏷️ **태그: ${tagName}**\n\n"${tagName}" 태그에 ${mode === 'remove' ? '제거할' : '추가할'} 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
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

/**
 * 태그 항목 선택 확정 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagItemsConfirmButton(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('tag_items_confirm_', '').split('_');
    const hasMode = parts[0] !== 'inventory' && parts[0] !== 'crafting';
    const mode = hasMode ? parts[0] : 'create';
    const type = hasMode ? parts[1] : parts[0];
    const tagName = decodeCustomIdPart(parts[parts.length - 1]);
    const category = hasMode ? parts.slice(2, -1).join('_') : parts.slice(1, -1).join('_');
    
    const sessionKey = `${interaction.user.id}_${type}_${category}_${tagName}_${mode}`;
    const selectedItems = global.tagSessions?.[sessionKey]?.selectedItems || [];
    
    if (!selectedItems || selectedItems.length === 0) {
      return await interaction.editReply({
        content: '❌ 선택된 항목이 없습니다. 항목을 선택한 뒤 다시 시도해주세요.',
        components: []
      });
    }
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
    }
    
    let addedCount = 0;
    let movedCount = 0;
    let removedCount = 0;
    
    if (mode === 'remove') {
      const result = removeItemsFromTag(inventory.tags, type, category, tagName, selectedItems, inventory);
      removedCount = result.removedCount;
    } else {
      if (mode === 'create') {
        const sessionColor = global.tagSessions?.[sessionKey]?.color || 'default';
        setTagColor(inventory.tags, type, category, tagName, sessionColor);
      }
      const result = addItemsToTag(inventory.tags, type, category, tagName, selectedItems, true, inventory);
      addedCount = result.addedCount;
      movedCount = result.movedCount;
    }
    
    // 임시 정보 삭제
    if (global.tagSessions) {
      delete global.tagSessions[sessionKey];
    }
    
    // DB 저장
    await updateSettings({ tags: inventory.tags });
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(mode === 'remove' ? '✅ 태그 항목 제거 완료' : '✅ 태그 설정 완료')
      .setDescription([
        `**카테고리:** ${category}`,
        `🏷️ **태그:** ${tagName}`,
        ``,
        mode === 'remove' ? `🧹 **제거된 항목:** ${removedCount}개` : `📦 **추가된 항목:** ${addedCount}개`,
        mode !== 'remove' && movedCount > 0 ? `🔄 **이동된 항목:** ${movedCount}개 (기존 태그에서 제거됨)` : '',
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
    console.error('❌ 태그 선택 확정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 항목 선택 초기화 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleTagItemsClearButton(interaction) {
  try {
    await interaction.deferUpdate();
    
    const parts = interaction.customId.replace('tag_items_clear_', '').split('_');
    const hasMode = parts[0] !== 'inventory' && parts[0] !== 'crafting';
    const mode = hasMode ? parts[0] : 'create';
    const type = hasMode ? parts[1] : parts[0];
    const tagName = decodeCustomIdPart(parts[parts.length - 1]);
    const category = hasMode ? parts.slice(2, -1).join('_') : parts.slice(1, -1).join('_');
    
    const sessionKey = `${interaction.user.id}_${type}_${category}_${tagName}_${mode}`;
    if (global.tagSessions) {
      delete global.tagSessions[sessionKey];
    }
    
    const inventory = await loadInventory();
    const { selectTimeout } = getTimeoutSettings(inventory);
    
    const contentMessage = `🏷️ **태그: ${tagName}**\n\n"${tagName}" 태그에 ${mode === 'remove' ? '제거할' : '추가할'} 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.\n\n✅ 현재 선택: 0개\n\n✅ 선택 완료 버튼을 눌러 태그를 적용하세요.\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
    
    await interaction.editReply({
      content: contentMessage
    });
    
  } catch (error) {
    console.error('❌ 태그 선택 초기화 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 생성 버튼 핸들러
 */
export async function handleTagCreateButton(interaction) {
  return await handleTagSetButton(interaction);
}

/**
 * 태그 편집 버튼 핸들러
 */
export async function handleTagEditButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    await showTagActionSelect(interaction, {
      type,
      category,
      action: 'edit',
      title: '✏️ 태그 편집',
      placeholder: '편집할 태그를 선택하세요'
    });
  } catch (error) {
    console.error('❌ 태그 편집 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 삭제 버튼 핸들러
 */
export async function handleTagDeleteButton(interaction) {
  return await handleTagRemoveButton(interaction);
}

/**
 * 태그 검색 버튼 핸들러
 */
export async function handleTagSearchButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const modal = new ModalBuilder()
      .setCustomId(`tag_search_modal_${type}_${category}`)
      .setTitle(`🔎 태그 검색 - ${category}`);
    
    const queryInput = new TextInputBuilder()
      .setCustomId('tag_query')
      .setLabel('검색어')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('태그명 또는 아이템명')
      .setRequired(true);
    
    modal.addComponents(new ActionRowBuilder().addComponents(queryInput));
    await interaction.showModal(modal);
  } catch (error) {
    console.error('❌ 태그 검색 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 병합 버튼 핸들러
 */
export async function handleTagMergeButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    await showTagActionSelect(interaction, {
      type,
      category,
      action: 'merge_source',
      title: '🔀 태그 병합',
      placeholder: '원본 태그를 선택하세요'
    });
  } catch (error) {
    console.error('❌ 태그 병합 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 빈 태그 정리 버튼 핸들러
 */
export async function handleTagCleanupButton(interaction) {
  try {
    const parts = interaction.customId.split('_');
    const type = parts[2];
    const category = parts.slice(3).join('_');
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
    }
    
    const removed = cleanupEmptyTags(inventory.tags, type, category);
    await updateSettings({ tags: inventory.tags });
    
    await interaction.update({
      content: `🧹 빈 태그 정리 완료: ${removed}개 태그 삭제됨`,
      components: []
    });
    
    const { infoTimeout } = getTimeoutSettings(inventory);
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, infoTimeout);
  } catch (error) {
    console.error('❌ 태그 정리 버튼 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 액션 페이지 이동 핸들러
 */
export async function handleTagActionPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_tag_action_' : 'page_prev_tag_action_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const action = parts[0];
    const type = parts[1];
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(2, -1).join('_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    await showTagActionSelect(interaction, {
      type,
      category,
      action,
      title: '🏷️ 태그 선택',
      placeholder: '태그를 선택하세요',
      page: newPage
    });
  } catch (error) {
    console.error('❌ 태그 액션 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 보기 페이지 이동 핸들러
 */
export async function handleTagViewPageButton(interaction) {
  try {
    const isNext = interaction.customId.startsWith('page_next_');
    const prefix = isNext ? 'page_next_tag_view_' : 'page_prev_tag_view_';
    const parts = interaction.customId.replace(prefix, '').split('_');
    const type = parts[0];
    const currentPage = parseInt(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    const newPage = isNext ? currentPage + 1 : currentPage - 1;
    
    await renderTagViewPage(interaction, type, category, newPage);
  } catch (error) {
    console.error('❌ 태그 보기 페이지 이동 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 편집 - 항목 추가 버튼
 */
export async function handleTagEditAddButton(interaction) {
  try {
    const parts = interaction.customId.replace('tag_edit_add_', '').split('_');
    const type = parts[0];
    const tagName = decodeCustomIdPart(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    await showTagItemsSelection(interaction, { type, category, tagName, mode: 'add' });
  } catch (error) {
    console.error('❌ 태그 항목 추가 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 편집 - 항목 제거 버튼
 */
export async function handleTagEditRemoveButton(interaction) {
  try {
    const parts = interaction.customId.replace('tag_edit_remove_', '').split('_');
    const type = parts[0];
    const tagName = decodeCustomIdPart(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    await showTagItemsSelection(interaction, { type, category, tagName, mode: 'remove' });
  } catch (error) {
    console.error('❌ 태그 항목 제거 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 삭제 확정 버튼
 */
export async function handleTagDeleteConfirmButton(interaction) {
  try {
    await interaction.deferUpdate();
    const parts = interaction.customId.replace('tag_delete_confirm_', '').split('_');
    const type = parts[0];
    const tagName = decodeCustomIdPart(parts[parts.length - 1]);
    const category = parts.slice(1, -1).join('_');
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
    }
    
    const deleted = deleteTag(inventory.tags, type, category, tagName);
    await updateSettings({ tags: inventory.tags });
    
    await interaction.editReply({
      content: deleted ? `✅ "${tagName}" 태그가 삭제되었습니다.` : `❌ "${tagName}" 태그를 찾을 수 없습니다.`,
      components: []
    });
  } catch (error) {
    console.error('❌ 태그 삭제 확정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 삭제 취소 버튼
 */
export async function handleTagDeleteCancelButton(interaction) {
  try {
    await interaction.update({ content: '❎ 태그 삭제가 취소되었습니다.', components: [] });
  } catch (error) {
    console.error('❌ 태그 삭제 취소 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 병합 확정 버튼
 */
export async function handleTagMergeConfirmButton(interaction) {
  try {
    await interaction.deferUpdate();
    const parts = interaction.customId.replace('tag_merge_confirm_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    
    const session = global.tagMergeSessions?.[`${interaction.user.id}_${type}_${category}`];
    if (!session?.sourceTag || !session?.targetTag) {
      return await interaction.editReply({
        content: '❌ 병합 정보를 찾을 수 없습니다.',
        components: []
      });
    }
    
    const inventory = await loadInventory();
    const normalized = normalizeTagsData(inventory.tags || {});
    if (normalized.changed) {
      inventory.tags = normalized.tags;
    }
    
    const result = mergeTags(inventory.tags, type, category, session.sourceTag, session.targetTag);
    await updateSettings({ tags: inventory.tags });
    
    delete global.tagMergeSessions[`${interaction.user.id}_${type}_${category}`];
    
    await interaction.editReply({
      content: `✅ 태그 병합 완료: ${session.sourceTag} → ${session.targetTag} (${result.mergedCount}개 이동)`,
      components: []
    });
  } catch (error) {
    console.error('❌ 태그 병합 확정 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

/**
 * 태그 병합 취소 버튼
 */
export async function handleTagMergeCancelButton(interaction) {
  try {
    const parts = interaction.customId.replace('tag_merge_cancel_', '').split('_');
    const type = parts[0];
    const category = parts.slice(1).join('_');
    
    if (global.tagMergeSessions) {
      delete global.tagMergeSessions[`${interaction.user.id}_${type}_${category}`];
    }
    
    await interaction.update({ content: '❎ 태그 병합이 취소되었습니다.', components: [] });
  } catch (error) {
    console.error('❌ 태그 병합 취소 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다.', ephemeral: true }).catch(() => {});
  }
}

// ===================== 내부 유틸 =====================

async function showTagActionSelect(interaction, { type, category, action, title, placeholder, page = 0 }) {
  const inventory = await loadInventory();
  const normalized = normalizeTagsData(inventory.tags || {});
  if (normalized.changed) {
    inventory.tags = normalized.tags;
    await updateSettings({ tags: normalized.tags });
  }
  
  const tags = listTags(inventory.tags, type, category);
  if (tags.length === 0) {
    return await interaction.update({
      content: `❌ "${category}" 카테고리에 태그가 없습니다.`,
      components: []
    });
  }
  
  const pageSize = 25;
  const totalPages = Math.ceil(tags.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = startIdx + pageSize;
  const pagedTags = tags.slice(startIdx, endIdx);
  
  const colorEmoji = {
    'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
    'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
  };
  
  const tagOptions = pagedTags.map(tag => ({
    label: tag.name,
    value: tag.name,
    description: `${tag.items.length}개 항목`,
    emoji: colorEmoji[tag.color] || '🏷️'
  }));
  
  const { StringSelectMenuBuilder } = await import('discord.js');
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_tag_action_${action}_${type}_${category}`)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(tagOptions);
  
  const rows = [new ActionRowBuilder().addComponents(selectMenu)];
  
  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_action_${action}_${type}_${category}_${page}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_action_${action}_${type}_${category}_${page}`)
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
  let contentMessage = `${title}\n\n${placeholder}`;
  if (totalPages > 1) {
    contentMessage += `\n\n📄 페이지 ${page + 1}/${totalPages} (전체 ${tags.length}개 태그)`;
  }
  contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
  
  await interaction.update({
    content: contentMessage,
    components: rows,
    embeds: []
  });
  
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {}
  }, selectTimeout);
}

async function renderTagViewPage(interaction, type, category, page = 0) {
  const inventory = await loadInventory();
  const normalized = normalizeTagsData(inventory.tags || {});
  if (normalized.changed) {
    inventory.tags = normalized.tags;
    await updateSettings({ tags: normalized.tags });
  }
  
  const tags = listTags(inventory.tags, type, category);
  if (tags.length === 0) {
    return await interaction.update({
      content: `📋 **${category}** 카테고리에 설정된 태그가 없습니다.`,
      components: []
    });
  }
  
  const pageSize = 10;
  const totalPages = Math.ceil(tags.length / pageSize);
  const startIdx = page * pageSize;
  const endIdx = startIdx + pageSize;
  const pagedTags = tags.slice(startIdx, endIdx);
  
  const colorEmoji = {
    'red': '🔴', 'green': '🟢', 'blue': '🔵', 'yellow': '🟡',
    'purple': '🟣', 'cyan': '🔵', 'white': '⚪', 'default': '🏷️'
  };
  
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`🏷️ ${category} 카테고리 태그 목록`)
    .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  pagedTags.forEach(tag => {
    const emoji = colorEmoji[tag.color] || '🏷️';
    embed.addFields({
      name: `${emoji} ${tag.name}`,
      value: `${tag.items.length}개 항목`,
      inline: false
    });
  });
  
  const { StringSelectMenuBuilder } = await import('discord.js');
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_tag_action_view_${type}_${category}`)
    .setPlaceholder('상세 보기할 태그를 선택하세요')
    .addOptions(pagedTags.map(tag => ({
      label: tag.name,
      value: tag.name,
      description: `${tag.items.length}개 항목`,
      emoji: colorEmoji[tag.color] || '🏷️'
    })));
  
  const rows = [new ActionRowBuilder().addComponents(selectMenu)];
  
  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_view_${type}_${category}_${page}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_view_${type}_${category}_${page}`)
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
  
  await interaction.update({
    embeds: [embed],
    components: rows,
    content: ''
  });
  
  const { selectTimeout } = getTimeoutSettings(inventory);
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {}
  }, selectTimeout);
}

async function showTagItemsSelection(interaction, { type, category, tagName, mode }) {
  const inventory = await loadInventory();
  const normalized = normalizeTagsData(inventory.tags || {});
  if (normalized.changed) {
    inventory.tags = normalized.tags;
    await updateSettings({ tags: normalized.tags });
  }
  
  const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
  let items = Object.keys(targetData?.[category] || {});
  if (mode === 'remove') {
    items = inventory.tags?.[type]?.[category]?.[tagName]?.items || [];
  }
  
  if (items.length === 0) {
    return await interaction.update({
      content: `❌ "${tagName}" 태그에 ${mode === 'remove' ? '제거할 항목' : '추가할 항목'}이 없습니다.`,
      components: []
    });
  }
  
  const itemOptions = items.map(item => {
    const currentTag = getItemTag(item, category, type, inventory);
    const icon = getItemIcon(item, inventory);
    
    // 커스텀 이모지 처리
    const emojiMatch = icon.match(/<a?:.+?:(\d+)>/);
    const emoji = emojiMatch ? emojiMatch[1] : icon;
      
    return {
      label: item,
      value: item,
      emoji: emoji,
      description: mode === 'remove' ? '태그에 포함됨' : (currentTag ? `현재: ${currentTag}` : '태그 없음')
    };
  });
  
  const pageSize = 25;
  const totalPages = Math.ceil(itemOptions.length / pageSize);
  const page = 0;
  const limitedOptions = itemOptions.slice(0, pageSize);
  
  global.tagSessions = global.tagSessions || {};
  const sessionKey = `${interaction.user.id}_${type}_${category}_${tagName}_${mode}`;
  global.tagSessions[sessionKey] = {
    type,
    category,
    tagName,
    mode,
    selectedItems: [],
    color: 'default',
    updatedAt: Date.now()
  };
  
  const { StringSelectMenuBuilder } = await import('discord.js');
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
    .setPlaceholder(`"${tagName}" 태그에 ${mode === 'remove' ? '제거할' : '추가할'} 항목을 선택하세요 (여러 개 가능)`)
    .setMinValues(1)
    .setMaxValues(Math.min(limitedOptions.length, 25))
    .addOptions(limitedOptions);
  
  const confirmButton = new ButtonBuilder()
    .setCustomId(`tag_items_confirm_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
    .setLabel('✅ 선택 완료')
    .setStyle(ButtonStyle.Success);
  
  const clearButton = new ButtonBuilder()
    .setCustomId(`tag_items_clear_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}`)
    .setLabel('🧹 선택 초기화')
    .setStyle(ButtonStyle.Secondary);
  
  const rows = [
    new ActionRowBuilder().addComponents(selectMenu),
    new ActionRowBuilder().addComponents(confirmButton, clearButton)
  ];
  
  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(`page_prev_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
      .setLabel('◀ 이전')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    
    const nextButton = new ButtonBuilder()
      .setCustomId(`page_next_tag_items_${mode}_${type}_${category}_${encodeCustomIdPart(tagName)}_${page}`)
      .setLabel('다음 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1);
    
    const pageInfo = new ButtonBuilder()
      .setCustomId(`page_info_${page}`)
      .setLabel(`${page + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true);
    
    rows.push(new ActionRowBuilder().addComponents(prevButton, pageInfo, nextButton));
  }
  
  const { selectTimeout } = getTimeoutSettings(inventory);
  let contentMessage = `🏷️ **태그: ${tagName}**\n\n"${tagName}" 태그에 ${mode === 'remove' ? '제거할' : '추가할'} 항목을 선택하세요\n💡 여러 개를 한 번에 선택할 수 있습니다.`;
  if (totalPages > 1) {
    contentMessage += `\n\n📄 페이지 1/${totalPages} (전체 ${itemOptions.length}개 항목)`;
  }
  contentMessage += `\n\n_이 메시지는 ${selectTimeout/1000}초 후 자동 삭제됩니다_`;
  
  await interaction.update({
    content: contentMessage,
    components: rows,
    embeds: []
  });
}