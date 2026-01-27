// Select 메뉴 인터랙션 핸들러 - 메인 라우터

import {
  handleQuantitySelect,
  handleResetSelect,
  handleRemoveSelect,
  handleEditSelect,
  handleReorderFirstSelect,
  handleReorderSecondSelect,
  handleReorderMoveSelect,
  handleSortOptionSelect,
  handleReorderTagFirstSelect,
  handleReorderTagSecondSelect,
  handleWorkItemSelect,
  handleTagItemsSelect,
  handleConfirmTagRemoveSelect,
  handleTagItemSelect,
  handleRecipeEditStartSelect,
  handleRecipeMaterialEditSelect,
  handleRecipeMaterialSelect,
  handleRecipeAddSelect,
  handleRecipeMaterialStandaloneSelect,
  handleTagColorSelect,
  handleTagForColorSelect,
  handleChangeTagColor,
  handleTagActionSelect,
  handleItemTypeSelect,
  handleTypeChangeSelect,
  handleConfirmTypeChange,
  handlePointsItemSelect,
  handleContributionPointsItemSelect,
  handlePermissionMemberSelect,
  handlePermissionAdminSelect
} from './selectHandlers/index.js';
import { requireFeature, resolveFeatureKeyFromCustomId } from '../utils.js';

/**
 * Select 메뉴 인터랙션 처리 함수
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleSelectInteraction(interaction) {
  try {
    console.log('Select 메뉴 감지! customId:', interaction.customId);

    const featureKey = resolveFeatureKeyFromCustomId(interaction.customId);
    const allowed = await requireFeature(interaction, featureKey);
    if (!allowed) return;
  
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
  
  // 순서 변경 첫 번째 선택
  else if (interaction.customId.startsWith('select_reorder_first_')) {
    return await handleReorderFirstSelect(interaction);
  }
  
  // 순서 변경 두 번째 선택
  else if (interaction.customId.startsWith('select_reorder_second_')) {
    return await handleReorderSecondSelect(interaction);
  }
  
  // 위/아래 이동 항목 선택
  else if (interaction.customId.startsWith('select_reorder_move_')) {
    return await handleReorderMoveSelect(interaction);
  }
  
  // 자동 정렬 옵션 선택
  else if (interaction.customId.startsWith('select_sort_option_')) {
    return await handleSortOptionSelect(interaction);
  }

  // 순서 변경 태그 첫 번째 선택
  else if (interaction.customId.startsWith('select_reorder_tag_first_')) {
    return await handleReorderTagFirstSelect(interaction);
  }
  
  // 순서 변경 태그 두 번째 선택
  else if (interaction.customId.startsWith('select_reorder_tag_second_')) {
    return await handleReorderTagSecondSelect(interaction);
  }
  
  // 물품 유형 선택 (must be before select_item_ to avoid conflict)
  else if (interaction.customId.startsWith('select_item_type_')) {
    return await handleItemTypeSelect(interaction);
  }
  
  // 작업 항목 선택
  else if (interaction.customId.startsWith('select_item_')) {
    return await handleWorkItemSelect(interaction);
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

  // 태그 액션 선택 (편집/삭제/색상/병합/보기)
  else if (interaction.customId.startsWith('select_tag_action_')) {
    return await handleTagActionSelect(interaction);
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
  
  // 레시피 수정 시작 (제작품 선택 후 1단계 재료 선택)
  else if (interaction.customId.startsWith('select_recipe_edit_') && !interaction.customId.startsWith('select_recipe_material_edit_') && !interaction.customId.startsWith('select_recipe_add_')) {
    return await handleRecipeEditStartSelect(interaction);
  }
  
  // 레시피 재료 선택 (독립 실행)
  else if (interaction.customId.startsWith('select_recipe_material_standalone_')) {
    return await handleRecipeMaterialStandaloneSelect(interaction);
  }
  
  // 레시피 재료 선택 (수정)
  else if (interaction.customId.startsWith('select_recipe_material_edit_')) {
    return await handleRecipeMaterialEditSelect(interaction);
  }
  
  // 레시피 재료 선택 (추가)
  else if (interaction.customId.startsWith('select_recipe_material_')) {
    return await handleRecipeMaterialSelect(interaction);
  }
  
  // 레시피 추가 제작품 선택
  else if (interaction.customId.startsWith('select_recipe_add_')) {
    return await handleRecipeAddSelect(interaction);
  }
  
  // 유형 변경할 아이템 선택
  else if (interaction.customId.startsWith('select_type_change_')) {
    return await handleTypeChangeSelect(interaction);
  }
  
  // 유형 변경 확인
  else if (interaction.customId.startsWith('confirm_type_change_')) {
    return await handleConfirmTypeChange(interaction);
  }
  
  // 배점 관리 - 아이템 선택
  else if (interaction.customId.startsWith('select_points_item_')) {
    const parts = interaction.customId.split('_');
    return await handlePointsItemSelect(interaction, parts);
  }
  
  // 기여도 배점 관리 - 아이템 선택
  else if (interaction.customId.startsWith('contribution_select_points_')) {
    return await handleContributionPointsItemSelect(interaction);
  }

  // 권한 설정 - 멤버 권한 범위 선택
  else if (interaction.customId === 'perm_member_features_select') {
    return await handlePermissionMemberSelect(interaction);
  }
  // 권한 설정 - 관리자 권한 범위 선택
  else if (interaction.customId === 'perm_admin_features_select') {
    return await handlePermissionAdminSelect(interaction);
  }
  } catch (error) {
    console.error('셀렉트 처리 에러:', error);
    try {
      if (interaction.deferred) {
        await interaction.followUp({ content: `오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`, ephemeral: true });
      } else if (!interaction.replied) {
        await interaction.reply({ content: `오류가 발생했습니다: ${error?.message || '알 수 없는 오류'}`, ephemeral: true });
      }
    } catch (replyError) {
      console.error('에러 응답 실패:', replyError.message);
    }
  }
}
