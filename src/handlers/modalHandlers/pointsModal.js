// 배점 관리 모달 핸들러

import { getItemPoints, updateItemPoints } from '../../database.js';
import { getTimeoutSettings, decodeCustomIdPart, isAdmin, safeErrorReply } from '../../utils.js';

/**
 * 배점 입력 모달 처리 (재고/제작 설정용)
 */
export async function handlePointsModal(interaction, parts) {
  // 관리자/서버장만 배점 설정 가능
  const adminCheck = await isAdmin(interaction);
  if (!adminCheck) {
    return await safeErrorReply(interaction, '❌ 배점 설정은 관리자 또는 서버장만 사용할 수 있습니다.', true);
  }

  const type = parts[2];
  const category = parts[3];
  const itemName = decodeCustomIdPart(parts.slice(4).join('_')); // 아이템 이름 (언더스코어 포함 가능)
  
  const newPointsStr = interaction.fields.getTextInputValue('points').trim();
  const newPoints = parseInt(newPointsStr);
  
  // 입력 검증
  if (isNaN(newPoints) || newPoints < 0 || newPoints > 100) {
    const timeouts = await getTimeoutSettings();
    await interaction.reply({
      content: `❌ 배점은 0~100 사이의 숫자여야 합니다.\n\n_이 메시지는 ${timeouts.info}초 후 자동 삭제됩니다_`,
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
    const oldPoints = itemPoints?.[type]?.[category]?.[itemName] ?? 1;
    
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

/**
 * 기여도 배점 입력 모달 처리
 */
export async function handleContributionPointsModal(interaction, parts) {
  // 관리자/서버장만 배점 설정 가능
  const adminCheck = await isAdmin(interaction);
  if (!adminCheck) {
    return await safeErrorReply(interaction, '❌ 배점 설정은 관리자 또는 서버장만 사용할 수 있습니다.', true);
  }

  // customId: contribution_modal_points_inventory_해양_산호
  const type = parts[3];
  const category = parts[4];
  const itemName = decodeCustomIdPart(parts.slice(5).join('_'));
  
  const newPointsStr = interaction.fields.getTextInputValue('points').trim();
  const newPoints = parseInt(newPointsStr);
  
  // 입력 검증
  if (isNaN(newPoints) || newPoints < 0 || newPoints > 100) {
    await interaction.reply({
      content: '❌ 배점은 0~100 사이의 숫자여야 합니다.',
      ephemeral: true
    });
    return;
  }
  
  try {
    // 현재 배점 조회
    const itemPoints = await getItemPoints();
    const oldPoints = itemPoints?.[type]?.[category]?.[itemName] ?? 1;
    
    // 배점 업데이트
    await updateItemPoints(type, category, itemName, newPoints);
    
    // 성공 메시지 후 카테고리 아이템 목록으로 돌아가기
    const { handleContributionPointsCategory } = await import('../buttonHandlers/contribution.js');
    
    // 임시 성공 메시지 표시
    await interaction.deferUpdate();
    
    // 메시지 업데이트로 성공 표시 후 목록으로 돌아가기
    await interaction.editReply({
      content: `✅ **${itemName}** 배점이 ${oldPoints}점 → ${newPoints}점으로 수정되었습니다.\n\n잠시 후 목록으로 돌아갑니다...`,
      embeds: [],
      components: []
    });
    
    // 1초 후 카테고리 목록으로 돌아가기
    setTimeout(async () => {
      try {
        await handleContributionPointsCategory(interaction, type, category, 0);
      } catch (error) {
        console.error('❌ 목록 복원 실패:', error);
      }
    }, 1000);
    
  } catch (error) {
    console.error('❌ 배점 업데이트 실패:', error);
    await interaction.reply({
      content: '❌ 배점 업데이트 중 오류가 발생했습니다.',
      ephemeral: true
    }).catch(() => {});
  }
}
