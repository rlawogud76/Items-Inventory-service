// 수량 관리 modal 핸들러
import { loadInventory, saveInventory } from '../../database.js';
import { addHistory, sanitizeNumber } from '../../utils.js';

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
    
    console.log('📝 모달 제출 - 수량 관리');
    console.log('  - customId:', interaction.customId);
    console.log('  - action:', action);
    console.log('  - type:', type);
    console.log('  - category:', category);
    console.log('  - itemName:', itemName);
    
    const boxesInput = interaction.fields.getTextInputValue('boxes_change')?.trim() || '';
    const setsInput = interaction.fields.getTextInputValue('sets_change').trim();
    const itemsInput = interaction.fields.getTextInputValue('items_change').trim();
    
    // 숫자 검증 및 sanitization
    const boxes = boxesInput ? sanitizeNumber(boxesInput, { min: 0, max: 10000 }) : 0;
    const sets = sanitizeNumber(setsInput, { min: 0, max: 100000 });
    const items = sanitizeNumber(itemsInput, { min: 0, max: 63 });
    
    if (boxes === null || sets === null || items === null) {
      return await interaction.reply({ 
        content: '❌ 수량을 올바르게 입력해주세요. (상자: 0-10000, 세트: 0-100000, 개: 0-63)', 
        ephemeral: true 
      });
    }
    
    const inventory = await loadInventory();
    const targetData = type === 'inventory' ? inventory : inventory.crafting;
    
    console.log('  - targetData.categories:', Object.keys(targetData.categories || {}));
    
    if (!targetData.categories[category]) {
      console.error(`❌ 카테고리 "${category}"를 찾을 수 없습니다.`);
      console.error('  - 사용 가능한 카테고리:', Object.keys(targetData.categories || {}));
      return await interaction.reply({ 
        content: `❌ "${category}" 카테고리를 찾을 수 없습니다. (타입: ${type})\n사용 가능한 카테고리: ${Object.keys(targetData.categories || {}).join(', ')}`, 
        ephemeral: true 
      });
    }
    
    if (!targetData.categories[category][itemName]) {
      console.error(`❌ 아이템 "${itemName}"을 카테고리 "${category}"에서 찾을 수 없습니다.`);
      console.error('  - 사용 가능한 아이템:', Object.keys(targetData.categories[category] || {}));
      return await interaction.reply({ 
        content: `❌ "${itemName}" 아이템을 찾을 수 없습니다.`, 
        ephemeral: true 
      });
    }
    
    const changeAmount = Math.round(boxes * 3456) + Math.round(sets * 64) + Math.round(items);
    const itemData = targetData.categories[category][itemName];
    const oldQuantity = itemData.quantity;
    const oldRequired = itemData.required;
    
    console.log('  - 변경량:', changeAmount);
    console.log('  - 기존 수량:', oldQuantity);
    console.log('  - 기존 목표:', oldRequired);
    
    let newQuantity = oldQuantity;
    let newRequired = oldRequired;
    let actionText = '';
    
    if (action === 'add') {
      newQuantity = oldQuantity + changeAmount;
      actionText = `추가: +${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
    } else if (action === 'subtract') {
      newQuantity = Math.max(0, oldQuantity - changeAmount);
      actionText = `차감: -${changeAmount}개 (${oldQuantity} → ${newQuantity})`;
    } else if (action === 'edit') {
      newQuantity = changeAmount;
      actionText = `수정: ${oldQuantity}개 → ${newQuantity}개`;
    } else if (action === 'edit_required') {
      newRequired = changeAmount;
      actionText = `목표 수정: ${oldRequired}개 → ${newRequired}개`;
    }
    
    console.log('  - 새 수량:', newQuantity);
    console.log('  - 새 목표:', newRequired);
    console.log('  - 액션:', actionText);
    
    // 수량 업데이트
    itemData.quantity = newQuantity;
    itemData.required = newRequired;
    
    // 히스토리 추가
    addHistory(inventory, type, category, itemName, action, actionText, interaction.user.displayName || interaction.user.username);
    
    // 저장
    await saveInventory(inventory);
    
    await interaction.reply({ 
      content: `✅ **${itemName}** 수량이 업데이트되었습니다!\n${actionText}`, 
      ephemeral: true 
    });
    
    console.log('✅ 수량 업데이트 완료');
    
  } catch (error) {
    console.error('❌ 모달 제출 에러:', error);
    await interaction.reply({ content: '오류가 발생했습니다: ' + error.message, ephemeral: true }).catch((err) => {
      console.error('❌ 모달 제출 응답 실패:', err);
    });
  }
}
