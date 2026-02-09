const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate } = require('../middleware/auth');

// 손익계산서 목록 조회
router.get('/', authenticate, async (req, res, next) => {
  try {
    const list = await db.getProfitLossList();
    res.json(list);
  } catch (error) {
    next(error);
  }
});

// 손익계산서 상세 조회
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const doc = await db.getProfitLoss(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다' });
    }
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// 손익계산서 생성
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { title, recordDate, income, expense } = req.body;
    
    const doc = await db.createProfitLoss({
      title: title || '손익계산서',
      recordDate: recordDate ? new Date(recordDate) : new Date(),
      income: income || [],
      expense: expense || [],
      createdBy: req.user.id,
      lastModifiedBy: req.user.id
    });
    
    // 소켓 이벤트 발송
    const io = req.app.get('io');
    if (io) {
      io.emit('profitloss:created', { id: doc._id });
    }
    
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
});

// 손익계산서 수정
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { title, recordDate, income, expense } = req.body;
    
    const updateData = {
      lastModifiedBy: req.user.id
    };
    
    if (title !== undefined) updateData.title = title;
    if (recordDate !== undefined) updateData.recordDate = new Date(recordDate);
    if (income !== undefined) updateData.income = income;
    if (expense !== undefined) updateData.expense = expense;
    
    const doc = await db.updateProfitLoss(req.params.id, updateData);
    
    if (!doc) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다' });
    }
    
    // 소켓 이벤트 발송
    const io = req.app.get('io');
    if (io) {
      io.emit('profitloss:updated', { id: doc._id });
    }
    
    res.json(doc);
  } catch (error) {
    next(error);
  }
});

// 손익계산서 삭제
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const doc = await db.deleteProfitLoss(req.params.id);
    
    if (!doc) {
      return res.status(404).json({ error: '문서를 찾을 수 없습니다' });
    }
    
    // 소켓 이벤트 발송
    const io = req.app.get('io');
    if (io) {
      io.emit('profitloss:deleted', { id: req.params.id });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
