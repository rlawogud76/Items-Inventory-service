const mongoose = require('mongoose');

// 수입/지출 항목 스키마
const entrySchema = new mongoose.Schema({
  item: { type: String, default: '' },
  price: { type: Number, default: 0 },
  qty: { type: Number, default: 0 },
  direct: { type: Number, default: 0 },
  note: { type: String, default: '' }
}, { _id: false });

const profitLossSchema = new mongoose.Schema({
  // 기본 정보
  title: { type: String, default: '손익계산서' },
  recordDate: { type: Date, default: Date.now },
  
  // 수입/지출 항목들
  income: [entrySchema],
  expense: [entrySchema],
  
  // 작성자 정보
  createdBy: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  
  // 마지막 수정자
  lastModifiedBy: { type: String, default: '' },
  lastModifiedByName: { type: String, default: '' }
}, { 
  timestamps: true,
  collection: 'profitloss'
});

profitLossSchema.index({ recordDate: -1 });
profitLossSchema.index({ createdAt: -1 });

const ProfitLoss = mongoose.models.ProfitLoss || mongoose.model('ProfitLoss', profitLossSchema);
module.exports = { ProfitLoss };
