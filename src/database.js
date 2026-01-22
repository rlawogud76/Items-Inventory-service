import mongoose from 'mongoose';

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

// 마지막 업데이트 시간 추적
let lastUpdateTime = null;

// 변경 감지 (폴링 방식)
export function watchInventoryChanges() {
  console.log('�️ 재고 변경 감지 시작 (폴링 방식)');
  
  // 3초마다 체크
  setInterval(async () => {
    try {
      const inventory = await Inventory.findOne().select('updatedAt').lean();
      if (!inventory) return;
      
      const currentUpdateTime = inventory.updatedAt?.getTime();
      
      // 처음 실행이거나 변경이 있으면
      if (lastUpdateTime === null) {
        lastUpdateTime = currentUpdateTime;
        return;
      }
      
      if (currentUpdateTime > lastUpdateTime) {
        console.log('� 재고 데이터 변경 감지!');
        lastUpdateTime = currentUpdateTime;
        
        // 모든 리스너에게 알림
        changeListeners.forEach(listener => {
          try {
            listener({ operationType: 'update' });
          } catch (error) {
            console.error('리스너 실행 에러:', error);
          }
        });
      }
    } catch (error) {
      console.error('❌ 변경 감지 에러:', error.message);
    }
  }, 3000); // 3초
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

// 재고 데이터 로드 - 단순화
export async function loadInventory() {
  try {
    const inventory = await Inventory.getInstance();
    const data = inventory.toObject();
    
    // 메타데이터 제거
    delete data._id;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;
    
    // history가 배열인지 확인
    if (!Array.isArray(data.history)) {
      data.history = [];
    }
    
    // 기본 구조 보장
    if (!data.categories) data.categories = {};
    if (!data.collecting) data.collecting = {};
    if (!data.crafting) {
      data.crafting = {
        categories: {},
        crafting: {},
        recipes: {}
      };
    }
    if (!data.tags) {
      data.tags = {
        inventory: {},
        crafting: {}
      };
    }
    if (!data.settings) {
      data.settings = {
        uiMode: 'normal',
        barLength: 15
      };
    }
    
    return data;
  } catch (error) {
    console.error('❌ 재고 로드 실패:', error.message);
    throw error;
  }
}

// 재고 데이터 저장 - Optimistic Locking 추가
export async function saveInventory(data, retryCount = 0) {
  const maxRetries = 5;
  
  try {
    // 최신 데이터를 다시 가져와서 충돌 방지
    const inventory = await Inventory.getInstance();
    
    // 현재 버전 저장 (optimistic locking)
    const currentVersion = inventory.__v;
    
    inventory.categories = data.categories || {};
    inventory.collecting = data.collecting || {};
    inventory.crafting = data.crafting || {
      categories: {},
      crafting: {},
      recipes: {}
    };
    inventory.tags = data.tags || {
      inventory: {},
      crafting: {}
    };
    inventory.settings = data.settings || {
      uiMode: 'normal',
      barLength: 15
    };
    inventory.history = data.history || [];
    
    // Mixed 타입은 명시적으로 변경 표시 필요
    inventory.markModified('categories');
    inventory.markModified('collecting');
    inventory.markModified('crafting');
    inventory.markModified('tags');
    inventory.markModified('settings');
    
    // Optimistic locking: 버전이 변경되지 않았을 때만 저장
    const result = await Inventory.updateOne(
      { _id: inventory._id, __v: currentVersion },
      {
        $set: {
          categories: inventory.categories,
          collecting: inventory.collecting,
          crafting: inventory.crafting,
          tags: inventory.tags,
          settings: inventory.settings,
          history: inventory.history
        },
        $inc: { __v: 1 }
      }
    );
    
    // 업데이트가 실패한 경우 (다른 프로세스가 먼저 수정함)
    if (result.matchedCount === 0) {
      throw new Error('VersionConflict');
    }
    
    // 저장 후 즉시 변경 리스너 트리거 (실시간 업데이트)
    const updatedInventory = await Inventory.findById(inventory._id);
    lastUpdateTime = updatedInventory.updatedAt?.getTime();
    changeListeners.forEach(listener => {
      try {
        listener({ operationType: 'update' });
      } catch (error) {
        console.error('리스너 실행 에러:', error);
      }
    });
    
    console.log(`✅ 재고 저장 성공 (버전: ${currentVersion} -> ${currentVersion + 1})`);
    return true;
  } catch (error) {
    // 버전 충돌 에러인 경우 재시도
    if ((error.message === 'VersionConflict' || error.name === 'VersionError') && retryCount < maxRetries) {
      console.log(`⚠️ 버전 충돌 감지 - 재시도 ${retryCount + 1}/${maxRetries}`);
      // 지수 백오프: 대기 시간을 점점 늘림
      const waitTime = Math.min(1000, 50 * Math.pow(2, retryCount));
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 최신 데이터를 다시 로드하여 병합
      const latestInventory = await loadInventory();
      
      // 데이터 병합 전략: 새 데이터 우선, history는 합치기
      const mergedData = {
        ...latestInventory,
        ...data,
        // history는 중복 제거하며 합치기 (최근 100개만)
        history: [...new Set([...(data.history || []), ...(latestInventory.history || [])])].slice(-100)
      };
      
      return saveInventory(mergedData, retryCount + 1);
    }
    
    console.error('❌ 재고 저장 실패:', error.message);
    console.error('❌ 재시도 횟수:', retryCount);
    throw error;
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
    inventory.history = inventoryData.history || [];
    
    inventory.markModified('categories');
    inventory.markModified('collecting');
    inventory.markModified('crafting');
    inventory.markModified('settings');
    
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
