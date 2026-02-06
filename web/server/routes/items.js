const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireFeature } = require('../middleware/auth');

// ============ 제작 계획 API (특정 경로가 먼저 선언되어야 함) ============

// 제작 대시보드 조회
router.get('/crafting/dashboard', async (req, res, next) => {
  try {
    const { category } = req.query;
    const dashboard = await db.getCraftingDashboard(category || null);
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
});

// 제작 계획 생성 (3차 목표 기준 전체 티어 자동 생성)
router.post('/crafting/plan', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { 
      category, 
      tier3Goals, 
      eventId, 
      createEvent, 
      eventTitle, 
      startDate, 
      endDate, 
      eventColor 
    } = req.body;
    
    if (!category || !tier3Goals || !Array.isArray(tier3Goals)) {
      return res.status(400).json({ error: '카테고리와 3차 목표가 필요합니다.' });
    }
    
    if (tier3Goals.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 3차 목표가 필요합니다.' });
    }
    
    let finalEventId = eventId;
    let createdEvent = null;
    
    // 새 이벤트 생성이 요청된 경우
    if (createEvent && startDate && endDate) {
      createdEvent = await db.createEvent({
        title: eventTitle || `${category} 제작 계획`,
        description: `3차 목표: ${tier3Goals.map(g => `${g.name} x${g.quantity}`).join(', ')}`,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        allDay: true,
        color: eventColor || 'blue',
        repeat: 'none',
        createdBy: req.user.id,
        createdByName: req.user.username || req.user.globalName || ''
      });
      finalEventId = createdEvent._id;
    }
    
    const result = await db.createCraftingPlan(category, tier3Goals, finalEventId);
    
    // 히스토리 기록
    await db.addHistoryEntry({
      timestamp: new Date().toISOString(),
      type: 'crafting',
      category,
      itemName: '[제작 계획]',
      action: 'create_plan',
      details: `3차: ${result.tier3}개, 2차: ${result.tier2}개, 1차: ${result.tier1}개 (총 ${result.created}개)${createdEvent ? ` | 일정: ${createdEvent.title}` : ''}`,
      userName: req.user.username
    });
    
    res.status(201).json({
      ...result,
      event: createdEvent
    });
  } catch (error) {
    next(error);
  }
});

// 필요량 계산 미리보기 (실제 생성 전)
router.post('/crafting/calculate', authenticate, async (req, res, next) => {
  try {
    const { category, tier3Goals } = req.body;
    
    if (!category || !tier3Goals || !Array.isArray(tier3Goals)) {
      return res.status(400).json({ error: '카테고리와 3차 목표가 필요합니다.' });
    }
    
    const requirements = await db.calculateMaterialRequirements(category, tier3Goals);
    res.json(requirements);
  } catch (error) {
    next(error);
  }
});

// 제작 미리보기 - 제작 시 영향받는 재료 목록
router.get('/crafting/preview', authenticate, async (req, res, next) => {
  try {
    const { type = 'crafting', category, name, amount } = req.query;
    
    if (!category || !name || !amount) {
      return res.status(400).json({ error: '카테고리, 아이템명, 수량이 필요합니다.' });
    }
    
    const preview = await db.getCraftingPreview(type, category, name, parseInt(amount) || 1);
    res.json(preview);
  } catch (error) {
    next(error);
  }
});

// 제작 아이템 전체 삭제
router.delete('/crafting/all', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { category } = req.query;
    const deletedCount = await db.deleteCraftingItems(category || null);
    
    // 히스토리 기록
    await db.addHistoryEntry({
      timestamp: new Date().toISOString(),
      type: 'crafting',
      category: category || '전체',
      itemName: '[일괄 삭제]',
      action: 'delete_all',
      details: `${deletedCount}개 아이템 삭제`,
      userName: req.user.username
    });
    
    res.json({ success: true, deletedCount });
  } catch (error) {
    next(error);
  }
});

// ============ 기존 API ============

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
    const { delta, action = 'update_quantity', syncMaterials = true, syncLinked = true, forceSync = false } = req.body;
    
    if (typeof delta !== 'number') {
      return res.status(400).json({ error: 'delta는 숫자여야 합니다.' });
    }
    
    const actionText = delta > 0 ? `추가: +${delta}개` : `차감: ${delta}개`;
    
    // 아이템 정보 조회
    const items = await db.getItems(type);
    const item = items.find(i => i.name === name && i.category === category);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 레시피가 있으면 재료 연동 (재귀적)
    if (syncMaterials && delta > 0) {
      // 제작 시 (수량 증가) - 재료 검증 후 차감
      const validation = await db.validateMaterialsRecursive(type, category, name, delta);
      
      if (!validation.valid && !forceSync) {
        return res.status(400).json({ 
          error: '재료가 부족합니다.', 
          missing: validation.missing 
        });
      }
      
      // 재귀적으로 모든 하위 재료 차감
      const syncResult = await db.syncMaterialsRecursive(type, category, name, delta, req.user.username);
      
      if (!syncResult.success) {
        return res.status(500).json({ error: '재료 동기화 실패', details: syncResult.error });
      }
    } else if (syncMaterials && delta < 0) {
      // 취소 시 (수량 감소) - 재료 복구 (재귀적)
      await db.syncMaterialsRecursive(type, category, name, delta, req.user.username);
    }
    
    // 분야 간 연동 (inventory <-> crafting)
    if (syncLinked && delta !== 0) {
      const otherType = type === 'inventory' ? 'crafting' : 'inventory';
      const otherItems = await db.getItems(otherType);
      const linkedItem = otherItems.find(i => i.name === name && i.category === category);
      
      if (linkedItem) {
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
    
    // 소켓으로 알림 브로드캐스트
    const io = req.app.get('io');
    if (io) {
      io.emit('activity', {
        type: 'quantity',
        action: delta > 0 ? 'add' : 'subtract',
        itemName: name,
        category,
        itemType: type,
        delta,
        userName: req.user.username || req.user.globalName || '알 수 없음',
        timestamp: Date.now()
      });
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
    const { value, syncMaterials = true, syncLinked = true, forceSync = false } = req.body;
    
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ error: 'value는 0 이상의 숫자여야 합니다.' });
    }
    
    // 아이템 정보 조회
    const items = await db.getItems(type);
    const item = items.find(i => i.name === name && i.category === category);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    const delta = value - item.quantity; // 변화량 계산
    
    // 레시피가 있으면 재료 연동 (재귀적)
    if (syncMaterials && delta > 0) {
      // 제작 시 (수량 증가) - 재료 검증 후 차감
      const validation = await db.validateMaterialsRecursive(type, category, name, delta);
      
      if (!validation.valid && !forceSync) {
        return res.status(400).json({ 
          error: '재료가 부족합니다.', 
          missing: validation.missing 
        });
      }
      
      // 재귀적으로 모든 하위 재료 차감
      await db.syncMaterialsRecursive(type, category, name, delta, req.user.username);
    } else if (syncMaterials && delta < 0) {
      // 취소 시 (수량 감소) - 재료 복구 (재귀적)
      await db.syncMaterialsRecursive(type, category, name, delta, req.user.username);
    }
    
    // 분야 간 연동 (inventory <-> crafting)
    if (syncLinked && delta !== 0) {
      const otherType = type === 'inventory' ? 'crafting' : 'inventory';
      const otherItems = await db.getItems(otherType);
      const linkedItem = otherItems.find(i => i.name === name && i.category === category);
      
      if (linkedItem) {
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
    
    // 소켓으로 알림 브로드캐스트
    const io = req.app.get('io');
    if (io) {
      io.emit('activity', {
        type: 'quantity',
        action: 'set',
        itemName: name,
        category,
        itemType: type,
        value,
        userName: req.user.username || req.user.globalName || '알 수 없음',
        timestamp: Date.now()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 제작 아이템 목표 수량 변경 + 하위 티어 재계산
router.patch('/:type/:category/:name/required', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const { value, recalculate = true } = req.body;
    
    if (type !== 'crafting') {
      return res.status(400).json({ error: '제작 아이템만 목표 수량을 변경할 수 있습니다.' });
    }
    
    if (typeof value !== 'number' || value < 0) {
      return res.status(400).json({ error: 'value는 0 이상의 숫자여야 합니다.' });
    }
    
    // 아이템 정보 조회
    const items = await db.getItems(type, category);
    const item = items.find(i => i.name === name);
    
    if (!item) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 목표 수량 업데이트
    const result = await db.updateItemDetails(type, category, name, { required: value });
    
    if (!result) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 하위 티어 재계산 (2차, 3차 아이템만)
    let recalcResult = { updated: 0 };
    if (recalculate && item.tier >= 2) {
      recalcResult = await db.recalculateCraftingRequirements(category, name, item.tier, value);
    }
    
    // 히스토리 기록
    await db.addHistoryEntry({
      timestamp: new Date().toISOString(),
      type,
      category,
      itemName: name,
      action: 'update_required',
      details: `목표 변경: ${item.required} → ${value}개${recalcResult.updated > 0 ? ` (하위 ${recalcResult.updated}개 재계산)` : ''}`,
      userName: req.user.username
    });
    
    res.json({ success: true, recalculated: recalcResult.updated });
  } catch (error) {
    next(error);
  }
});

// 순서 업데이트 (/:type/:category/:name 보다 먼저 선언되어야 함)
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

// 아이템 정보 수정
router.patch('/:type/:category/:name', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    const updates = req.body;
    
    // 허용된 필드만 업데이트
    const allowedFields = ['name', 'emoji', 'itemType', 'required', 'linkedItem', 'setSize', 'boxSize'];
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

// 작업자 상태 업데이트 (단일 - 하위 호환)
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
    
    // 소켓으로 알림 브로드캐스트
    const io = req.app.get('io');
    if (io) {
      io.emit('activity', {
        type: 'worker',
        action: action, // 'start' or 'stop'
        itemName: name,
        category,
        itemType: type,
        userName: req.user.username || req.user.globalName || '알 수 없음',
        timestamp: Date.now()
      });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 다중 작업자 추가
router.post('/:type/:category/:name/workers', authenticate, requireFeature('work'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    
    const result = await db.addItemWorker(
      type, 
      category, 
      name, 
      req.user.id, 
      req.user.username
    );
    
    if (!result) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    if (!result.success) {
      return res.status(409).json({ error: result.message });
    }
    
    // 소켓으로 알림 브로드캐스트
    const io = req.app.get('io');
    if (io) {
      io.emit('activity', {
        type: 'worker',
        action: 'join',
        itemName: name,
        category,
        itemType: type,
        userName: req.user.username || req.user.globalName || '알 수 없음',
        timestamp: Date.now()
      });
    }
    
    res.json({ success: true, item: result.item });
  } catch (error) {
    next(error);
  }
});

// 다중 작업자 제거 (본인 또는 관리자)
router.delete('/:type/:category/:name/workers/:userId', authenticate, requireFeature('work'), async (req, res, next) => {
  try {
    const { type, category, name, userId } = req.params;
    
    // 본인이 아니면 관리자 권한 필요
    if (userId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: '본인의 작업만 취소할 수 있습니다.' });
    }
    
    const result = await db.removeItemWorker(type, category, name, userId);
    
    if (!result) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    // 소켓으로 알림 브로드캐스트
    const io = req.app.get('io');
    if (io) {
      io.emit('activity', {
        type: 'worker',
        action: 'leave',
        itemName: name,
        category,
        itemType: type,
        userName: req.user.username || req.user.globalName || '알 수 없음',
        timestamp: Date.now()
      });
    }
    
    res.json({ success: true, item: result.item });
  } catch (error) {
    next(error);
  }
});

// 아이템의 모든 작업자 제거 (관리자 전용)
router.delete('/:type/:category/:name/workers', authenticate, requireFeature('manage'), async (req, res, next) => {
  try {
    const { type, category, name } = req.params;
    
    const result = await db.clearItemWorkers(type, category, name);
    
    if (!result) {
      return res.status(404).json({ error: '아이템을 찾을 수 없습니다.' });
    }
    
    res.json({ success: true, item: result.item });
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
