// 기여도 계산 서비스

/**
 * 히스토리 details에서 수량 파싱
 * @param {string} action - 액션 타입
 * @param {string} details - 상세 내용
 * @returns {number} 파싱된 수량
 */
export function parseQuantityFromDetails(action, details) {
  try {
    // remove, reset 액션: 기여도 없음
    if (action === 'remove' || action === 'reset') {
      return 0;
    }
    
    // add 액션: "초기: N개"
    if (action === 'add') {
      const match = details.match(/초기:\s*(\d+)개/);
      return match ? parseInt(match[1]) : 0;
    }
    
    // update 액션들
    if (action === 'update_quantity' || action === 'update_required') {
      // "N -> M" 형식: 절대값 차이
      const arrowMatch = details.match(/(\d+)\s*->\s*(\d+)/);
      if (arrowMatch) {
        const oldQty = parseInt(arrowMatch[1]);
        const newQty = parseInt(arrowMatch[2]);
        return Math.abs(newQty - oldQty);
      }
      
      // "N개 추가" 형식
      const addMatch = details.match(/(\d+)개\s*추가/);
      if (addMatch) {
        return parseInt(addMatch[1]);
      }
      
      // "N개 차감" 형식
      const subtractMatch = details.match(/(\d+)개\s*차감/);
      if (subtractMatch) {
        return parseInt(subtractMatch[1]);
      }
      
      // "수정: N -> M" 형식
      const editMatch = details.match(/수정:\s*(\d+)\s*->\s*(\d+)/);
      if (editMatch) {
        const oldQty = parseInt(editMatch[1]);
        const newQty = parseInt(editMatch[2]);
        return Math.abs(newQty - oldQty);
      }
    }
    
    // craft 액션: "N개 제작"
    if (action === 'craft') {
      const match = details.match(/(\d+)개\s*제작/);
      return match ? parseInt(match[1]) : 0;
    }
    
    return 0;
  } catch (error) {
    console.error('⚠️ 수량 파싱 실패:', action, details, error);
    return 0;
  }
}

/**
 * 현재 기간 필터링 (마지막 reset 이후)
 * @param {Array} historyEntries - 히스토리 엔트리 배열
 * @returns {object} { entries, periodStart }
 */
export function filterByCurrentPeriod(historyEntries) {
  // 가장 최근 reset 액션 찾기
  let resetIndex = -1;
  for (let i = historyEntries.length - 1; i >= 0; i--) {
    if (historyEntries[i].action === 'reset') {
      resetIndex = i;
      break;
    }
  }
  
  // reset 이후 엔트리만 반환
  if (resetIndex !== -1) {
    return {
      entries: historyEntries.slice(resetIndex + 1),
      periodStart: historyEntries[resetIndex].timestamp
    };
  }
  
  // reset이 없으면 전체 반환
  return {
    entries: historyEntries,
    periodStart: historyEntries[0]?.timestamp || new Date().toISOString()
  };
}

/**
 * 기여도 계산
 * @param {Array} historyEntries - 히스토리 엔트리 배열
 * @param {object} itemPoints - 아이템 배점 객체
 * @param {object} options - 옵션 { type, period, topN }
 * @returns {object} 사용자별 점수 객체
 */
export function calculateContributions(historyEntries, itemPoints, options = {}) {
  const { type = 'all', period = 'current' } = options;
  
  // 기간 필터링
  let entries = historyEntries;
  let periodStart = null;
  
  if (period === 'current') {
    const filtered = filterByCurrentPeriod(historyEntries);
    entries = filtered.entries;
    periodStart = filtered.periodStart;
  }
  
  // 타입 필터링
  if (type !== 'all') {
    entries = entries.filter(e => e.type === type);
  }
  
  // 사용자별 점수 계산
  const userScores = {};
  
  for (const entry of entries) {
    const { userName, type: entryType, category, itemName, action, details } = entry;
    
    // 수량 파싱
    const quantity = parseQuantityFromDetails(action, details);
    if (quantity === 0) continue;
    
    // 배점 가져오기 (기본값: 1)
    const points = itemPoints?.[entryType]?.[category]?.[itemName] || 1;
    
    // 점수 계산: quantity × points
    const score = quantity * points;
    
    // 누적
    if (!userScores[userName]) {
      userScores[userName] = { score: 0, count: 0 };
    }
    userScores[userName].score += score;
    userScores[userName].count += 1;
  }
  
  // 100으로 나누고 소수점 2자리 반올림
  for (const userName in userScores) {
    userScores[userName].score = Math.round(userScores[userName].score) / 100;
    // 음수 방지
    if (userScores[userName].score < 0) {
      userScores[userName].score = 0;
    }
  }
  
  return { userScores, periodStart };
}

/**
 * 순위 생성
 * @param {object} userScores - 사용자별 점수 객체
 * @param {number} topN - 상위 N명
 * @returns {Array} 순위 배열
 */
export function generateRankings(userScores, topN = 3) {
  return Object.entries(userScores)
    .sort((a, b) => {
      // 점수 내림차순
      if (b[1].score !== a[1].score) {
        return b[1].score - a[1].score;
      }
      // 동점 시 이름 가나다순
      return a[0].localeCompare(b[0], 'ko');
    })
    .slice(0, topN)
    .map(([userName, data], index) => ({
      rank: index + 1,
      userName,
      score: data.score,
      count: data.count
    }));
}
