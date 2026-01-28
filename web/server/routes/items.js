const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireFeature } = require('../middleware/auth');

// 아이템 목록 조회
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const { category } = req.query;
    
    if (!['inventory', 'crafting'].includes(type)) {
      return res.status(400).json({ error: '유효하지 않은 타입입니다.' });
    }
    
    const items = await db.getItems(type, category || null);
    res.json(items);
  } catch (error) {
    next(error);
  }
});

// 카테고리 목록 조회
router.get('/:type/categories', async (req, res, next) => {
  try {
    const { type } = req.params;
    const categories = await db.getCategories(type);
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// 단일 아이템 조회
router.get('/:type/:category/:name', async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const items = await db.getItems(type, category);
    const item = items.find(i => i.name === name);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json(item);
  } catch (error) {
    next(error);
  }
});

// 아이템 추가
router.post('/', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { name, category, type, itemType, quantity, required, emoji } = req.body;
    
    if (!name || !category || !type) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }
    
    const newItem = await db.addItem({
      name,
      category,
      type,
      itemType,
      quantity: quantity || 0,
      required: required || 0,
      emoji
    });
    
    // 히스토리 기록
    await db.addHistoryEntry({
      timestamp: new Date().toISOString(),
      type,
      category,
      itemName: name,
      action: 'add',
      details: `초기: ${quantity || 0}개`,
      userName: req.user.username
    });
    
    res.status(201).json(newItem);
  } catch (error) {
    if (error.message === '이미 존재하는 아이템입니다.') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

// 수량 업데이트 (원자적 연산) + 레시피 재료 연동 + 분야 간 연동
router.patch('/:type/:category/:name/quantity', authenticate, requireFeature('quantity'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const { delta, action = 'update_quantity', syncMaterials = true, syncLinked = true } = req.body;
    
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'delta는 숫자여야 합니다.' });
    }
    
    const actionText = delta > 0 ? `추가: +${delta}개` : `차감: ${delta}개`;
    
    // 아이템 정보 조회 (레시피 연동 여부 확인)
    const items = await db.getItems(type);
    const item = items.find(i => i.name === name && i.category === category);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 중간재료/완성품이고 레시피가 있으면 재료 연동
    if (syncMaterials && (item.itemType === 'intermediate' || item.itemType === 'finished') && delta !== 0) {
      const recipes = await db.getRecipes(category);
      const recipe = recipes.find(r => r.resultName === name);
      
      if (recipe && recipe.materials && recipe.materials.length > 0) {
        // 수량 증가 시 재료 차감, 수량 감소 시 재료 복구
        for (const material of recipe.materials) {
          const materialDelta = -(delta * material.quantity); // 역방향
          
          // 재료는 inventory 타입에서 찾기
          await db.updateItemQuantity(
            'inventory',
            material.category,
            material.name,
            materialDelta,
            req.user.username,
            'recipe_sync',
            `[레시피 연동] ${name} ${delta > 0 ? '제작' : '취소'}: ${materialDelta > 0 ? '+' : ''}${materialDelta}개`
          );
        }
      }
    }
    
    // 분야 간 연동 (inventory <-> crafting)
    if (syncLinked && delta !== 0) {
      const otherType = type === 'inventory' ? 'crafting' : 'inventory';
      const otherItems = await db.getItems(otherType);
      const linkedItem = otherItems.find(i => i.name === name && i.category === category);
      
      if (linkedItem) {
        // 연동된 아이템 수량도 같이 변경 (무한 루프 방지를 위해 syncLinked: false)
        await db.updateItemQuantity(
          otherType,
          category,
          name,
          delta,
          req.user.username,
          'linked_sync',
          `[분야 연동] ${type === 'inventory' ? '재고' : '제작'}→${otherType === 'inventory' ? '재고' : '제작'}: ${delta > 0 ? '+' : ''}${delta}개`
        );
      }
    }
    
    const success = await db.updateItemQuantity(
      type, 
      category, 
      name, 
      delta, 
      req.user.username,
      action,
      actionText
    );
    
    if (!success) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 수량 직접 설정 (절대값으로 설정) + 레시피 재료 연동 + 분야 간 연동
router.patch('/:type/:category/:name/quantity/set', authenticate, requireFeature('quantity'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const { value, syncMaterials = true, syncLinked = true } = req.body;
    
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ error: 'value는 0 이상의 숫자여야 합니다.' });
    }
    
    // 아이템 정보 조회 (레시피 연동 여부 확인)
    const items = await db.getItems(type);
    const item = items.find(i => i.name === name && i.category === category);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    const delta = value - item.quantity; // 변화량 계산
    
    // 중간재료/완성품이고 레시피가 있으면 재료 연동
    if (syncMaterials && (item.itemType === 'intermediate' || item.itemType === 'finished') && delta !== 0) {
      const recipes = await db.getRecipes(category);
      const recipe = recipes.find(r => r.resultName === name);
      
      if (recipe && recipe.materials && recipe.materials.length > 0) {
        for (const material of recipe.materials) {
          const materialDelta = -(delta * material.quantity);
          
          await db.updateItemQuantity(
            'inventory',
            material.category,
            material.name,
            materialDelta,
            req.user.username,
            'recipe_sync',
            `[레시피 연동] ${name} ${delta > 0 ? '제작' : '취소'}: ${materialDelta > 0 ? '+' : ''}${materialDelta}개`
          );
        }
      }
    }
    
    // 분야 간 연동 (inventory <-> crafting)
    if (syncLinked && delta !== 0) {
      const otherType = type === 'inventory' ? 'crafting' : 'inventory';
      const otherItems = await db.getItems(otherType);
      const linkedItem = otherItems.find(i => i.name === name && i.category === category);
      
      if (linkedItem) {
        // 연동된 아이템도 같은 값으로 설정
        await db.setItemQuantity(
          otherType,
          category,
          name,
          value,
          req.user.username,
          'linked_sync',
          `[분야 연동] ${type === 'inventory' ? '재고' : '제작'}→${otherType === 'inventory' ? '재고' : '제작'}: ${value}개로 설정`
        );
      }
    }
    
    const success = await db.setItemQuantity(
      type, 
      category, 
      name, 
      value, 
      req.user.username,
      'set_quantity',
      `수량 설정: ${value}개`
    );
    
    if (!success) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 아이템 정보 수정
router.patch('/:type/:category/:name', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const updates = req.body;
    
    // 허용된 필드만 업데이트
    const allowedFields = ['name', 'emoji', 'itemType', 'required', 'linkedItem'];
    const filteredUpdates = {};
    
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        filteredUpdates[key] = updates[key];
      }
    }
    
    const result = await db.updateItemDetails(type, category, name, filteredUpdates);
    
    if (!result) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json(result);
  } catch (error) {
    if (error.message === '이미 존재하는 이름입니다.') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

// 아이템 삭제
router.delete('/:type/:category/:name', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    
    const success = await db.removeItem(type, category, name);
    
    if (!success) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 히스토리 기록
    await db.addHistoryEntry({
      timestamp: new Date().toISOString(),
      type,
      category,
      itemName: name,
      action: 'remove',
      details: '삭제됨',
      userName: req.user.username
    });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 작업자 상태 업데이트
router.patch('/:type/:category/:name/worker', authenticate, requireFeature('work'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const { action } = req.body; // 'start' or 'stop'
    
    // 현재 아이템 정보 조회
    const items = await db.getItems(type, category);
    const item = items.find(i => i.name === name);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    let workerData = null;
    if (action === 'start') {
      // 이미 다른 사람이 작업 중인 경우 차단
      if (item.worker?.userId && item.worker.userId !== req.user.id) {
        return res.status(409).json({ 
          error: `${item.worker.userName}님이 이미 작업 중입니다.` 
        });
      }
      
      workerData = {
        userId: req.user.id,
        userName: req.user.username,
        startTime: new Date()
      };
    } else if (action === 'stop') {
      // 본인이 아닌 경우 관리자만 중단 가능
      if (item.worker?.userId && item.worker.userId !== req.user.id && !req.user.isAdmin) {
        return res.status(403).json({ 
          error: '본인의 작업만 중단할 수 있습니다.' 
        });
      }
    }
    
    const success = await db.updateItemWorker(type, category, name, workerData);
    
    if (!success) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 순서 업데이트
router.patch('/:type/:category/order', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category } = req.params;
    const { items } = req.body; // [{ name, order }, ...]
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items는 배열이어야 합니다.' });
    }
    
    await db.updateItemsOrder(type, category, items);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 카테고리 초기화
router.post('/:type/:category/reset', authenticate, requireFeature('reset'), async (req, res, next) => {
  try {
    const { type, category } = req.params;
    
    const items = await db.getItems(type, category);
    
    const updates = items.map(item => ({
      type,
      category,
      itemName: item.name,
      delta: -item.quantity,
      operation: 'set',
      value: 0,
      field: 'quantity'
    }));
    
    await db.updateMultipleItems(updates, [{
      timestamp: new Date().toISOString(),
      type,
      category,
      itemName: '전체',
      action: 'reset',
      details: `${items.length}개 아이템 초기화`,
      userName: req.user.username
    }]);
    
    res.json({ success: true, count: items.length });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
