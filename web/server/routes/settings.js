const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireAdmin, requireServerOwner, requireFeature } = require('../middleware/auth');

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

// 배점 조회
router.get('/points', async (req, res, next) => {
  try {
    const points = await db.getItemPoints();
    res.json(points);
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

module.exports = router;
