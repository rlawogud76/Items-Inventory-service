import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, NavLink } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { 
  Plus, 
  Minus, 
  Trash2,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  Target,
  Package,
  Layers,
  Star,
  AlertCircle,
  Settings
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'
import { CraftingPlanModal, DeleteConfirmModal } from '../components/ItemModals'
import { ProgressBar } from '../components/ProgressBar'
import { formatQuantity, calculateDDay } from '../utils/formatting'
import clsx from 'clsx'

// 티어 설정
const TIER_CONFIG = {
  1: { 
    name: '1차 재료', 
    icon: Package, 
    color: 'bg-blue-500', 
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400'
  },
  2: { 
    name: '2차 중간재', 
    icon: Layers, 
    color: 'bg-purple-500', 
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400'
  },
  3: { 
    name: '3차 완성품', 
    icon: Star, 
    color: 'bg-yellow-500', 
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400'
  }
}

// 개별 아이템 카드
function CraftingCard({ item, onQuantityChange, onQuantitySet, onRequiredChange }) {
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [inputMode, setInputMode] = useState('add') // 'add', 'subtract', 'set', 'required'
  const [showMaterials, setShowMaterials] = useState(false)
  
  const percentage = item.required > 0 ? Math.min((item.quantity / item.required) * 100, 100) : 0
  const isComplete = item.quantity >= item.required
  const remaining = Math.max(0, item.required - item.quantity)
  
  // 하위재료 정보
  const hasMaterials = item.materialsWithStock && item.materialsWithStock.length > 0
  
  const handleQuickChange = (delta) => {
    onQuantityChange(item, delta)
  }
  
  const handleSubmit = (e) => {
    e.preventDefault()
    const value = parseInt(inputValue) || 0
    if (value < 0) return
    if (value === 0 && inputMode !== 'set' && inputMode !== 'required') return
    
    if (inputMode === 'set') {
      onQuantitySet(item, value)
    } else if (inputMode === 'subtract') {
      onQuantityChange(item, -value)
    } else if (inputMode === 'required') {
      onRequiredChange(item, value)
    } else {
      onQuantityChange(item, value)
    }
    
    setInputValue('')
    setShowInput(false)
  }
  
  return (
    <div className={clsx(
      'rounded-lg border transition-all',
      isComplete 
        ? 'bg-green-500/10 border-green-500/30' 
        : 'bg-white dark:bg-dark-400 border-light-300 dark:border-dark-300 hover:border-light-400 dark:hover:border-dark-200'
    )}>
      <div className="p-3">
        {/* 헤더: 아이콘 + 이름 */}
        <div className="flex items-center gap-2 mb-2">
          {item.emoji && (
            <span className="text-lg">
              <DiscordText>{item.emoji}</DiscordText>
            </span>
          )}
          <span className="font-medium text-sm truncate flex-1">
            <DiscordText>{item.name}</DiscordText>
          </span>
          {isComplete && <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />}
        </div>
        
        {/* 진행률 바 */}
        <ProgressBar current={item.quantity} target={item.required} size="sm" />
        
        {/* 수량 표시 */}
        <div className="flex justify-between items-center mt-2 text-xs">
          <span className={clsx(
            'font-mono',
            isComplete ? 'text-green-400' : 'text-gray-400'
          )}>
            {item.quantity} / {item.required}
          </span>
          {!isComplete && remaining > 0 && (
            <span className="text-gray-500">
              -{remaining}
            </span>
          )}
        </div>
        
        {/* 빠른 조작 버튼 */}
        {!showInput ? (
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => handleQuickChange(1)}
              className="flex-1 py-1 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-colors"
          >
            +1
          </button>
          <button
            onClick={() => handleQuickChange(64)}
            className="flex-1 py-1 text-xs bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded transition-colors"
          >
            +64
          </button>
          <button
            onClick={() => handleQuickChange(-1)}
            className="flex-1 py-1 text-xs bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded transition-colors"
          >
            -1
          </button>
          <button
            onClick={() => setShowInput(true)}
            className="px-2 py-1 text-xs bg-light-200 dark:bg-dark-300 hover:bg-light-300 dark:hover:bg-dark-200 rounded transition-colors"
          >
            ...
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-2 space-y-2">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setInputMode('add')}
              className={clsx(
                'flex-1 py-1 text-xs rounded transition-colors',
                inputMode === 'add' ? 'bg-green-600 text-white' : 'bg-light-200 dark:bg-dark-300'
              )}
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => setInputMode('subtract')}
              className={clsx(
                'flex-1 py-1 text-xs rounded transition-colors',
                inputMode === 'subtract' ? 'bg-red-600 text-white' : 'bg-light-200 dark:bg-dark-300'
              )}
            >
              차감
            </button>
            <button
              type="button"
              onClick={() => setInputMode('set')}
              className={clsx(
                'flex-1 py-1 text-xs rounded transition-colors',
                inputMode === 'set' ? 'bg-blue-600 text-white' : 'bg-light-200 dark:bg-dark-300'
              )}
            >
              설정
            </button>
            <button
              type="button"
              onClick={() => setInputMode('required')}
              className={clsx(
                'flex-1 py-1 text-xs rounded transition-colors',
                inputMode === 'required' ? 'bg-yellow-600 text-white' : 'bg-light-200 dark:bg-dark-300'
              )}
            >
              목표
            </button>
          </div>
          <div className="flex gap-1">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={inputMode === 'required' ? '목표 수량' : '수량'}
              className="flex-1 px-2 py-1 text-xs bg-light-200 dark:bg-dark-200 rounded border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none"
              autoFocus
              min="0"
            />
            <button
              type="submit"
              className="px-3 py-1 text-xs bg-primary-600 hover:bg-primary-500 rounded transition-colors text-white"
            >
              확인
            </button>
            <button
              type="button"
              onClick={() => setShowInput(false)}
              className="px-2 py-1 text-xs bg-light-200 dark:bg-dark-300 hover:bg-light-300 dark:hover:bg-dark-200 rounded transition-colors"
            >
              ✕
            </button>
          </div>
        </form>
      )}
      
      {/* 하위재료 펼치기 버튼 */}
      {hasMaterials && (
        <button
          onClick={() => setShowMaterials(!showMaterials)}
          className="w-full mt-2 py-1 text-xs text-gray-400 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
        >
          {showMaterials ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          재료 {item.materialsWithStock.length}종
        </button>
      )}
      </div>
      
      {/* 하위재료 목록 */}
      {hasMaterials && showMaterials && (
        <div className="border-t border-light-300 dark:border-dark-300 p-2 bg-light-100 dark:bg-dark-300/50">
          <div className="space-y-1.5">
            {item.materialsWithStock.map((mat, idx) => {
              const hasEnough = mat.stock >= mat.needed
              const shortage = Math.max(0, mat.needed - mat.stock)
              return (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1 flex items-center gap-1">
                    {mat.emoji && (
                      <span className="text-sm">
                        <DiscordText>{mat.emoji}</DiscordText>
                      </span>
                    )}
                    <DiscordText>{mat.name}</DiscordText>
                  </span>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-gray-500">x{mat.quantity}</span>
                    <span className={clsx(
                      'font-mono',
                      hasEnough ? 'text-green-400' : 'text-red-400'
                    )}>
                      {mat.stock}
                      {!hasEnough && shortage > 0 && (
                        <span className="text-red-500 ml-1">(-{shortage})</span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// 티어 컬럼 컴포넌트
function TierColumn({ tier, items, onQuantityChange, onQuantitySet, onRequiredChange }) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  
  const completedCount = items.filter(i => i.quantity >= i.required).length
  const totalCount = items.length
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  
  return (
    <div className={clsx(
      'flex flex-col rounded-xl border',
      config.borderColor,
      config.bgColor
    )}>
      {/* 컬럼 헤더 */}
      <div className="p-4 border-b border-light-300 dark:border-dark-300">
        <div className="flex items-center gap-2 mb-2">
          <div className={clsx('p-1.5 rounded-lg', config.color)}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h3 className={clsx('font-semibold', config.textColor)}>
            {config.name}
          </h3>
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {completedCount}/{totalCount}
          </span>
        </div>
        <ProgressBar current={completedCount} target={totalCount} size="sm" />
        <div className="text-right text-xs text-gray-500 mt-1">
          {progress}% 완료
        </div>
      </div>
      
      {/* 아이템 목록 */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-350px)]">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            아이템 없음
          </div>
        ) : (
          items.map(item => (
            <CraftingCard
              key={`${item.category}-${item.name}`}
              item={item}
              onQuantityChange={onQuantityChange}
              onQuantitySet={onQuantitySet}
              onRequiredChange={onRequiredChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

// 완료 컬럼
function CompletedColumn({ items }) {
  return (
    <div className="flex flex-col rounded-xl border border-green-500/30 bg-green-500/5">
      {/* 컬럼 헤더 */}
      <div className="p-4 border-b border-light-300 dark:border-dark-300">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-green-500">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-semibold text-green-400">완료</h3>
          <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {items.length}
          </span>
        </div>
      </div>
      
      {/* 완료 아이템 목록 */}
      <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-350px)]">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            아직 없음
          </div>
        ) : (
          items.map(item => (
            <div
              key={`${item.category}-${item.name}`}
              className="rounded-lg bg-green-500/10 border border-green-500/20 p-2"
            >
              <div className="flex items-center gap-2">
                {item.emoji && (
                  <span className="text-sm">
                    <DiscordText>{item.emoji}</DiscordText>
                  </span>
                )}
                <span className="text-sm truncate flex-1">
                  <DiscordText>{item.name}</DiscordText>
                </span>
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
              </div>
              <div className="text-xs text-green-400 mt-1">
                {item.quantity} / {item.required}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// 메인 컴포넌트
export default function Crafting() {
  const { category } = useParams()
  const { hasFeature } = useAuth()
  const queryClient = useQueryClient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  
  // 대시보드 데이터 조회
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['crafting', 'dashboard', category],
    queryFn: () => api.get(`/items/crafting/dashboard${category ? `?category=${category}` : ''}`).then(res => res.data),
  })
  
  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', 'crafting', 'categories'],
    queryFn: () => api.get('/items/crafting/categories').then(res => res.data),
  })
  
  // 이벤트 목록 조회 (마감일 표시용)
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(res => res.data),
  })
  
  // 수량 변경 뮤테이션
  const quantityMutation = useMutation({
    mutationFn: ({ item, delta }) => 
      api.patch(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}/quantity`, { delta }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crafting', 'dashboard'] })
    },
  })
  
  // 수량 직접 설정 뮤테이션
  const quantitySetMutation = useMutation({
    mutationFn: ({ item, value }) => 
      api.patch(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}/quantity/set`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crafting', 'dashboard'] })
    },
  })
  
  // 목표 수량 변경 뮤테이션 (재계산 포함)
  const requiredMutation = useMutation({
    mutationFn: ({ item, value }) => 
      api.patch(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}/required`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crafting', 'dashboard'] })
    },
  })
  
  // 전체 삭제 뮤테이션
  const deleteAllMutation = useMutation({
    mutationFn: () => api.delete(`/items/crafting/all${category ? `?category=${category}` : ''}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crafting'] })
      queryClient.invalidateQueries({ queryKey: ['items', 'crafting'] })
      setDeleteModalOpen(false)
    },
  })
  
  // 핸들러
  const handleQuantityChange = (item, delta) => {
    quantityMutation.mutate({ item, delta })
  }
  
  const handleQuantitySet = (item, value) => {
    quantitySetMutation.mutate({ item, value })
  }
  
  const handleRequiredChange = (item, value) => {
    requiredMutation.mutate({ item, value })
  }
  
  // 티어별 아이템 분류 및 필터링
  const { tier1Items, tier2Items, tier3Items, completedItems } = useMemo(() => {
    if (!dashboard) return { tier1Items: [], tier2Items: [], tier3Items: [], completedItems: [] }
    
    const filterBySearch = (items) => {
      if (!searchQuery) return items
      const query = searchQuery.toLowerCase()
      return items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      )
    }
    
    const allTier1 = filterBySearch(dashboard.tier1?.items || [])
    const allTier2 = filterBySearch(dashboard.tier2?.items || [])
    const allTier3 = filterBySearch(dashboard.tier3?.items || [])
    
    // 완료된 아이템 분리
    const completed = [
      ...allTier1.filter(i => i.quantity >= i.required),
      ...allTier2.filter(i => i.quantity >= i.required),
      ...allTier3.filter(i => i.quantity >= i.required),
    ]
    
    return {
      tier1Items: allTier1.filter(i => i.quantity < i.required),
      tier2Items: allTier2.filter(i => i.quantity < i.required),
      tier3Items: allTier3.filter(i => i.quantity < i.required),
      completedItems: completed,
    }
  }, [dashboard, searchQuery])
  
  // 전체 진행률 계산
  const overallProgress = dashboard?.overall?.progress || 0
  const totalItems = dashboard?.overall?.total || 0
  const completedCount = dashboard?.overall?.completed || 0
  
  // 연동된 이벤트 (마감일 표시용)
  const linkedEvents = dashboard?.linkedEvents || []
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="w-7 h-7 text-primary-500" />
            제작 계획
            {category && (
              <span className="text-primary-400 ml-2">
                <DiscordText>{category}</DiscordText>
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            티어별로 제작 진행 상황을 관리하세요
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {hasFeature('manage') && (
            <>
              <button
                onClick={() => setPlanModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                새 계획
              </button>
              {totalItems > 0 && (
                <button
                  onClick={() => setDeleteModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  전체 삭제
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* 카테고리 탭 */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <NavLink
            to="/crafting"
            end
            className={({ isActive }) => clsx(
              'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
              isActive 
                ? 'bg-primary-600 text-white' 
                : 'bg-white dark:bg-dark-400 hover:bg-light-200 dark:hover:bg-dark-300 text-gray-600 dark:text-gray-300 border border-light-300 dark:border-transparent'
            )}
          >
            전체
          </NavLink>
          {categories.map(cat => (
            <NavLink
              key={cat}
              to={`/crafting/${encodeURIComponent(cat)}`}
              className={({ isActive }) => clsx(
                'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                isActive 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-white dark:bg-dark-400 hover:bg-light-200 dark:hover:bg-dark-300 text-gray-600 dark:text-gray-300 border border-light-300 dark:border-transparent'
              )}
            >
              <DiscordText>{cat}</DiscordText>
            </NavLink>
          ))}
        </div>
      )}
      
      {/* 전체 진행 상황 */}
      {totalItems > 0 && (
        <div className="bg-white dark:bg-dark-400 rounded-xl p-4 border border-light-300 dark:border-dark-300 shadow-sm dark:shadow-none">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-primary-500 dark:text-primary-400">
                {overallProgress}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                완료 {completedCount} / {totalItems}
              </div>
            </div>
            
            {/* 연동된 이벤트 마감일 표시 */}
            {linkedEvents.length > 0 && (
              <div className="flex items-center gap-2">
                {linkedEvents.map(event => {
                  const dday = calculateDDay(event.endDate)
                  const isOverdue = dday?.startsWith('D+')
                  const isToday = dday === 'D-Day'
                  
                  return (
                    <div 
                      key={event._id}
                      className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm",
                        isOverdue ? "bg-red-500/20 text-red-400" :
                        isToday ? "bg-yellow-500/20 text-yellow-400" :
                        "bg-primary-500/20 text-primary-400"
                      )}
                    >
                      <Calendar className="w-4 h-4" />
                      <span className="font-medium">{event.title}</span>
                      <span className="font-bold">{dday}</span>
                      <span className="text-xs opacity-70">
                        (~{new Date(event.endDate).toLocaleDateString()})
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <ProgressBar current={completedCount} target={totalItems} />
        </div>
      )}
      
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="아이템 검색..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-400 rounded-lg border border-light-300 dark:border-dark-300 focus:border-primary-500 outline-none"
        />
      </div>
      
      {/* 칸반 보드 */}
      {totalItems > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TierColumn
            tier={1}
            items={tier1Items}
            onQuantityChange={handleQuantityChange}
            onQuantitySet={handleQuantitySet}
            onRequiredChange={handleRequiredChange}
          />
          <TierColumn
            tier={2}
            items={tier2Items}
            onQuantityChange={handleQuantityChange}
            onQuantitySet={handleQuantitySet}
            onRequiredChange={handleRequiredChange}
          />
          <TierColumn
            tier={3}
            items={tier3Items}
            onQuantityChange={handleQuantityChange}
            onQuantitySet={handleQuantitySet}
            onRequiredChange={handleRequiredChange}
          />
          <CompletedColumn items={completedItems} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg mb-2">제작 계획이 없습니다</p>
          <p className="text-sm mb-4">새 제작 계획을 생성해 시작하세요</p>
          {hasFeature('manage') && (
            <button
              onClick={() => setPlanModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              새 제작 계획 생성
            </button>
          )}
        </div>
      )}
      
      {/* 제작 계획 모달 */}
      <CraftingPlanModal
        isOpen={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        category={category}
      />
      
      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={() => deleteAllMutation.mutate()}
        title="제작 계획 삭제"
        message={`${category || '전체'} 카테고리의 모든 제작 아이템(${totalItems}개)을 삭제하시겠습니까?`}
        isLoading={deleteAllMutation.isPending}
      />
    </div>
  )
}
