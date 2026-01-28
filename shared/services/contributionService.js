// 기여도 계산 서비스

/**
 * 히스토리 details에서 수량 파싱 (부호 포함)
 * 추가는 양수, 차감은 음수 반환
 */
function parseQuantityFromDetails(action, details) {
  try {
    if (action === 'remove' || action === 'reset') {
      return 0;
    }
    
    if (action === 'add') {
      const match = details.match(/초기:\s*(\d+)개/);
      return match ? parseInt(match[1]) : 0;
    }
    
    if (action === 'update_quantity' || action === 'update_required' || action === 'edit_required') {
      // 추가는 양수
      const addPlusMatch = details.match(/추가:\s*\+(\d+)개/);
      if (addPlusMatch) return parseInt(addPlusMatch[1]);
      
      // 차감은 음수
      const subtractMinusMatch = details.match(/차감:\s*-(\d+)개/);
      if (subtractMinusMatch) return -parseInt(subtractMinusMatch[1]);
      
      // 수정은 변화량 (증가면 양수, 감소면 음수)
      const editUnicodeMatch = details.match(/수정:\s*(\d+)개?\s*→\s*(\d+)개?/);
      if (editUnicodeMatch) {
        return parseInt(editUnicodeMatch[2]) - parseInt(editUnicodeMatch[1]);
      }
      
      const targetEditMatch = details.match(/목표\s*수정:\s*(\d+)개?\s*→\s*(\d+)개?/);
      if (targetEditMatch) {
        return parseInt(targetEditMatch[2]) - parseInt(targetEditMatch[1]);
      }
      
      const parenUnicodeMatch = details.match(/\((\d+)\s*→\s*(\d+)\)/);
      if (parenUnicodeMatch) {
        return parseInt(parenUnicodeMatch[2]) - parseInt(parenUnicodeMatch[1]);
      }
      
      const arrowMatch = details.match(/(\d+)\s*->\s*(\d+)/);
      if (arrowMatch) {
        return parseInt(arrowMatch[2]) - parseInt(arrowMatch[1]);
      }
      
      // 추가는 양수
      const addMatch = details.match(/(\d+)개\s*추가/);
      if (addMatch) return parseInt(addMatch[1]);
      
      // 차감은 음수
      const subtractMatch = details.match(/(\d+)개\s*차감/);
      if (subtractMatch) return -parseInt(subtractMatch[1]);
    }
    
    if (action === 'craft') {
      const match = details.match(/(\d+)개\s*제작/);
      return match ? parseInt(match[1]) : 0;
    }
    
    // 소모는 음수, 반환은 양수
    if (details.includes('소모')) {
      const consumeMatch = details.match(/(\d+)개\s*소모/);
      if (consumeMatch) return -parseInt(consumeMatch[1]);
    }
    
    if (details.includes('반환')) {
      const returnMatch = details.match(/(\d+)개\s*반환/);
      if (returnMatch) return parseInt(returnMatch[1]);
    }
    
    return 0;
  } catch (error) {
    console.error('⚠️ 수량 파싱 실패:', action, details, error);
    return 0;
  }
}

/**
 * 현재 기간 필터링 (마지막 reset 이후)
 */
function filterByCurrentPeriod(historyEntries) {
  let resetIndex = -1;
  for (let i = historyEntries.length - 1; i >= 0; i--) {
    if (historyEntries[i].action === 'reset') {
      resetIndex = i;
      break;
    }
  }
  
  if (resetIndex !== -1) {
    return {
      entries: historyEntries.slice(resetIndex + 1),
      periodStart: historyEntries[resetIndex].timestamp
    };
  }
  
  return {
    entries: historyEntries,
    periodStart: historyEntries[0]?.timestamp || new Date().toISOString()
  };
}

/**
 * 기여도 계산
 */
function calculateContributions(historyEntries, itemPoints, options = {}) {
  const { type = 'all', period = 'current' } = options;
  
  let entries = historyEntries;
  
  if (period === 'current') {
    const { entries: filtered } = filterByCurrentPeriod(historyEntries);
    entries = filtered;
  }
  
  if (type !== 'all') {
    entries = entries.filter(e => e.type === type);
  }
  
  const contributions = {};
  
  for (const entry of entries) {
    const { userName, action, details, type: entryType, category, itemName } = entry;
    
    if (!userName) continue;
    
    const quantity = parseQuantityFromDetails(action, details);
    if (quantity <= 0) continue;
    
    const pointMultiplier = itemPoints?.[entryType]?.[category]?.[itemName] ?? 1;
    const score = quantity * pointMultiplier;
    
    if (!contributions[userName]) {
      contributions[userName] = { total: 0, inventory: 0, crafting: 0, actions: 0 };
    }
    
    contributions[userName].total += score;
    contributions[userName][entryType] += score;
    contributions[userName].actions += 1;
  }
  
  return contributions;
}

/**
 * TOP N 순위 생성
 */
function getTopContributors(contributions, n = 10) {
  return Object.entries(contributions)
    .map(([userName, data]) => ({ userName, ...data }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

module.exports = {
  parseQuantityFromDetails,
  filterByCurrentPeriod,
  calculateContributions,
  getTopContributors
};
