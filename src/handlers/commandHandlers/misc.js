// 기타 커맨드 핸들러 (사용법, 통계, 이모지설정, 수정내역, 기여도초기화)

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { loadInventory, updateItemDetails, getHistory, getHistoryCount } from '../../database.js';
import { getItemIcon, sendTemporaryReply, getTimeoutSettingsAsync } from '../../utils.js';
import { STACK, EMOJIS, UI } from '../../constants.js';

/**
 * /사용법 커맨드 처리
 */
export async function handleUsageCommand(interaction) {
  const helpEmbed = new EmbedBuilder()
    .setTitle('📘 처음 쓰는 사람을 위한 사용법')
    .setColor(0x5865F2)
    .setDescription('처음 사용해도 바로 이해할 수 있게 핵심만 정리했습니다.')
    .addFields(
      { 
        name: '✅ 1분 시작 가이드', 
        value: [
          '1) `/재고 카테고리:해양` 또는 `/제작 카테고리:해양` 실행',
          '2) 화면의 버튼으로 모든 작업 진행',
          '3) 수량 변경 시 모든 화면 자동 업데이트',
          '',
          '💡 **핵심:** 명령어는 화면 열기용, 나머지는 버튼으로 처리'
        ].join('\n'),
        inline: false
      },
      { 
        name: `${EMOJIS.BOX} 재고 화면`, 
        value: [
          `• ${EMOJIS.BOX} 수집하기: 작업자 등록`,
          '• 📊 수량관리: 추가/수정/차감/목표',
          '• 📋 물품관리: 추가/삭제/이름 수정',
          '• 🏷️ 태그관리: 그룹화',
          '• ♻️ 초기화: 개별/일괄',
          '• 📏 UI/바 크기: 표시 방식 조절'
        ].join('\n'),
        inline: false
      },
      { 
        name: '🔨 제작 화면', 
        value: [
          '• 🔨 제작하기: 작업자 등록',
          '• 📊 수량관리: 추가/수정/차감/목표',
          '• 📦 품목관리: 추가/삭제/이름 수정',
          '• 🏷️ 태그관리: 그룹화',
          '• 📋 레시피: 조회/추가/수정/삭제',
          '• ♻️ 초기화, 📏 UI/바 크기'
        ].join('\n'),
        inline: false
      },
      { 
        name: '🔧 기타 명령어', 
        value: [
          '**`/기여도`**',
          '재고 및 제작 기여도 순위를 확인합니다.',
          '> 재고/제작 분야별 TOP 3 순위 표시',
          '',
          '**`/이모지설정`**',
          '아이템의 커스텀 이모지를 설정합니다.',
          '> 예: `/이모지설정 타입:재고 카테고리:해양 아이템:나무 이모지:🪵`',
          '',
          '**`/수정내역 [개수]`**',
          '최근 수정 내역을 확인합니다 (최대 25개).',
          '> 예: `/수정내역 개수:20`',
          '',
          '**`/메시지닫기`**',
          '프라이빗 포함 모든 활성 메시지를 닫습니다.',
          '> 관리자 전용 명령어',
          '',
          '**`/복구`**',
          '중간 제작품 연동을 복구합니다.'
        ].join('\n'),
        inline: false
      },
      { 
        name: '💡 팁', 
        value: [
          '• **실시간 업데이트**: 수량 변경 시 모든 화면 자동 갱신',
          '• **작업자 표시**: 수집/제작 버튼으로 작업자 표시',
          '• **자동 삭제**: 메시지는 설정된 타이머에 따라 자동 삭제',
          '• **페이지네이션**: 25개 초과 시 페이지 버튼 생성',
          `• **세트 단위**: 낱개 + 세트(${STACK.ITEMS_PER_SET}개) + 상자(${STACK.ITEMS_PER_BOX}개)`,
          `• **진행률 표시**: ${EMOJIS.COLORS.RED}(25%↓) ${EMOJIS.COLORS.YELLOW}(25–90%) ${EMOJIS.COLORS.GREEN}(90%↑)`,
          '• **태그 기능**: 관련 물품을 태그로 그룹화'
        ].join('\n'),
        inline: false
      }
    );
  await sendTemporaryReply(interaction, { embeds: [helpEmbed] }, 60000);
}

/**
 * /이모지설정 커맨드 처리
 */
export async function handleEmojiCommand(interaction) {
  const type = interaction.options.getString('타입');
  const category = interaction.options.getString('카테고리');
  const itemName = interaction.options.getString('아이템');
  const emoji = interaction.options.getString('이모지');
  
  const inventory = await loadInventory();
  
  // 아이템 존재 확인
  const targetData = type === 'inventory' ? inventory.categories : inventory.crafting?.categories;
  
  if (!targetData?.[category]?.[itemName]) {
    return await sendTemporaryReply(interaction, `❌ "${category}" 카테고리에 "${itemName}" 아이템이 존재하지 않습니다.`);
  }
  
  // 이모지 설정 (DB 반영)
  await updateItemDetails(type, category, itemName, { emoji: emoji });
  
  const successEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ 이모지 설정 완료')
    .setDescription([
      `**타입:** ${type === 'inventory' ? '재고' : '제작'}`,
      `**카테고리:** ${category}`,
      `**아이템:** ${emoji} ${itemName}`,
      '',
      '이제 이 아이템은 설정한 이모지로 표시됩니다.'
    ].join('\n'));
  
  await sendTemporaryReply(interaction, { embeds: [successEmbed] });
}

/**
 * /수정내역 커맨드 처리
 */
export async function handleHistoryCommand(interaction) {
  const count = interaction.options.getInteger('개수') || 10;
  const limit = Math.min(count, 25);
  const histories = await getHistory(limit);

  if (histories.length === 0) {
    return sendTemporaryReply(interaction, '📋 수정 내역이 없습니다.');
  }

  const inventory = await loadInventory();
  const embed = new EmbedBuilder()
    .setTitle('📋 수정 내역')
    .setColor(0x5865F2)
    .setTimestamp();

  for (const history of histories) {
    const date = new Date(history.timestamp);
    
    // 한국 시간대(UTC+9)로 변환
    const kstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
    const month = String(kstDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kstDate.getUTCDate()).padStart(2, '0');
    const hour = String(kstDate.getUTCHours()).padStart(2, '0');
    const minute = String(kstDate.getUTCMinutes()).padStart(2, '0');
    const timeStr = `${month}/${day} ${hour}:${minute}`;
    
    const typeEmoji = history.type === 'inventory' ? '📦' : '🔨';
    const actionText = {
      'add': '추가',
      'remove': '제거',
      'update_quantity': '현재 수량 변경',
      'update_required': '목표 수량 변경',
      'reset': '초기화',
      'rename': '이름 수정'
    }[history.action] || history.action;
    
    const icon = getItemIcon(history.itemName, inventory);
    
    embed.addFields({
      name: `${typeEmoji} ${history.category} - ${icon} ${history.itemName}`,
      value: `**${actionText}** by ${history.userName}\n${history.details}\n\`${timeStr}\``,
      inline: false
    });
  }
  
  const total = await getHistoryCount();
  if (total > limit) {
    embed.setFooter({ text: `총 ${total}개 중 ${limit}개 표시` });
  }
  
  // 수정 내역 메시지는 사용자가 직접 닫을 때까지 유지 (자동 삭제 안함)
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/**
 * /기여도초기화 커맨드 처리
 */
export async function handleContributionResetCommand(interaction) {
  const historyCount = await getHistoryCount();

  if (historyCount === 0) {
    return await sendTemporaryReply(interaction, '❌ 초기화할 기여도 데이터가 없습니다.');
  }
  
  // 확인 버튼 생성
  const confirmRow = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('confirm_contribution_reset')
        .setLabel('✅ 확인')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('cancel_contribution_reset')
        .setLabel('❌ 취소')
        .setStyle(ButtonStyle.Secondary)
    );
  
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('⚠️ 기여도 초기화 확인')
    .setDescription([
      '**모든 수정 내역이 삭제됩니다!**',
      '',
      `현재 저장된 내역: **${historyCount}개**`,
      '',
      '이 작업은 되돌릴 수 없습니다.',
      '정말로 초기화하시겠습니까?'
    ].join('\n'));
  
  await interaction.reply({ 
    embeds: [confirmEmbed], 
    components: [confirmRow], 
    ephemeral: true 
  });
}

/**
 * /임베드비교 커맨드 처리
 */
export async function handleEmbedCompareCommand(interaction) {
  const text = ['✅ 상태: 정상', '📦 재고: 120개', '🔨 제작: 8건'].join('\n');

  const embed = new EmbedBuilder()
    .setTitle('상태 요약')
    .setColor(0x5865F2)
    .addFields(
      { name: '상태', value: '정상', inline: true },
      { name: '재고', value: '120개', inline: true },
      { name: '제작', value: '8건', inline: true }
    )
    .setFooter({ text: '임베드 예시 (비교용)' });

  await interaction.reply({
    content: `일반 텍스트:\n${text}`,
    embeds: [embed],
    ephemeral: true
  });
}

/**
 * /메시지닫기 커맨드 처리
 * 프라이빗(에페메랄) 포함 모든 활성 메시지를 닫음
 * @param {Interaction} interaction
 * @param {Map} activeMessages
 */
export async function handleCloseAllMessagesCommand(interaction, activeMessages) {
  const messageMap = activeMessages || global.activeMessages;
  const { infoTimeout } = await getTimeoutSettingsAsync();

  if (!messageMap || messageMap.size === 0) {
    return await sendTemporaryReply(interaction, '닫을 활성 메시지가 없습니다.', infoTimeout);
  }

  await interaction.deferReply({ ephemeral: true });

  const total = messageMap.size;
  let success = 0;
  let failed = 0;

  for (const [messageId, data] of messageMap.entries()) {
    try {
      if (data?.interaction) {
        await data.interaction.deleteReply();
        success += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
    } finally {
      messageMap.delete(messageId);
    }
  }

  await interaction.editReply({
    content: [
      '✅ 모든 활성 메시지를 닫았습니다.',
      `- 대상: ${total}개`,
      `- 성공: ${success}개`,
      `- 실패: ${failed}개`
    ].join('\n')
  });

  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      // ignore
    }
  }, infoTimeout);
}
