const mongoose = require('mongoose');
const { Item } = require('./models/Item');
const { Recipe } = require('./models/Recipe');
const { Setting } = require('./models/Setting');
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
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
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
    const count = await History.countDocuments();
    if (count > 100) {
      const old = await History.find().sort({ timestamp: 1 }).limit(count - 100).select('_id').lean();
      await History.deleteMany({ _id: { $in: old.map((o) => o._id) } });
    }
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

        if (item.worker && item.worker.userId) {
          if (!inventory.collecting[item.category]) {
            inventory.collecting[item.category] = {};
          }
          inventory.collecting[item.category][item.name] = {
            userId: item.worker.userId,
            userName: item.worker.userName,
            startTime: item.worker.startTime
          };
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

        if (item.worker && item.worker.userId) {
          if (!inventory.crafting.crafting[item.category]) {
            inventory.crafting.crafting[item.category] = {};
          }
          inventory.crafting.crafting[item.category][item.name] = {
            userId: item.worker.userId,
            userName: item.worker.userName,
            startTime: item.worker.startTime
          };
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

// 작업자 업데이트
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

// 유저 등록/업데이트
async function registerUser(userData) {
  try {
    console.log('📝 유저 등록/업데이트:', userData.username, userData.id);
    const settings = await getSettings();
    const registeredUsers = settings?.registeredUsers || [];
    
    // 기존 유저 찾기
    const existingIndex = registeredUsers.findIndex(u => u.id === userData.id);
    
    if (existingIndex >= 0) {
      // 업데이트
      registeredUsers[existingIndex] = {
        ...registeredUsers[existingIndex],
        ...userData
      };
      console.log('✅ 유저 업데이트 완료:', userData.username);
    } else {
      // 새 유저 추가
      registeredUsers.push(userData);
      console.log('✅ 새 유저 추가:', userData.username);
    }
    
    await updateSettings({ registeredUsers });
    console.log('📊 현재 등록된 유저 수:', registeredUsers.length);
    return true;
  } catch (error) {
    console.error('❌ 유저 등록 실패:', error);
    return false;
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
  updateItemsOrder,
  
  // 레시피
  saveRecipe,
  removeRecipe,
  
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
  
  // 모델 (직접 접근용)
  Item,
  Recipe,
  Setting,
  History
};
