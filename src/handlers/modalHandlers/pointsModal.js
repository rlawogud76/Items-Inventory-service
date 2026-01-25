// 배점 관리 모달 핸들러

import { getItemPoints, updateItemPoints } from '../../database.js';
import { getTimeoutSettings } from '../../utils.js';

/**
 * 배점 입력 모달 처리
 */
export async function handlePointsModal(interaction, parts) {
  const type = parts[2];
  const category = parts[3];
  const itemName = parts.slice(4).join('_'); // 아이템 이름 (언더스코어 포함 가능)
  
  const newPointsStr = interaction.fields.getTextInputValue('points').trim();
  const newPoints = parseInt(newPointsStr);
  
  // 입력 검증
  if (isNaN(newPoints) || newPoints < 1 || newPoints > 100) {
    const timeouts = await getTimeoutSettings();
    await interaction.reply({
      content: `❌ 배점은 1~100 사이의 숫자여야 합니다.\n\n_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`,
      ephemeral: true
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, timeouts.info * 1000);
    return;
  }
  
  try {
    // 현재 배점 조회
    const itemPoints = await getItemPoints();
    const oldPoints = itemPoints?.[type]?.[category]?.[itemName] || 1;
    
    // 배점 업데이트
    await updateItemPoints(type, category, itemName, newPoints);
    
    const timeouts = await getTimeoutSettings();
    await interaction.reply({
      content: [
        '✅ 배점이 수정되었습니다!',
        '',
        `**${itemName}**: ${oldPoints}점 → ${newPoints}점`,
        '',
        `_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`
      ].join('\n'),
      ephemeral: true
    });
    
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, timeouts.info * 1000);
    
  } catch (error) {
    console.error('❌ 배점 업데이트 실패:', error);
    await interaction.reply({
      content: '❌ 배점 업데이트 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}
