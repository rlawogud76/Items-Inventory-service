// 버튼 인터랙션 핸들러 - 메인 라우터
// 
// 📋 목차:
// ├─ 1. 페이지네이션 (page_prev_embed_, page_next_embed_) → pagination.js
// ├─ 2. 새로고침 (refresh) → refresh.js
// ├─ 3. 수량관리 (quantity) → quantity.js
// ├─ 4. 초기화 (reset, reset_individual, reset_batch) → reset.js
// ├─ 5. 물품/품목 관리 (manage, manage_add, manage_remove, manage_edit) → manage.js
// ├─ 6. 레시피 (recipe_crafting_, recipe_view_, recipe_edit_) → recipe.js
// ├─ 7. 태그 (manage_tag, tag_set_, tag_remove_, tag_view_) → tag.js
// ├─ 8. 설정 (ui_mode, bar_size, auto_refresh) → settings.js
// ├─ 9. 작업 (collecting, crafting, stop_collecting_, stop_crafting_) → work.js
// ├─ 10. 수량 액션 (quantity_add_, quantity_edit_, quantity_subtract_) → quantityActions.js
// ├─ 11. 레시피 플로우 (add_recipe_, skip_recipe_, add_more_recipe_, finish_recipe_) → recipe.js
// └─ 12. 기여도 초기화 (confirm_contribution_reset, cancel_contribution_reset) → contribution.js



// 분리된 핸들러 import
import { 
  handlePageNavigation,
  handlePageJump,
  handleGenericPageJump,
  handleRecipeMaterialPageNavigation,
  handleRecipeMaterialStandalonePageNavigation,
  handleRecipeAddPageNavigation,
  handleRefresh,
  handleQuantityButton,
  handleQuantityPageButton,
  handleResetButton,
  handleResetTypeButton,
  handleResetPageButton,
  handleManageButton,
  handleManageAddButton,
  handleAddItemStep2Button,
  handleAddItemTypeButton,
  handleManageTypeButton,
  handleManageTypePageButton,
  handleManageRemoveButton,
  handleManageEditButton,
  handleManageRemovePageButton,
  handleManageEditPageButton,
  handleManageTagButton,
  handleManageReorderButton,
  handleManageReorderPageButton,
  handleManageReorderSecondPageButton,
  handleReorderMoveButton,
  handleReorderSortButton,
  handleMoveItemPositionButton,
  handleMoveItemButton,
  handleReorderTagButton,
  handleReorderTagPageButton,
  handleTagSetButton,
  handleTagRemoveButton,
  handleTagColorButton,
  handleTagViewButton,
  handleTagRemovePageButton,
  handleTagColorPageButton,
  handleTagItemsPageButton,
  handleTagItemsConfirmButton,
  handleTagItemsClearButton,
  handleTagCreateButton,
  handleTagEditButton,
  handleTagDeleteButton,
  handleTagSearchButton,
  handleTagMergeButton,
  handleTagCleanupButton,
  handleTagActionPageButton,
  handleTagViewPageButton,
  handleTagEditAddButton,
  handleTagEditRemoveButton,
  handleTagDeleteConfirmButton,
  handleTagDeleteCancelButton,
  handleTagMergeConfirmButton,
  handleTagMergeCancelButton,
  handleRecipeButton,
  handleRecipeViewButton,
  handleRecipeAddButton,
  handleRecipeEditButton,
  handleRecipeAddSkipButton,
  handleRecipeMoreFinishButton,
  handleRecipeStandaloneMoreFinishButton,
  handleBarSizeButton,
  handleUiModeButton,
  handleAutoRefreshButton,
  handleTimeoutSettingsButton,
  handleWorkButton,
  handleWorkPageButton,
  handleStopWorkButton,
  handleQuantityActionButton,
  handleConfirmContributionReset,
  handleCancelContributionReset,
  handleContributionRefresh,
  handleContributionResetConfirm,
  handleContributionPointsManage,
  handleContributionPointsType,
  handleContributionPointsCategory,
  handleContributionPointsResetAll,
  handleContributionPointsView,
  handleContributionViewType,
  handleContributionBack,
  handleRecipeMaterialPagination,
  handleRecipeEditPagination,
  handlePointsManageButton,
  handlePointsTypeButton,
  handlePointsCategoryButton,
  handlePointsResetButton,
  handlePointsViewButton,
  handlePointsViewTypeButton,
  handlePermissionRefresh,
  handlePermissionAdminAdd,
  handlePermissionAdminRemove,
  handlePermissionAdminFeatures,
  handlePermissionMemberEdit
} from './buttonHandlers/index.js';
import { requireFeature, resolveFeatureKeyFromCustomId } from '../utils.js';

// 버튼 인터랙션 처리 함수
export async function handleButtonInteraction(interaction) {
  try {
    console.log('버튼 클릭 감지! customId:', interaction.customId);

    const featureKey = resolveFeatureKeyFromCustomId(interaction.customId);
    const allowed = await requireFeature(interaction, featureKey);
    if (!allowed) return;
    
    // ============================================
    // 1. 페이지네이션 핸들러 (분리됨)
    // ============================================
    if (interaction.customId.startsWith('page_prev_embed_') || interaction.customId.startsWith('page_next_embed_')) {
      return await handlePageNavigation(interaction);
    }
    
    // 페이지 점프 버튼 (임베드용) - 먼저 체크해야 함!
    else if (interaction.customId.startsWith('page_jump_embed_')) {
      return await handlePageJump(interaction);
    }
    
    // 페이지 점프 버튼 (범용 - 셀렉트 메뉴 등)
    else if (interaction.customId.startsWith('page_') && interaction.customId.includes('_jump_')) {
      return await handleGenericPageJump(interaction);
    }
    
    // ============================================
    // 2. 새로고침 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('refresh')) {
      return await handleRefresh(interaction);
    }
    
    // ============================================
    // 3. 수량관리 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('page_quantity_')) {
      // 수량관리 페이지네이션
      return await handleQuantityPageButton(interaction);
    }
    
    else if (interaction.customId.startsWith('quantity') && 
             !interaction.customId.startsWith('quantity_add_') && 
             !interaction.customId.startsWith('quantity_edit_') && 
             !interaction.customId.startsWith('quantity_subtract_')) {
      return await handleQuantityButton(interaction);
    }
    
    // ============================================
    // 4. 초기화 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('reset') && !interaction.customId.startsWith('reset_individual') && !interaction.customId.startsWith('reset_batch')) {
      return await handleResetButton(interaction);
    }
    
    else if (interaction.customId.startsWith('reset_individual') || interaction.customId.startsWith('reset_batch')) {
      return await handleResetTypeButton(interaction);
    }
    
    // ============================================
    // 5. 물품/품목 관리 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('manage') && !interaction.customId.startsWith('manage_add') && !interaction.customId.startsWith('manage_remove') && !interaction.customId.startsWith('manage_edit') && !interaction.customId.startsWith('manage_tag') && !interaction.customId.startsWith('manage_type') && !interaction.customId.startsWith('manage_reorder')) {
      return await handleManageButton(interaction);
    }
    
    else if (interaction.customId.startsWith('manage_add')) {
      return await handleManageAddButton(interaction);
    }
    
    else if (interaction.customId.startsWith('add_item_step2_btn_')) {
      return await handleAddItemStep2Button(interaction);
    }
    
    else if (interaction.customId.startsWith('add_item_type_btn_')) {
      return await handleAddItemTypeButton(interaction);
    }
    
    else if (interaction.customId.startsWith('manage_remove')) {
      return await handleManageRemoveButton(interaction);
    }
    
    else if (interaction.customId.startsWith('manage_edit')) {
      return await handleManageEditButton(interaction);
    }
    
    else if (interaction.customId.startsWith('manage_reorder')) {
      return await handleManageReorderButton(interaction);
    }
    
    else if (interaction.customId.startsWith('reorder_move_')) {
      return await handleReorderMoveButton(interaction);
    }
    
    else if (interaction.customId.startsWith('reorder_sort_')) {
      return await handleReorderSortButton(interaction);
    }

    else if (interaction.customId.startsWith('reorder_tag_')) {
      return await handleReorderTagButton(interaction);
    }
    
    else if (interaction.customId.startsWith('move_item_position_')) {
      return await handleMoveItemPositionButton(interaction);
    }
    
    else if (interaction.customId.startsWith('move_item_')) {
      return await handleMoveItemButton(interaction);
    }

    // 태그 페이지네이션
    else if (interaction.customId.startsWith('page_prev_tag_remove_') || interaction.customId.startsWith('page_next_tag_remove_')) {
      return await handleTagRemovePageButton(interaction);
    }
    
    else if (interaction.customId.startsWith('page_prev_tag_color_') || interaction.customId.startsWith('page_next_tag_color_')) {
      return await handleTagColorPageButton(interaction);
    }
    
    else if (interaction.customId.startsWith('page_prev_tag_items_') || interaction.customId.startsWith('page_next_tag_items_')) {
      return await handleTagItemsPageButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_items_confirm_')) {
      return await handleTagItemsConfirmButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_items_clear_')) {
      return await handleTagItemsClearButton(interaction);
    }

    else if (interaction.customId.startsWith('page_prev_tag_action_') || interaction.customId.startsWith('page_next_tag_action_')) {
      return await handleTagActionPageButton(interaction);
    }

    else if (interaction.customId.startsWith('page_prev_tag_view_') || interaction.customId.startsWith('page_next_tag_view_')) {
      return await handleTagViewPageButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_edit_add_')) {
      return await handleTagEditAddButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_edit_remove_')) {
      return await handleTagEditRemoveButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_delete_confirm_')) {
      return await handleTagDeleteConfirmButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_delete_cancel_')) {
      return await handleTagDeleteCancelButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_merge_confirm_')) {
      return await handleTagMergeConfirmButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_merge_cancel_')) {
      return await handleTagMergeCancelButton(interaction);
    }
    
    // ============================================
    // 6. 레시피 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('recipe_crafting_') || interaction.customId.startsWith('recipe_inventory_')) {
      return await handleRecipeButton(interaction);
    }
    
    else if (interaction.customId.startsWith('recipe_view_')) {
      return await handleRecipeViewButton(interaction);
    }
    
    else if (interaction.customId.startsWith('recipe_add_')) {
      return await handleRecipeAddButton(interaction);
    }
    
    else if (interaction.customId.startsWith('recipe_edit_')) {
      return await handleRecipeEditButton(interaction);
    }
    
    // ============================================
    // 7. 태그 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('manage_type_')) {
      return await handleManageTypeButton(interaction);
    }
    
    else if (interaction.customId.startsWith('manage_tag')) {
      return await handleManageTagButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_create_')) {
      return await handleTagCreateButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_edit_')) {
      return await handleTagEditButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_delete_')) {
      return await handleTagDeleteButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_search_')) {
      return await handleTagSearchButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_merge_')) {
      return await handleTagMergeButton(interaction);
    }

    else if (interaction.customId.startsWith('tag_cleanup_')) {
      return await handleTagCleanupButton(interaction);
    }
    
    else if (interaction.customId.startsWith('tag_set_')) {
      return await handleTagSetButton(interaction);
    }
    
    else if (interaction.customId.startsWith('tag_remove_')) {
      return await handleTagRemoveButton(interaction);
    }
    
    else if (interaction.customId.startsWith('tag_color_')) {
      return await handleTagColorButton(interaction);
    }
    
    else if (interaction.customId.startsWith('tag_view_')) {
      return await handleTagViewButton(interaction);
    }
    
    // ============================================
    // 8. 설정 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('bar_size')) {
      return await handleBarSizeButton(interaction);
    }
    
    else if (interaction.customId.startsWith('ui_mode')) {
      return await handleUiModeButton(interaction);
    }
    
    else if (interaction.customId.startsWith('auto_refresh')) {
      return await handleAutoRefreshButton(interaction);
    }
    
    else if (interaction.customId.startsWith('timeout_settings')) {
      return await handleTimeoutSettingsButton(interaction);
    }
    
    // ============================================
    // 9. 작업 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('collecting') || interaction.customId.startsWith('crafting')) {
      // crafting_stop은 제외
      if (!interaction.customId.startsWith('stop_collecting_') && !interaction.customId.startsWith('stop_crafting_')) {
        return await handleWorkButton(interaction);
      }
    }
    
    else if (interaction.customId.startsWith('page_prev_') || interaction.customId.startsWith('page_next_')) {
      // 레시피 재료 선택 페이지 이동 (독립 실행)
      if (interaction.customId.includes('_recipe_material_standalone_')) {
        return await handleRecipeMaterialStandalonePageNavigation(interaction);
      }
      // 레시피 재료 선택 페이지 이동
      else if (interaction.customId.includes('_recipe_material_')) {
        return await handleRecipeMaterialPageNavigation(interaction);
      }
      // 레시피 추가 제작품 선택 페이지 이동
      else if (interaction.customId.includes('_recipe_add_')) {
        return await handleRecipeAddPageNavigation(interaction);
      }
      // 레시피 수정 제작품 선택 페이지 이동
      else if (interaction.customId.includes('_recipe_edit_')) {
        return await handleRecipeEditPagination(interaction);
      }
      // 수량관리 페이지 이동
      else if (interaction.customId.includes('_quantity_')) {
        return await handleQuantityPageButton(interaction);
      }
      // 초기화 페이지 이동
      else if (interaction.customId.includes('_reset_')) {
        return await handleResetPageButton(interaction);
      }
      // 삭제 페이지 이동
      else if (interaction.customId.includes('_remove_')) {
        return await handleManageRemovePageButton(interaction);
      }
      // 수정 페이지 이동
      else if (interaction.customId.includes('_edit_')) {
        return await handleManageEditPageButton(interaction);
      }
      // 유형 변경 페이지 이동
      else if (interaction.customId.includes('_type_')) {
        return await handleManageTypePageButton(interaction);
      }
      // 태그 묶음 이동 페이지 이동
      else if (interaction.customId.includes('_reorder_tag_')) {
        return await handleReorderTagPageButton(interaction);
      }
      // 순서 변경 페이지 이동
      else if (interaction.customId.includes('_reorder_second_')) {
        return await handleManageReorderSecondPageButton(interaction);
      }
      else if (interaction.customId.includes('_reorder_')) {
        return await handleManageReorderPageButton(interaction);
      }
      // 작업 페이지 이동 (collecting/crafting) - 가장 마지막에 체크!!!!
      else if (interaction.customId.includes('_collecting_') || interaction.customId.includes('_crafting_')) {
        return await handleWorkPageButton(interaction);
      }
    }
    
    else if (interaction.customId.startsWith('stop_collecting_') || interaction.customId.startsWith('stop_crafting_')) {
      return await handleStopWorkButton(interaction);
    }
    
    // ============================================
    // 10. 수량 액션 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('quantity_add_') || 
             interaction.customId.startsWith('quantity_edit_') || 
             interaction.customId.startsWith('quantity_subtract_') ||
             interaction.customId.startsWith('quantity_edit_required_')) {
      return await handleQuantityActionButton(interaction);
    }
    
    // ============================================
    // 11. 레시피 플로우 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId.startsWith('add_recipe_') || interaction.customId.startsWith('skip_recipe_')) {
      return await handleRecipeAddSkipButton(interaction);
    }
    
    // Standalone 핸들러를 먼저 체크 (더 구체적인 조건)
    else if (interaction.customId.startsWith('add_more_recipe_standalone_') ||
             interaction.customId.startsWith('finish_recipe_standalone_')) {
      return await handleRecipeStandaloneMoreFinishButton(interaction);
    }
    
    else if (interaction.customId.startsWith('add_more_recipe_') || 
             interaction.customId.startsWith('finish_recipe_') ||
             interaction.customId.startsWith('add_more_recipe_edit_') ||
             interaction.customId.startsWith('finish_recipe_edit_')) {
      return await handleRecipeMoreFinishButton(interaction);
    }
    
    // ============================================
    // 12. 기여도 관리 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId === 'confirm_contribution_reset') {
      return await handleConfirmContributionReset(interaction);
    }
    
    else if (interaction.customId === 'cancel_contribution_reset') {
      return await handleCancelContributionReset(interaction);
    }
    
    // 기여도 새로고침
    else if (interaction.customId === 'contribution_refresh') {
      return await handleContributionRefresh(interaction);
    }
    
    // 기여도 초기화 확인 요청
    else if (interaction.customId === 'contribution_reset_confirm') {
      return await handleContributionResetConfirm(interaction);
    }
    
    // 기여도 배점 설정 메뉴
    else if (interaction.customId === 'contribution_points_manage') {
      return await handleContributionPointsManage(interaction);
    }
    
    // 기여도 배점 타입 선택
    else if (interaction.customId.startsWith('contribution_points_type_')) {
      const type = interaction.customId.split('_')[3]; // inventory or crafting
      return await handleContributionPointsType(interaction, type);
    }
    
    // 기여도 배점 카테고리 선택
    else if (interaction.customId.startsWith('contribution_points_category_')) {
      const parts = interaction.customId.split('_');
      const type = parts[3];
      const category = parts[4];
      const page = parseInt(parts[5]) || 0;
      return await handleContributionPointsCategory(interaction, type, category, page);
    }
    
    // 기여도 배점 전체 초기화
    else if (interaction.customId === 'contribution_points_reset_all') {
      return await handleContributionPointsResetAll(interaction);
    }
    
    // 기여도 배점 조회 메뉴
    else if (interaction.customId === 'contribution_points_view') {
      return await handleContributionPointsView(interaction);
    }
    
    // 기여도 배점 조회 - 타입별/전체
    else if (interaction.customId.startsWith('contribution_view_type_') || interaction.customId.startsWith('contribution_view_all_')) {
      const parts = interaction.customId.split('_');
      if (parts[2] === 'all') {
        const page = parseInt(parts[3]) || 0;
        return await handleContributionViewType(interaction, 'all', page);
      } else {
        const type = parts[3];
        const page = parseInt(parts[4]) || 0;
        return await handleContributionViewType(interaction, type, page);
      }
    }
    
    // 기여도 메인 화면으로 돌아가기
    else if (interaction.customId === 'contribution_back') {
      return await handleContributionBack(interaction);
    }
    
    // ============================================
    // 13. 배점 관리 핸들러 (재고/제작용 - 분리됨)
    // ============================================
    else if (interaction.customId === 'points_manage') {
      // 첫 클릭인지 뒤로가기인지 구분
      // 첫 클릭: interaction.message가 임베드 메시지 (embeds 있음)
      // 뒤로가기: interaction.message가 배점 메뉴 (embeds 없음)
      const isBackButton = !interaction.message.embeds || interaction.message.embeds.length === 0;
      return await handlePointsManageButton(interaction, isBackButton);
    }
    
    else if (interaction.customId.startsWith('points_type_')) {
      const parts = interaction.customId.split('_');
      return await handlePointsTypeButton(interaction, parts);
    }
    
    else if (interaction.customId.startsWith('points_category_')) {
      const parts = interaction.customId.split('_');
      return await handlePointsCategoryButton(interaction, parts);
    }
    
    else if (interaction.customId === 'points_reset') {
      return await handlePointsResetButton(interaction);
    }
    
    // 배점 조회 메뉴
    else if (interaction.customId === 'points_view') {
      return await handlePointsViewButton(interaction);
    }
    
    // 배점 조회 (타입별/전체) - points_view_type_inventory_0, points_view_all_0
    else if (interaction.customId.startsWith('points_view_type_') || interaction.customId.startsWith('points_view_all_')) {
      const parts = interaction.customId.split('_');
      return await handlePointsViewTypeButton(interaction, parts);
    }

    // ============================================
    // 14. 권한 설정 핸들러 (분리됨)
    // ============================================
    else if (interaction.customId === 'perm_refresh') {
      return await handlePermissionRefresh(interaction);
    }
    else if (interaction.customId === 'perm_admin_add') {
      return await handlePermissionAdminAdd(interaction);
    }
    else if (interaction.customId === 'perm_admin_remove') {
      return await handlePermissionAdminRemove(interaction);
    }
    else if (interaction.customId === 'perm_admin_features') {
      return await handlePermissionAdminFeatures(interaction);
    }
    else if (interaction.customId === 'perm_member_edit') {
      return await handlePermissionMemberEdit(interaction);
    }
  } catch (error) {
    console.error('버튼 처리 에러:', error);
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
