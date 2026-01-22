// 유틸리티 함수들

// 수량을 상자/세트/개로 변환하는 함수
export function formatQuantity(quantity) {
  const boxes = Math.floor(quantity / 3456); // 1상자 = 54세트 = 3456개
  const remainingAfterBoxes = quantity % 3456;
  const sets = Math.floor(remainingAfterBoxes / 64);
  const items = remainingAfterBoxes % 64;
  
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
  
  for (const [tagName, items] of Object.entries(tags)) {
    if (items.includes(itemName)) {
      return tagName;
    }
  }
  return null;
}

// 태그에 속한 모든 아이템 가져오기
export function getItemsByTag(tagName, category, type, inventory) {
  return inventory.tags?.[type]?.[category]?.[tagName] || [];
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
    '레드스톤': '🔴'
  };
  return icons[itemName] || '📦';
}

// 프로그레스 바 생성
export function createProgressBar(current, required, length = 10) {
  const percentage = Math.min(current / required, 1);
  const filled = Math.round(percentage * length);
  const empty = length - filled;
  
  const filledChar = '█';
  const emptyChar = '░';
  
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// 수정 내역 추가
export function addHistory(inventory, type, category, itemName, action, details, userName) {
  if (!inventory.history) {
    inventory.history = [];
  }
  
  inventory.history.unshift({
    timestamp: new Date().toISOString(),
    type: type, // 'inventory' or 'crafting'
    category: category,
    itemName: itemName,
    action: action, // 'add', 'remove', 'update_quantity', 'update_required'
    details: details,
    userName: userName
  });
  
  // 최대 100개까지만 보관
  if (inventory.history.length > 100) {
    inventory.history = inventory.history.slice(0, 100);
  }
}

// ephemeral 메시지 자동 삭제
export async function sendTemporaryReply(interaction, content, deleteAfter = 15000) {
  // content가 문자열이면 { content: ... }, 객체면 그대로 사용
  const replyOptions = typeof content === 'string' 
    ? { content: content, ephemeral: true, fetchReply: true }
    : { ...content, ephemeral: true, fetchReply: true };
  
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
