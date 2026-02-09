/**
 * 공통 수량 포맷팅 유틸리티
 */

// 고정 크기 상수
export const SET_SIZE = 64
export const BOX_SIZE = 3456

/**
 * 수량을 상자/세트/개 형태로 포맷팅
 * @param {number} quantity - 수량
 * @param {Object} options - 옵션
 * @param {number} options.boxSize - 상자당 개수 (기본: 3456)
 * @param {number} options.setSize - 세트당 개수 (기본: 64)
 * @param {boolean} options.showAll - 모든 단위 표시 (기본: true)
 * @returns {string} 포맷팅된 문자열
 */
export function formatQuantity(quantity, options = {}) {
  const { 
    boxSize = BOX_SIZE, 
    setSize = SET_SIZE,
    showAll = true 
  } = options
  
  if (quantity === 0) return '0개'
  
  const parts = []
  let remaining = quantity
  
  // 상자 계산
  if (boxSize > 0) {
    const boxes = Math.floor(remaining / boxSize)
    if (boxes > 0) {
      parts.push(`${boxes}상자`)
      remaining = remaining % boxSize
    }
  }
  
  // 세트 계산
  if (setSize > 0) {
    const sets = Math.floor(remaining / setSize)
    if (sets > 0) {
      parts.push(`${sets}세트`)
      remaining = remaining % setSize
    }
  }
  
  // 남은 개수
  if (remaining > 0 || parts.length === 0) {
    parts.push(`${remaining}개`)
  }
  
  return parts.join(' ')
}

/**
 * D-Day 계산
 * @param {Date|string} targetDate - 목표 날짜
 * @returns {string} D-Day 문자열
 */
export function calculateDDay(targetDate) {
  if (!targetDate) return null
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(targetDate)
  target.setHours(0, 0, 0, 0)
  
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
  
  if (diff === 0) return 'D-Day'
  if (diff > 0) return `D-${diff}`
  return `D+${Math.abs(diff)}`
}
