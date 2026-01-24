// 수량 관리 modal 핸들러
import { loadInventory, updateMultipleItems } from '../../database.js';
import { sanitizeNumber, getTimeoutSettings } from '../../utils.js';
import { consumeRecipeMaterials, returnRecipeMaterials, adjustRecipeMaterials } from '../../recipeService.js';
import { STACK, LIMITS } from '../../constants.js';

/**
 * 수량 추가/수정/차감/목표수정 modal 핸들러
 * @param {Interaction} interaction - Discord 인터랙션
 */
export async function handleQuantityModal(interaction) {
  try {
    // modal_add_inventory_해양_산호 형식 파싱
    // 마지막 _를 기준으로 아이템명 분리
    const lastUnderscoreIndex = interaction.customId.lastIndexOf('_');
    const itemName = interaction.customId.substring(lastUnderscoreIndex + 1);
    const prefix = interaction.customId.substring(0, lastUnderscoreIndex);
    const parts = prefix.split('_');
    
    let action, type, category;
    // modal_edit_required_inventory_해양 형식 처리
    if (parts[1] === 'edit' && parts[2] === 'required') {
      action = 'edit_required';
      type = parts[3];
      category = parts.slice(4).join('_');
    } else {
      action = parts[1]; // 'add', 'edit', or 'subtract'
      type = parts[2]; // 'inventory' or 'crafting'
      category = parts.slice(3).join('_');
    }
    
    console.log('📝 모달 제출 - 수량 관리 (원자적 업데이트)');
    console.log('  - customId:', interaction.customId);
    console.log('  - action:', action);
    console.log('  - type:', type);
    console.log('  - category:', category);
    console.log('  - itemName:', itemName);
    
    const boxesInput = interaction.fields.getTextInputValue('boxes_change')?.trim() || '0';
    const setsInput = interaction.fields.getTextInputValue('sets_change')?.trim() || '0';
    const itemsInput = interaction.fields.getTextInputValue('items_change')?.trim() || '0';
    
    // 숫자 검증 및 sanitization
    const boxes = sanitizeNumber(boxesInput, { min: 0, max: LIMITS.MAX_BOXES });
    const sets = sanitizeNumber(setsInput, { min: 0, max: LIMITS.MAX_SETS });
    const items = sanitizeNumber(itemsInput, { min: 0, max: LIMITS.MAX_ITEMS });
    
    if (boxes === null || sets === null || items === null) {
      return await interaction.reply({ 
        content: `❌ 수량을 올바르게 입력해주세요. (상자: 0-${LIMITS.MAX_BOXES}, 세트: 0-${LIMITS.MAX_SETS}, 개: 0-${LIMITS.MAX_ITEMS})`, 
        ephemeral: true 
      });
    }
    
    // DB에서 최신 상태 읽기 (검증용)
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    if (!targetData?.categories?.[category]) {
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    if (!targetData?.categories?.[category]?.[itemName]) {
      return await interaction.reply({ 
        content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    const changeAmount = Math.round(boxes * STACK.ITEMS_PER_BOX) + Math.round(sets * STACK.ITEMS_PER_SET) + Math.round(items);
    const itemData = targetData.categories[category][itemName];
    const oldQuantity = itemData.quantity;
    const oldRequired = itemData.required;
    const userName = interaction.user.displayName || interaction.user.username;
    
    console.log('  - 변경량:', changeAmount);
    console.log('  - 기존 수량:', oldQuantity);
    
    let newQuantity = oldQuantity;
    let newRequired = oldRequired;
    let actionText = '';
    
    // 업데이트 계획 생성
    const updates = [];
    const historyEntries = [];
    
    // 제작품인 경우 레시피 처리
    if (type === 'crafting' && action !== 'edit_required') {
      let recipeResult = { success: true, updates: [], historyEntries: [] };
      
      if (action === 'add') {
        recipeResult = consumeRecipeMaterials(inventory, category, itemName, changeAmount, userName);
        newQuantity = oldQuantity + changeAmount;
        actionText = `추가: +${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
      } else if (action === 'subtract') {
        const res = returnRecipeMaterials(inventory, category, itemName, changeAmount, userName);
        recipeResult = { success: true, ...res };
        newQuantity = Math.max(0, oldQuantity - changeAmount);
        actionText = `차감: -${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
      } else if (action === 'edit') {
        recipeResult = adjustRecipeMaterials(inventory, category, itemName, oldQuantity, changeAmount, userName);
        newQuantity = changeAmount;
        actionText = `수정: ${oldQuantity}개 → ${newQuantity}개`;
      }
      
      if (!recipeResult.success) {
        return await interaction.reply({ content: recipeResult.message, ephemeral: true });
      }
      
      if (recipeResult.updates) updates.push(...recipeResult.updates);
      if (recipeResult.historyEntries) historyEntries.push(...recipeResult.historyEntries);
    } else if (action !== 'edit_required') {
      // 일반 재고 아이템
      if (action === 'add') {
        newQuantity = oldQuantity + changeAmount;
        actionText = `추가: +${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
      } else if (action === 'subtract') {
        newQuantity = Math.max(0, oldQuantity - changeAmount);
        actionText = `차감: -${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
      } else if (action === 'edit') {
        newQuantity = changeAmount;
        actionText = `수정: ${oldQuantity}개 → ${newQuantity}개`;
      }
    }
    
    // 메인 아이템 업데이트 추가
    if (action === 'edit_required') {
      newRequired = changeAmount;
      actionText = `목표 수정: ${oldRequired}개 → ${newRequired}개`;
      updates.push({
        type, category, itemName,
        value: newRequired,
        operation: 'set',
        field: 'required'
      });
      
      historyEntries.push({
        timestamp: new Date().toISOString(),
        type, category, itemName,
        action: 'edit_required',
        details: actionText,
        userName
      });
    } else {
      // 수량 변경
      if (action === 'edit') {
        updates.push({
          type, category, itemName,
          value: newQuantity,
          operation: 'set'
        });
      } else {
        // add or subtract (원자적 inc 사용)
        const delta = action === 'add' ? changeAmount : -changeAmount;
        updates.push({
          type, category, itemName,
          delta: delta,
          operation: 'inc'
        });
      }
      
      // 메인 아이템 히스토리
      historyEntries.push({
        timestamp: new Date().toISOString(),
        type, category, itemName,
        action: 'update_quantity',
        details: actionText,
        userName
      });
      
      // 연동 아이템 처리 (항상 메인 아이템 수량과 동기화)
      if (itemData.linkedItem) {
        const [linkedType, linkedCategory, linkedName] = itemData.linkedItem.split('/');
        // 검증: 연동 아이템이 실제로 존재하는지 확인은 생략하고 업데이트 시도 (DB 레벨에서 없으면 무시됨)
        // 하지만 정확성을 위해 inventory에서 확인 권장
        const linkedExists = linkedType === 'inventory' 
          ? inventory.categories?.[linkedCategory]?.[linkedName]
          : inventory.crafting?.categories?.[linkedCategory]?.[linkedName];
          
        if (linkedExists) {
          updates.push({
            type: linkedType,
            category: linkedCategory,
            itemName: linkedName,
            value: newQuantity,
            operation: 'set'
          });
          console.log(`🔄 연동 업데이트 계획 추가: ${itemData.linkedItem} -> ${newQuantity}`);
        }
      }
    }
    
    // DB 업데이트 실행
    await updateMultipleItems(updates, historyEntries);
    
    const syncText = (itemData.linkedItem && action !== 'edit_required') ? '\n🔗 연동된 아이템도 자동 업데이트되었습니다!' : '';
    
    await interaction.reply({ 
      content: `✅ ${itemName}\n수량이 업데이트되었습니다!\n${actionText}${syncText}\n\n_이 메시지는 15초 후 자동 삭제됩니다_`, 
      ephemeral: true 
    });
    
    // 15초 후 자동 삭제
    setTimeout(async () => {
      try {
        await interaction.deleteReply();
      } catch (error) {}
    }, 15000);
    
    console.log('✅ 수량 업데이트 완료 (Atomic)');
    
  } catch (error) {
    console.error('❌ 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 모달 제출 응답 실패:', err);
    });
  }
}

