const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, optionalAuth, requireFeature } = require('../middleware/auth');

// 히스토리 조회 - 권한 체크 추가
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    // 권한 체크
    if (req.user) {
      const allowedFeatures = req.user.isAdmin || req.user.isServerOwner
        ? (req.user.adminAllowedFeatures || ['*'])
        : (req.user.memberAllowedFeatures || []);
      
      if (!allowedFeatures.includes('*') && !allowedFeatures.includes('history')) {
        return res.status(403).json({ error: '수정내역 조회 권한이 없습니다.' });
      }
    } else {
      // 비로그인 사용자는 기본적으로 차단
      return res.status(401).json({ error: '로그인이 필요합니다.' });
    }

    const { 
      limit = 20, 
      page = 1, 
      type, 
      category, 
      userName 
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filters = {};
    
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (userName) filters.userName = userName;
    
    const [history, total] = await Promise.all([
      db.getHistory(parseInt(limit), skip, filters),
      db.getHistoryCount(filters)
    ]);
    
    res.json({
      data: history,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
