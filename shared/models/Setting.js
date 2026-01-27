const mongoose = require('mongoose');
const { UI } = require('../constants');

const settingSchema = new mongoose.Schema({
  // 전역 설정 문서 하나만 유지 (ID: 'global')
  _id: { type: String, default: 'global' },
  
  // UI 설정
  uiMode: { type: String, default: 'normal' },
  barLength: { type: Number, default: UI.DEFAULT_BAR_LENGTH },
  
  // 메시지 자동 삭제 시간 설정 (초 단위)
  selectMessageTimeout: { type: Number, default: 30 },
  infoMessageTimeout: { type: Number, default: 15 },
  
  // 태그 시스템
  tags: {
    inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
    crafting: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  
  // 아이템 배점 시스템
  itemPoints: {
    inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
    crafting: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // 권한 설정
  adminUserIds: { type: [String], default: [] },
  adminAllowedFeatureKeys: { type: [String], default: ['*'] },
  memberAllowedFeatureKeys: { type: [String], default: ['*'] },
  
  // 마이그레이션 상태
  isMigrated: { type: Boolean, default: false },
  migrationDate: { type: Date }
}, { 
  timestamps: true,
  collection: 'settings'
});

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

module.exports = { Setting };
