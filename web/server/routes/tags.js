const express = require('express');
const router = express.Router();
const db = require('shared/database');
const tagService = require('shared/services/tagService');
const { authenticate, requireFeature } = require('../middleware/auth');

// 전체 태그 목록 조회 (카테고리 무관)
router.get('/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const settings = await db.getSettings();
    const typeTags = settings?.tags?.[type] || {};
    
    // 모든 카테고리의 태그를 합쳐서 중복 제거
    const allTags = [];
    const seenNames = new Set();
    
    for (const category of Object.keys(typeTags)) {
      const categoryTags = typeTags[category];
      // 객체 구조: { tagName: { items: [], color: '' } }
      if (categoryTags && typeof categoryTags === 'object' && !Array.isArray(categoryTags)) {
        for (const [tagName, tagData] of Object.entries(categoryTags)) {
          if (tagName && !seenNames.has(tagName)) {
            seenNames.add(tagName);
            allTags.push({
              name: tagName,
              color: tagData?.color || 'default',
              items: tagData?.items || []
            });
          }
        }
      }
    }
    
    res.json(allTags);
  } catch (error) {
    next(error);
  }
});

// 태그 목록 조회 (카테고리별)
router.get('/:type/:category', async (req, res, next) => {
  try {
    const { type, category } = req.params;
    const settings = await db.getSettings();
    const tags = tagService.listTags(settings?.tags || {}, type, category);
    res.json(tags);
  } catch (error) {
    next(error);
  }
});

// 태그 생성
router.post('/', authenticate, requireFeature('tag'), async (req, res, next) => {
  try {
    const { type, category, tagName, color } = req.body;
    
    if (!type || !category || !tagName) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }
    
    const settings = await db.getSettings();
    const tags = settings?.tags || { inventory: {}, crafting: {} };
    
    tagService.ensureTag(tags, type, category, tagName, color || 'default');
    
    await db.updateSettings({ tags });
    
    res.status(201).json({ success: true, tagName });
  } catch (error) {
    next(error);
  }
});

// 태그에 아이템 추가
router.post('/:type/:category/:tagName/items', authenticate, requireFeature('tag'), async (req, res, next) => {
  try {
    const { type, category, tagName } = req.params;
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items는 배열이어야 합니다.' });
    }
    
    const settings = await db.getSettings();
    const tags = settings?.tags || { inventory: {}, crafting: {} };
    const inventory = await db.loadInventory();
    
    const result = tagService.addItemsToTag(tags, type, category, tagName, items, true, inventory);
    
    await db.updateSettings({ tags });
    
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 태그에서 아이템 제거
router.delete('/:type/:category/:tagName/items', authenticate, requireFeature('tag'), async (req, res, next) => {
  try {
    const { type, category, tagName } = req.params;
    const { items } = req.body;
    
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'items는 배열이어야 합니다.' });
    }
    
    const settings = await db.getSettings();
    const tags = settings?.tags || { inventory: {}, crafting: {} };
    const inventory = await db.loadInventory();
    
    const result = tagService.removeItemsFromTag(tags, type, category, tagName, items, inventory);
    
    await db.updateSettings({ tags });
    
    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

// 태그 색상 변경
router.patch('/:type/:category/:tagName/color', authenticate, requireFeature('tag'), async (req, res, next) => {
  try {
    const { type, category, tagName } = req.params;
    const { color } = req.body;
    
    const settings = await db.getSettings();
    const tags = settings?.tags || { inventory: {}, crafting: {} };
    
    tagService.setTagColor(tags, type, category, tagName, color);
    
    await db.updateSettings({ tags });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 태그 삭제
router.delete('/:type/:category/:tagName', authenticate, requireFeature('tag'), async (req, res, next) => {
  try {
    const { type, category, tagName } = req.params;
    
    const settings = await db.getSettings();
    const tags = settings?.tags || { inventory: {}, crafting: {} };
    
    const success = tagService.deleteTag(tags, type, category, tagName);
    
    if (!success) {
      return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
    }
    
    await db.updateSettings({ tags });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// 태그 검색
router.get('/:type/:category/search', async (req, res, next) => {
  try {
    const { type, category } = req.params;
    const { q } = req.query;
    
    const settings = await db.getSettings();
    const results = tagService.searchTags(settings?.tags || {}, type, category, q);
    
    res.json(results);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
