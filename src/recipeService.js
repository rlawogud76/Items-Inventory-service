// 레시피 관련 비즈니스 로직
import { getItemIcon, addHistory } from './utils.js';

/**
 * 제작품 추가 시 레시피 재료 차감
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} quantity - 제작 수량
 * @param {string} userName - 사용자 이름
 * @returns {Object} { success: boolean, message?: string }
 */
export function consumeRecipeMaterials(inventory, category, itemName, quantity, userName) {
  const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
  if (!recipe || quantity <= 0) {
    return { success: true }; // 레시피 없으면 그냥 통과
  }
  
  // 재료 충분한지 확인
  const materialCheck = [];
  for (const material of recipe) {
    const materialData = inventory.categories[material.category]?.[material.name];
    const requiredQty = material.quantity * quantity;
    const currentQty = materialData?.quantity || 0;
    
    materialCheck.push({
      name: material.name,
      category: material.category,
      required: requiredQty,
      current: currentQty,
      enough: currentQty >= requiredQty
    });
  }
  
  const lackingMaterials = materialCheck.filter(m => !m.enough);
  if (lackingMaterials.length > 0) {
    const lackingList = lackingMaterials
      .map(m => {
        const icon = getItemIcon(m.name, inventory);
        return `${icon} **${m.name}**: ${m.current}개 / ${m.required}개 필요 (${m.required - m.current}개 부족)`;
      })
      .join('\n');
    
    return {
      success: false,
      message: `❌ **${itemName}** ${quantity}개를 제작하기 위한 재료가 부족합니다!\n\n**부족한 재료:**\n${lackingList}`
    };
  }
  
  // 재료 차감
  for (const material of recipe) {
    const requiredQty = material.quantity * quantity;
    inventory.categories[material.category][material.name].quantity -= requiredQty;
    
    addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
      `[제작 재료 소모] ${itemName} ${quantity}개 제작으로 ${requiredQty}개 소모`,
      userName);
  }
  
  return { success: true };
}

/**
 * 제작품 차감 시 레시피 재료 반환
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} quantity - 차감 수량
 * @param {string} userName - 사용자 이름
 */
export function returnRecipeMaterials(inventory, category, itemName, quantity, userName) {
  const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
  if (!recipe || quantity <= 0) {
    return; // 레시피 없으면 그냥 통과
  }
  
  // 재료 반환
  for (const material of recipe) {
    const returnQty = material.quantity * quantity;
    
    if (inventory.categories[material.category]?.[material.name]) {
      inventory.categories[material.category][material.name].quantity += returnQty;
      
      addHistory(inventory, 'inventory', material.category, material.name, 'update_quantity',
        `[제작 취소] ${itemName} ${quantity}개 차감으로 ${returnQty}개 반환`,
        userName);
    }
  }
}

/**
 * 제작품 수정 시 레시피 재료 조정 (증가/감소)
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} oldQuantity - 기존 수량
 * @param {number} newQuantity - 새 수량
 * @param {string} userName - 사용자 이름
 * @returns {Object} { success: boolean, message?: string }
 */
export function adjustRecipeMaterials(inventory, category, itemName, oldQuantity, newQuantity, userName) {
  const quantityDiff = newQuantity - oldQuantity;
  
  if (quantityDiff > 0) {
    // 수량 증가 - 재료 차감 필요
    return consumeRecipeMaterials(inventory, category, itemName, quantityDiff, userName);
  } else if (quantityDiff < 0) {
    // 수량 감소 - 재료 반환
    returnRecipeMaterials(inventory, category, itemName, Math.abs(quantityDiff), userName);
    return { success: true };
  }
  
  return { success: true }; // 변화 없음
}
