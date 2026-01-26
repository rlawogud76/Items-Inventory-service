// Command 인터랙션 핸들러 - 메인 라우터

import {
  handleInventoryCommand,
  handleCraftingCommand,
  handleUsageCommand,
  handleEmojiCommand,
  handleHistoryCommand,
  handleContributionResetCommand,
  handleContributionCommand,
  handleRepairCommand,
  handlePermissionsCommand,
  handlePermissionStatusCommand,
  handleEmbedCompareCommand,
  handleCloseAllMessagesCommand
} from './commandHandlers/index.js';
import { requireFeature, resolveFeatureKeyFromCommand } from '../utils.js';

/**
 * Command 인터랙션 처리 함수
 * @param {Interaction} interaction - Discord 인터랙션
 * @param {Map} activeMessages - 활성 메시지 맵 (재고/제작 커맨드용)
 */
export async function handleCommandInteraction(interaction, activeMessages) {
  const { commandName } = interaction;
  
  console.log('커맨드 실행:', commandName);
  
  try {
    const featureKey = resolveFeatureKeyFromCommand(commandName);
    const allowed = await requireFeature(interaction, featureKey);
    if (!allowed) return;

    // 재고 관련
    if (commandName === '재고') {
      return await handleInventoryCommand(interaction, activeMessages);
    }
    
    // 제작 관련
    else if (commandName === '제작') {
      return await handleCraftingCommand(interaction, activeMessages);
    }
    
    // 기타
    else if (commandName === '사용법') {
      return await handleUsageCommand(interaction);
    }
    else if (commandName === '기여도') {
      return await handleContributionCommand(interaction);
    }
    else if (commandName === '이모지설정') {
      return await handleEmojiCommand(interaction);
    }
    else if (commandName === '수정내역') {
      return await handleHistoryCommand(interaction);
    }
    else if (commandName === '기여도초기화') {
      return await handleContributionResetCommand(interaction);
    }
    else if (commandName === '복구') {
      return await handleRepairCommand(interaction);
    }
    else if (commandName === '권한설정') {
      return await handlePermissionsCommand(interaction);
    }
    else if (commandName === '권한조회') {
      return await handlePermissionStatusCommand(interaction);
    }
    else if (commandName === '임베드비교') {
      return await handleEmbedCompareCommand(interaction);
    }
    else if (commandName === '메시지닫기') {
      return await handleCloseAllMessagesCommand(interaction, activeMessages);
    }
    
  } catch (error) {
    console.error('커맨드 실행 에러:', error);
    try {
      if (interaction.deferred) {
        await interaction.followUp({ content: '오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'), ephemeral: true });
      } else if (!interaction.replied) {
        await interaction.reply({ content: '오류가 발생했습니다: ' + (error?.message || '알 수 없는 오류'), ephemeral: true });
      }
    } catch (replyError) {
      console.error('에러 응답 실패:', replyError.message);
    }
  }
}
