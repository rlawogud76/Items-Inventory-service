// 기여도 커맨드 핸들러

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { getHistory, getItemPoints } from '../../database.js';
import { calculateContributions, generateRankings } from '../../services/contributionService.js';

/**
 * 기여도 관리 버튼 생성
 */
export function createContributionButtons() {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('contribution_refresh')
      .setLabel('🔄 새로고침')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('contribution_points_manage')
      .setLabel('⭐ 배점 설정')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('contribution_points_view')
      .setLabel('📋 배점 조회')
      .setStyle(ButtonStyle.Secondary)
  );
  
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('contribution_reset_confirm')
      .setLabel('🗑️ 기여도 초기화')
      .setStyle(ButtonStyle.Danger)
  );
  
  return [row1, row2];
}

/**
 * 기여도 임베드 생성
 */
export async function createContributionEmbed() {
  const [histories, itemPoints] = await Promise.all([
    getHistory(1000),
    getItemPoints()
  ]);
  
  // 재고 기여도 계산
  const inventoryResult = calculateContributions(
    histories,
    itemPoints,
    { type: 'inventory', period: 'current' }
  );
  
  // 제작 기여도 계산
  const craftingResult = calculateContributions(
    histories,
    itemPoints,
    { type: 'crafting', period: 'current' }
  );
  
  // 순위 생성
  const inventoryRankings = generateRankings(inventoryResult.userScores, 3);
  const craftingRankings = generateRankings(craftingResult.userScores, 3);
  
  // 기간 시작일 포맷팅
  const periodStart = inventoryResult.periodStart || craftingResult.periodStart;
  const periodText = periodStart
    ? new Date(periodStart).toLocaleDateString('ko-KR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }) + '부터 현재까지'
    : '전체 기간';
  
  // Embed 생성
  const embed = new EmbedBuilder()
    .setTitle(`📊 기여도 순위 (${periodText})`)
    .setColor(0x5865F2)
    .setTimestamp();
  
  // 재고 기여도 섹션
  const inventoryText = [];
  inventoryText.push('**📦 재고 기여도 TOP 3**');
  inventoryText.push('');
  
  if (inventoryRankings.length === 0) {
    inventoryText.push('기여도 데이터가 없습니다.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    inventoryRankings.forEach(ranking => {
      const medal = medals[ranking.rank - 1];
      const scoreFormatted = ranking.score.toLocaleString('ko-KR', {
        maximumFractionDigits: 0
      });
      inventoryText.push(`${medal} **${ranking.userName}** - ${scoreFormatted}점 (${ranking.count}회)`);
    });
  }
  
  embed.addFields({
    name: '\u200B',
    value: inventoryText.join('\n'),
    inline: false
  });
  
  // 구분선
  embed.addFields({
    name: '\u200B',
    value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    inline: false
  });
  
  // 제작 기여도 섹션
  const craftingText = [];
  craftingText.push('**🔨 제작 기여도 TOP 3**');
  craftingText.push('');
  
  if (craftingRankings.length === 0) {
    craftingText.push('기여도 데이터가 없습니다.');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    craftingRankings.forEach(ranking => {
      const medal = medals[ranking.rank - 1];
      const scoreFormatted = ranking.score.toLocaleString('ko-KR', {
        maximumFractionDigits: 0
      });
      craftingText.push(`${medal} **${ranking.userName}** - ${scoreFormatted}점 (${ranking.count}회)`);
    });
  }
  
  embed.addFields({
    name: '\u200B',
    value: craftingText.join('\n'),
    inline: false
  });
  
  return { embed, hasData: histories.length > 0 };
}

/**
 * /기여도 커맨드 처리
 */
export async function handleContributionCommand(interaction) {
  try {
    const { embed, hasData } = await createContributionEmbed();
    const buttons = createContributionButtons();
    
    // 메시지 전송 (버튼 포함, 프라이빗 메시지)
    await interaction.reply({ 
      embeds: [embed], 
      components: buttons,
      ephemeral: true
    });
    
  } catch (error) {
    console.error('❌ 기여도 명령어 처리 실패:', error);
    await interaction.reply({
      content: '❌ 기여도 조회 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}
