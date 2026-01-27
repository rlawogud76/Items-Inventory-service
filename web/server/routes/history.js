const express = require('express');
const router = express.Router();
const db = require('shared/database');

// 히스토리 조회
router.get('/', async (req, res, next) => {
  try {
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
