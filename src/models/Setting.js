import mongoose from 'mongoose';
import { UI } from '../constants.js';

const settingSchema = new mongoose.Schema({
  // 전역 설정 문서 하나만 유지 (ID: 'global')
  _id: { type: String, default: 'global' },
  
  // UI 설정
  uiMode: { type: String, default: 'normal' },
  barLength: { type: Number, default: UI.DEFAULT_BAR_LENGTH },
  
  // 메시지 자동 삭제 시간 설정 (초 단위)
  selectMessageTimeout: { type: Number, default: 30 }, // 셀렉트 메뉴 메시지 (기본 30초)
  infoMessageTimeout: { type: Number, default: 15 },   // 안내 메시지 (기본 15초)
  
  // 태그 시스템 (기존 구조 유지하되 별도 관리)
  // 구조: { inventory: { category: { tagName: [items...] } }, crafting: { ... } }
  tags: {
    inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
    crafting: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  
  // 아이템 배점 시스템 (기여도 계산용)
  // 구조: { inventory: { category: { itemName: points } }, crafting: { ... } }
  itemPoints: {
    inventory: { type: mongoose.Schema.Types.Mixed, default: {} },
    crafting: { type: mongoose.Schema.Types.Mixed, default: {} }
  },

  // 권한 설정
  adminUserIds: { type: [String], default: [] },
  // '*' 포함 시 모든 기능 허용
  memberAllowedFeatureKeys: { type: [String], default: ['*'] },
  
  // 마이그레이션 상태
  isMigrated: { type: Boolean, default: false },
  migrationDate: { type: Date }
}, { 
  timestamps: true,
  collection: 'settings'
});

export const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);
