// 기여도 커맨드 핸들러

import { EmbedBuilder } from 'discord.js';
import { getHistory, getItemPoints } from '../../database.js';
import { calculateContributions, generateRankings } from '../../services/contributionService.js';

/**
 * /기여도 커맨드 처리
 */
export async function handleContributionCommand(interaction) {
  try {
    // 히스토리 및 배점 데이터 로드
    const [histories, itemPoints] = await Promise.all([
      getHistory(1000), // 최근 1000개
      getItemPoints()
    ]);
    
    if (histories.length === 0) {
      await interaction.reply({
        content: '❌ 기여도 데이터가 없습니다.',
        ephemeral: true
      });
      return;
    }
    
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
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
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
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
        craftingText.push(`${medal} **${ranking.userName}** - ${scoreFormatted}점 (${ranking.count}회)`);
      });
    }
    
    embed.addFields({
      name: '\u200B',
      value: craftingText.join('\n'),
      inline: false
    });
    
    // 메시지 전송 (영구 지속)
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
  } catch (error) {
    console.error('❌ 기여도 명령어 처리 실패:', error);
    await interaction.reply({
      content: '❌ 기여도 조회 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}
