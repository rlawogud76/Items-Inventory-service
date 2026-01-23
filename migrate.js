// MongoDB 데이터 구조 마이그레이션 스크립트
// 기존: 단일 document (Mixed 타입)
// 신규: 여러 컬렉션 (정규화된 구조)

import 'dotenv/config';
import mongoose from 'mongoose';

// 기존 스키마
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

const OldInventory = mongoose.model('Inventory', oldInventorySchema);

// 새 스키마들
const inventoryItemSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  category: { type: String, required: true, index: true },
  name: { type: String, required: true, index: true },
  quantity: { type: Number, required: true, default: 0 },
  required: { type: Number, required: true, default: 0 },
  emoji: { type: String, default: null }
}, { timestamps: true });

inventoryItemSchema.index({ type: 1, category: 1, name: 1 }, { unique: true });

const recipeSchema = new mongoose.Schema({
  type: { type: String, required: true, default: 'crafting', index: true },
  category: { type: String, required: true, index: true },
  itemName: { type: String, required: true, index: true },
  materials: [{
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    category: { type: String, required: true }
  }]
}, { timestamps: true });

recipeSchema.index({ type: 1, category: 1, itemName: 1 }, { unique: true });

const tagSchema = new mongoose.Schema({
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  category: { type: String, required: true, index: true },
  tagName: { type: String, required: true, index: true },
  items: [{ type: String }]
}, { timestamps: true });

tagSchema.index({ type: 1, category: 1, tagName: 1 }, { unique: true });

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

const settingsSchema = new mongoose.Schema({
  uiMode: { type: String, default: 'normal', enum: ['normal', 'detailed'] },
  barLength: { type: Number, default: 15, min: 5, max: 30 }
}, { timestamps: true });

const NewInventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
const NewRecipe = mongoose.model('Recipe', recipeSchema);
const NewTag = mongoose.model('Tag', tagSchema);
const NewHistory = mongoose.model('History', historySchema);
const NewSettings = mongoose.model('Settings', settingsSchema);

async function migrate() {
  try {
    console.log('🚀 마이그레이션 시작...\n');
    
    // MongoDB 연결
    const mongoUri = process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.DATABASE_URL || 
                     process.env.MONGODB_URI || 
                     'mongodb://localhost:27017/minecraft-inventory';
    
    console.log('📡 MongoDB 연결 중...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB 연결 성공!\n');
    
    // 기존 데이터 로드
    console.log('📦 기존 데이터 로드 중...');
    const oldData = await OldInventory.findOne();
    
    if (!oldData) {
      console.log('⚠️ 기존 데이터가 없습니다. 마이그레이션 종료.');
      process.exit(0);
    }
    
    console.log('✅ 기존 데이터 로드 완료');
    console.log(`   - 재고 카테고리: ${Object.keys(oldData.categories || {}).length}개`);
    console.log(`   - 제작 카테고리: ${Object.keys(oldData.crafting?.categories || {}).length}개`);
    console.log(`   - 히스토리: ${(oldData.history || []).length}개\n`);
    
    // 새 컬렉션에 이미 데이터가 있는지 확인
    const existingItemsCount = await NewInventoryItem.countDocuments();
    if (existingItemsCount > 0) {
      console.log('⚠️ 새 컬렉션에 이미 데이터가 있습니다.');
      console.log(`   - 기존 아이템: ${existingItemsCount}개`);
      
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question('기존 데이터를 삭제하고 계속하시겠습니까? (yes/no): ', resolve);
      });
      rl.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ 마이그레이션 취소됨');
        process.exit(0);
      }
      
      console.log('\n🗑️ 기존 새 컬렉션 데이터 삭제 중...');
      await Promise.all([
        NewInventoryItem.deleteMany({}),
        NewRecipe.deleteMany({}),
        NewTag.deleteMany({}),
        NewHistory.deleteMany({}),
        NewSettings.deleteMany({})
      ]);
      console.log('✅ 삭제 완료\n');
    }
    
    // 트랜잭션 시작
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      let totalItems = 0;
      let totalRecipes = 0;
      let totalTags = 0;
      let totalHistory = 0;
      
      // 1. 재고 아이템 마이그레이션
      console.log('📦 재고 아이템 마이그레이션 중...');
      const inventoryItems = [];
      
      // inventory 아이템
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
      
      // crafting 아이템
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
        await NewInventoryItem.insertMany(inventoryItems, { session });
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
        await NewRecipe.insertMany(recipes, { session });
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
        await NewTag.insertMany(tags, { session });
        totalTags = tags.length;
        console.log(`✅ 태그 ${totalTags}개 마이그레이션 완료`);
      }
      
      // 4. 히스토리 마이그레이션 (최근 1000개만)
      console.log('📜 히스토리 마이그레이션 중...');
      const history = (oldData.history || []).slice(-1000);
      
      if (history.length > 0) {
        await NewHistory.insertMany(history, { session });
        totalHistory = history.length;
        console.log(`✅ 히스토리 ${totalHistory}개 마이그레이션 완료`);
      }
      
      // 5. 설정 마이그레이션
      console.log('⚙️ 설정 마이그레이션 중...');
      await NewSettings.create([{
        uiMode: oldData.settings?.uiMode || 'normal',
        barLength: oldData.settings?.barLength || 15
      }], { session });
      console.log('✅ 설정 마이그레이션 완료');
      
      // 트랜잭션 커밋
      await session.commitTransaction();
      console.log('\n✅ 트랜잭션 커밋 완료');
      
      // 요약
      console.log('\n' + '='.repeat(50));
      console.log('🎉 마이그레이션 완료!');
      console.log('='.repeat(50));
      console.log(`📦 아이템: ${totalItems}개`);
      console.log(`📝 레시피: ${totalRecipes}개`);
      console.log(`🏷️ 태그: ${totalTags}개`);
      console.log(`📜 히스토리: ${totalHistory}개`);
      console.log(`⚙️ 설정: 1개`);
      console.log('='.repeat(50));
      
      // 백업 생성 (기존 데이터를 다른 컬렉션으로 복사)
      console.log('\n💾 기존 데이터 백업 중...');
      const BackupInventory = mongoose.model('InventoryBackup', oldInventorySchema, 'inventories_backup');
      await BackupInventory.create(oldData.toObject());
      console.log('✅ 백업 완료 (컬렉션: inventories_backup)');
      
      console.log('\n⚠️ 마이그레이션이 성공적으로 완료되었습니다.');
      console.log('⚠️ database.js를 database-new.js로 교체하려면:');
      console.log('   1. src/database.js 백업');
      console.log('   2. src/database-new.js를 src/database.js로 이름 변경');
      console.log('   3. 봇 재시작');
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('\n❌ 마이그레이션 실패:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 MongoDB 연결 종료');
  }
}

// 실행
migrate();
