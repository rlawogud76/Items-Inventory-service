const express = require('express');
const router = express.Router();
const db = require('shared/database');
const { authenticate, requireFeature } = require('../middleware/auth');

// 레시피 목록 조회
router.get('/', async (req, res, next) => {
  try {
    const { category } = req.query;
    const recipes = await db.getRecipes(category || null);
    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

// 특정 레시피 조회
router.get('/:category/:resultName', async (req, res, next) => {
  try {
    const { category, resultName } = req.params;
    const recipes = await db.getRecipes(category);
    const recipe = recipes.find(r => r.resultName === resultName);
    
    if (!recipe) {
      return res.status(404).json({ error: '레시피를 찾을 수 없습니다.' });
    }
    
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// 레시피 추가/수정
router.post('/', authenticate, requireFeature('recipe'), async (req, res, next) => {
  try {
    const { category, resultName, materials } = req.body;
    
    if (!category || !resultName || !materials) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다.' });
    }
    
    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: '재료가 필요합니다.' });
    }
    
    const recipe = await db.saveRecipe(category, resultName, materials);
    res.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
});

// 레시피 수정
router.put('/:category/:resultName', authenticate, requireFeature('recipe'), async (req, res, next) => {
  try {
    const { category, resultName } = req.params;
    const { materials } = req.body;
    
    if (!Array.isArray(materials)) {
      return res.status(400).json({ error: '재료는 배열이어야 합니다.' });
    }
    
    const recipe = await db.saveRecipe(category, resultName, materials);
    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// 레시피 삭제
router.delete('/:category/:resultName', authenticate, requireFeature('recipe'), async (req, res, next) => {
  try {
    const { category, resultName } = req.params;
    
    const success = await db.removeRecipe(category, resultName);
    
    if (!success) {
      return res.status(404).json({ error: '레시피를 찾을 수 없습니다.' });
    }
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
