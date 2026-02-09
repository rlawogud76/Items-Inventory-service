const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireAdmin, requireFeature } = require('../middleware/auth');

// 설정 조회
router.get('/', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    
    // 민감한 정보 제외
    const publicSettings = {
      uiMode: settings?.uiMode || 'normal',
      barLength: settings?.barLength || 15,
      selectMessageTimeout: settings?.selectMessageTimeout || 30,
      infoMessageTimeout: settings?.infoMessageTimeout || 15
    };
    
    res.json(publicSettings);
  } catch (error) {
    next(error);
  }
});

// 설정 수정
router.patch('/', authenticate, requireFeature('settings'), async (req, res, next) => {
  try {
    const allowedFields = ['uiMode', 'barLength', 'selectMessageTimeout', 'infoMessageTimeout'];
    const updates = {};
    
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: '수정할 필드가 없습니다.' });
    }
    
    await db.updateSettings(updates);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 권한 설정 조회 (관리자 전용)
router.get('/permissions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    
    res.json({
      adminUserIds: settings?.adminUserIds || [],
      adminAllowedFeatureKeys: settings?.adminAllowedFeatureKeys || ['*'],
      memberAllowedFeatureKeys: settings?.memberAllowedFeatureKeys || ['*']
    });
  } catch (error) {
    next(error);
  }
});

// 권한 설정 수정 
// - 관리자 목록, 관리자 권한: 서버장만 가능
// - 멤버 권한: 관리자 또는 서버장 가능
router.patch('/permissions', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { adminUserIds, adminAllowedFeatureKeys, memberAllowedFeatureKeys } = req.body;
    const updates = {};
    
    // 관리자 목록 및 관리자 권한 변경은 서버장만 가능
    if (adminUserIds !== undefined || adminAllowedFeatureKeys !== undefined) {
      if (!req.user?.isServerOwner) {
        return res.status(403).json({ error: '관리자 설정은 서버장만 변경할 수 있습니다.' });
      }
    }
    
    if (adminUserIds !== undefined) {
      updates.adminUserIds = adminUserIds;
    }
    if (adminAllowedFeatureKeys !== undefined) {
      updates.adminAllowedFeatureKeys = adminAllowedFeatureKeys;
    }
    if (memberAllowedFeatureKeys !== undefined) {
      updates.memberAllowedFeatureKeys = memberAllowedFeatureKeys;
    }
    
    await db.updateSettings(updates);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 배점 조회 (실제 아이템 목록 기반)
router.get('/points', async (req, res, next) => {
  try {
    // 저장된 배점과 실제 아이템 목록을 함께 조회
    const [savedPoints, inventoryItems, craftingItems] = await Promise.all([
      db.getItemPoints(),
      db.getItems('inventory'),
      db.getItems('crafting')
    ]);
    
    // 배열이 아닌 경우 빈 배열로 처리
    const invItems = Array.isArray(inventoryItems) ? inventoryItems : [];
    const craftItems = Array.isArray(craftingItems) ? craftingItems : [];
    
    // 실제 아이템 기반으로 배점 구조 생성
    const result = {
      inventory: {},
      crafting: {}
    };
    
    // 재고 아이템
    for (const item of invItems) {
      if (!result.inventory[item.category]) {
        result.inventory[item.category] = {};
      }
      // 저장된 배점이 있으면 사용, 없으면 기본값 1
      result.inventory[item.category][item.name] = 
        savedPoints?.inventory?.[item.category]?.[item.name] || 1;
    }
    
    // 제작 아이템
    for (const item of craftItems) {
      if (!result.crafting[item.category]) {
        result.crafting[item.category] = {};
      }
      result.crafting[item.category][item.name] = 
        savedPoints?.crafting?.[item.category]?.[item.name] || 1;
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// 배점 수정
router.patch('/points/:type/:category/:itemName', authenticate, requireFeature('points'), async (req, res, next) => {
  try {
    const { type, category, itemName } = req.params;
    const { points } = req.body;
    
    if (typeof points !== 'number' || points < 1 || points > 100) {
      return res.status(400).json({ error: '배점은 1~100 사이의 숫자여야 합니다.' });
    }
    
    await db.updateItemPoints(type, category, itemName, points);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 배점 초기화
router.post('/points/reset', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await db.resetAllItemPoints();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 유저 목록 조회
router.get('/users', authenticate, requireFeature('users'), async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    const registeredUsers = await db.getRegisteredUsers();
    const adminUserIds = settings?.adminUserIds || [];
    const serverOwnerId = settings?.serverOwnerId || process.env.SERVER_OWNER_ID;
    
    // 역할 부여
    const usersWithRoles = registeredUsers.map(user => ({
      ...user,
      role: user.id === serverOwnerId 
        ? 'owner' 
        : adminUserIds.includes(user.id) 
          ? 'admin' 
          : 'member'
    }));
    
    // 서버장 > 관리자 > 멤버 순으로 정렬
    usersWithRoles.sort((a, b) => {
      const order = { owner: 0, admin: 1, member: 2 };
      return order[a.role] - order[b.role];
    });
    
    res.json({ users: usersWithRoles });
  } catch (error) {
    next(error);
  }
});

// 카테고리 이모지 조회
router.get('/category-emojis', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.json({
      inventory: settings?.categoryEmojis?.inventory || {},
      crafting: settings?.categoryEmojis?.crafting || {}
    });
  } catch (error) {
    next(error);
  }
});

// 카테고리 이모지 수정
router.patch('/category-emojis/:type/:category', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { type, category } = req.params;
    const { emoji } = req.body;
    
    if (!['inventory', 'crafting'].includes(type)) {
      return res.status(400).json({ error: '잘못된 타입입니다.' });
    }
    
    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: '이모지가 필요합니다.' });
    }
    
    const settings = await db.getSettings();
    const categoryEmojis = settings?.categoryEmojis || { inventory: {}, crafting: {} };
    
    if (!categoryEmojis[type]) {
      categoryEmojis[type] = {};
    }
    categoryEmojis[type][category] = emoji;
    
    await db.updateSettings({ categoryEmojis });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 카테고리 이모지 삭제
router.delete('/category-emojis/:type/:category', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { type, category } = req.params;
    
    if (!['inventory', 'crafting'].includes(type)) {
      return res.status(400).json({ error: '잘못된 타입입니다.' });
    }
    
    const settings = await db.getSettings();
    const categoryEmojis = settings?.categoryEmojis || { inventory: {}, crafting: {} };
    
    if (categoryEmojis[type] && categoryEmojis[type][category]) {
      delete categoryEmojis[type][category];
      await db.updateSettings({ categoryEmojis });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 수량 프리셋 조회
router.get('/quantity-presets', async (req, res, next) => {
  try {
    const settings = await db.getSettings();
    res.json({
      presets: settings?.quantityPresets || [1, 10, 64, 100]
    });
  } catch (error) {
    next(error);
  }
});

// 수량 프리셋 수정
router.patch('/quantity-presets', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { presets } = req.body;
    
    if (!Array.isArray(presets)) {
      return res.status(400).json({ error: '프리셋은 배열이어야 합니다.' });
    }
    
    // 숫자만 필터링 및 정렬
    const validPresets = presets
      .map(p => parseInt(p))
      .filter(p => !isNaN(p) && p > 0)
      .sort((a, b) => a - b);
    
    if (validPresets.length === 0) {
      return res.status(400).json({ error: '최소 1개 이상의 프리셋이 필요합니다.' });
    }
    
    await db.updateSettings({ quantityPresets: validPresets });
    res.json({ success: true, presets: validPresets });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
