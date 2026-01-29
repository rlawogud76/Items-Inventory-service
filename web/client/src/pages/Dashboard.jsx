import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { Package, Hammer, TrendingUp, Clock } from 'lucide-react'
import api from '../services/api'

function StatCard({ title, value, icon: Icon, color, to }) {
  const content = (
    <div className={`bg-white dark:bg-dark-300 rounded-xl p-6 border border-light-300 dark:border-dark-100 hover:border-${color}-500/50 transition-colors shadow-sm dark:shadow-none`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-${color}-500/20`}>
          <Icon className={`text-${color}-500`} size={24} />
        </div>
      </div>
    </div>
  )

  if (to) {
    return <NavLink to={to}>{content}</NavLink>
  }
  return content
}

function ProgressBar({ current, target, color = 'primary' }) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  
  return (
    <div className="w-full bg-light-300 dark:bg-dark-200 rounded-full h-2">
      <div
        className={`bg-${color}-500 h-2 rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function Dashboard() {
  // 재고 데이터 조회
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['items', 'inventory'],
    queryFn: () => api.get('/items/inventory').then(res => res.data),
  })

  // 제작 데이터 조회
  const { data: craftingItems = [] } = useQuery({
    queryKey: ['items', 'crafting'],
    queryFn: () => api.get('/items/crafting').then(res => res.data),
  })

  // 기여도 조회
  const { data: contributionsData } = useQuery({
    queryKey: ['contributions'],
    queryFn: () => api.get('/contributions?limit=5').then(res => res.data),
  })

  // 통계 계산
  const inventoryCategories = [...new Set(inventoryItems.map(i => i.category))]
  const craftingCategories = [...new Set(craftingItems.map(i => i.category))]
  
  const totalInventoryItems = inventoryItems.length
  const totalCraftingItems = craftingItems.length
  
  const inventoryProgress = inventoryItems.reduce(
    (acc, item) => {
      acc.current += item.quantity
      acc.target += item.required
      return acc
    },
    { current: 0, target: 0 }
  )
  
  const craftingProgress = craftingItems.reduce(
    (acc, item) => {
      acc.current += item.quantity
      acc.target += item.required
      return acc
    },
    { current: 0, target: 0 }
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="재고 카테고리"
          value={inventoryCategories.length}
          icon={Package}
          color="blue"
          to="/inventory"
        />
        <StatCard
          title="제작 카테고리"
          value={craftingCategories.length}
          icon={Hammer}
          color="orange"
          to="/crafting"
        />
        <StatCard
          title="총 재고 아이템"
          value={totalInventoryItems}
          icon={Package}
          color="green"
        />
        <StatCard
          title="총 제작품"
          value={totalCraftingItems}
          icon={Hammer}
          color="purple"
        />
      </div>

      {/* 진행 상황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 재고 진행률 */}
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-light-300 dark:border-dark-100 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">재고 진행률</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {inventoryProgress.current.toLocaleString()} / {inventoryProgress.target.toLocaleString()}
            </span>
          </div>
          <ProgressBar 
            current={inventoryProgress.current} 
            target={inventoryProgress.target}
            color="blue"
          />
          <p className="text-right text-sm text-gray-500 dark:text-gray-400 mt-2">
            {inventoryProgress.target > 0 
              ? `${((inventoryProgress.current / inventoryProgress.target) * 100).toFixed(1)}%`
              : '0%'}
          </p>
        </div>

        {/* 제작 진행률 */}
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-light-300 dark:border-dark-100 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">제작 진행률</h2>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {craftingProgress.current.toLocaleString()} / {craftingProgress.target.toLocaleString()}
            </span>
          </div>
          <ProgressBar 
            current={craftingProgress.current} 
            target={craftingProgress.target}
            color="orange"
          />
          <p className="text-right text-sm text-gray-500 dark:text-gray-400 mt-2">
            {craftingProgress.target > 0 
              ? `${((craftingProgress.current / craftingProgress.target) * 100).toFixed(1)}%`
              : '0%'}
          </p>
        </div>
      </div>

      {/* 기여도 TOP 5 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-light-300 dark:border-dark-100 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp size={20} className="text-yellow-500" />
            기여도 TOP 5
          </h2>
          <NavLink 
            to="/contributions"
            className="text-sm text-primary-500 hover:text-primary-400"
          >
            더보기
          </NavLink>
        </div>
        
        {contributionsData?.contributors?.length > 0 ? (
          <div className="space-y-3">
            {contributionsData.contributors.map((contributor, index) => (
              <div 
                key={contributor.userName}
                className="flex items-center justify-between p-3 bg-light-200 dark:bg-dark-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className={`
                    w-8 h-8 rounded-full flex items-center justify-center font-bold
                    ${index === 0 ? 'bg-yellow-500/20 text-yellow-500' : ''}
                    ${index === 1 ? 'bg-gray-400/20 text-gray-400' : ''}
                    ${index === 2 ? 'bg-orange-500/20 text-orange-500' : ''}
                    ${index > 2 ? 'bg-light-300 dark:bg-dark-100 text-gray-500' : ''}
                  `}>
                    {index + 1}
                  </span>
                  <span>{contributor.userName}</span>
                </div>
                <span className="font-mono text-primary-500 dark:text-primary-400">
                  {contributor.total.toLocaleString()}점
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">아직 기여도 데이터가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

export default Dashboard
