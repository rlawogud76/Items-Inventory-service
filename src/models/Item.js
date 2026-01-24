import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  // 식별자
  name: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  
  // 구분: 'inventory'(일반 재고) 또는 'crafting'(제작품)
  type: { type: String, required: true, enum: ['inventory', 'crafting'], index: true },
  
  // 세부 유형: 'material'(재료), 'intermediate'(중간재), 'final'(완성품)
  itemType: { type: String, default: 'material' },
  
  // 데이터
  quantity: { type: Number, default: 0, min: 0 },
  required: { type: Number, default: 0, min: 0 },
  
  // 연동 정보 (예: 'crafting/해양/산호_판자')
  linkedItem: { type: String, default: null },
  
  // UI 관련
  emoji: { type: String, default: null },
  
  // 메타데이터
  updatedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  collection: 'items' // 컬렉션 이름 명시
});

// 복합 인덱스: 같은 타입, 카테고리 내에서 이름은 유일해야 함
itemSchema.index({ type: 1, category: 1, name: 1 }, { unique: true });

export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);
