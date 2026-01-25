// 레시피 관련 비즈니스 로직
import { getItemIcon } from './utils.js';

/**
 * 제작품 추가 시 레시피 재료 차감 계획 생성
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} quantity - 제작 수량
 * @param {string} userName - 사용자 이름
 * @returns {Object} { success: boolean, message?: string, updates?: Array, historyEntries?: Array }
 */
export function consumeRecipeMaterials(inventory, category, itemName, quantity, userName) {
  const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
  if (!recipe || quantity <= 0) {
    return { success: true, updates: [], historyEntries: [] };
  }

  const materialCheck = [];
  for (const material of recipe) {
    const materialData = inventory?.categories?.[material.category]?.[material.name];
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

  const updates = [];
  const historyEntries = [];

  for (const material of recipe) {
    const requiredQty = material.quantity * quantity;
    
    updates.push({
      type: 'inventory',
      category: material.category,
      itemName: material.name,
      delta: -requiredQty
    });

    historyEntries.push({
      timestamp: new Date().toISOString(),
      type: 'inventory',
      category: material.category,
      itemName: material.name,
      action: 'update_quantity',
      details: `[제작 재료 소모] ${itemName} ${quantity}개 제작으로 ${requiredQty}개 소모`,
      userName
    });
  }
  
  return { success: true, updates, historyEntries };
}

/**
 * 제작품 차감 시 레시피 재료 반환 계획 생성
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} quantity - 차감 수량
 * @param {string} userName - 사용자 이름
 * @returns {Object} { updates: Array, historyEntries: Array }
 */
export function returnRecipeMaterials(inventory, category, itemName, quantity, userName) {
  const updates = [];
  const historyEntries = [];
  
  const recipe = inventory.crafting?.recipes?.[category]?.[itemName];
  if (!recipe || quantity <= 0) return { updates, historyEntries };

  for (const material of recipe) {
    const returnQty = material.quantity * quantity;
    
    if (inventory?.categories?.[material.category]?.[material.name]) {
      updates.push({
        type: 'inventory',
        category: material.category,
        itemName: material.name,
        delta: returnQty
      });

      historyEntries.push({
        timestamp: new Date().toISOString(),
        type: 'inventory',
        category: material.category,
        itemName: material.name,
        action: 'update_quantity',
        details: `[제작 취소] ${itemName} ${quantity}개 차감으로 ${returnQty}개 반환`,
        userName
      });
    }
  }
  
  return { updates, historyEntries };
}

/**
 * 제작품 수정 시 레시피 재료 조정 계획 생성
 * @param {Object} inventory - 전체 inventory 객체
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} oldQuantity - 기존 수량
 * @param {number} newQuantity - 새 수량
 * @param {string} userName - 사용자 이름
 * @returns {Object} { success: boolean, message?: string, updates?: Array, historyEntries?: Array }
 */
export function adjustRecipeMaterials(inventory, category, itemName, oldQuantity, newQuantity, userName) {
  const quantityDiff = newQuantity - oldQuantity;
  if (quantityDiff > 0) {
    return consumeRecipeMaterials(inventory, category, itemName, quantityDiff, userName);
  }
  if (quantityDiff < 0) {
    const result = returnRecipeMaterials(inventory, category, itemName, Math.abs(quantityDiff), userName);
    return { success: true, ...result };
  }
  return { success: true, updates: [], historyEntries: [] };
}

