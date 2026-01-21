import mongoose from 'mongoose';

// MongoDB 연결
export async function connectDatabase() {
  try {
    // Railway는 여러 변수명 사용 가능
    const mongoUri = process.env.MONGODB_URL || 
                     process.env.MONGO_URL || 
                     process.env.DATABASE_URL || 
                     process.env.MONGODB_URI || 
                     'mongodb://localhost:27017/minecraft-inventory';
    
    console.log('🔍 MongoDB URI 확인:', mongoUri.replace(/\/\/.*:.*@/, '//***:***@')); // 비밀번호 숨김
    
    await mongoose.connect(mongoUri);
    
    console.log('✅ MongoDB 연결 성공!');
    return true;
  } catch (error) {
    console.error('❌ MongoDB 연결 실패:', error.message);
    console.error('💡 .env에 MONGODB_URI를 설정하세요.');
    return false;
  }
}

// 재고 스키마
const inventorySchema = new mongoose.Schema({
  categories: {
    type: Map,
    of: {
      type: Map,
      of: {
        quantity: { type: Number, default: 0 },
        required: { type: Number, default: 0 },
        emoji: { type: String, default: null }
      }
    },
    default: {}
  },
  collecting: {
    type: Map,
    of: {
      type: Map,
      of: {
        userId: String,
        userName: String,
        startTime: String
      }
    },
    default: {}
  },
  crafting: {
    categories: {
      type: Map,
      of: {
        type: Map,
        of: {
          quantity: { type: Number, default: 0 },
          required: { type: Number, default: 0 },
          emoji: { type: String, default: null }
        }
      },
      default: {}
    },
    crafting: {
      type: Map,
      of: {
        type: Map,
        of: {
          userId: String,
          userName: String,
          startTime: String
        }
      },
      default: {}
    },
    recipes: {
      type: Map,
      of: {
        type: Map,
        of: [{
          name: String,
          quantity: Number,
          category: String
        }]
      },
      default: {}
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
  timestamps: true
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

// 재고 데이터 로드
export async function loadInventory() {
  try {
    const inventory = await Inventory.getInstance();
    const data = inventory.toObject();
    
    // Map을 일반 객체로 변환
    const convertMapToObject = (obj) => {
      if (obj instanceof Map) {
        const result = {};
        for (const [key, value] of obj.entries()) {
          result[key] = convertMapToObject(value);
        }
        return result;
      } else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = convertMapToObject(value);
        }
        return result;
      }
      return obj;
    };
    
    return convertMapToObject(data);
  } catch (error) {
    console.error('❌ 재고 로드 실패:', error.message);
    throw error;
  }
}

// 재고 데이터 저장
export async function saveInventory(data) {
  try {
    const inventory = await Inventory.getInstance();
    
    inventory.categories = data.categories || {};
    inventory.collecting = data.collecting || {};
    inventory.crafting = data.crafting || {
      categories: {},
      crafting: {},
      recipes: {}
    };
    inventory.settings = data.settings || {
      uiMode: 'normal',
      barLength: 15
    };
    inventory.history = data.history || [];
    
    await inventory.save();
    return true;
  } catch (error) {
    console.error('❌ 재고 저장 실패:', error.message);
    throw error;
  }
}

// data.js에서 MongoDB로 마이그레이션
export async function migrateFromDataFile(inventoryData) {
  try {
    const inventory = await Inventory.getInstance();
    
    // 기존 데이터가 있으면 건너뜀
    const hasData = inventory.categories && Object.keys(inventory.categories.toObject()).length > 0;
    
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
    inventory.history = inventoryData.history || [];
    
    await inventory.save();
    
    console.log('✅ 마이그레이션 완료!');
    console.log(`   - 카테고리: ${Object.keys(inventoryData.categories || {}).length}개`);
    console.log(`   - 제작 카테고리: ${Object.keys(inventoryData.crafting?.categories || {}).length}개`);
    console.log(`   - 히스토리: ${(inventoryData.history || []).length}개`);
    
    return true;
  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error.message);
    return false;
  }
}
