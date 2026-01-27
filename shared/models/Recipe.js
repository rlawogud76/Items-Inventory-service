const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

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

// 복합 인덱스
recipeSchema.index({ category: 1, resultName: 1 }, { unique: true });

const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);

module.exports = { Recipe };
