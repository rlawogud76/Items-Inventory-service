// 역마이그레이션: 새 컬렉션 → 기존 inventories 컬렉션
import 'dotenv/config';
import mongoose from 'mongoose';

// 새 스키마들
const inventoryItemSchema = new mongoose.Schema({
  type: String,
  category: String,
  name: String,
  quantity: Number,
  required: Number,
  emoji: String
}, { timestamps: true });

const recipeSchema = new mongoose.Schema({
  type: String,
  category: String,
  itemName: String,
  materials: Array
}, { timestamps: true });

const tagSchema = new mongoose.Schema({
  type: String,
  category: String,
  tagName: String,
  items: Array
}, { timestamps: true });

const historySchema = new mongoose.Schema({
  timestamp: String,
  type: String,
  category: String,
  itemName: String,
  action: String,
  details: String,
  userName: String
}, { timestamps: true });

const settingsSchema = new mongoose.Schema({
  uiMode: String,
  barLength: Number
}, { timestamps: true });

const InventoryItem = mongoose.model('InventoryItem', inventoryItemSchema);
const Recipe = mongoose.model('Recipe', recipeSchema);
const Tag = mongoose.model('Tag', tagSchema);
const History = mongoose.model('History', historySchema);
const Settings = mongoose.model('Settings', settingsSchema);

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

async function reverseMigrate() {
  try {
    console.log('🔄 역마이그레이션 시작...\n');
    
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
    
    // 새 컬렉션에서 데이터 로드
    console.log('📦 새 컬렉션에서 데이터 로드 중...');
    const [items, recipes, tags, history, settings] = await Promise.all([
      InventoryItem.find().lean(),
      Recipe.find().lean(),
      Tag.find().lean(),
      History.find().sort({ timestamp: -1 }).limit(1000).lean(),
      Settings.findOne().lean()
    ]);
    
    console.log(`✅ 데이터 로드 완료`);
    console.log(`   - 아이템: ${items.length}개`);
    console.log(`   - 레시피: ${recipes.length}개`);
    console.log(`   - 태그: ${tags.length}개`);
    console.log(`   - 히스토리: ${history.length}개`);
    console.log(`   - 설정: ${settings ? '1개' : '0개'}\n`);
    
    if (items.length === 0) {
      console.log('⚠️ 새 컬렉션에 데이터가 없습니다.');
      process.exit(0);
    }
    
    // 기존 형식으로 변환
    console.log('🔄 기존 형식으로 변환 중...');
    const oldData = {
      categories: {},
      collecting: {},
      crafting: {
        categories: {},
        recipes: {}
      },
      tags: {
        inventory: {},
        crafting: {}
      },
      settings: {
        uiMode: settings?.uiMode || 'normal',
        barLength: settings?.barLength || 15
      },
      history: history.map(h => ({
        timestamp: h.timestamp,
        type: h.type,
        category: h.category,
        itemName: h.itemName,
        action: h.action,
        details: h.details,
        userName: h.userName
      }))
    };
    
    // 아이템 변환
    items.forEach(item => {
      const itemData = {
        quantity: item.quantity,
        required: item.required
      };
      if (item.emoji) itemData.emoji = item.emoji;
      
      if (item.type === 'inventory') {
        if (!oldData.categories[item.category]) {
          oldData.categories[item.category] = {};
        }
        oldData.categories[item.category][item.name] = itemData;
      } else {
        if (!oldData.crafting.categories[item.category]) {
          oldData.crafting.categories[item.category] = {};
        }
        oldData.crafting.categories[item.category][item.name] = itemData;
      }
    });
    
    // 레시피 변환
    recipes.forEach(recipe => {
      if (!oldData.crafting.recipes[recipe.category]) {
        oldData.crafting.recipes[recipe.category] = {};
      }
      oldData.crafting.recipes[recipe.category][recipe.itemName] = recipe.materials;
    });
    
    // 태그 변환
    tags.forEach(tag => {
      if (!oldData.tags[tag.type][tag.category]) {
        oldData.tags[tag.type][tag.category] = {};
      }
      oldData.tags[tag.type][tag.category][tag.tagName] = tag.items;
    });
    
    console.log('✅ 변환 완료\n');
    
    // 기존 컬렉션에 저장
    console.log('💾 inventories 컬렉션에 저장 중...');
    
    // 기존 데이터 삭제
    await OldInventory.deleteMany({});
    
    // 새 데이터 저장
    await OldInventory.create(oldData);
    
    console.log('✅ 저장 완료!\n');
    
    console.log('='.repeat(60));
    console.log('🎉 역마이그레이션 완료!');
    console.log('='.repeat(60));
    console.log('✅ 데이터가 inventories 컬렉션으로 복원되었습니다.');
    console.log('✅ 봇을 재시작하면 정상적으로 작동합니다.');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ 역마이그레이션 실패:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 MongoDB 연결 종료');
  }
}

reverseMigrate();
