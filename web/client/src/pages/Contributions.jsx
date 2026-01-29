import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trophy, Package, Hammer, RotateCcw, ShieldX } from 'lucide-react'
import { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Contributions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['contributions'],
    queryFn: () => api.get('/contributions?limit=50').then(res => res.data),
    retry: (failureCount, error) => {
      if (error?.response?.status === 403) return false
      return failureCount < 3
    }
  })

  // 권한 없음 에러 표시
  if (error?.response?.status === 403) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <ShieldX className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-400 mb-2">권한이 없습니다</h2>
        <p className="text-gray-500 dark:text-gray-400">기여도 조회 권한이 비활성화되어 있습니다.</p>
        <p className="text-gray-500 text-sm mt-2">관리자에게 문의하세요.</p>
      </div>
    )
  }

  const resetMutation = useMutation({
    mutationFn: () => api.delete('/contributions/reset'),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
      alert(response.data.message || '기여도가 초기화되었습니다.')
      setShowResetConfirm(false)
    },
    onError: (error) => {
      alert(error.response?.data?.error || '초기화에 실패했습니다.')
    }
  })

  const handleReset = () => {
    resetMutation.mutate()
  }

  const getRankStyle = (index) => {
    if (index === 0) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
    if (index === 1) return 'bg-gray-400/20 text-gray-400 border-gray-400/50'
    if (index === 2) return 'bg-orange-600/20 text-orange-500 border-orange-600/50'
    return 'bg-gray-100 dark:bg-dark-200 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-dark-100'
  }

  const getRankIcon = (index) => {
    if (index === 0) return ''
    if (index === 1) return ''
    if (index === 2) return ''
    return `${index + 1}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <Trophy className="text-yellow-500" />
          기여도 순위
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            총 {data?.totalUsers || 0}명 참여
          </span>
          {user?.isAdmin && (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
            >
              <RotateCcw size={14} />
              초기화
            </button>
          )}
        </div>
      </div>

      {/* 초기화 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-300 rounded-xl p-6 max-w-md mx-4 border border-gray-200 dark:border-dark-100">
            <h2 className="text-xl font-bold text-red-400 mb-4"> 기여도 초기화</h2>
            <p className="text-gray-700 dark:text-gray-300 mb-2">
              정말로 모든 기여도를 초기화하시겠습니까?
            </p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              모든 수정 내역이 삭제되며, 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-lg text-gray-900 dark:text-white"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={resetMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {resetMutation.isPending ? '처리 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : data?.contributors?.length > 0 ? (
        <div className="space-y-3">
          {data.contributors.map((contributor, index) => (
            <div
              key={contributor.userName}
              className={`rounded-xl p-4 border ${getRankStyle(index)} transition-colors`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* 순위 */}
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                    ${index < 3 ? '' : 'bg-gray-200 dark:bg-dark-300'}
                  `}>
                    {getRankIcon(index)}
                  </div>
                  
                  {/* 사용자 정보 */}
                  <div>
                    <p className="font-semibold text-lg text-gray-900 dark:text-white">{contributor.userName}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {contributor.actions}회 기여
                    </p>
                  </div>
                </div>

                {/* 점수 */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-500 dark:text-primary-400">
                    {contributor.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">점</p>
                </div>
              </div>

              {/* 세부 점수 */}
              <div className="mt-4 pt-4 border-t border-current/20 flex gap-6">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-blue-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">재고</span>
                  <span className="font-mono text-gray-900 dark:text-white">{contributor.inventory.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hammer size={16} className="text-orange-400" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">제작</span>
                  <span className="font-mono text-gray-900 dark:text-white">{contributor.crafting.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Trophy size={48} className="mx-auto mb-4 opacity-50" />
          <p>아직 기여도 데이터가 없습니다.</p>
          <p className="text-sm mt-2">아이템 수량을 변경하면 기여도가 기록됩니다.</p>
        </div>
      )}
    </div>
  )
}

export default Contributions
