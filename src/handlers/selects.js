// Select 메뉴 인터랙션 핸들러 - 메인 라우터

import {
  handleQuantitySelect,
  handleResetSelect,
  handleRemoveSelect,
  handleEditSelect,
  handleWorkItemSelect,
  handleTagItemsSelect,
  handleConfirmTagRemoveSelect,
  handleTagItemSelect,
  handleRecipeMaterialEditSelect,
  handleRecipeMaterialSelect,
  handleTagColorSelect,
  handleTagForColorSelect,
  handleChangeTagColor,
  handleItemTypeSelect,
  handleTypeChangeSelect,
  handleConfirmTypeChange
} from './selectHandlers/index.js';

/**
 * Select 메뉴 인터랙션 처리 함수
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleSelectInteraction(interaction) {
  console.log('Select 메뉴 감지! customId:', interaction.customId);
  
  // 수량 관리
  if (interaction.customId.startsWith('select_quantity_')) {
    return await handleQuantitySelect(interaction);
  }
  
  // 초기화
  else if (interaction.customId.startsWith('select_reset_')) {
    return await handleResetSelect(interaction);
  }
  
  // 삭제
  else if (interaction.customId.startsWith('select_remove_')) {
    return await handleRemoveSelect(interaction);
  }
  
  // 수정
  else if (interaction.customId.startsWith('select_edit_')) {
    return await handleEditSelect(interaction);
  }
  
  // 작업 항목 선택
  else if (interaction.customId.startsWith('select_item_')) {
    return await handleWorkItemSelect(interaction);
  }
  
  // 물품 유형 선택
  else if (interaction.customId.startsWith('select_item_type_')) {
    return await handleItemTypeSelect(interaction);
  }
  
  // 색상 변경할 태그 선택
  else if (interaction.customId.startsWith('select_tag_for_color_')) {
    return await handleTagForColorSelect(interaction);
  }
  
  // 태그 색상 변경
  else if (interaction.customId.startsWith('change_tag_color_')) {
    return await handleChangeTagColor(interaction);
  }
  
  // 태그 색상 선택
  else if (interaction.customId.startsWith('select_tag_color_')) {
    return await handleTagColorSelect(interaction);
  }
  
  // 태그 항목들 선택 (태그에 추가)
  else if (interaction.customId.startsWith('select_tag_items_')) {
    return await handleTagItemsSelect(interaction);
  }
  
  // 태그 제거 확인
  else if (interaction.customId.startsWith('confirm_tag_remove_')) {
    return await handleConfirmTagRemoveSelect(interaction);
  }
  
  // 태그 항목 선택 (개별)
  else if (interaction.customId.startsWith('select_tag_item_')) {
    return await handleTagItemSelect(interaction);
  }
  
  // 레시피 재료 선택 (수정)
  else if (interaction.customId.startsWith('select_recipe_material_edit_')) {
    return await handleRecipeMaterialEditSelect(interaction);
  }
  
  // 레시피 재료 선택 (추가)
  else if (interaction.customId.startsWith('select_recipe_material_')) {
    return await handleRecipeMaterialSelect(interaction);
  }
  
  // 유형 변경할 아이템 선택
  else if (interaction.customId.startsWith('select_type_change_')) {
    return await handleTypeChangeSelect(interaction);
  }
  
  // 유형 변경 확인
  else if (interaction.customId.startsWith('confirm_type_change_')) {
    return await handleConfirmTypeChange(interaction);
  }
}
