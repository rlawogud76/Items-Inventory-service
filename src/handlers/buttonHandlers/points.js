// 배점 관리 버튼 핸들러

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { loadInventory, getItemPoints, resetAllItemPoints } from '../../database.js';
import { isAdmin, safeErrorReply } from '../../utils.js';

// 활성 타이머 저장소 (messageId -> timerId)
const activeTimers = new Map();

/**
 * 이전 타이머 취소 및 새 타이머 등록
 */
function setMessageTimer(messageId, callback, delay) {
  // 이전 타이머가 있으면 취소
  if (activeTimers.has(messageId)) {
    clearTimeout(activeTimers.get(messageId));
    console.log('⏰ 이전 타이머 취소:', messageId);
  }
  
  // 새 타이머 등록
  const timerId = setTimeout(() => {
    callback();
    activeTimers.delete(messageId);
  }, delay);
  
  activeTimers.set(messageId, timerId);
  console.log('⏰ 새 타이머 등록:', messageId, '/', delay, 'ms');
}

/**
 * 배점 관리 메인 버튼
 */
export async function handlePointsManageButton(interaction, isBackButton = false) {
  try {
    // 관리자/서버장만 배점 설정 가능
    const adminCheck = await isAdmin(interaction);
    if (!adminCheck) {
      return await safeErrorReply(interaction, '❌ 배점 설정은 관리자 또는 서버장만 사용할 수 있습니다.', true);
    }

    console.log('⭐ 배점 관리 버튼 핸들러 시작, isBackButton:', isBackButton);
    
    // getTimeoutSettingsAsync() 사용 (DB에서 로드)
    const inventory = await loadInventory();
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    const infoTimeout = (inventory?.settings?.infoMessageTimeout || 15) * 1000;
    
    console.log('⭐ 타이머 설정:', { selectTimeout, infoTimeout });
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('points_type_inventory')
        .setLabel('📦 재고 배점 설정')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('points_type_crafting')
        .setLabel('🔨 제작 배점 설정')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('points_view')
        .setLabel('📋 배점 조회')
        .setStyle(ButtonStyle.Secondary)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('points_reset')
        .setLabel('🔄 전체 초기화 (모두 1점으로)')
        .setStyle(ButtonStyle.Danger)
    );
    
    const selectTimeoutSeconds = Math.round(selectTimeout / 1000);
    const content = `⭐ **배점 설정**\n\n배점을 설정할 분야를 선택하세요.\n\n_이 메시지는 ${selectTimeoutSeconds}초 후 자동 삭제됩니다_`;
    
    let messageId;
    
    // 뒤로가기 버튼인 경우 update, 첫 클릭인 경우 reply
    if (isBackButton) {
      console.log('⭐ 뒤로가기 - interaction.update() 호출');
      await interaction.update({
        content,
        components: [row1, row2]
      });
      messageId = interaction.message.id;
    } else {
      console.log('⭐ 첫 클릭 - interaction.reply() 호출');
      const reply = await interaction.reply({
        content,
        components: [row1, row2],
        flags: 64, // ephemeral
        fetchReply: true
      });
      messageId = reply.id;
    }
    
    console.log('⭐ 배점 관리 메뉴 표시 완료, messageId:', messageId);
    
    // 타이머 등록 (이전 타이머 자동 취소)
    setMessageTimer(messageId, async () => {
      try {
        console.log('⏰ 배점 관리 메뉴 자동 삭제 실행');
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) { // Unknown Message 에러는 무시
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, selectTimeout);
  } catch (error) {
    console.error('❌ 배점 관리 버튼 핸들러 에러:', error);
    console.error('❌ 에러 스택:', error.stack);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ 배점 설정 메뉴를 여는 중 오류가 발생했습니다.',
        flags: 64
      }).catch(err => console.error('❌ 에러 응답 실패:', err));
    }
  }
}

/**
 * 타입 선택 (재고/제작)
 */
export async function handlePointsTypeButton(interaction, parts) {
  try {
    // 관리자/서버장만 배점 설정 가능
    const adminCheck = await isAdmin(interaction);
    if (!adminCheck) {
      return await safeErrorReply(interaction, '❌ 배점 설정은 관리자 또는 서버장만 사용할 수 있습니다.', true);
    }

    const type = parts[2]; // 'inventory' or 'crafting'
    const typeLabel = type === 'inventory' ? '📦 재고' : '🔨 제작';
    
    console.log('⭐ 타입 선택:', type);
    
    const inventory = await loadInventory();
    const categories = type === 'inventory' 
      ? Object.keys(inventory.categories || {})
      : Object.keys(inventory.crafting?.categories || {});
    
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    const infoTimeout = (inventory?.settings?.infoMessageTimeout || 15) * 1000;
    
    if (categories.length === 0) {
      const infoSeconds = Math.round(infoTimeout / 1000);
      await interaction.update({
        content: `❌ ${typeLabel} 카테고리가 없습니다.\n\n_이 메시지는 ${infoSeconds}초 후 자동 삭제됩니다_`,
        components: []
      });
      
      const messageId = interaction.message.id;
      setMessageTimer(messageId, async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          if (error.code !== 10008) {
            console.error('❌ 자동 삭제 실패:', error);
          }
        }
      }, infoTimeout);
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
    
    const selectSeconds = Math.round(selectTimeout / 1000);
    await interaction.update({
      content: `⭐ **${typeLabel} 배점 설정**\n\n카테고리를 선택하세요.\n\n_이 메시지는 ${selectSeconds}초 후 자동 삭제됩니다_`,
      components: rows.slice(0, 5) // 최대 5개 row
    });
    
    const messageId = interaction.message.id;
    console.log('⭐ 타입 선택 완료, messageId:', messageId);
    
    setMessageTimer(messageId, async () => {
      try {
        console.log('⏰ 타입 선택 메뉴 자동 삭제 실행');
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, selectTimeout);
  } catch (error) {
    console.error('❌ 타입 선택 핸들러 에러:', error);
    console.error('❌ 에러 스택:', error.stack);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ 카테고리 목록을 불러오는 중 오류가 발생했습니다.',
        flags: 64
      }).catch(err => console.error('❌ 에러 응답 실패:', err));
    }
  }
}

/**
 * 카테고리 선택 - 아이템 목록 표시
 */
export async function handlePointsCategoryButton(interaction, parts) {
  try {
    // 관리자/서버장만 배점 설정 가능
    const adminCheck = await isAdmin(interaction);
    if (!adminCheck) {
      return await safeErrorReply(interaction, '❌ 배점 설정은 관리자 또는 서버장만 사용할 수 있습니다.', true);
    }

    const type = parts[2];
    const category = parts[3];
    const page = parseInt(parts[4]) || 0;
    
    const typeLabel = type === 'inventory' ? '📦 재고' : '🔨 제작';
    
    const [inventory, itemPoints] = await Promise.all([
      loadInventory(),
      getItemPoints()
    ]);
    
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    const infoTimeout = (inventory?.settings?.infoMessageTimeout || 15) * 1000;
    
    const items = type === 'inventory'
      ? inventory.categories?.[category] || {}
      : inventory.crafting?.categories?.[category] || {};
    
    const itemList = Object.keys(items);
    
    if (itemList.length === 0) {
      const infoSeconds = Math.round(infoTimeout / 1000);
      await interaction.update({
        content: `❌ ${category} 카테고리에 항목이 없습니다.\n\n_이 메시지는 ${infoSeconds}초 후 자동 삭제됩니다_`,
        components: []
      });
      
      const messageId = interaction.message.id;
      setMessageTimer(messageId, async () => {
        try {
          await interaction.deleteReply();
        } catch (error) {
          if (error.code !== 10008) {
            console.error('❌ 자동 삭제 실패:', error);
          }
        }
      }, infoTimeout);
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
      const currentPoints = itemPoints?.[type]?.[category]?.[itemName] ?? 1;
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
    
    const selectSeconds = Math.round(selectTimeout / 1000);
    await interaction.update({
      content: `⭐ **${typeLabel} > ${category} 배점 설정**\n\n배점을 수정할 항목을 선택하세요.\n(${startIdx + 1}-${endIdx} / 총 ${itemList.length}개)\n\n_이 메시지는 ${selectSeconds}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    const messageId = interaction.message.id;
    setMessageTimer(messageId, async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, selectTimeout);
  } catch (error) {
    console.error('❌ 카테고리 선택 핸들러 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ 항목 목록을 불러오는 중 오류가 발생했습니다.',
        flags: 64
      }).catch(err => console.error('❌ 에러 응답 실패:', err));
    }
  }
}

/**
 * 전체 초기화
 */
export async function handlePointsResetButton(interaction) {
  try {
    // 관리자/서버장만 초기화 가능
    const adminCheck = await isAdmin(interaction);
    if (!adminCheck) {
      return await safeErrorReply(interaction, '❌ 배점 초기화는 관리자 또는 서버장만 사용할 수 있습니다.', true);
    }

    await resetAllItemPoints();
    
    const inventory = await loadInventory();
    const infoTimeout = (inventory?.settings?.infoMessageTimeout || 15) * 1000;
    const infoSeconds = Math.round(infoTimeout / 1000);
    
    await interaction.update({
      content: `✅ 모든 아이템 배점이 1점으로 초기화되었습니다.\n\n_이 메시지는 ${infoSeconds}초 후 자동 삭제됩니다_`,
      components: []
    });
    
    const messageId = interaction.message.id;
    setMessageTimer(messageId, async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 배점 초기화 실패:', error);
    await interaction.update({
      content: '❌ 배점 초기화 중 오류가 발생했습니다.',
      components: []
    }).catch(() => {});
  }
}

/**
 * 배점 조회 - 타입 선택
 */
export async function handlePointsViewButton(interaction) {
  try {
    const inventory = await loadInventory();
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('points_view_type_inventory_0')
        .setLabel('📦 재고 배점 조회')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('points_view_type_crafting_0')
        .setLabel('🔨 제작 배점 조회')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('points_view_all_0')
        .setLabel('📋 전체 배점 조회')
        .setStyle(ButtonStyle.Success)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('points_manage')
        .setLabel('◀️ 돌아가기')
        .setStyle(ButtonStyle.Secondary)
    );
    
    const selectSeconds = Math.round(selectTimeout / 1000);
    await interaction.update({
      content: `📋 **배점 조회**\n\n조회할 분야를 선택하세요.\n\n_이 메시지는 ${selectSeconds}초 후 자동 삭제됩니다_`,
      components: [row1, row2]
    });
    
    const messageId = interaction.message.id;
    setMessageTimer(messageId, async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 배점 조회 버튼 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ 배점 조회 메뉴를 여는 중 오류가 발생했습니다.',
        flags: 64
      }).catch(err => console.error('❌ 에러 응답 실패:', err));
    }
  }
}

/**
 * 배점 조회 - 실제 조회 표시
 */
export async function handlePointsViewTypeButton(interaction, parts) {
  try {
    // points_view_type_inventory_0 또는 points_view_all_0
    const viewType = parts[2]; // 'type' 또는 'all'
    const type = viewType === 'all' ? 'all' : parts[3]; // 'inventory', 'crafting', or 'all'
    const page = parseInt(parts[parts.length - 1]) || 0;
    
    const [inventory, itemPoints] = await Promise.all([
      loadInventory(),
      getItemPoints()
    ]);
    
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    
    // 배점이 설정된 아이템 목록 수집
    const pointsList = [];
    
    const collectPoints = (targetType, typeLabel) => {
      const categories = itemPoints?.[targetType] || {};
      for (const [category, items] of Object.entries(categories)) {
        for (const [itemName, points] of Object.entries(items)) {
          if (points !== 1) { // 기본값(1)이 아닌 것만 표시
            pointsList.push({
              type: targetType,
              typeLabel,
              category,
              itemName,
              points
            });
          }
        }
      }
    };
    
    if (type === 'all' || type === 'inventory') {
      collectPoints('inventory', '📦 재고');
    }
    if (type === 'all' || type === 'crafting') {
      collectPoints('crafting', '🔨 제작');
    }
    
    // 점수 내림차순 정렬
    pointsList.sort((a, b) => b.points - a.points);
    
    // 페이지네이션
    const itemsPerPage = 15;
    const totalPages = Math.ceil(pointsList.length / itemsPerPage) || 1;
    const startIdx = page * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, pointsList.length);
    const pageItems = pointsList.slice(startIdx, endIdx);
    
    // 타이틀 설정
    let title;
    if (type === 'all') {
      title = '📋 전체 배점 조회';
    } else if (type === 'inventory') {
      title = '📦 재고 배점 조회';
    } else {
      title = '🔨 제작 배점 조회';
    }
    
    // 내용 생성
    let content;
    if (pointsList.length === 0) {
      content = `${title}\n\n기본값(1점)과 다르게 설정된 배점이 없습니다.\n모든 아이템이 기본 1점으로 계산됩니다.`;
    } else {
      const lines = pageItems.map((item, idx) => {
        const rank = startIdx + idx + 1;
        return `**${rank}.** ${item.typeLabel} > ${item.category} > **${item.itemName}** - \`${item.points}점\``;
      });
      
      content = `${title}\n\n` +
        `📊 기본값(1점)이 아닌 배점 목록:\n` +
        `(${startIdx + 1}-${endIdx} / 총 ${pointsList.length}개)\n\n` +
        lines.join('\n');
    }
    
    // 버튼 생성
    const rows = [];
    
    // 페이지네이션 버튼
    if (totalPages > 1) {
      const pageButtons = [];
      
      if (page > 0) {
        pageButtons.push(
          new ButtonBuilder()
            .setCustomId(type === 'all' ? `points_view_all_${page - 1}` : `points_view_type_${type}_${page - 1}`)
            .setLabel('◀️ 이전')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId(`points_view_page_info`)
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      if (page < totalPages - 1) {
        pageButtons.push(
          new ButtonBuilder()
            .setCustomId(type === 'all' ? `points_view_all_${page + 1}` : `points_view_type_${type}_${page + 1}`)
            .setLabel('다음 ▶️')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      rows.push(new ActionRowBuilder().addComponents(pageButtons));
    }
    
    // 뒤로가기 버튼
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('points_view')
          .setLabel('◀️ 돌아가기')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    
    const selectSeconds = Math.round(selectTimeout / 1000);
    await interaction.update({
      content: content + `\n\n_이 메시지는 ${selectSeconds}초 후 자동 삭제됩니다_`,
      components: rows
    });
    
    const messageId = interaction.message.id;
    setMessageTimer(messageId, async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        if (error.code !== 10008) {
          console.error('❌ 자동 삭제 실패:', error);
        }
      }
    }, selectTimeout);
    
  } catch (error) {
    console.error('❌ 배점 조회 타입 핸들러 에러:', error);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ 배점 조회 중 오류가 발생했습니다.',
        flags: 64
      }).catch(err => console.error('❌ 에러 응답 실패:', err));
    }
  }
}
