// Modal 제출 인터랙션 핸들러 - 메인 라우터

import {
  handleRecipeEditQuantityModal,
  handleRecipeQuantityModal,
  handleRecipeStandaloneQuantityModal,
  handleAddItemModalStep1,
  handleAddItemModalStep2,
  handleEditNameModal,
  handleTagNameInputModal,
  handleTagNameModal,
  handleBarSizeModal
} from './modalHandlers/index.js';

/**
 * Modal 제출 인터랙션 처리 함수
 * @param {Interaction} interaction - Discord 인터랙션
 * @returns {boolean} - 처리 여부 (true면 처리됨, false면 index.js에서 처리)
 */
export async function handleModalInteraction(interaction) {
  console.log('Modal 제출 감지! customId:', interaction.customId);
  
  // 레시피 수정 수량
  if (interaction.customId.startsWith('recipe_edit_quantity_modal_')) {
    await handleRecipeEditQuantityModal(interaction);
    return true;
  }
  
  // 레시피 추가 수량 (독립 실행)
  else if (interaction.customId.startsWith('recipe_standalone_quantity_modal_')) {
    await handleRecipeStandaloneQuantityModal(interaction);
    return true;
  }
  
  // 레시피 수량
  else if (interaction.customId.startsWith('recipe_quantity_modal_')) {
    await handleRecipeQuantityModal(interaction);
    return true;
  }
  
  // 물품/품목 추가 - Step 1 (이름 + 초기 수량)
  else if (interaction.customId.startsWith('add_item_modal_step1_')) {
    await handleAddItemModalStep1(interaction);
    return true;
  }
  
  // 물품/품목 추가 - Step 2 (목표 수량)
  else if (interaction.customId.startsWith('add_item_modal_step2_')) {
    await handleAddItemModalStep2(interaction);
    return true;
  }
  
  // 이름 수정
  else if (interaction.customId.startsWith('edit_name_modal_')) {
    await handleEditNameModal(interaction);
    return true;
  }
  
  // 태그 이름 입력 (생성)
  else if (interaction.customId.startsWith('tag_name_input_')) {
    await handleTagNameInputModal(interaction);
    return true;
  }
  
  // 태그 이름 (개별 설정)
  else if (interaction.customId.startsWith('tag_name_modal_')) {
    await handleTagNameModal(interaction);
    return true;
  }
  
  // 바 크기 설정
  else if (interaction.customId.startsWith('bar_size_modal_')) {
    await handleBarSizeModal(interaction);
    return true;
  }
  
  // 나머지는 index.js에서 처리 (수량 등)
  return false;
}
