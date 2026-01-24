// 프로젝트 전역 상수 정의

/**
 * 마인크래프트 스택 관련 상수
 */
export const STACK = {
  ITEMS_PER_SET: 64,              // 1세트 = 64개
  SETS_PER_BOX: 54,               // 1상자 = 54세트 (셜커박스/큰상자 기준)
  ITEMS_PER_BOX: 64 * 54,         // 1상자 = 3456개
};

/**
 * 입력값 검증 제한 상수
 */
export const LIMITS = {
  MAX_BOXES: 10000,
  MAX_SETS: 100000,
  MAX_ITEMS: 63,                  // 1세트 미만
  NAME_MAX_LENGTH: 50,
  HISTORY_MAX_ENTRIES: 1000,
};

/**
 * 데이터베이스 및 캐시 설정
 */
export const DB_CONFIG = {
  CACHE_TTL: 5000,                // 5초
  POLLING_INTERVAL: 3000,         // 3초
  CONNECT_TIMEOUT: 30000,         // 30초
};

/**
 * UI/UX 설정
 */
export const UI = {
  DEFAULT_BAR_LENGTH: 15,
  PROGRESS_BAR_FILLED: '█',
  PROGRESS_BAR_EMPTY: '░',
};

/**
 * 아이콘/이모지 설정
 */
export const EMOJIS = {
  BOX: '📦',
  SET: '📚',
  ITEM: '🔹',
  INTERMEDIATE: '🔄',
  FINAL: '⭐',
  COLORS: {
    RED: '🔴',
    GREEN: '🟢',
    BLUE: '🔵',
    YELLOW: '🟡',
    PURPLE: '🟣',
    CYAN: '🔵',
    WHITE: '⚪',
  }
};
