import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false }); // 서브 문서 ID 생성 방지

const recipeSchema = new mongoose.Schema({
  // 결과물 (제작품)
  resultName: { type: String, required: true, index: true },
  category: { type: String, required: true, index: true },
  
  // 필요한 재료 목록
  materials: [materialSchema],
  
  // 메타데이터
  updatedAt: { type: Date, default: Date.now }
}, { 
  timestamps: true,
  collection: 'recipes'
});

// 복합 인덱스: 카테고리 내에서 결과물 이름은 유일해야 함
recipeSchema.index({ category: 1, resultName: 1 }, { unique: true });

export const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);
