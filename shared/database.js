const mongoose = require('mongoose');
const { Item } = require('./models/Item');
const { Recipe } = require('./models/Recipe');
const { Setting } = require('./models/Setting');
const { User } = require('./models/User');
const { Event } = require('./models/Event');
const { DB_CONFIG } = require('./constants');

// 변경 감지 관련
let watchIntervalId = null;
let changeStream = null;
const changeListeners = new Set();

function stopWatching() {
  if (watchIntervalId) {
    clearInterval(watchIntervalId);
    watchIntervalId = null;
    console.log('🔴 변경 감지 중지');
  }
  if (changeStream) {
    try {
      changeStream.close();
      changeStream = null;
      console.log('🔴 Change Stream 종료');
    } catch (err) {
      console.warn('Change Stream 종료 실패:', err?.message || err);
    }
  }
}

async function disconnectDatabase() {
  try {
    stopWatching();
    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료 완료');
  } catch (err) {
    console.error('❌ MongoDB 연결 종료 실패:', err);
  }
}

async function connectDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.DATABASE_URL || 
                     process.env.MONGODB_URI || 
                     'mongodb://localhost:27017/minecraft-inventory';
    
    console.log('🔍 MongoDB 연결 시도...');
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,  // 5초로 단축
      socketTimeoutMS: 10000,
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB 연결 끊김');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB 재연결 성공');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB 연결 에러:', err.message);
    });
    
    console.log('✅ MongoDB 연결 성공!');
    return true;
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    return false;
  }
}

// 히스토리 스키마
const historySchema = new mongoose.Schema({
  timestamp: { type: String, required: true, index: true },
  type: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  itemName: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  userName: { type: String, required: true, index: true }
}, { timestamps: true });
historySchema.index({ timestamp: -1 });

const History = mongoose.models.InventoryHistory || mongoose.model('InventoryHistory', historySchema, 'inventory_histories');

// 히스토리 추가
async function addHistoryEntry(entry) {
  try {
    await History.create(entry);
    // 최신 100개만 유지 - 단일 쿼리로 오래된 항목 삭제 (race condition 방지)
    const keepIds = await History.find()
      .sort({ timestamp: -1 })
      .limit(100)
      .select('_id')
      .lean();
    await History.deleteMany({ 
      _id: { $nin: keepIds.map(h => h._id) } 
    });
  } catch (error) {
    console.error('❌ 히스토리 추가 실패:', error.message);
  }
}

// 히스토리 조회
async function getHistory(limit = 10, skip = 0, filters = {}) {
  try {
    const q = {};
    if (filters.type) q.type = filters.type;
    if (filters.category) q.category = filters.category;
    if (filters.userName) q.userName = filters.userName;
    const list = await History.find(q).sort({ timestamp: -1 }).skip(skip).limit(limit).lean();
    return list.map((h) => ({
      timestamp: h.timestamp,
      type: h.type,
      category: h.category,
      itemName: h.itemName,
      action: h.action,
      details: h.details,
      userName: h.userName
    }));
  } catch (error) {
    console.error('❌ 히스토리 조회 실패:', error.message);
    return [];
  }
}

async function getHistoryCount(filters = {}) {
  try {
    const q = {};
    if (filters.type) q.type = filters.type;
    if (filters.category) q.category = filters.category;
    return await History.countDocuments(q);
  } catch (error) {
    console.error('❌ 히스토리 개수 조회 실패:', error.message);
    return 0;
  }
}

async function clearHistory() {
  try {
    await History.deleteMany({});
  } catch (error) {
    console.error('❌ 히스토리 삭제 실패:', error.message);
  }
}

// 변경 리스너 관리
function addChangeListener(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

function removeChangeListener(listener) {
  changeListeners.delete(listener);
}

function notifyChangeListeners(event = { operationType: 'update' }) {
  changeListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('리스너 실행 에러:', error);
    }
  });
}

// 변경 감지 시작
function watchInventoryChanges() {
  // MongoDB 연결 상태 확인
  if (mongoose.connection.readyState !== 1) {
    console.log('⚠️ MongoDB가 연결되지 않아 변경 감지를 시작할 수 없습니다.');
    return;
  }

  console.log('👁️ 재고 변경 감지 시작');

  const collectionsToWatch = ['items', 'recipes', 'settings', 'inventory_histories'];

  try {
    if (mongoose.connection?.watch) {
      changeStream = mongoose.connection.watch([
        { $match: { 'ns.coll': { $in: collectionsToWatch } } }
      ], { fullDocument: 'updateLookup' });

      changeStream.on('change', (change) => {
        try {
          console.log('🔔 Change Stream 이벤트:', change.operationType);
          notifyChangeListeners({ operationType: change.operationType, change });
        } catch (err) {
          console.error('Change Stream 처리 실패:', err);
        }
      });

      changeStream.on('error', (err) => {
        console.warn('Change Stream 에러, 폴링으로 폴백:', err?.message || err);
        try { changeStream.close(); } catch (e) {}
        changeStream = null;
        startPolling();
      });

      console.log('✅ Change Stream으로 변경 감지 시작');
      return;
    }
  } catch (err) {
    console.warn('Change Stream 초기화 실패:', err?.message || err);
  }

  startPolling();
}

let lastUpdateTime = null;

function startPolling() {
  watchIntervalId = setInterval(async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;

      const [latestItem, latestRecipe, latestSetting] = await Promise.all([
        Item.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
        Recipe.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
        Setting.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean()
      ]);

      const times = [latestItem?.updatedAt, latestRecipe?.updatedAt, latestSetting?.updatedAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime());

      if (times.length === 0) return;

      const currentUpdateTime = Math.max(...times);

      if (lastUpdateTime === null) {
        lastUpdateTime = currentUpdateTime;
        return;
      }

      if (currentUpdateTime > lastUpdateTime) {
        console.log('🔔 데이터 변경 감지 (폴링)');
        lastUpdateTime = currentUpdateTime;
        notifyChangeListeners({ operationType: 'update' });
      }
    } catch (error) {
      if (!error.message?.includes('timed out')) {
        console.error('❌ 변경 감지 에러:', error.message);
      }
    }
  }, DB_CONFIG.POLLING_INTERVAL);
}

// 재고 데이터 로드
async function loadInventory() {
  try {
    const [items, recipes, setting] = await Promise.all([
      Item.find({}).sort({ order: 1 }).lean(),
      Recipe.find({}).lean(),
      Setting.findById('global').lean()
    ]);
    
    const inventory = {
      categories: {},
      crafting: {
        categories: {},
        recipes: {},
        crafting: {}
      },
      tags: setting?.tags || { inventory: {}, crafting: {} },
      settings: {
        uiMode: setting?.uiMode || 'normal',
        barLength: setting?.barLength || 15,
        selectMessageTimeout: setting?.selectMessageTimeout || 30,
        infoMessageTimeout: setting?.infoMessageTimeout || 15
      },
      collecting: {}
    };
    
    items.forEach(item => {
      if (item.type === 'inventory') {
        if (!inventory.categories[item.category]) {
          inventory.categories[item.category] = {};
        }
        inventory.categories[item.category][item.name] = {
          quantity: item.quantity,
          required: item.required,
          itemType: item.itemType,
          linkedItem: item.linkedItem,
          emoji: item.emoji
        };

        // workers 배열에서 작업자 정보 추출
        if (item.workers && item.workers.length > 0) {
          if (!inventory.collecting[item.category]) {
            inventory.collecting[item.category] = {};
          }
          inventory.collecting[item.category][item.name] = item.workers.map(w => ({
            userId: w.userId,
            userName: w.userName,
            startTime: w.startedAt
          }));
        }
      } else if (item.type === 'crafting') {
        if (!inventory.crafting.categories[item.category]) {
          inventory.crafting.categories[item.category] = {};
        }
        inventory.crafting.categories[item.category][item.name] = {
          quantity: item.quantity,
          required: item.required,
          itemType: item.itemType,
          linkedItem: item.linkedItem,
          emoji: item.emoji
        };

        // workers 배열에서 작업자 정보 추출
        if (item.workers && item.workers.length > 0) {
          if (!inventory.crafting.crafting[item.category]) {
            inventory.crafting.crafting[item.category] = {};
          }
          inventory.crafting.crafting[item.category][item.name] = item.workers.map(w => ({
            userId: w.userId,
            userName: w.userName,
            startTime: w.startedAt
          }));
        }
      }
    });
    
    recipes.forEach(recipe => {
      if (!inventory.crafting.recipes[recipe.category]) {
        inventory.crafting.recipes[recipe.category] = {};
      }
      inventory.crafting.recipes[recipe.category][recipe.resultName] = recipe.materials.map(m => ({
        name: m.name,
        category: m.category,
        quantity: m.quantity
      }));
    });
    
    return inventory;
  } catch (error) {
    console.error('❌ 재고 로드 실패:', error.message);
    throw error;
  }
}

// 아이템 수량 원자적 업데이트
async function updateItemQuantity(type, category, itemName, delta, userName, action, details) {
  try {
    // 먼저 현재 수량 확인 (차감 시 음수 방지)
    if (delta < 0) {
      const currentItem = await Item.findOne({ type, category, name: itemName });
      if (currentItem) {
        const newQuantity = currentItem.quantity + delta;
        if (newQuantity < 0) {
          // 음수가 되지 않도록 현재 수량만큼만 차감
          delta = -currentItem.quantity;
          if (delta === 0) {
            return true; // 이미 0이면 아무것도 안 함
          }
        }
      }
    }
    
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { $inc: { quantity: delta }, $set: { updatedAt: new Date() } },
      { new: true }
    );
    
    if (result) {
      if (action && details) {
        await addHistoryEntry({
          timestamp: new Date().toISOString(),
          type,
          category,
          itemName,
          action,
          details,
          userName
        });
      }
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 아이템 수량 업데이트 에러:', error);
    throw error;
  }
}

// 아이템 수량 직접 설정 (절대값)
async function setItemQuantity(type, category, itemName, value, userName, action, details) {
  try {
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { $set: { quantity: Math.max(0, value), updatedAt: new Date() } },
      { new: true }
    );
    
    if (result) {
      if (action && details) {
        await addHistoryEntry({
          timestamp: new Date().toISOString(),
          type,
          category,
          itemName,
          action,
          details,
          userName
        });
      }
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 아이템 수량 설정 에러:', error);
    throw error;
  }
}

// 여러 아이템 일괄 업데이트
async function updateMultipleItems(updates, historyEntries) {
  try {
    const bulkOps = updates.map(u => {
      const filter = { type: u.type, category: u.category, name: u.itemName };
      const update = {};
      const fieldName = u.field === 'required' ? 'required' : 'quantity';
      
      if (u.operation === 'set') {
        update.$set = { [fieldName]: u.value, updatedAt: new Date() };
      } else {
        update.$inc = { [fieldName]: u.delta };
        update.$set = { updatedAt: new Date() };
      }
      
      return { updateOne: { filter, update } };
    });
    
    if (bulkOps.length > 0) {
      const result = await Item.bulkWrite(bulkOps);
      
      if (result.modifiedCount > 0) {
        if (historyEntries && historyEntries.length > 0) {
          for (const h of historyEntries) {
            await addHistoryEntry(h);
          }
        }
        notifyChangeListeners();
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('❌ 다중 아이템 업데이트 에러:', error);
    throw error;
  }
}

// 아이템 추가
async function addItem(itemData) {
  try {
    const newItem = new Item({
      name: itemData.name,
      category: itemData.category,
      type: itemData.type,
      itemType: itemData.itemType || (itemData.type === 'crafting' ? 'final' : 'material'),
      quantity: itemData.quantity || 0,
      required: itemData.required || 0,
      linkedItem: itemData.linkedItem,
      emoji: itemData.emoji
    });
    
    await newItem.save();
    notifyChangeListeners();
    return newItem;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('이미 존재하는 아이템입니다.');
    }
    throw error;
  }
}

// 아이템 삭제
async function removeItem(type, category, name) {
  try {
    const result = await Item.deleteOne({ type, category, name });
    
    if (type === 'crafting') {
      await Recipe.deleteOne({ category, resultName: name });
    }
    
    if (result.deletedCount > 0) {
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 아이템 삭제 실패:', error);
    throw error;
  }
}

// 아이템 정보 수정
async function updateItemDetails(type, category, oldName, updates) {
  try {
    const filter = { type, category, name: oldName };
    const update = { $set: { ...updates, updatedAt: new Date() } };
    
    if (updates.name && updates.name !== oldName) {
      const exists = await Item.exists({ type, category, name: updates.name });
      if (exists) {
        throw new Error('이미 존재하는 이름입니다.');
      }
      
      if (type === 'crafting') {
        await Recipe.updateOne(
          { category, resultName: oldName },
          { $set: { resultName: updates.name } }
        );
      }
    }
    
    const result = await Item.findOneAndUpdate(filter, update, { new: true });
    
    if (result) {
      notifyChangeListeners();
      return result;
    }
    return null;
  } catch (error) {
    console.error('❌ 아이템 수정 실패:', error);
    throw error;
  }
}

// 레시피 저장
async function saveRecipe(category, resultName, materials) {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { category, resultName },
      {
        category,
        resultName,
        materials: materials.map(m => ({
          name: m.name,
          category: m.category,
          quantity: m.quantity
        }))
      },
      { upsert: true, new: true }
    );
    
    notifyChangeListeners();
    return recipe;
  } catch (error) {
    console.error('❌ 레시피 저장 실패:', error);
    throw error;
  }
}

// 레시피 삭제
async function removeRecipe(category, resultName) {
  try {
    const result = await Recipe.deleteOne({ category, resultName });
    if (result.deletedCount > 0) {
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 레시피 삭제 실패:', error);
    throw error;
  }
}

// ============ 제작 계획 관련 함수들 ============

/**
 * 레시피 재료 검증 (재귀적) - 모든 하위 재료가 충분한지 확인
 * @param {string} type - 아이템 타입 (crafting/inventory)
 * @param {string} category - 카테고리
 * @param {string} itemName - 제작할 아이템 이름
 * @param {number} craftAmount - 제작할 수량
 * @param {number} depth - 재귀 깊이 (무한 루프 방지)
 * @returns {Object} { valid: boolean, missing: [{name, category, required, available, shortage}] }
 */
async function validateMaterialsRecursive(type, category, itemName, craftAmount, depth = 0) {
  try {
    if (depth > 5 || craftAmount <= 0) return { valid: true, missing: [] };
    
    const recipes = await Recipe.find({}).lean();
    const recipe = recipes.find(r => r.resultName === itemName && r.category === category);
    
    if (!recipe || !recipe.materials || recipe.materials.length === 0) {
      return { valid: true, missing: [] };
    }
    
    const missing = [];
    
    for (const mat of recipe.materials) {
      const materialItem = await Item.findOne({ 
        type, 
        category: mat.category, 
        name: mat.name 
      }).lean();
      
      // 해당 재료가 제작 계획에 없으면 검증 스킵 (외부 재료)
      if (!materialItem) continue;
      
      const available = materialItem.quantity || 0;
      const required = mat.quantity * craftAmount;
      
      if (available < required) {
        missing.push({
          name: mat.name,
          category: mat.category,
          required,
          available,
          shortage: required - available
        });
      }
    }
    
    return { valid: missing.length === 0, missing };
  } catch (error) {
    console.error('❌ 재료 검증 실패:', error);
    return { valid: false, missing: [{ name: itemName, error: error.message }] };
  }
}

/**
 * 레시피 재료 차감 (재귀적) - 모든 하위 재료 자동 차감
 * @param {string} type - 아이템 타입 (crafting/inventory)  
 * @param {string} category - 카테고리
 * @param {string} itemName - 제작 아이템 이름
 * @param {number} craftAmount - 제작 수량 (양수: 제작, 음수: 취소)
 * @param {string} userName - 작업자
 * @param {number} depth - 재귀 깊이
 * @param {string} batchId - 히스토리 그룹화용 배치 ID
 * @returns {Object} { success: boolean, changes: [{name, delta}] }
 */
async function syncMaterialsRecursive(type, category, itemName, craftAmount, userName, depth = 0, batchId = null) {
  try {
    if (depth > 5) return { success: true, changes: [] };
    
    const recipes = await Recipe.find({}).lean();
    const recipe = recipes.find(r => r.resultName === itemName && r.category === category);
    
    if (!recipe || !recipe.materials || recipe.materials.length === 0) {
      return { success: true, changes: [] };
    }
    
    const changes = [];
    const batch = batchId || `batch_${Date.now()}`;
    
    for (const mat of recipe.materials) {
      const materialDelta = -(craftAmount * mat.quantity);
      
      const materialItem = await Item.findOne({ 
        type, 
        category: mat.category, 
        name: mat.name 
      });
      
      if (materialItem) {
        const newQuantity = Math.max(0, materialItem.quantity + materialDelta);
        const actualDelta = newQuantity - materialItem.quantity;
        
        if (actualDelta !== 0) {
          await Item.findOneAndUpdate(
            { type, category: mat.category, name: mat.name },
            { $set: { quantity: newQuantity, updatedAt: new Date() } }
          );
          
          await addHistoryEntry({
            timestamp: new Date().toISOString(),
            type,
            category: mat.category,
            itemName: mat.name,
            action: 'recipe_sync',
            details: `[${batch}] ${itemName} ${craftAmount > 0 ? '제작' : '취소'}: ${actualDelta > 0 ? '+' : ''}${actualDelta}개`,
            userName
          });
          
          changes.push({ name: mat.name, category: mat.category, delta: actualDelta });
        }
        
        // 하위 재료도 재귀적으로 차감 (재료가 레시피가 있는 경우만)
        // 주의: 하위 재료는 이미 위에서 처리되었으므로 재귀 호출 불필요
        // 제작 계획에서는 1차 재료만 차감하면 됨 (계층 구조가 아님)
      }
    }
    
    notifyChangeListeners();
    return { success: true, changes };
  } catch (error) {
    console.error('❌ 재료 동기화 실패:', error);
    return { success: false, changes: [], error: error.message };
  }
}

/**
 * 제작 미리보기 - 제작 시 영향받는 모든 재료 목록 반환
 * @param {string} type - 아이템 타입
 * @param {string} category - 카테고리
 * @param {string} itemName - 제작 아이템
 * @param {number} craftAmount - 제작 수량
 * @returns {Object} { materials: [{name, category, currentStock, required, afterStock, shortage}], hasShortage }
 */
async function getCraftingPreview(type, category, itemName, craftAmount) {
  try {
    const recipes = await Recipe.find({}).lean();
    const materials = [];
    
    const collectMaterials = async (name, cat, amount, depth = 0) => {
      if (depth > 5) return;
      
      const recipe = recipes.find(r => r.resultName === name && r.category === cat);
      if (!recipe || !recipe.materials) return;
      
      for (const mat of recipe.materials) {
        const item = await Item.findOne({ type, category: mat.category, name: mat.name }).lean();
        const currentStock = item?.quantity || 0;
        const required = mat.quantity * amount;
        
        const existing = materials.find(m => m.name === mat.name && m.category === mat.category);
        if (existing) {
          existing.required += required;
          existing.afterStock = Math.max(0, existing.currentStock - existing.required);
          existing.shortage = Math.max(0, existing.required - existing.currentStock);
        } else {
          materials.push({
            name: mat.name,
            category: mat.category,
            currentStock,
            required,
            afterStock: Math.max(0, currentStock - required),
            shortage: Math.max(0, required - currentStock)
          });
        }
        
        await collectMaterials(mat.name, mat.category, required, depth + 1);
      }
    };
    
    await collectMaterials(itemName, category, craftAmount);
    
    return { 
      materials,
      hasShortage: materials.some(m => m.shortage > 0)
    };
  } catch (error) {
    console.error('❌ 제작 미리보기 실패:', error);
    throw error;
  }
}

/**
 * 3차 제작품 목표 기준으로 모든 티어 필요량 계산
 * @param {string} category - 카테고리
 * @param {Array} tier3Goals - [{name, quantity}] 3차 제작품 목표
 * @returns {Object} { tier1: [], tier2: [], tier3: [] }
 */
async function calculateMaterialRequirements(category, tier3Goals) {
  try {
    const recipes = await Recipe.find({ category }).lean();
    const recipeMap = recipes.reduce((acc, r) => {
      acc[r.resultName] = r;
      return acc;
    }, {});

    const requirements = { tier1: {}, tier2: {}, tier3: {} };

    // 3차 목표 설정
    for (const goal of tier3Goals) {
      requirements.tier3[goal.name] = {
        name: goal.name,
        required: goal.quantity,
        emoji: goal.emoji || null
      };

      // 3차 레시피에서 2차 재료 계산
      const recipe3 = recipeMap[goal.name];
      if (recipe3 && recipe3.materials) {
        for (const mat of recipe3.materials) {
          const needed = mat.quantity * goal.quantity;
          if (!requirements.tier2[mat.name]) {
            requirements.tier2[mat.name] = { name: mat.name, required: 0, emoji: null };
          }
          requirements.tier2[mat.name].required += needed;

          // 2차 레시피에서 1차 재료 계산
          const recipe2 = recipeMap[mat.name];
          if (recipe2 && recipe2.materials) {
            for (const mat2 of recipe2.materials) {
              const needed2 = mat2.quantity * needed;
              if (!requirements.tier1[mat2.name]) {
                requirements.tier1[mat2.name] = { name: mat2.name, required: 0, emoji: null };
              }
              requirements.tier1[mat2.name].required += needed2;
            }
          }
        }
      }
    }

    return {
      tier1: Object.values(requirements.tier1),
      tier2: Object.values(requirements.tier2),
      tier3: Object.values(requirements.tier3)
    };
  } catch (error) {
    console.error('❌ 재료 필요량 계산 실패:', error);
    throw error;
  }
}

/**
 * 제작 계획의 상위 티어 목표 변경 시 하위 티어 필요량 재계산
 * @param {string} category - 카테고리
 * @param {string} itemName - 변경된 아이템 이름
 * @param {number} tier - 변경된 아이템 티어
 * @param {number} newRequired - 새로운 목표 수량
 */
async function recalculateCraftingRequirements(category, itemName, tier, newRequired) {
  try {
    // 티어 1은 재계산 대상이 아님
    if (tier === 1) return { success: true, updated: 0 };
    
    const recipes = await Recipe.find({ category }).lean();
    const recipeMap = recipes.reduce((acc, r) => {
      acc[r.resultName] = r;
      return acc;
    }, {});
    
    // 해당 아이템의 레시피 찾기
    const recipe = recipeMap[itemName];
    if (!recipe || !recipe.materials) return { success: true, updated: 0 };
    
    // 누적 계산을 위한 맵 (기존 set → inc로 변경)
    const requiredMap = {};
    
    // 직접 재료 계산
    for (const mat of recipe.materials) {
      const totalNeeded = mat.quantity * newRequired;
      
      if (!requiredMap[mat.name]) {
        requiredMap[mat.name] = 0;
      }
      requiredMap[mat.name] += totalNeeded;
      
      // 2단계 하위 재료 (3차 -> 2차 -> 1차)
      if (tier === 3) {
        const subRecipe = recipeMap[mat.name];
        if (subRecipe && subRecipe.materials) {
          for (const subMat of subRecipe.materials) {
            const subNeeded = subMat.quantity * totalNeeded;
            if (!requiredMap[subMat.name]) {
              requiredMap[subMat.name] = 0;
            }
            requiredMap[subMat.name] += subNeeded;
          }
        }
      }
    }
    
    // 누적된 값으로 업데이트 생성
    const updates = Object.entries(requiredMap).map(([name, value]) => ({
      type: 'crafting',
      category,
      itemName: name,
      field: 'required',
      operation: 'set',
      value
    }));
    
    if (updates.length > 0) {
      await updateMultipleItems(updates, []);
    }
    
    return { success: true, updated: updates.length };
  } catch (error) {
    console.error('❌ 제작 필요량 재계산 실패:', error);
    throw error;
  }
}

/**
 * 제작 계획 생성 (3차 목표 기준으로 전체 티어 아이템 자동 생성)
 * @param {string} category - 카테고리
 * @param {Array} tier3Goals - [{name, quantity, emoji}]
 * @param {string} eventId - 연동할 이벤트 ID (optional)
 */
async function createCraftingPlan(category, tier3Goals, eventId = null) {
  try {
    // 기존 해당 카테고리 crafting 아이템 삭제
    await Item.deleteMany({ type: 'crafting', category });

    // 필요량 계산
    const requirements = await calculateMaterialRequirements(category, tier3Goals);

    const itemsToCreate = [];

    // 1차 아이템 생성
    for (const item of requirements.tier1) {
      itemsToCreate.push({
        name: item.name,
        category,
        type: 'crafting',
        itemType: 'material',
        tier: 1,
        eventId: eventId ? new mongoose.Types.ObjectId(eventId) : null,
        quantity: 0,
        required: item.required,
        emoji: item.emoji
      });
    }

    // 2차 아이템 생성
    for (const item of requirements.tier2) {
      itemsToCreate.push({
        name: item.name,
        category,
        type: 'crafting',
        itemType: 'intermediate',
        tier: 2,
        eventId: eventId ? new mongoose.Types.ObjectId(eventId) : null,
        quantity: 0,
        required: item.required,
        emoji: item.emoji
      });
    }

    // 3차 아이템 생성
    for (const item of requirements.tier3) {
      itemsToCreate.push({
        name: item.name,
        category,
        type: 'crafting',
        itemType: 'final',
        tier: 3,
        eventId: eventId ? new mongoose.Types.ObjectId(eventId) : null,
        quantity: 0,
        required: item.required,
        emoji: item.emoji
      });
    }

    // 일괄 생성
    if (itemsToCreate.length > 0) {
      await Item.insertMany(itemsToCreate);
    }

    notifyChangeListeners();
    
    return {
      created: itemsToCreate.length,
      tier1: requirements.tier1.length,
      tier2: requirements.tier2.length,
      tier3: requirements.tier3.length
    };
  } catch (error) {
    console.error('❌ 제작 계획 생성 실패:', error);
    throw error;
  }
}

/**
 * 특정 카테고리 또는 전체 crafting 아이템 삭제
 * @param {string} category - 카테고리 (null이면 전체)
 */
async function deleteCraftingItems(category = null) {
  try {
    const query = { type: 'crafting' };
    if (category) {
      query.category = category;
    }
    const result = await Item.deleteMany(query);
    notifyChangeListeners();
    return result.deletedCount;
  } catch (error) {
    console.error('❌ 제작 아이템 삭제 실패:', error);
    throw error;
  }
}

/**
 * 티어별 제작 대시보드 통계
 * @param {string} category - 카테고리 (optional)
 */
async function getCraftingDashboard(category = null) {
  try {
    const query = { type: 'crafting' };
    if (category) {
      query.category = category;
    }

    const items = await Item.find(query).lean();
    
    // 레시피 조회 (하위재료 표시용)
    const recipes = await Recipe.find(category ? { category } : {}).lean();
    const recipeMap = recipes.reduce((acc, r) => {
      acc[r.resultName] = r;
      return acc;
    }, {});
    
    // 인벤토리 아이템 조회 (재고 연동용)
    const inventoryItems = await Item.find({ type: 'inventory' }).lean();
    const inventoryMap = inventoryItems.reduce((acc, item) => {
      const key = `${item.category}:${item.name}`;
      acc[key] = item;
      return acc;
    }, {});
    
    // 연동된 이벤트 조회
    const eventIds = [...new Set(items.filter(i => i.eventId).map(i => i.eventId.toString()))];
    let linkedEvents = [];
    if (eventIds.length > 0) {
      linkedEvents = await Event.find({ _id: { $in: eventIds } }).lean();
    }
    const eventMap = linkedEvents.reduce((acc, e) => {
      acc[e._id.toString()] = e;
      return acc;
    }, {});
    
    const stats = {
      tier1: { items: [], total: 0, completed: 0 },
      tier2: { items: [], total: 0, completed: 0 },
      tier3: { items: [], total: 0, completed: 0 },
      overall: { total: 0, completed: 0, progress: 0 },
      recipes: recipeMap,
      inventoryMap,
      linkedEvents: linkedEvents.map(e => ({
        _id: e._id,
        title: e.title,
        startDate: e.startDate,
        endDate: e.endDate,
        color: e.color
      }))
    };

    for (const item of items) {
      const tierKey = `tier${item.tier || 1}`;
      const isCompleted = item.quantity >= item.required;
      
      // 레시피 정보 추가
      const recipe = recipeMap[item.name];
      if (recipe) {
        item.recipe = recipe;
        // 재료별 인벤토리 보유량 추가
        if (recipe.materials) {
          item.materialsWithStock = recipe.materials.map(mat => {
            const invKey = `${mat.category || item.category}:${mat.name}`;
            const invItem = inventoryMap[invKey];
            return {
              ...mat,
              emoji: invItem?.emoji || null,
              stock: invItem?.quantity || 0,
              needed: mat.quantity * Math.max(0, item.required - item.quantity)
            };
          });
        }
      }
      
      stats[tierKey].items.push(item);
      stats[tierKey].total++;
      if (isCompleted) stats[tierKey].completed++;
      
      stats.overall.total++;
      if (isCompleted) stats.overall.completed++;
    }

    stats.overall.progress = stats.overall.total > 0 
      ? Math.round((stats.overall.completed / stats.overall.total) * 100) 
      : 0;

    return stats;
  } catch (error) {
    console.error('❌ 대시보드 조회 실패:', error);
    throw error;
  }
}

// 작업자 업데이트 (단일 - 하위 호환)
async function updateItemWorker(type, category, itemName, workerData) {
  try {
    const update = workerData 
      ? { worker: workerData, updatedAt: new Date() } 
      : { worker: { userId: null, userName: null, startTime: null }, updatedAt: new Date() };
      
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { $set: update },
      { new: true }
    );
    
    if (result) {
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 작업자 업데이트 실패:', error);
    throw error;
  }
}

// 작업자 추가 (다중 작업자)
async function addItemWorker(type, category, itemName, userId, userName) {
  try {
    const item = await Item.findOne({ type, category, name: itemName });
    if (!item) return null;
    
    // 이미 참여 중인지 확인
    const alreadyWorking = item.workers?.some(w => w.userId === userId);
    if (alreadyWorking) {
      return { success: false, message: '이미 작업에 참여 중입니다.' };
    }
    
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { 
        $push: { 
          workers: { 
            userId, 
            userName, 
            startedAt: new Date() 
          } 
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (result) {
      notifyChangeListeners();
      return { success: true, item: result };
    }
    return null;
  } catch (error) {
    console.error('❌ 작업자 추가 실패:', error);
    throw error;
  }
}

// 작업자 제거 (다중 작업자)
async function removeItemWorker(type, category, itemName, userId) {
  try {
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { 
        $pull: { workers: { userId } },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (result) {
      notifyChangeListeners();
      return { success: true, item: result };
    }
    return null;
  } catch (error) {
    console.error('❌ 작업자 제거 실패:', error);
    throw error;
  }
}

// 아이템의 모든 작업자 제거
async function clearItemWorkers(type, category, itemName) {
  try {
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { 
        $set: { workers: [], updatedAt: new Date() }
      },
      { new: true }
    );
    
    if (result) {
      notifyChangeListeners();
      return { success: true, item: result };
    }
    return null;
  } catch (error) {
    console.error('❌ 작업자 전체 제거 실패:', error);
    throw error;
  }
}

// 설정 조회
async function getSettings() {
  try {
    return await Setting.findById('global').lean();
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error.message);
    return null;
  }
}

// 설정 업데이트
async function updateSettings(updates) {
  try {
    const result = await Setting.findByIdAndUpdate(
      'global',
      { $set: updates },
      { new: true, upsert: true }
    );
    notifyChangeListeners();
    return result;
  } catch (error) {
    console.error('❌ 설정 업데이트 실패:', error);
    throw error;
  }
}

// 아이템 순서 업데이트
async function updateItemsOrder(type, category, items) {
  try {
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { type, category, name: item.name },
        update: { $set: { order: item.order } }
      }
    }));
    
    const result = await Item.bulkWrite(bulkOps);
    notifyChangeListeners();
    return result;
  } catch (error) {
    console.error('❌ 순서 업데이트 에러:', error);
    throw error;
  }
}

// 배점 관련
async function getItemPoints() {
  try {
    const setting = await Setting.findById('global').lean();
    return setting?.itemPoints || { inventory: {}, crafting: {} };
  } catch (error) {
    console.error('❌ 아이템 배점 조회 실패:', error);
    return { inventory: {}, crafting: {} };
  }
}

async function updateItemPoints(type, category, itemName, points) {
  try {
    const path = `itemPoints.${type}.${category}.${itemName}`;
    await Setting.findByIdAndUpdate(
      'global',
      { $set: { [path]: points } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('❌ 아이템 배점 업데이트 실패:', error);
    throw error;
  }
}

async function resetAllItemPoints() {
  try {
    await Setting.findByIdAndUpdate(
      'global',
      { $set: { itemPoints: { inventory: {}, crafting: {} } } },
      { upsert: true }
    );
    return true;
  } catch (error) {
    console.error('❌ 아이템 배점 초기화 실패:', error);
    throw error;
  }
}

// 아이템 직접 조회
async function getItems(type, category = null) {
  try {
    const query = { type };
    if (category) query.category = category;
    return await Item.find(query).sort({ order: 1 }).lean();
  } catch (error) {
    console.error('❌ 아이템 조회 실패:', error);
    throw error;
  }
}

// 레시피 직접 조회
async function getRecipes(category = null) {
  try {
    const query = category ? { category } : {};
    return await Recipe.find(query).lean();
  } catch (error) {
    console.error('❌ 레시피 조회 실패:', error);
    throw error;
  }
}

// 카테고리 목록 조회
async function getCategories(type) {
  try {
    const items = await Item.find({ type }).distinct('category');
    return items;
  } catch (error) {
    console.error('❌ 카테고리 조회 실패:', error);
    throw error;
  }
}

// 유저 등록/업데이트 (별도 User 컬렉션 사용)
async function registerUser(userData) {
  try {
    console.log('📝 유저 등록/업데이트:', userData.username, userData.id);
    
    // upsert로 한 번에 처리 (있으면 업데이트, 없으면 생성)
    const result = await User.findByIdAndUpdate(
      userData.id,
      {
        _id: userData.id,
        username: userData.username,
        globalName: userData.globalName,
        avatar: userData.avatar
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    
    const isNew = !result.createdAt || (Date.now() - new Date(result.createdAt).getTime() < 1000);
    console.log(isNew ? '✅ 새 유저 추가:' : '✅ 유저 업데이트 완료:', userData.username);
    
    const count = await User.countDocuments();
    console.log('📊 현재 등록된 유저 수:', count);
    
    notifyChangeListeners();
    return true;
  } catch (error) {
    console.error('❌ 유저 등록 실패:', error);
    return false;
  }
}

// 등록된 유저 목록 조회
async function getRegisteredUsers() {
  try {
    const users = await User.find().lean();
    return users.map(u => ({
      id: u._id,
      username: u.username,
      globalName: u.globalName,
      avatar: u.avatar,
      registeredAt: u.registeredAt
    }));
  } catch (error) {
    console.error('❌ 유저 목록 조회 실패:', error);
    return [];
  }
}

// ========== 이벤트 관련 함수 ==========

// 반복 이벤트 확장 헬퍼
function expandRepeatingEvents(events, rangeStart, rangeEnd) {
  const expanded = [];
  
  for (const event of events) {
    if (event.repeat === 'none') {
      expanded.push(event);
      continue;
    }
    
    // 반복 이벤트 인스턴스 생성
    const eventStart = new Date(event.startDate);
    const repeatEnd = event.repeatEndDate ? new Date(event.repeatEndDate) : rangeEnd;
    let current = new Date(eventStart);
    
    while (current <= repeatEnd && current <= rangeEnd) {
      if (current >= rangeStart || (event.endDate && new Date(event.endDate) >= rangeStart)) {
        expanded.push({
          ...event,
          _instanceDate: new Date(current),
          isInstance: true,
          originalId: event._id
        });
      }
      
      // 다음 반복 날짜 계산
      if (event.repeat === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (event.repeat === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else if (event.repeat === 'monthly') {
        current.setMonth(current.getMonth() + 1);
      }
    }
  }
  
  return expanded;
}

// 이벤트 조회 (날짜 범위)
async function getEvents(startDate, endDate) {
  try {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const events = await Event.find({
      $or: [
        // 단일 이벤트: 시작일이 범위 내
        { repeat: 'none', startDate: { $gte: start, $lte: end } },
        // 단일 이벤트: 종료일이 범위 내
        { repeat: 'none', endDate: { $gte: start, $lte: end } },
        // 단일 이벤트: 범위를 포함하는 경우
        { repeat: 'none', startDate: { $lte: start }, endDate: { $gte: end } },
        // 반복 이벤트: 시작일이 범위 이전이고 반복종료일이 없거나 범위 이후
        { repeat: { $ne: 'none' }, startDate: { $lte: end }, $or: [
          { repeatEndDate: null },
          { repeatEndDate: { $gte: start } }
        ]}
      ]
    }).sort({ startDate: 1 }).lean();
    
    return expandRepeatingEvents(events, start, end);
  } catch (error) {
    console.error('❌ 이벤트 조회 실패:', error);
    return [];
  }
}

// 다가오는 이벤트 조회 (알림용)
async function getUpcomingEvents(days = 2) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return getEvents(now, end);
}

// 이벤트 생성
async function createEvent(data) {
  try {
    const event = await Event.create(data);
    console.log('✅ 이벤트 생성:', event.title);
    return event;
  } catch (error) {
    console.error('❌ 이벤트 생성 실패:', error);
    throw error;
  }
}

// 이벤트 수정
async function updateEvent(id, data) {
  try {
    const event = await Event.findByIdAndUpdate(id, data, { new: true });
    if (event) {
      console.log('✅ 이벤트 수정:', event.title);
    }
    return event;
  } catch (error) {
    console.error('❌ 이벤트 수정 실패:', error);
    throw error;
  }
}

// 이벤트 삭제
async function deleteEvent(id) {
  try {
    const event = await Event.findByIdAndDelete(id);
    if (event) {
      console.log('✅ 이벤트 삭제:', event.title);
    }
    return event;
  } catch (error) {
    console.error('❌ 이벤트 삭제 실패:', error);
    throw error;
  }
}

module.exports = {
  // 연결
  connectDatabase,
  disconnectDatabase,
  stopWatching,
  watchInventoryChanges,
  
  // 리스너
  addChangeListener,
  removeChangeListener,
  notifyChangeListeners,
  
  // 데이터 로드
  loadInventory,
  getItems,
  getRecipes,
  getCategories,
  
  // 아이템 CRUD
  addItem,
  removeItem,
  updateItemDetails,
  updateItemQuantity,
  setItemQuantity,
  updateMultipleItems,
  updateItemWorker,
  addItemWorker,
  removeItemWorker,
  clearItemWorkers,
  updateItemsOrder,
  
  // 레시피
  saveRecipe,
  removeRecipe,
  
  // 제작 계획
  calculateMaterialRequirements,
  recalculateCraftingRequirements,
  createCraftingPlan,
  deleteCraftingItems,
  getCraftingDashboard,
  validateMaterialsRecursive,
  syncMaterialsRecursive,
  getCraftingPreview,
  
  // 설정
  getSettings,
  updateSettings,
  
  // 배점
  getItemPoints,
  updateItemPoints,
  resetAllItemPoints,
  
  // 히스토리
  addHistoryEntry,
  getHistory,
  getHistoryCount,
  clearHistory,
  
  // 유저
  registerUser,
  getRegisteredUsers,
  
  // 이벤트
  getEvents,
  getUpcomingEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  
  // 모델 (직접 접근용)
  Item,
  Recipe,
  Setting,
  History,
  Event
};
