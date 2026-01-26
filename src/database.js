import mongoose from 'mongoose';
import { Item } from './models/Item.js';
import { Recipe } from './models/Recipe.js';
import { Setting } from './models/Setting.js';
import { DB_CONFIG } from './constants.js';

// 변경 감지 인터벌 ID를 보관하여 중지할 수 있도록 함
let watchIntervalId = null;
let changeStream = null;

export function stopWatching() {
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

export async function disconnectDatabase() {
  try {
    stopWatching();
    await mongoose.disconnect();
    console.log('✅ MongoDB 연결 종료 완료');
  } catch (err) {
    console.error('❌ MongoDB 연결 종료 실패:', err);
  }
}

// MongoDB 연결
export async function connectDatabase() {
  try {
    // 모든 환경변수 출력 (디버깅용)
    console.log('🔍 환경변수 확인:');
    console.log('  - MONGODB_URL:', process.env.MONGODB_URL ? '있음' : '없음');
    console.log('  - MONGO_URL:', process.env.MONGO_URL ? '있음' : '없음');
    console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '있음' : '없음');
    console.log('  - MONGODB_URI:', process.env.MONGODB_URI ? '있음' : '없음');
    
    // Railway는 여러 변수명 사용 가능
    const mongoUri = process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.DATABASE_URL || 
                     process.env.MONGODB_URI || 
                     'mongodb://localhost:27017/minecraft-inventory';
    
    console.log('🔍 사용할 MongoDB URI:', mongoUri.replace(/\/\/.*:.*@/, '//***:***@')); // 비밀번호 숨김
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30초
      socketTimeoutMS: 45000, // 45초
    });
    
    // 연결 이벤트 핸들러
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
    console.error('💡 .env에 MONGODB_URI를 설정하세요.');
    return false;
  }
}

// 재고 스키마 - Mixed 타입으로 단순화
const inventorySchema = new mongoose.Schema({
  categories: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  collecting: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  crafting: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      categories: {},
      crafting: {},
      recipes: {}
    }
  },
  tags: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      inventory: {}, // { categoryName: { tagName: [itemName1, itemName2, ...] } }
      crafting: {}
    }
  },
  settings: {
    uiMode: { type: String, default: 'normal' },
    barLength: { type: Number, default: 15 }
  },
  history: [{
    timestamp: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    itemName: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, required: true },
    userName: { type: String, required: true }
  }]
}, {
  timestamps: true,
  minimize: false // 빈 객체도 저장
});

// 싱글톤 패턴
inventorySchema.statics.getInstance = async function() {
  let instance = await this.findOne();
  if (!instance) {
    console.log('📦 새로운 재고 데이터 생성 중...');
    instance = await this.create({
      categories: {},
      collecting: {},
      crafting: {
        categories: {},
        crafting: {},
        recipes: {}
      },
      tags: {
        inventory: {},
        crafting: {}
      },
      settings: {
        uiMode: 'normal',
        barLength: 15
      },
      history: []
    });
  }
  return instance;
};

export const Inventory = mongoose.model('Inventory', inventorySchema);

// 히스토리 스키마 (별도 컬렉션)
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

// 히스토리 추가 (최대 100개 유지)
export async function addHistoryEntry(entry) {
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
export async function getHistory(limit = 10, skip = 0, filters = {}) {
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

// 히스토리 개수
export async function getHistoryCount() {
  try {
    return await History.countDocuments();
  } catch (error) {
    console.error('❌ 히스토리 개수 조회 실패:', error.message);
    return 0;
  }
}

// 히스토리 전체 삭제
export async function clearHistory() {
  try {
    await History.deleteMany({});
  } catch (error) {
    console.error('❌ 히스토리 삭제 실패:', error.message);
  }
}

// 마지막 업데이트 시간 추적
let lastUpdateTime = null;

// 변경 감지 (폴링 방식)
export function watchInventoryChanges() {
  console.log('👁️ 재고 변경 감지 시작 (Change Stream 우선)');

  const collectionsToWatch = ['items', 'recipes', 'settings', 'inventory_histories', 'inventories'];

  // 우선 가능하면 Change Stream 사용 (복제셋 필요). 불가 시 폴링으로 폴백.
  try {
    if (mongoose.connection?.watch) {
      changeStream = mongoose.connection.watch([
        { $match: { 'ns.coll': { $in: collectionsToWatch } } }
      ], { fullDocument: 'updateLookup' });

      changeStream.on('change', (change) => {
        try {
          console.log('🔔 Change Stream 이벤트 감지:', change.operationType, change?.ns?.coll || 'unknown');
          changeListeners.forEach(listener => {
            try { listener({ operationType: change.operationType, change }); } catch (err) { console.error('리스너 실행 에러:', err); }
          });
        } catch (err) {
          console.error('Change Stream 처리 실패:', err);
        }
      });

      changeStream.on('error', (err) => {
        console.warn('Change Stream 에러 발생, 폴링으로 폴백합니다:', err?.message || err);
        try { changeStream.close(); } catch (e) {}
        changeStream = null;
        startPolling();
      });

      console.log('✅ Change Stream으로 변경 감지 시작');
      return;
    }
  } catch (err) {
    console.warn('Change Stream 초기화 실패, 폴링으로 폴백:', err?.message || err);
  }

  // Change Stream을 사용할 수 없을 경우 폴링 시작
  startPolling();

  function startPolling() {
    watchIntervalId = setInterval(async () => {
      try {
        if (mongoose.connection.readyState !== 1) {
          console.log('⚠️ MongoDB 연결 끊김 - 재연결 대기 중...');
          return;
        }

        const [latestItem, latestRecipe, latestSetting] = await Promise.all([
          Item.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
          Recipe.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean(),
          Setting.findOne().sort({ updatedAt: -1 }).select('updatedAt').lean()
        ]);

        const times = [latestItem?.updatedAt, latestRecipe?.updatedAt, latestSetting?.updatedAt]
          .filter(Boolean)
          .map((d) => d.getTime());

        if (times.length === 0) return;

        const currentUpdateTime = Math.max(...times);

        if (lastUpdateTime === null) {
          lastUpdateTime = currentUpdateTime;
          return;
        }

        if (currentUpdateTime > lastUpdateTime) {
          console.log('🔔 재고 데이터 변경 감지 (폴링)!');
          lastUpdateTime = currentUpdateTime;
          changeListeners.forEach(listener => {
            try { listener({ operationType: 'update' }); } catch (error) { console.error('리스너 실행 에러:', error); }
          });
        }
      } catch (error) {
        if (error.message && (error.message.includes('timed out') || error.message.includes('interrupted'))) {
          return;
        }
        console.error('❌ 변경 감지 에러:', error.message || error);
      }
    }, 3000);
  }
}

// 변경 감지 리스너들
const changeListeners = new Set();

// 변경 리스너 등록
export function addChangeListener(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

// 변경 리스너 제거
export function removeChangeListener(listener) {
  changeListeners.delete(listener);
}

// 마이그레이션 함수: 기존 Inventory 데이터를 새 컬렉션들로 분리
export async function migrateToNewSchema() {
  try {
    const setting = await Setting.findById('global');
    if (setting?.isMigrated) {
      return false; // 이미 마이그레이션됨
    }
    
    console.log('� 새 스키마로 마이그레이션 시작...');
    const oldInventory = await Inventory.findOne();
    if (!oldInventory) {
      console.log('⚠️ 기존 데이터가 없습니다. 빈 상태로 초기화합니다.');
      await Setting.create({ _id: 'global', isMigrated: true, migrationDate: new Date() });
      return true;
    }
    
    const data = oldInventory.toObject();
    
    // 1. 일반 아이템 마이그레이션
    if (data.categories) {
      for (const [category, items] of Object.entries(data.categories)) {
        for (const [name, itemData] of Object.entries(items)) {
          await Item.findOneAndUpdate(
            { name, category, type: 'inventory' },
            {
              name, category, type: 'inventory',
              quantity: itemData.quantity || 0,
              required: itemData.required || 0,
              itemType: itemData.itemType || 'material',
              linkedItem: itemData.linkedItem,
              emoji: itemData.emoji
            },
            { upsert: true, new: true }
          );
        }
      }
    }
    
    // 2. 제작 아이템 및 레시피 마이그레이션
    if (data.crafting) {
      // 제작품
      if (data.crafting.categories) {
        for (const [category, items] of Object.entries(data.crafting.categories)) {
          for (const [name, itemData] of Object.entries(items)) {
            await Item.findOneAndUpdate(
              { name, category, type: 'crafting' },
              {
                name, category, type: 'crafting',
                quantity: itemData.quantity || 0,
                required: itemData.required || 0,
                itemType: itemData.itemType || 'final',
                linkedItem: itemData.linkedItem,
                emoji: itemData.emoji
              },
              { upsert: true, new: true }
            );
          }
        }
      }
      
      // 레시피
      if (data.crafting.recipes) {
        for (const [category, recipes] of Object.entries(data.crafting.recipes)) {
          for (const [resultName, materials] of Object.entries(recipes)) {
            await Recipe.findOneAndUpdate(
              { resultName, category },
              {
                resultName, category,
                materials: materials.map(m => ({
                  name: m.name,
                  category: m.category,
                  quantity: m.quantity
                }))
              },
              { upsert: true, new: true }
            );
          }
        }
      }
    }
    
    // 3. 설정 및 태그 마이그레이션
    await Setting.findOneAndUpdate(
      { _id: 'global' },
      {
        uiMode: data.settings?.uiMode || 'normal',
        barLength: data.settings?.barLength || 15,
        tags: data.tags || { inventory: {}, crafting: {} },
        isMigrated: true,
        migrationDate: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log('✅ 마이그레이션 완료!');
    return true;
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    return false;
  }
}

// 재고 데이터 로드 - 새 스키마 기반 어댑터 적용
export async function loadInventory() {
  try {
    // 마이그레이션 체크
    await migrateToNewSchema();
    
    console.log('🔄 DB에서 재고 로드 (새 스키마)');
    
    // 병렬로 데이터 로드
    const [items, recipes, setting] = await Promise.all([
      Item.find({}).sort({ order: 1 }).lean(), // order 필드로 정렬
      Recipe.find({}).lean(),
      Setting.findById('global').lean()
    ]);
    
    // 기존 구조로 객체 조립 (어댑터 패턴)
    const inventory = {
      categories: {},
      crafting: {
        categories: {},
        recipes: {},
        crafting: {} // 기존 호환성 유지용 빈 객체
      },
      tags: setting?.tags || { inventory: {}, crafting: {} },
      settings: {
        uiMode: setting?.uiMode || 'normal',
        barLength: setting?.barLength || 15,
        selectMessageTimeout: setting?.selectMessageTimeout || 30,
        infoMessageTimeout: setting?.infoMessageTimeout || 15
      },
      collecting: {} // 기존 호환성 유지용 빈 객체
    };
    
    // 아이템 배치
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

        // 작업 상태 복원
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

        // 작업 상태 복원
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
    
    // 레시피 배치
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


// 변경 감지 알림 함수
export function notifyChangeListeners() {
  changeListeners.forEach(listener => {
    try {
      listener({ operationType: 'update' });
    } catch (error) {
      console.error('리스너 실행 에러:', error);
    }
  });
}

// 재고 데이터 저장 - DEPRECATED (하위 호환성 및 마이그레이션 과도기용)
// 더 이상 이 함수를 사용하여 데이터를 저장하면 안 됩니다.
export async function saveInventory(data, retryCount = 0) {
  console.warn('⚠️ saveInventory is DEPRECATED but performing a best-effort save to Inventory document.');
  try {
    const inventory = await Inventory.getInstance();

    inventory.categories = data.categories || {};
    inventory.collecting = data.collecting || {};
    inventory.crafting = data.crafting || {
      categories: {},
      crafting: {},
      recipes: {}
    };
    inventory.settings = data.settings || { uiMode: 'normal', barLength: 15 };
    inventory.history = data.history || [];

    inventory.markModified('categories');
    inventory.markModified('collecting');
    inventory.markModified('crafting');
    inventory.markModified('history');

    await inventory.save();
    notifyChangeListeners();
    return true;
  } catch (error) {
    console.error('❌ saveInventory 실패:', error);
    if (retryCount < 3) {
      return saveInventory(data, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 아이템 수량 원자적 업데이트 (동시성 해결)
 * @param {string} type - 'inventory' 또는 'crafting'
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} delta - 변경할 수량 (+ 또는 -)
 * @param {string} userName - 변경한 사용자
 * @param {string} action - 히스토리 액션
 * @param {string} details - 히스토리 상세
 */
export async function updateItemQuantity(type, category, itemName, delta, userName, action, details) {
  try {
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { $inc: { quantity: delta } },
      { new: true }
    );
    
    if (result) {
      // 히스토리 추가
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
      
      // 알림
      notifyChangeListeners();
      return true;
    } else {
      console.error(`❌ 아이템 업데이트 실패: ${type}/${category}/${itemName} (문서 없음)`);
      return false;
    }
  } catch (error) {
    console.error('❌ 아이템 수량 업데이트 중 에러:', error);
    throw error;
  }
}

/**
 * 여러 아이템 수량 원자적 일괄 업데이트 (레시피용)
 * @param {Array} updates - { type, category, itemName, delta, value, operation, field } 배열
 * @param {Array} historyEntries - 히스토리 엔트리 배열
 */
export async function updateMultipleItems(updates, historyEntries) {
  try {
    const bulkOps = updates.map(u => {
      const filter = { 
        type: u.type, 
        category: u.category, 
        name: u.itemName 
      };
      
      const update = {};
      
      // 필드 결정 (quantity 또는 required)
      const fieldName = u.field === 'required' ? 'required' : 'quantity';
      
      if (u.operation === 'set') {
        update.$set = { [fieldName]: u.value };
      } else {
        // 기본값: inc
        update.$inc = { [fieldName]: u.delta };
      }
      
      return {
        updateOne: {
          filter,
          update
        }
      };
    });
    
    if (bulkOps.length > 0) {
      const result = await Item.bulkWrite(bulkOps);
      
      if (result.modifiedCount > 0) {
        // 히스토리 일괄 추가
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

/**
 * 아이템 추가 (새 스키마)
 */
export async function addItem(itemData) {
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
    return true;
  } catch (error) {
    if (error.code === 11000) {
      throw new Error('이미 존재하는 아이템입니다.');
    }
    throw error;
  }
}

/**
 * 아이템 삭제 (새 스키마)
 */
export async function removeItem(type, category, name) {
  try {
    const result = await Item.deleteOne({ type, category, name });
    
    // 제작품인 경우 레시피도 함께 삭제
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

/**
 * 아이템 정보 수정 (이름 변경 포함)
 */
export async function updateItemDetails(type, category, oldName, updates) {
  try {
    const filter = { type, category, name: oldName };
    const update = { $set: updates };
    
    // 이름이 변경되는 경우 중복 체크 필요
    if (updates.name && updates.name !== oldName) {
      const exists = await Item.exists({ type, category, name: updates.name });
      if (exists) {
        throw new Error('이미 존재하는 이름입니다.');
      }
      
      // 제작품 이름 변경 시 레시피의 resultName도 변경해야 함
      if (type === 'crafting') {
        await Recipe.updateOne(
          { category, resultName: oldName },
          { $set: { resultName: updates.name } }
        );
      }
      
      // 태그 업데이트
      const setting = await Setting.findById('global');
      if (setting && setting.tags && setting.tags[type] && setting.tags[type][category]) {
        let modified = false;
        for (const [tagName, tagData] of Object.entries(setting.tags[type][category])) {
          // 태그 데이터가 배열(기존 형식)인지 객체(새 형식)인지 확인
          let itemsArray;
          if (Array.isArray(tagData)) {
            // 기존 형식: tagData가 직접 배열
            itemsArray = tagData;
          } else if (tagData && Array.isArray(tagData.items)) {
            // 새 형식: { items: [...], color: '...' }
            itemsArray = tagData.items;
          } else {
            // 알 수 없는 형식 - 건너뛰기
            console.warn(`⚠️ 알 수 없는 태그 형식: ${tagName}`, tagData);
            continue;
          }
          
          const idx = itemsArray.indexOf(oldName);
          if (idx !== -1) {
            itemsArray[idx] = updates.name;
            modified = true;
          }
        }
        
        if (modified) {
          setting.markModified('tags');
          await setting.save();
        }
      }
    }
    
    const result = await Item.findOneAndUpdate(filter, update, { new: true });
    
    if (result) {
      notifyChangeListeners();
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ 아이템 수정 실패:', error);
    throw error;
  }
}

/**
 * 레시피 추가/수정
 */
export async function saveRecipe(category, resultName, materials) {
  try {
    await Recipe.findOneAndUpdate(
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
    return true;
  } catch (error) {
    console.error('❌ 레시피 저장 실패:', error);
    throw error;
  }
}

/**
 * 레시피 삭제
 */
export async function removeRecipe(category, resultName) {
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



/**
 * 아이템 작업자 업데이트
 * @param {string} type - 'inventory' 또는 'crafting'
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {object} workerData - { userId, userName, startTime } 또는 null (작업 중단)
 */
export async function updateItemWorker(type, category, itemName, workerData) {
  try {
    const update = workerData 
      ? { worker: workerData } 
      : { worker: { userId: null, userName: null, startTime: null } }; // Reset
      
    const result = await Item.findOneAndUpdate(
      { type, category, name: itemName },
      { $set: update },
      { new: true }
    );
    
    if (result) {
      notifyChangeListeners();
      return true;
    }
    console.error(`❌ 작업자 업데이트 실패: ${type}/${category}/${itemName} (문서 없음)`);
    return false;
  } catch (error) {
    console.error('❌ 작업자 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 설정 업데이트
 * @param {object} updates - 업데이트할 설정 객체 (예: { uiMode: 'detailed', barLength: 20 })
 */
export async function updateSettings(updates) {
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

/**
 * 설정 조회
 */
export async function getSettings() {
  try {
    return await Setting.findById('global').lean();
  } catch (error) {
    console.error('❌ 설정 조회 실패:', error.message);
    return null;
  }
}

// data.js에서 MongoDB로 마이그레이션
export async function migrateFromDataFile(inventoryData) {
  try {
    const inventory = await Inventory.getInstance();
    
    // 기존 데이터가 있으면 건너뜀
    const categoriesObj = inventory.categories || {};
    const hasData = Object.keys(categoriesObj).length > 0;
    
    if (hasData) {
      console.log('⚠️ MongoDB에 이미 데이터가 있습니다. 마이그레이션 건너뜀.');
      return false;
    }
    
    console.log('🔄 data.js에서 MongoDB로 데이터 마이그레이션 시작...');
    
    inventory.categories = inventoryData.categories || {};
    inventory.collecting = inventoryData.collecting || {};
    inventory.crafting = inventoryData.crafting || {
      categories: {},
      crafting: {},
      recipes: {}
    };
    inventory.settings = inventoryData.settings || {
      uiMode: 'normal',
      barLength: 15
    };
    inventory.history = [];

    // 기존 data.js 히스토리를 History 컬렉션으로 이전
    const hist = inventoryData.history || [];
    for (const h of hist) {
      await addHistoryEntry(h);
    }

    inventory.markModified('categories');
    inventory.markModified('collecting');
    inventory.markModified('crafting');
    inventory.markModified('history');

    await inventory.save();

    console.log('✅ 마이그레이션 완료!');
    console.log(`   - 카테고리: ${Object.keys(inventoryData.categories || {}).length}개`);
    console.log(`   - 제작 카테고리: ${Object.keys(inventoryData.crafting?.categories || {}).length}개`);
    console.log(`   - 히스토리: ${hist.length}개 (History 컬렉션으로 이전)`);
    
    return true;
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    return false;
  }
}

/**
 * 아이템 순서 일괄 업데이트
 * @param {string} type - 'inventory' or 'crafting'
 * @param {string} category - 카테고리명
 * @param {Array} items - { name, order } 배열
 */
export async function updateItemsOrder(type, category, items) {
  try {
    const bulkOps = items.map(item => ({
      updateOne: {
        filter: { type, category, name: item.name },
        update: { $set: { order: item.order } }
      }
    }));
    
    const result = await Item.bulkWrite(bulkOps);
    console.log(`✅ 순서 업데이트 완료: ${type}/${category} - ${items.length}개 항목`);
    return result;
  } catch (error) {
    console.error('❌ 순서 업데이트 에러:', error);
    throw error;
  }
}

/**
 * 아이템 배점 초기화 (첫 실행 시)
 */
export async function initializeItemPoints() {
  try {
    const setting = await Setting.findById('global');
    
    if (!setting?.itemPoints) {
      await Setting.findByIdAndUpdate(
        'global',
        { 
          $set: { 
            itemPoints: { 
              inventory: {}, 
              crafting: {} 
            } 
          } 
        },
        { upsert: true }
      );
      console.log('✅ 아이템 배점 초기화 완료 (기본값: 1점)');
    }
  } catch (error) {
    console.error('❌ 아이템 배점 초기화 실패:', error);
    throw error;
  }
}

/**
 * 아이템 배점 조회
 * @returns {object} { inventory: {}, crafting: {} }
 */
export async function getItemPoints() {
  try {
    const setting = await Setting.findById('global').lean();
    return setting?.itemPoints || { inventory: {}, crafting: {} };
  } catch (error) {
    console.error('❌ 아이템 배점 조회 실패:', error);
    return { inventory: {}, crafting: {} };
  }
}

/**
 * 아이템 배점 업데이트
 * @param {string} type - 'inventory' 또는 'crafting'
 * @param {string} category - 카테고리
 * @param {string} itemName - 아이템 이름
 * @param {number} points - 배점 (1-100)
 */
export async function updateItemPoints(type, category, itemName, points) {
  try {
    const path = `itemPoints.${type}.${category}.${itemName}`;
    await Setting.findByIdAndUpdate(
      'global',
      { $set: { [path]: points } },
      { upsert: true }
    );
    console.log(`✅ 배점 업데이트: ${type}/${category}/${itemName} = ${points}점`);
    return true;
  } catch (error) {
    console.error('❌ 아이템 배점 업데이트 실패:', error);
    throw error;
  }
}

/**
 * 모든 아이템 배점 초기화 (1점으로)
 */
export async function resetAllItemPoints() {
  try {
    await Setting.findByIdAndUpdate(
      'global',
      { $set: { itemPoints: { inventory: {}, crafting: {} } } },
      { upsert: true }
    );
    console.log('✅ 모든 아이템 배점 초기화 완료 (1점)');
    return true;
  } catch (error) {
    console.error('❌ 아이템 배점 초기화 실패:', error);
    throw error;
  }
}

/**
 * 배점과 함께 아이템 목록 조회
 * @param {string} type - 'inventory' 또는 'crafting'
 * @returns {Array} 아이템 배열 (배점 포함)
 */
export async function getItemsWithPoints(type) {
  try {
    const [items, itemPoints] = await Promise.all([
      Item.find({ type }).sort({ category: 1, order: 1 }).lean(),
      getItemPoints()
    ]);
    
    return items.map(item => ({
      ...item,
      points: itemPoints?.[type]?.[item.category]?.[item.name] ?? 1
    }));
  } catch (error) {
    console.error('❌ 배점 포함 아이템 조회 실패:', error);
    throw error;
  }
}
