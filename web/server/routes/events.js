const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireAdmin } = require('../middleware/auth');

// 이벤트 조회 (인증된 유저)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(startDate.getTime() + 35 * 24 * 60 * 60 * 1000);
    
    const events = await db.getEvents(startDate, endDate);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// 다가오는 이벤트 (알림용)
router.get('/upcoming', authenticate, async (req, res, next) => {
  try {
    const events = await db.getUpcomingEvents(2);
    res.json(events);
  } catch (error) {
    next(error);
  }
});

// 이벤트 생성 (관리자/서버장)
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, description, startDate, endDate, allDay, color, repeat, repeatEndDate } = req.body;
    
    if (!title || !startDate) {
      return res.status(400).json({ error: '제목과 시작일은 필수입니다' });
    }
    
    const event = await db.createEvent({
      title,
      description: description || '',
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      allDay: allDay !== false,
      color: color || 'blue',
      repeat: repeat || 'none',
      repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : null,
      createdBy: req.user.id,
      createdByName: req.user.username || req.user.globalName || ''
    });
    
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});

// 이벤트 수정 (관리자/서버장)
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, description, startDate, endDate, allDay, color, repeat, repeatEndDate } = req.body;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startDate !== undefined) updateData.startDate = new Date(startDate);
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
    if (allDay !== undefined) updateData.allDay = allDay;
    if (color !== undefined) updateData.color = color;
    if (repeat !== undefined) updateData.repeat = repeat;
    if (repeatEndDate !== undefined) updateData.repeatEndDate = repeatEndDate ? new Date(repeatEndDate) : null;
    
    const event = await db.updateEvent(req.params.id, updateData);
    if (!event) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다' });
    }
    
    res.json(event);
  } catch (error) {
    next(error);
  }
});

// 이벤트 삭제 (관리자/서버장)
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const event = await db.deleteEvent(req.params.id);
    if (!event) {
      return res.status(404).json({ error: '이벤트를 찾을 수 없습니다' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
