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
  MAX_EMOJI_LENGTH: 10,           // 이모지 최대 길이
  DISCORD_SELECT_MAX_OPTIONS: 25, // Discord Select Menu 최대 옵션 수
  DISCORD_FIELD_MAX_LENGTH: 1024, // Discord Embed Field 최대 길이
  DISCORD_DESCRIPTION_MAX_LENGTH: 100, // Discord Select Option Description 최대 길이
};

/**
 * 데이터베이스 및 캐시 설정
 */
export const DB_CONFIG = {
  POLLING_INTERVAL: 3000,         // 3초
  CONNECT_TIMEOUT: 30000,         // 30초
  SOCKET_TIMEOUT: 45000,          // 45초
};

/**
 * 인터랙션 디바운스 및 타임아웃 설정
 */
export const INTERACTION_CONFIG = {
  DEBOUNCE_MS: 1000,              // 1초 내 중복 인터랙션 무시
  DEBOUNCE_CLEANUP_INTERVAL: 60000, // 1분마다 만료된 debounce 항목 정리
  DEBOUNCE_MAX_AGE: 10000,        // 10초 이상 된 항목 정리
  ACTIVE_MESSAGE_TIMEOUT: 600000, // 10분 후 활성 메시지 만료
  DEFAULT_SELECT_TIMEOUT: 30000,  // 기본 선택 메시지 타임아웃 (30초)
  DEFAULT_INFO_TIMEOUT: 15000,    // 기본 정보 메시지 타임아웃 (15초)
};

/**
 * UI/UX 설정
 */
export const UI = {
  DEFAULT_BAR_LENGTH: 15,
  PROGRESS_BAR_FILLED: '█',
  PROGRESS_BAR_EMPTY: '░',
  DEFAULT_UI_MODE: 'normal',
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
  DEFAULT: '📦',
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
