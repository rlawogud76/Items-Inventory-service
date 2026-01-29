import clsx from 'clsx'

/**
 * 공통 ProgressBar 컴포넌트
 * @param {number} current - 현재 값
 * @param {number} target - 목표 값
 * @param {'sm'|'md'|'lg'} size - 크기
 * @param {string} className - 추가 클래스
 */
export function ProgressBar({ current, target, size = 'md', className }) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const isComplete = current >= target && target > 0
  
  // 색상 결정
  let barColor = 'bg-red-500'
  if (isComplete) barColor = 'bg-green-500'
  else if (percentage >= 75) barColor = 'bg-yellow-500'
  else if (percentage >= 50) barColor = 'bg-orange-500'
  else if (percentage > 0) barColor = 'bg-primary-500'
  
  // 높이 결정
  const heightClass = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }[size] || 'h-2'
  
  return (
    <div className={clsx(
      'w-full bg-gray-200 dark:bg-dark-200 rounded-full overflow-hidden',
      heightClass,
      className
    )}>
      <div
        className={clsx(barColor, heightClass, 'rounded-full transition-all duration-300')}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

export default ProgressBar
