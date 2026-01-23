import mongoose from 'mongoose';

// MongoDB 연결
export async function connectDatabase() {
  try {
    console.log('🔍 환경변수 확인:');
    console.log('  - MONGODB_URL:', process.env.MONGODB_URL ? '있음' : '없음');
    console.log('  - MONGO_URL:', process.env.MONGO_URL ? '있음' : '없음');
    console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '있음' : '없음');
    console.log('  - MONGODB_URI:', process.env.MONGODB_URI ? '있음' : '없음');
    
    const mongoUri = process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.DATABASE_URL || 
                     process.env.MONGODB_URI || 
                     'mongodb://localhost:27017/minecraft-inventory';
    
    console.log('🔍 사용할 MongoDB URI:', mongoUri.replace(/\/\/.*:.*@/, '//***:***@'));
    
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB 연결 성공!');
    return true;
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    console.error('💡 .env에 MONGODB_URI를 설정하세요.');
    return false;
  }
}

// ==================== 스키마 정의 ====================

// 재고 아이템 스키마
const inventoryItemSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  category: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  quantity: { type: Number, required: true, default: 0 },
  required: { type: Number, required: true, default: 0 },
  emoji: { type: String, default: null }
}, {
  timestamps: true
});

// 복합 인덱스: type + category + name 조합으로 빠른 조회
inventoryItemSchema.index({ type: 1, category: 1, name: 1 }, { unique: true });
inventoryItemSchema.index({ type: 1, category: 1 });

// 레시피 스키마
const recipeSchema = new mongoose.Schema({
  type: { type: String, required: true, default: 'crafting', index: true },
  category: { type: String, required: true, index: true },
  itemName: { type: String, required: true, index: true },
  materials: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    category: { type: String, required: true }
  }]
}, {
  timestamps: true
});

recipeSchema.index({ type: 1, category: 1, itemName: 1 }, { unique: true });

// 태그 스키마
const tagSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  category: { type: String, required: true, index: true },
  tagName: { type: String, required: true, index: true },
  items: [{ type: String }],
  color: { type: String, default: 'default' } // 색상 필드 추가
}, {
  timestamps: true
});

tagSchema.index({ type: 1, category: 1, tagName: 1 }, { unique: true });

// 히스토리 스키마
const historySchema = new mongoose.Schema({
  timestamp: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  category: { type: String, required: true, index: true },
  itemName: { type: String, required: true },
  action: { type: String, required: true },
  details: { type: String, required: true },
  userName: { type: String, required: true, index: true }
}, {
  timestamps: true
});

// 최근 히스토리 조회를 위한 인덱스
historySchema.index({ timestamp: -1 });
historySchema.index({ type: 1, category: 1, timestamp: -1 });

// 설정 스키마 (싱글톤)
const settingsSchema = new mongoose.Schema({
  uiMode: { type: String, default: 'normal', enum: ['normal', 'detailed'] },
  barLength: { type: Number, default: 15, min: 5, max: 30 }
}, {
  timestamps: true
});

// 모델 생성 (이미 존재하면 재사용)
export const InventoryItem = mongoose.models.InventoryItem || mongoose.model('InventoryItem', inventoryItemSchema);
export const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);
export const Tag = mongoose.models.Tag || mongoose.model('Tag', tagSchema);
export const History = mongoose.models.History || mongoose.model('History', historySchema);
export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);

// ==================== 캐시 설정 ====================
const CACHE_TTL = 5000; // 5초
const cache = {
  items: { data: null, timestamp: null },
  recipes: { data: null, timestamp: null },
  tags: { data: null, timestamp: null },
  settings: { data: null, timestamp: null }
};

function invalidateCache(type = 'all') {
  if (type === 'all') {
    cache.items = { data: null, timestamp: null };
    cache.recipes = { data: null, timestamp: null };
    cache.tags = { data: null, timestamp: null };
    cache.settings = { data: null, timestamp: null };
    console.log('🗑️ 전체 캐시 무효화');
  } else {
    cache[type] = { data: null, timestamp: null };
    console.log(`🗑️ ${type} 캐시 무효화`);
  }
}

function getCached(type) {
  const now = Date.now();
  const cached = cache[type];
  if (cached.data && cached.timestamp && (now - cached.timestamp) < CACHE_TTL) {
    console.log(`📦 캐시에서 ${type} 로드`);
    return JSON.parse(JSON.stringify(cached.data));
  }
  return null;
}

function setCache(type, data) {
  cache[type] = {
    data: JSON.parse(JSON.stringify(data)),
    timestamp: Date.now()
  };
}

// ==================== CRUD 함수 ====================

// 설정 가져오기
export async function getSettings() {
  const cached = getCached('settings');
  if (cached) return cached;
  
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({ uiMode: 'normal', barLength: 15 });
  }
  
  const data = settings.toObject();
  delete data._id;
  delete data.__v;
  delete data.createdAt;
  delete data.updatedAt;
  
  setCache('settings', data);
  return data;
}

// 설정 저장
export async function saveSettings(settingsData) {
  await Settings.findOneAndUpdate({}, settingsData, { upsert: true });
  invalidateCache('settings');
  notifyChange('settings');
  console.log('✅ 설정 저장 완료');
}

// 모든 아이템 가져오기 (기존 형식으로 변환)
export async function loadInventory() {
  const cached = getCached('items');
  if (cached) return cached;
  
  console.log('🔄 DB에서 재고 로드');
  
  const [items, recipes, tags, settings] = await Promise.all([
    InventoryItem.find().lean(),
    Recipe.find().lean(),
    Tag.find().lean(),
    getSettings()
  ]);
  
  // 기존 형식으로 변환
  const inventory = {
    categories: {},
    crafting: {
      categories: {},
      recipes: {}
    },
    tags: {
      inventory: {},
      crafting: {}
    },
    settings: settings,
    history: [] // 히스토리는 별도 조회
  };
  
  // 아이템 변환
  items.forEach(item => {
    const itemData = {
      quantity: item.quantity,
      required: item.required
    };
    if (item.emoji) itemData.emoji = item.emoji;
    
    if (item.type === 'inventory') {
      if (!inventory.categories[item.category]) {
        inventory.categories[item.category] = {};
      }
      inventory.categories[item.category][item.name] = itemData;
    } else {
      if (!inventory.crafting.categories[item.category]) {
        inventory.crafting.categories[item.category] = {};
      }
      inventory.crafting.categories[item.category][item.name] = itemData;
    }
  });
  
  // 레시피 변환
  recipes.forEach(recipe => {
    if (!inventory.crafting.recipes[recipe.category]) {
      inventory.crafting.recipes[recipe.category] = {};
    }
    inventory.crafting.recipes[recipe.category][recipe.itemName] = recipe.materials;
  });
  
  // 태그 변환
  tags.forEach(tag => {
    if (!inventory.tags[tag.type][tag.category]) {
      inventory.tags[tag.type][tag.category] = {};
    }
    // 새로운 형식으로 저장 (색상 포함)
    inventory.tags[tag.type][tag.category][tag.tagName] = {
      items: tag.items,
      color: tag.color || 'default'
    };
  });
  
  setCache('items', inventory);
  return JSON.parse(JSON.stringify(inventory));
}

// 재고 저장 (기존 형식에서 새 형식으로 변환)
export async function saveInventory(data, retryCount = 0) {
  const maxRetries = 3;
  
  try {
    console.log('💾 재고 저장 시작...');
    
    // 트랜잭션 시작 (MongoDB 4.0+)
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // 1. 재고 아이템 저장
      const inventoryItems = [];
      
      // inventory 아이템
      for (const [category, items] of Object.entries(data.categories || {})) {
        for (const [name, itemData] of Object.entries(items)) {
          inventoryItems.push({
            type: 'inventory',
            category,
            name,
            quantity: itemData.quantity,
            required: itemData.required,
            emoji: itemData.emoji || null
          });
        }
      }
      
      // crafting 아이템
      for (const [category, items] of Object.entries(data.crafting?.categories || {})) {
        for (const [name, itemData] of Object.entries(items)) {
          inventoryItems.push({
            type: 'crafting',
            category,
            name,
            quantity: itemData.quantity,
            required: itemData.required,
            emoji: itemData.emoji || null
          });
        }
      }
      
      // Bulk upsert
      if (inventoryItems.length > 0) {
        const bulkOps = inventoryItems.map(item => ({
          updateOne: {
            filter: { type: item.type, category: item.category, name: item.name },
            update: { $set: item },
            upsert: true
          }
        }));
        await InventoryItem.bulkWrite(bulkOps, { session });
      }
      
      // 2. 레시피 저장
      const recipes = [];
      for (const [category, items] of Object.entries(data.crafting?.recipes || {})) {
        for (const [itemName, materials] of Object.entries(items)) {
          recipes.push({
            type: 'crafting',
            category,
            itemName,
            materials
          });
        }
      }
      
      if (recipes.length > 0) {
        const bulkOps = recipes.map(recipe => ({
          updateOne: {
            filter: { type: recipe.type, category: recipe.category, itemName: recipe.itemName },
            update: { $set: recipe },
            upsert: true
          }
        }));
        await Recipe.bulkWrite(bulkOps, { session });
      }
      
      // 3. 태그 저장
      const tags = [];
      for (const [type, categories] of Object.entries(data.tags || {})) {
        for (const [category, tagData] of Object.entries(categories)) {
          for (const [tagName, tagInfo] of Object.entries(tagData)) {
            if (Array.isArray(tagInfo)) {
              // 기존 형식 (배열)
              tags.push({
                type,
                category,
                tagName,
                items: tagInfo,
                color: 'default'
              });
            } else if (tagInfo.items) {
              // 새 형식 (객체)
              tags.push({
                type,
                category,
                tagName,
                items: tagInfo.items,
                color: tagInfo.color || 'default'
              });
            }
          }
        }
      }
            });
          }
        }
      }
      
      if (tags.length > 0) {
        const bulkOps = tags.map(tag => ({
          updateOne: {
            filter: { type: tag.type, category: tag.category, tagName: tag.tagName },
            update: { $set: tag },
            upsert: true
          }
        }));
        await Tag.bulkWrite(bulkOps, { session });
      }
      
      // 4. 설정 저장
      if (data.settings) {
        await Settings.findOneAndUpdate({}, data.settings, { upsert: true, session });
      }
      
      // 5. 히스토리 저장 (최근 100개만)
      if (data.history && data.history.length > 0) {
        const recentHistory = data.history.slice(-100);
        await History.deleteMany({}, { session });
        await History.insertMany(recentHistory, { session });
      }
      
      await session.commitTransaction();
      console.log('✅ 재고 저장 완료 (트랜잭션)');
      
      invalidateCache('all');
      notifyChange('inventory');
      
      return true;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    if (retryCount < maxRetries) {
      console.log(`⚠️ 저장 실패 - 재시도 ${retryCount + 1}/${maxRetries}`);
      const waitTime = Math.min(1000, 50 * Math.pow(2, retryCount));
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return saveInventory(data, retryCount + 1);
    }
    
    console.error('❌ 재고 저장 실패:', error.message);
    throw error;
  }
}

// 히스토리 조회 (페이지네이션)
export async function getHistory(limit = 10, skip = 0, filters = {}) {
  const query = {};
  if (filters.type) query.type = filters.type;
  if (filters.category) query.category = filters.category;
  if (filters.userName) query.userName = filters.userName;
  
  const history = await History.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(skip)
    .lean();
  
  return history.map(h => ({
    timestamp: h.timestamp,
    type: h.type,
    category: h.category,
    itemName: h.itemName,
    action: h.action,
    details: h.details,
    userName: h.userName
  }));
}

// 히스토리 추가
export async function addHistoryEntry(entry) {
  await History.create(entry);
  
  // 오래된 히스토리 정리 (1000개 이상이면 오래된 것 삭제)
  const count = await History.countDocuments();
  if (count > 1000) {
    const oldEntries = await History.find()
      .sort({ timestamp: 1 })
      .limit(count - 1000)
      .select('_id');
    
    const idsToDelete = oldEntries.map(e => e._id);
    await History.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`🗑️ 오래된 히스토리 ${idsToDelete.length}개 삭제`);
  }
}

// 히스토리 초기화
export async function clearHistory() {
  await History.deleteMany({});
  console.log('🗑️ 히스토리 초기화 완료');
}

// ==================== 변경 감지 ====================
const changeListeners = new Set();
let lastChangeTime = Date.now();

export function watchInventoryChanges() {
  console.log('👁️ 재고 변경 감지 시작 (폴링 방식)');
  
  setInterval(async () => {
    try {
      const latestItem = await InventoryItem.findOne()
        .sort({ updatedAt: -1 })
        .select('updatedAt')
        .lean();
      
      if (!latestItem) return;
      
      const currentTime = latestItem.updatedAt.getTime();
      if (currentTime > lastChangeTime) {
        console.log('🔔 재고 데이터 변경 감지!');
        lastChangeTime = currentTime;
        notifyChange('inventory');
      }
    } catch (error) {
      console.error('❌ 변경 감지 에러:', error.message);
    }
  }, 3000);
}

function notifyChange(type) {
  changeListeners.forEach(listener => {
    try {
      listener({ operationType: 'update', type });
    } catch (error) {
      console.error('리스너 실행 에러:', error);
    }
  });
}

export function addChangeListener(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

export function removeChangeListener(listener) {
  changeListeners.delete(listener);
}

// ==================== 자동 마이그레이션 ====================

// 기존 스키마 (마이그레이션용)
const oldInventorySchema = new mongoose.Schema({
  categories: mongoose.Schema.Types.Mixed,
  collecting: mongoose.Schema.Types.Mixed,
  crafting: mongoose.Schema.Types.Mixed,
  tags: mongoose.Schema.Types.Mixed,
  settings: {
    uiMode: String,
    barLength: Number
  },
  history: Array
}, { timestamps: true, minimize: false });

const OldInventory = mongoose.models.OldInventory || mongoose.model('OldInventory', oldInventorySchema, 'inventories');

// 마이그레이션 필요 여부 확인
export async function needsMigration() {
  try {
    const oldDataExists = await OldInventory.countDocuments() > 0;
    const newDataExists = await InventoryItem.countDocuments() > 0;
    
    // 기존 데이터는 있는데 새 데이터가 없으면 마이그레이션 필요
    return oldDataExists && !newDataExists;
  } catch (error) {
    console.error('❌ 마이그레이션 확인 실패:', error.message);
    return false;
  }
}

// 자동 마이그레이션 실행
export async function autoMigrate() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 자동 마이그레이션 시작');
    console.log('='.repeat(60));
    
    // 기존 데이터 로드
    console.log('📦 기존 데이터 로드 중...');
    const oldData = await OldInventory.findOne();
    
    if (!oldData) {
      console.log('⚠️ 기존 데이터가 없습니다.');
      return false;
    }
    
    console.log('✅ 기존 데이터 로드 완료');
    console.log(`   - 재고 카테고리: ${Object.keys(oldData.categories || {}).length}개`);
    console.log(`   - 제작 카테고리: ${Object.keys(oldData.crafting?.categories || {}).length}개`);
    console.log(`   - 히스토리: ${(oldData.history || []).length}개`);
    
    // 트랜잭션 시작
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      let totalItems = 0;
      let totalRecipes = 0;
      let totalTags = 0;
      let totalHistory = 0;
      
      // 1. 재고 아이템 마이그레이션
      console.log('\n📦 재고 아이템 마이그레이션 중...');
      const inventoryItems = [];
      
      for (const [category, items] of Object.entries(oldData.categories || {})) {
        for (const [name, itemData] of Object.entries(items)) {
          inventoryItems.push({
            type: 'inventory',
            category,
            name,
            quantity: itemData.quantity || 0,
            required: itemData.required || 0,
            emoji: itemData.emoji || null
          });
        }
      }
      
      for (const [category, items] of Object.entries(oldData.crafting?.categories || {})) {
        for (const [name, itemData] of Object.entries(items)) {
          inventoryItems.push({
            type: 'crafting',
            category,
            name,
            quantity: itemData.quantity || 0,
            required: itemData.required || 0,
            emoji: itemData.emoji || null
          });
        }
      }
      
      if (inventoryItems.length > 0) {
        await InventoryItem.insertMany(inventoryItems, { session });
        totalItems = inventoryItems.length;
        console.log(`✅ 아이템 ${totalItems}개 마이그레이션 완료`);
      }
      
      // 2. 레시피 마이그레이션
      console.log('📝 레시피 마이그레이션 중...');
      const recipes = [];
      
      for (const [category, items] of Object.entries(oldData.crafting?.recipes || {})) {
        for (const [itemName, materials] of Object.entries(items)) {
          recipes.push({
            type: 'crafting',
            category,
            itemName,
            materials: materials || []
          });
        }
      }
      
      if (recipes.length > 0) {
        await Recipe.insertMany(recipes, { session });
        totalRecipes = recipes.length;
        console.log(`✅ 레시피 ${totalRecipes}개 마이그레이션 완료`);
      }
      
      // 3. 태그 마이그레이션
      console.log('🏷️ 태그 마이그레이션 중...');
      const tags = [];
      
      for (const [type, categories] of Object.entries(oldData.tags || {})) {
        for (const [category, tagData] of Object.entries(categories)) {
          for (const [tagName, items] of Object.entries(tagData)) {
            tags.push({
              type,
              category,
              tagName,
              items: items || []
            });
          }
        }
      }
      
      if (tags.length > 0) {
        await Tag.insertMany(tags, { session });
        totalTags = tags.length;
        console.log(`✅ 태그 ${totalTags}개 마이그레이션 완료`);
      }
      
      // 4. 히스토리 마이그레이션 (최근 1000개만)
      console.log('📜 히스토리 마이그레이션 중...');
      const history = (oldData.history || []).slice(-1000);
      
      if (history.length > 0) {
        await History.insertMany(history, { session });
        totalHistory = history.length;
        console.log(`✅ 히스토리 ${totalHistory}개 마이그레이션 완료`);
      }
      
      // 5. 설정 마이그레이션
      console.log('⚙️ 설정 마이그레이션 중...');
      await Settings.create([{
        uiMode: oldData.settings?.uiMode || 'normal',
        barLength: oldData.settings?.barLength || 15
      }], { session });
      console.log('✅ 설정 마이그레이션 완료');
      
      // 트랜잭션 커밋
      await session.commitTransaction();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 자동 마이그레이션 완료!');
      console.log('='.repeat(60));
      console.log(`📦 아이템: ${totalItems}개`);
      console.log(`📝 레시피: ${totalRecipes}개`);
      console.log(`🏷️ 태그: ${totalTags}개`);
      console.log(`📜 히스토리: ${totalHistory}개`);
      console.log(`⚙️ 설정: 1개`);
      console.log('='.repeat(60));
      console.log('✅ 기존 데이터는 inventories 컬렉션에 그대로 보존됩니다.\n');
      
      return true;
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('\n❌ 자동 마이그레이션 실패:', error.message);
    console.error('💡 수동 마이그레이션을 실행하세요: npm run migrate');
    return false;
  }
}
