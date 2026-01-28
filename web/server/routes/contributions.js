const express = require('express');
const router = express.Router();
const db = require('shared/database');
const contributionService = require('shared/services/contributionService');
const { authenticate, requireAdmin } = require('../middleware/auth');

// 기여도 조회
router.get('/', async (req, res, next) => {
  try {
    const { type = 'all', limit = 10 } = req.query;
    
    // 전체 히스토리 조회 (최대 1000개)
    const history = await db.getHistory(1000, 0);
    const itemPoints = await db.getItemPoints();
    
    const contributions = contributionService.calculateContributions(
      history.reverse(), // 오래된 것부터 (필터링용)
      itemPoints,
      { type, period: 'current' }
    );
    
    const topContributors = contributionService.getTopContributors(
      contributions, 
      parseInt(limit)
    );
    
    res.json({
      contributors: topContributors,
      totalUsers: Object.keys(contributions).length
    });
  } catch (error) {
    next(error);
  }
});

// 특정 사용자 기여도
router.get('/user/:username', async (req, res, next) => {
  try {
    const { username } = req.params;
    
    const history = await db.getHistory(1000, 0);
    const itemPoints = await db.getItemPoints();
    
    const contributions = contributionService.calculateContributions(
      history.reverse(),
      itemPoints,
      { period: 'current' }
    );
    
    const userContribution = contributions[username] || { total: 0, inventory: 0, crafting: 0, actions: 0 };
    
    res.json({
      username,
      ...userContribution
    });
  } catch (error) {
    next(error);
  }
});

// 기여도 초기화 (수정 내역 전체 삭제) - 관리자 전용
router.delete('/reset', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const count = await db.getHistoryCount();
    await db.clearHistory();
    
    res.json({ 
      success: true, 
      message: `${count}개의 수정 내역이 삭제되었습니다.`,
      deletedCount: count
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
