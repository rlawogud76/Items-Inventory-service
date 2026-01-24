// 기여도 초기화 핸들러
import { EmbedBuilder } from 'discord.js';
import { clearHistory, getHistoryCount } from '../../database.js';
import { getTimeoutSettingsAsync } from '../../utils.js';

/**
 * 기여도 초기화 확인 버튼 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleConfirmContributionReset(interaction) {
  try {
    const historyCount = await getHistoryCount();
    await clearHistory();
    
    const { infoTimeout } = await getTimeoutSettingsAsync();
    
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ 기여도 초기화 완료')
      .setDescription([
        `**${historyCount}개**의 수정 내역이 삭제되었습니다.`,
        '',
        '모든 기여도 통계가 초기화되었습니다.',
        '',
        `_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`
      ].join('\n'));
    
    await interaction.update({ 
      embeds: [successEmbed], 
      components: [] 
    });
    
    console.log(`✅ 기여도 초기화 완료 (${historyCount}개 삭제)`);
    
    // 설정된 시간 후 메시지 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, infoTimeout);
    
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
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleCancelContributionReset(interaction) {
  try {
    const { infoTimeout } = await getTimeoutSettingsAsync();
    
    const cancelEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('❌ 기여도 초기화 취소')
      .setDescription(`기여도 초기화가 취소되었습니다.\n\n_이 메시지는 ${infoTimeout / 1000}초 후 자동 삭제됩니다_`);
    
    await interaction.update({ 
      embeds: [cancelEmbed], 
      components: [] 
    });
    
    console.log('❌ 기여도 초기화 취소됨');
    
    // 설정된 시간 후 메시지 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {
        // 이미 삭제되었거나 삭제할 수 없는 경우 무시
      }
    }, infoTimeout);
    
  } catch (error) {
    console.error('❌ 취소 버튼 에러:', error);
    await interaction.reply({ 
      content: `❌ 오류가 발생했습니다: ${error.message}`, 
      ephemeral: true 
    }).catch(() => {});
  }
}
