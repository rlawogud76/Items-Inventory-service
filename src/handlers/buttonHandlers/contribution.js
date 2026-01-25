// 기여도 관련 버튼 핸들러
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from 'discord.js';
import { clearHistory, getHistoryCount, loadInventory, getItemPoints, resetAllItemPoints } from '../../database.js';
import { getTimeoutSettingsAsync } from '../../utils.js';
import { createContributionEmbed, createContributionButtons } from '../commandHandlers/contribution.js';

/**
 * 기여도 새로고침 버튼 핸들러
 */
export async function handleContributionRefresh(interaction) {
  try {
    const { embed } = await createContributionEmbed();
    const buttons = createContributionButtons();
    
    await interaction.update({
      embeds: [embed],
      components: buttons
    });
    
    console.log('🔄 기여도 새로고침 완료');
  } catch (error) {
    console.error('❌ 기여도 새로고침 에러:', error);
    await interaction.reply({
      content: '❌ 새로고침 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 초기화 확인 요청 버튼 핸들러
 */
export async function handleContributionResetConfirm(interaction) {
  try {
    const historyCount = await getHistoryCount();
    const { infoTimeout } = await getTimeoutSettingsAsync();
    
    const confirmEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⚠️ 기여도 초기화 확인')
      .setDescription([
        `정말로 **${historyCount}개**의 수정 내역을 삭제하시겠습니까?`,
        '',
        '이 작업은 되돌릴 수 없습니다.',
        '모든 기여도 통계가 초기화됩니다.'
      ].join('\n'));
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_contribution_reset')
        .setLabel('✅ 확인')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_contribution_reset')
        .setLabel('❌ 취소')
        .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
      embeds: [confirmEmbed],
      components: [row]
    });
    
  } catch (error) {
    console.error('❌ 기여도 초기화 확인 에러:', error);
    await interaction.reply({
      content: '❌ 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 초기화 확인 버튼 핸들러
 */
export async function handleConfirmContributionReset(interaction) {
  try {
    const historyCount = await getHistoryCount();
    await clearHistory();
    
    // 초기화 후 기여도 화면으로 돌아가기
    const { embed } = await createContributionEmbed();
    const buttons = createContributionButtons();
    
    // 임시 성공 메시지를 먼저 표시
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 기여도 초기화 완료')
      .setDescription(`**${historyCount}개**의 수정 내역이 삭제되었습니다.`);
    
    await interaction.update({ 
      embeds: [successEmbed], 
      components: [] 
    });
    
    console.log(`✅ 기여도 초기화 완료 (${historyCount}개 삭제)`);
    
    // 2초 후 기여도 화면으로 돌아가기
    setTimeout(async () => {
      try {
        await interaction.editReply({
          embeds: [embed],
          components: buttons
        });
      } catch (error) {
        console.error('❌ 기여도 화면 복원 실패:', error);
      }
    }, 2000);
    
  } catch (error) {
    console.error('❌ 기여도 초기화 에러:', error);
    await interaction.reply({ 
      content: `❌ 오류가 발생했습니다: ${error.message}`, 
      ephemeral: true 
    }).catch(() => {});
  }
}

/**
 * 기여도 초기화 취소 버튼 핸들러
 */
export async function handleCancelContributionReset(interaction) {
  try {
    // 기여도 화면으로 돌아가기
    const { embed } = await createContributionEmbed();
    const buttons = createContributionButtons();
    
    await interaction.update({ 
      embeds: [embed], 
      components: buttons 
    });
    
    console.log('❌ 기여도 초기화 취소됨');
    
  } catch (error) {
    console.error('❌ 취소 버튼 에러:', error);
    await interaction.reply({ 
      content: `❌ 오류가 발생했습니다: ${error.message}`, 
      ephemeral: true 
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 설정 메인 메뉴
 */
export async function handleContributionPointsManage(interaction) {
  try {
    const inventory = await loadInventory();
    const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
    
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('contribution_points_type_inventory')
        .setLabel('📦 재고 배점 설정')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('contribution_points_type_crafting')
        .setLabel('🔨 제작 배점 설정')
        .setStyle(ButtonStyle.Primary)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('contribution_points_reset_all')
        .setLabel('🔄 전체 초기화 (모두 1점으로)')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('contribution_back')
        .setLabel('◀️ 돌아가기')
        .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
      content: `⭐ **배점 설정**\n\n배점을 설정할 분야를 선택하세요.`,
      embeds: [],
      components: [row1, row2]
    });
    
  } catch (error) {
    console.error('❌ 배점 설정 메뉴 에러:', error);
    await interaction.reply({
      content: '❌ 배점 설정 메뉴를 여는 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 타입 선택 (재고/제작)
 */
export async function handleContributionPointsType(interaction, type) {
  try {
    const typeLabel = type === 'inventory' ? '📦 재고' : '🔨 제작';
    
    const inventory = await loadInventory();
    const categories = type === 'inventory' 
      ? Object.keys(inventory.categories || {})
      : Object.keys(inventory.crafting?.categories || {});
    
    if (categories.length === 0) {
      await interaction.update({
        content: `❌ ${typeLabel} 카테고리가 없습니다.`,
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('contribution_points_manage')
              .setLabel('◀️ 돌아가기')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
      return;
    }
    
    // 카테고리 버튼 생성
    const buttons = categories.map(category =>
      new ButtonBuilder()
        .setCustomId(`contribution_points_category_${type}_${category}_0`)
        .setLabel(category)
        .setStyle(ButtonStyle.Primary)
    );
    
    // 5개씩 나눠서 row 생성
    const rows = [];
    for (let i = 0; i < buttons.length; i += 5) {
      rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
    }
    
    // 뒤로가기 버튼
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('contribution_points_manage')
          .setLabel('◀️ 돌아가기')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    
    await interaction.update({
      content: `⭐ **${typeLabel} 배점 설정**\n\n카테고리를 선택하세요.`,
      embeds: [],
      components: rows.slice(0, 5)
    });
    
  } catch (error) {
    console.error('❌ 배점 타입 선택 에러:', error);
    await interaction.reply({
      content: '❌ 카테고리 목록을 불러오는 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 카테고리 선택 - 아이템 목록 표시
 */
export async function handleContributionPointsCategory(interaction, type, category, page) {
  try {
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
      await interaction.update({
        content: `❌ ${category} 카테고리에 항목이 없습니다.`,
        embeds: [],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`contribution_points_type_${type}`)
              .setLabel('◀️ 돌아가기')
              .setStyle(ButtonStyle.Secondary)
          )
        ]
      });
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
      const emoji = items[itemName]?.emoji;
      const option = {
        label: itemName,
        value: itemName,
        description: `현재: ${currentPoints}점`
      };
      // 이모지가 유효한 경우만 추가
      if (emoji && !emoji.startsWith('<') && emoji.length <= 10) {
        option.emoji = emoji;
      }
      return option;
    });
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`contribution_select_points_${type}_${category}_${page}`)
      .setPlaceholder('배점을 수정할 항목을 선택하세요')
      .addOptions(options);
    
    const rows = [new ActionRowBuilder().addComponents(selectMenu)];
    
    // 페이지네이션 버튼
    if (totalPages > 1) {
      const pageButtons = [];
      
      if (page > 0) {
        pageButtons.push(
          new ButtonBuilder()
            .setCustomId(`contribution_points_category_${type}_${category}_${page - 1}`)
            .setLabel('◀️ 이전')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId('contribution_points_page_info')
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      if (page < totalPages - 1) {
        pageButtons.push(
          new ButtonBuilder()
            .setCustomId(`contribution_points_category_${type}_${category}_${page + 1}`)
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
          .setCustomId(`contribution_points_type_${type}`)
          .setLabel('◀️ 돌아가기')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    
    await interaction.update({
      content: `⭐ **${typeLabel} > ${category} 배점 설정**\n\n배점을 수정할 항목을 선택하세요.\n(${startIdx + 1}-${endIdx} / 총 ${itemList.length}개)`,
      embeds: [],
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 배점 카테고리 선택 에러:', error);
    await interaction.reply({
      content: '❌ 항목 목록을 불러오는 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 전체 초기화
 */
export async function handleContributionPointsResetAll(interaction) {
  try {
    await resetAllItemPoints();
    
    // 성공 메시지 후 배점 메뉴로 돌아가기
    await interaction.update({
      content: `✅ 모든 아이템 배점이 1점으로 초기화되었습니다.`,
      embeds: [],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('contribution_points_manage')
            .setLabel('◀️ 돌아가기')
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });
    
  } catch (error) {
    console.error('❌ 배점 초기화 실패:', error);
    await interaction.reply({
      content: '❌ 배점 초기화 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 조회 메인 메뉴
 */
export async function handleContributionPointsView(interaction) {
  try {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('contribution_view_type_inventory_0')
        .setLabel('📦 재고 배점 조회')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('contribution_view_type_crafting_0')
        .setLabel('🔨 제작 배점 조회')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('contribution_view_all_0')
        .setLabel('📋 전체 배점 조회')
        .setStyle(ButtonStyle.Success)
    );
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('contribution_back')
        .setLabel('◀️ 돌아가기')
        .setStyle(ButtonStyle.Secondary)
    );
    
    await interaction.update({
      content: `📋 **배점 조회**\n\n조회할 분야를 선택하세요.`,
      embeds: [],
      components: [row1, row2]
    });
    
  } catch (error) {
    console.error('❌ 배점 조회 메뉴 에러:', error);
    await interaction.reply({
      content: '❌ 배점 조회 메뉴를 여는 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 배점 조회 - 타입별/전체
 */
export async function handleContributionViewType(interaction, type, page) {
  try {
    const itemPoints = await getItemPoints();
    
    // 배점이 설정된 아이템 목록 수집
    const pointsList = [];
    
    const collectPoints = (targetType, typeLabel) => {
      const categories = itemPoints?.[targetType] || {};
      for (const [category, items] of Object.entries(categories)) {
        for (const [itemName, points] of Object.entries(items)) {
          if (points !== 1) {
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
            .setCustomId(type === 'all' ? `contribution_view_all_${page - 1}` : `contribution_view_type_${type}_${page - 1}`)
            .setLabel('◀️ 이전')
            .setStyle(ButtonStyle.Secondary)
        );
      }
      
      pageButtons.push(
        new ButtonBuilder()
          .setCustomId('contribution_view_page_info')
          .setLabel(`${page + 1}/${totalPages}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      
      if (page < totalPages - 1) {
        pageButtons.push(
          new ButtonBuilder()
            .setCustomId(type === 'all' ? `contribution_view_all_${page + 1}` : `contribution_view_type_${type}_${page + 1}`)
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
          .setCustomId('contribution_points_view')
          .setLabel('◀️ 돌아가기')
          .setStyle(ButtonStyle.Secondary)
      )
    );
    
    await interaction.update({
      content,
      embeds: [],
      components: rows
    });
    
  } catch (error) {
    console.error('❌ 배점 조회 에러:', error);
    await interaction.reply({
      content: '❌ 배점 조회 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}

/**
 * 기여도 메인 화면으로 돌아가기
 */
export async function handleContributionBack(interaction) {
  try {
    const { embed } = await createContributionEmbed();
    const buttons = createContributionButtons();
    
    await interaction.update({
      content: null,
      embeds: [embed],
      components: buttons
    });
    
  } catch (error) {
    console.error('❌ 기여도 화면 복원 에러:', error);
    await interaction.reply({
      content: '❌ 기여도 화면으로 돌아가는 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}
