// 배점 관리 버튼 핸들러

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory, getItemPoints, resetAllItemPoints } from '../../database.js';
import { getTimeoutSettings } from '../../utils.js';

/**
 * 배점 관리 메인 버튼
 */
export async function handlePointsManageButton(interaction) {
  const timeouts = await getTimeoutSettings();
  
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('points_type_inventory')
      .setLabel('📦 재고 배점 설정')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('points_type_crafting')
      .setLabel('🔨 제작 배점 설정')
      .setStyle(ButtonStyle.Primary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('points_reset')
      .setLabel('🔄 전체 초기화 (모두 1점으로)')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('settings_back')
      .setLabel('◀️ 돌아가기')
      .setStyle(ButtonStyle.Secondary)
  );
  
  await interaction.update({
    content: '⭐ **배점 설정**\n\n배점을 설정할 분야를 선택하세요.',
    components: [row1, row2],
    embeds: []
  });
  
  // 자동 삭제
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {}
  }, timeouts.select * 1000);
}

/**
 * 타입 선택 (재고/제작)
 */
export async function handlePointsTypeButton(interaction, parts) {
  const type = parts[2]; // 'inventory' or 'crafting'
  const typeLabel = type === 'inventory' ? '📦 재고' : '🔨 제작';
  
  const inventory = await loadInventory();
  const categories = type === 'inventory' 
    ? Object.keys(inventory.categories || {})
    : Object.keys(inventory.crafting?.categories || {});
  
  if (categories.length === 0) {
    const timeouts = await getTimeoutSettings();
    await interaction.update({
      content: `❌ ${typeLabel} 카테고리가 없습니다.\n\n_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`,
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, timeouts.info * 1000);
    return;
  }
  
  // 카테고리 버튼 생성
  const buttons = categories.map(category =>
    new ButtonBuilder()
      .setCustomId(`points_category_${type}_${category}_0`)
      .setLabel(category)
      .setStyle(ButtonStyle.Primary)
  );
  
  // 5개씩 나눠서 row 생성
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) {
    rows.push(
      new ActionRowBuilder().addComponents(buttons.slice(i, i + 5))
    );
  }
  
  // 뒤로가기 버튼
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('points_manage')
        .setLabel('◀️ 돌아가기')
        .setStyle(ButtonStyle.Secondary)
    )
  );
  
  const timeouts = await getTimeoutSettings();
  await interaction.update({
    content: `⭐ **${typeLabel} 배점 설정**\n\n카테고리를 선택하세요.`,
    components: rows.slice(0, 5), // 최대 5개 row
    embeds: []
  });
  
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {}
  }, timeouts.select * 1000);
}

/**
 * 카테고리 선택 - 아이템 목록 표시
 */
export async function handlePointsCategoryButton(interaction, parts) {
  const type = parts[2];
  const category = parts[3];
  const page = parseInt(parts[4]) || 0;
  
  const typeLabel = type === 'inventory' ? '📦 재고' : '🔨 제작';
  
  const [inventory, itemPoints] = await Promise.all([
    loadInventory(),
    getItemPoints()
  ]);
  
  const items = type === 'inventory'
    ? inventory.categories?.[category] || {}
    : inventory.crafting?.categories?.[category] || {};
  
  const itemList = Object.keys(items);
  
  if (itemList.length === 0) {
    const timeouts = await getTimeoutSettings();
    await interaction.update({
      content: `❌ ${category} 카테고리에 항목이 없습니다.\n\n_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`,
      components: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, timeouts.info * 1000);
    return;
  }
  
  // 페이지네이션
  const itemsPerPage = 25;
  const totalPages = Math.ceil(itemList.length / itemsPerPage);
  const startIdx = page * itemsPerPage;
  const endIdx = Math.min(startIdx + itemsPerPage, itemList.length);
  const pageItems = itemList.slice(startIdx, endIdx);
  
  // 셀렉트 메뉴 옵션
  const options = pageItems.map(itemName => {
    const currentPoints = itemPoints?.[type]?.[category]?.[itemName] || 1;
    return {
      label: itemName,
      value: itemName,
      description: `현재: ${currentPoints}점`,
      emoji: items[itemName].emoji || '📦'
    };
  });
  
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_points_item_${type}_${category}_${page}`)
    .setPlaceholder('배점을 수정할 항목을 선택하세요')
    .addOptions(options);
  
  const rows = [new ActionRowBuilder().addComponents(selectMenu)];
  
  // 페이지네이션 버튼
  if (totalPages > 1) {
    const pageButtons = [];
    
    if (page > 0) {
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`points_category_${type}_${category}_${page - 1}`)
          .setLabel('◀️ 이전')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    pageButtons.push(
      new ButtonBuilder()
        .setCustomId(`points_page_info_${page}`)
        .setLabel(`${page + 1}/${totalPages}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    if (page < totalPages - 1) {
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`points_category_${type}_${category}_${page + 1}`)
          .setLabel('다음 ▶️')
          .setStyle(ButtonStyle.Secondary)
      );
    }
    
    rows.push(new ActionRowBuilder().addComponents(pageButtons));
  }
  
  // 뒤로가기
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`points_type_${type}`)
        .setLabel('◀️ 돌아가기')
        .setStyle(ButtonStyle.Secondary)
    )
  );
  
  const timeouts = await getTimeoutSettings();
  await interaction.update({
    content: `⭐ **${typeLabel} > ${category} 배점 설정**\n\n배점을 수정할 항목을 선택하세요.\n(${startIdx + 1}-${endIdx} / 총 ${itemList.length}개)`,
    components: rows,
    embeds: []
  });
  
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {}
  }, timeouts.select * 1000);
}

/**
 * 전체 초기화
 */
export async function handlePointsResetButton(interaction) {
  try {
    await resetAllItemPoints();
    
    const timeouts = await getTimeoutSettings();
    await interaction.update({
      content: `✅ 모든 아이템 배점이 1점으로 초기화되었습니다.\n\n_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`,
      components: [],
      embeds: []
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, timeouts.info * 1000);
    
  } catch (error) {
    console.error('❌ 배점 초기화 실패:', error);
    await interaction.update({
      content: '❌ 배점 초기화 중 오류가 발생했습니다.',
      components: [],
      embeds: []
    }).catch(() => {});
  }
}
