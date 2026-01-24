// 유틸리티 함수들
import { addHistoryEntry } from './database.js';
import { STACK, LIMITS, UI, EMOJIS } from './constants.js';

/**
 * 사용자 입력 sanitization
 * Discord markdown과 특수문자를 이스케이프하여 안전하게 만듦
 * @param {string} input - 사용자 입력 문자열
 * @param {object} options - 옵션 { maxLength, allowNewlines }
 * @returns {string} - Sanitized 문자열
 */
export function sanitizeInput(input, options = {}) {
  if (typeof input !== 'string') {
    return '';
  }
  
  const {
    maxLength = 100,
    allowNewlines = false,
    allowMarkdown = false
  } = options;
  
  let sanitized = input;
  
  // 길이 제한
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  // 개행 문자 제거 (옵션)
  if (!allowNewlines) {
    sanitized = sanitized.replace(/[\r\n]/g, ' ');
  }
  
  // Discord markdown 이스케이프 (옵션)
  if (!allowMarkdown) {
    sanitized = sanitized
      .replace(/\\/g, '\\\\')   // 백슬래시
      .replace(/\*/g, '\\*')    // 별표 (볼드/이탤릭)
      .replace(/_/g, '\\_')     // 언더스코어 (이탤릭)
      .replace(/~/g, '\\~')     // 틸드 (취소선)
      .replace(/`/g, '\\`')     // 백틱 (코드)
      .replace(/\|/g, '\\|')    // 파이프 (스포일러)
      .replace(/>/g, '\\>')     // 꺾쇠 (인용)
      .replace(/@/g, '\\@');    // @ (멘션 방지)
  }
  
  // 앞뒤 공백 제거
  sanitized = sanitized.trim();
  
  // 빈 문자열 체크
  if (sanitized.length === 0) {
    return '';
  }
  
  return sanitized;
}

/**
 * 숫자 입력 검증 및 sanitization
 * @param {string} input - 사용자 입력
 * @param {object} options - { min, max, allowNegative, allowFloat }
 * @returns {number|null} - 검증된 숫자 또는 null
 */
export function sanitizeNumber(input, options = {}) {
  const {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    allowNegative = false,
    allowFloat = false
  } = options;
  
  // 문자열을 숫자로 변환
  const num = allowFloat ? parseFloat(input) : parseInt(input, 10);
  
  // NaN 체크
  if (isNaN(num)) {
    return null;
  }
  
  // 음수 체크
  if (!allowNegative && num < 0) {
    return null;
  }
  
  // 범위 체크
  if (num < min || num > max) {
    return null;
  }
  
  // 무한대 체크
  if (!isFinite(num)) {
    return null;
  }
  
  return num;
}

/**
 * 카테고리/아이템 이름 검증
 * @param {string} name - 이름
 * @returns {boolean} - 유효 여부
 */
export function isValidName(name) {
  if (typeof name !== 'string') return false;
  if (name.length === 0 || name.length > 50) return false;
  
  // 특수문자 제한 (한글, 영문, 숫자, 공백, 일부 특수문자만 허용)
  const validPattern = /^[가-힣a-zA-Z0-9\s\-_()]+$/;
  return validPattern.test(name);
}

// 수량을 상자/세트/개로 변환하는 함수
export function formatQuantity(quantity) {
  const boxes = Math.floor(quantity / STACK.ITEMS_PER_BOX);
  const remainingAfterBoxes = quantity % STACK.ITEMS_PER_BOX;
  const sets = Math.floor(remainingAfterBoxes / STACK.ITEMS_PER_SET);
  const items = remainingAfterBoxes % STACK.ITEMS_PER_SET;
  
  return { boxes, sets, items };
}

// 수량을 문자열로 표시 (낱개/세트/상자)
export function formatQuantityString(quantity) {
  const { boxes, sets, items } = formatQuantity(quantity);
  return `${items}개/${sets}세트/${boxes}상자`;
}

// 아이템의 태그 가져오기
export function getItemTag(itemName, category, type, inventory) {
  const tags = inventory.tags?.[type]?.[category];
  if (!tags) return null;
  
  for (const [tagName, tagData] of Object.entries(tags)) {
    if (Array.isArray(tagData)) {
      // 기존 형식 (배열)
      if (tagData.includes(itemName)) {
        return tagName;
      }
    } else if (tagData.items && tagData.items.includes(itemName)) {
      // 새 형식 (객체)
      return tagName;
    }
  }
  return null;
}

// 아이템의 태그 색상 가져오기
export function getItemTagColor(itemName, category, type, inventory) {
  const tags = inventory.tags?.[type]?.[category];
  if (!tags) return null;
  
  for (const [tagName, tagData] of Object.entries(tags)) {
    if (Array.isArray(tagData)) {
      // 기존 형식 (배열)
      if (tagData.includes(itemName)) {
        return 'default';
      }
    } else if (tagData.items && tagData.items.includes(itemName)) {
      // 새 형식 (객체)
      return tagData.color || 'default';
    }
  }
  return null;
}

// 색상 적용 함수 (이모지 사용)
export function applyTagColor(text, color) {
  if (!color || color === 'default') return text;
  
  const COLOR_EMOJIS = {
    'red': EMOJIS.COLORS.RED,
    'green': EMOJIS.COLORS.GREEN, 
    'blue': EMOJIS.COLORS.BLUE,
    'yellow': EMOJIS.COLORS.YELLOW,
    'purple': EMOJIS.COLORS.PURPLE,
    'cyan': EMOJIS.COLORS.CYAN,
    'white': EMOJIS.COLORS.WHITE
  };
  
  const emoji = COLOR_EMOJIS[color];
  return emoji ? `${emoji} ${text}` : text;
}

// 태그에 속한 모든 아이템 가져오기
export function getItemsByTag(tagName, category, type, inventory) {
  const tagData = inventory.tags?.[type]?.[category]?.[tagName];
  if (!tagData) return [];
  
  // 새 형식과 기존 형식 모두 지원
  return Array.isArray(tagData) ? tagData : tagData.items || [];
}

// 카테고리의 모든 태그 가져오기
export function getAllTags(category, type, inventory) {
  return Object.keys(inventory.tags?.[type]?.[category] || {});
}

// 재고 상태 이모지 반환
export function getStatusEmoji(quantity, required) {
  const percentage = (quantity / required) * 100;
  if (percentage <= 25) return '🔴'; // 25% 이하
  if (percentage < 90) return '🟡'; // 25% 초과 ~ 90% 미만
  return '🟢'; // 90% 이상
}

// 아이템 아이콘 반환
export function getItemIcon(itemName, inventory = null) {
  // 먼저 inventory에서 커스텀 이모지 확인
  if (inventory) {
    // 재고 카테고리 확인
    for (const category of Object.values(inventory.categories || {})) {
      if (category[itemName]?.emoji) {
        return category[itemName].emoji;
      }
    }
    // 제작 카테고리 확인
    for (const category of Object.values(inventory.crafting?.categories || {})) {
      if (category[itemName]?.emoji) {
        return category[itemName].emoji;
      }
    }
  }
  
  // 기본 아이콘
  const icons = {
    '다이아몬드': '💎',
    '철괴': '⚙️',
    '나무': '🪵',
    '음식': '🍖',
    '레드스톤': EMOJIS.COLORS.RED
  };
  return icons[itemName] || EMOJIS.BOX;
}

// 프로그레스 바 생성
export function createProgressBar(current, required, length = UI.DEFAULT_BAR_LENGTH) {
  const percentage = Math.min(current / required, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  const filledChar = UI.PROGRESS_BAR_FILLED;
  const emptyChar = UI.PROGRESS_BAR_EMPTY;
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// 수정 내역 추가 (History 컬렉션에 저장, 최대 1000개 유지)
export async function addHistory(type, category, itemName, action, details, userName) {
  await addHistoryEntry({
    timestamp: new Date().toISOString(),
    type,
    category,
    itemName,
    action,
    details,
    userName
  });
}

// ephemeral 메시지 자동 삭제
export async function sendTemporaryReply(interaction, content, deleteAfter = 15000) {
  const seconds = Math.floor(deleteAfter / 1000);
  const deleteNotice = `\n\n_이 메시지는 ${seconds}초 후 자동 삭제됩니다_`;
  
  // content가 문자열이면 { content: ... }, 객체면 그대로 사용
  let replyOptions;
  if (typeof content === 'string') {
    replyOptions = { content: content + deleteNotice, ephemeral: true, fetchReply: true };
  } else {
    // 객체인 경우 content 필드에 추가
    replyOptions = { 
      ...content, 
      content: (content.content || '') + deleteNotice,
      ephemeral: true, 
      fetchReply: true 
    };
  }
  
  const reply = await interaction.reply(replyOptions);
  
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
    } catch (error) {
      // 이미 삭제되었거나 삭제할 수 없는 경우 무시
    }
  }, deleteAfter);
  
  return reply;
}

// ==================== 아이템 연동 관련 ====================

/**
 * 연동된 아이템 정보 가져오기
 * @param {string} linkedItemPath - 'type/category/name' 형식
 * @param {object} inventory - 재고 데이터
 * @returns {object|null} - 연동된 아이템 데이터
 */
export function getLinkedItem(linkedItemPath, inventory) {
  if (!linkedItemPath) return null;
  
  const [type, category, name] = linkedItemPath.split('/');
  
  if (type === 'inventory') {
    return inventory.categories?.[category]?.[name] || null;
  } else if (type === 'crafting') {
    return inventory.crafting?.categories?.[category]?.[name] || null;
  }
  
  return null;
}

/**
 * 연동된 아이템 수량 동기화
 * @param {string} type - 'inventory' or 'crafting'
 * @param {string} category - 카테고리명
 * @param {string} itemName - 아이템명
 * @param {number} newQuantity - 새로운 수량
 * @param {object} inventory - 재고 데이터
 * @returns {boolean} - 동기화 성공 여부
 */
export function syncLinkedItemQuantity(type, category, itemName, newQuantity, inventory) {
  const sourceItem = type === 'inventory' 
    ? inventory.categories?.[category]?.[itemName]
    : inventory.crafting?.categories?.[category]?.[itemName];
  
  if (!sourceItem || !sourceItem.linkedItem) {
    return false; // 연동 정보 없음
  }
  
  const linkedItem = getLinkedItem(sourceItem.linkedItem, inventory);
  if (!linkedItem) {
    return false; // 연동된 아이템 없음
  }
  
  // 수량 동기화
  linkedItem.quantity = newQuantity;
  
  console.log(`🔄 연동 동기화: ${type}/${category}/${itemName} → ${sourceItem.linkedItem} (${newQuantity}개)`);
  
  return true;
}

/**
 * 아이템이 중간 제작품인지 확인
 * @param {string} type - 'inventory' or 'crafting'
 * @param {string} category - 카테고리명
 * @param {string} itemName - 아이템명
 * @param {object} inventory - 재고 데이터
 * @returns {boolean}
 */
export function isIntermediateItem(type, category, itemName, inventory) {
  const item = type === 'inventory'
    ? inventory.categories?.[category]?.[itemName]
    : inventory.crafting?.categories?.[category]?.[itemName];
  
  // 기존 아이템은 itemType이 없을 수 있음 - 기본값 처리
  if (!item) return false;
  if (!item.itemType) {
    // 기본값: inventory는 material, crafting은 final
    item.itemType = type === 'inventory' ? 'material' : 'final';
  }
  
  return item.itemType === 'intermediate' && !!item.linkedItem;
}

/**
 * 연동 상태 텍스트 생성
 * @param {string} type - 'inventory' or 'crafting'
 * @param {string} category - 카테고리명
 * @param {string} itemName - 아이템명
 * @param {object} inventory - 재고 데이터
 * @returns {string}
 */
export function getLinkedStatusText(type, category, itemName, inventory) {
  const item = type === 'inventory'
    ? inventory.categories?.[category]?.[itemName]
    : inventory.crafting?.categories?.[category]?.[itemName];
  
  if (!item || !item.linkedItem) {
    return '';
  }
  
  const linkedItem = getLinkedItem(item.linkedItem, inventory);
  if (!linkedItem) {
    return '\n⚠️ 연동 오류 (연동된 아이템을 찾을 수 없음)';
  }
  
  const [linkedType] = item.linkedItem.split('/');
  const linkedTypeName = linkedType === 'inventory' ? '재고' : '제작';
  
  return `\n🔗 ${linkedTypeName}와 연동됨 (자동 동기화)`;
}


/**
 * 설정된 타이머 값 가져오기
 * @param {Object} inventory - 인벤토리 객체
 * @returns {Object} - { selectTimeout, infoTimeout } (밀리초)
 */
export function getTimeoutSettings(inventory) {
  const selectTimeout = (inventory?.settings?.selectMessageTimeout || 30) * 1000;
  const infoTimeout = (inventory?.settings?.infoMessageTimeout || 15) * 1000;
  return { selectTimeout, infoTimeout };
}
