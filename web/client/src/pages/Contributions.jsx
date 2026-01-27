import { useQuery } from '@tanstack/react-query'
import { Trophy, Package, Hammer } from 'lucide-react'
import api from '../services/api'

function Contributions() {
  const { data, isLoading } = useQuery({
    queryKey: ['contributions'],
    queryFn: () => api.get('/contributions?limit=50').then(res => res.data),
  })

  const getRankStyle = (index) => {
    if (index === 0) return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50'
    if (index === 1) return 'bg-gray-400/20 text-gray-400 border-gray-400/50'
    if (index === 2) return 'bg-orange-600/20 text-orange-500 border-orange-600/50'
    return 'bg-dark-200 text-gray-400 border-dark-100'
  }

  const getRankIcon = (index) => {
    if (index === 0) return '🥇'
    if (index === 1) return '🥈'
    if (index === 2) return '🥉'
    return `${index + 1}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Trophy className="text-yellow-500" />
          기여도 순위
        </h1>
        <span className="text-sm text-gray-400">
          총 {data?.totalUsers || 0}명 참여
        </span>
      </div>

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
                    ${index < 3 ? '' : 'bg-dark-300'}
                  `}>
                    {getRankIcon(index)}
                  </div>
                  
                  {/* 사용자 정보 */}
                  <div>
                    <p className="font-semibold text-lg">{contributor.userName}</p>
                    <p className="text-sm text-gray-400">
                      {contributor.actions}회 기여
                    </p>
                  </div>
                </div>

                {/* 점수 */}
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary-400">
                    {contributor.total.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">점</p>
                </div>
              </div>

              {/* 세부 점수 */}
              <div className="mt-4 pt-4 border-t border-current/20 flex gap-6">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-blue-400" />
                  <span className="text-sm text-gray-400">재고</span>
                  <span className="font-mono">{contributor.inventory.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Hammer size={16} className="text-orange-400" />
                  <span className="text-sm text-gray-400">제작</span>
                  <span className="font-mono">{contributor.crafting.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Trophy size={48} className="mx-auto mb-4 opacity-50" />
          <p>아직 기여도 데이터가 없습니다.</p>
          <p className="text-sm mt-2">아이템 수량을 변경하면 기여도가 기록됩니다.</p>
        </div>
      )}
    </div>
  )
}

export default Contributions
