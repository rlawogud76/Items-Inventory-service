// Command 인터랙션 핸들러 - 메인 라우터

import {
  handleInventoryCommand,
  handleCraftingCommand,
  handleCraftingAddCommand,
  handleCraftingRemoveCommand,
  handleRecipeViewCommand,
  handleRecipeEditCommand,
  handleRecipeDeleteCommand,
  handleHelpCommand,
  handleEmojiCommand,
  handleHistoryCommand,
  handleContributionResetCommand,
  handleStatsCommand
} from './commandHandlers/index.js';

/**
 * Command 인터랙션 처리 함수
 * @param {Interaction} interaction - Discord 인터랙션
 * @param {Map} activeMessages - 활성 메시지 맵 (재고/제작 커맨드용)
 */
export async function handleCommandInteraction(interaction, activeMessages) {
  const { commandName } = interaction;
  
  console.log('커맨드 실행:', commandName);
  
  try {
    // 재고 관련
    if (commandName === '재고') {
      return await handleInventoryCommand(interaction, activeMessages);
    }
    
    // 제작 관련
    else if (commandName === '제작') {
      return await handleCraftingCommand(interaction, activeMessages);
    }
    else if (commandName === '제작품목추가') {
      return await handleCraftingAddCommand(interaction);
    }
    else if (commandName === '제작품목제거') {
      return await handleCraftingRemoveCommand(interaction);
    }
    
    // 레시피 관련
    else if (commandName === '레시피조회') {
      return await handleRecipeViewCommand(interaction);
    }
    else if (commandName === '레시피수정') {
      return await handleRecipeEditCommand(interaction);
    }
    else if (commandName === '레시피삭제') {
      return await handleRecipeDeleteCommand(interaction);
    }
    
    // 기타
    else if (commandName === '도움말') {
      return await handleHelpCommand(interaction);
    }
    else if (commandName === '통계') {
      return await handleStatsCommand(interaction);
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
    
  } catch (error) {
    console.error('커맨드 실행 에러:', error);
    await interaction.reply({ content: '❌ 에러가 발생했습니다: ' + error.message, ephemeral: true }).catch(() => {});
  }
}
