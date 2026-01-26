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

// 권한 기능키 목록
export const PERMISSION_FEATURE_KEYS = [
  { key: '*', label: '전체 허용', description: '모든 기능 사용 허용' },
  { key: 'inventory', label: '재고', description: '재고 화면 및 관련 기능' },
  { key: 'crafting', label: '제작', description: '제작 화면 및 관련 기능' },
  { key: 'quantity', label: '수량', description: '수량 변경/관리' },
  { key: 'reset', label: '초기화', description: '초기화/리셋 기능' },
  { key: 'manage', label: '물품관리', description: '추가/수정/삭제/정렬' },
  { key: 'recipe', label: '레시피', description: '레시피 추가/수정' },
  { key: 'tag', label: '태그', description: '태그 설정/관리' },
  { key: 'settings', label: '설정', description: 'UI/타이머 설정' },
  { key: 'work', label: '작업', description: '수집/제작 작업' },
  { key: 'contribution', label: '기여도', description: '기여도 조회/배점' },
  { key: 'points', label: '배점', description: '배점 설정/조회' },
  { key: 'history', label: '수정내역', description: '수정 내역 조회' },
  { key: 'emoji', label: '이모지', description: '이모지 설정' },
  { key: 'repair', label: '복구', description: '복구 기능' },
  { key: 'usage', label: '사용법', description: '사용법 안내' },
  { key: 'permissions', label: '권한설정', description: '권한 관리' }
];
