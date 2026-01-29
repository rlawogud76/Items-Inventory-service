import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search, Plus, Trash2, Edit3, RotateCcw, Undo2, 
  ArrowUpDown, Filter, ChevronDown, ChevronRight,
  Package, CheckCircle2, AlertCircle, Minus, Users, X
} from 'lucide-react'
import clsx from 'clsx'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { ItemModal, DeleteConfirmModal, ResetConfirmModal } from '../components/ItemModals'
import { DiscordText } from '../utils/discordEmoji'
import { ProgressBar } from '../components/ProgressBar'
import { formatQuantity } from '../utils/formatting'

// 태그 색상 매핑
const getTagColor = (color) => {
  const colors = {
    red: { bg: 'bg-red-500/20 dark:bg-red-500/20', text: 'text-red-400', dot: 'bg-red-500' },
    orange: { bg: 'bg-orange-500/20 dark:bg-orange-500/20', text: 'text-orange-400', dot: 'bg-orange-500' },
    yellow: { bg: 'bg-yellow-500/20 dark:bg-yellow-500/20', text: 'text-yellow-400', dot: 'bg-yellow-500' },
    green: { bg: 'bg-green-500/20 dark:bg-green-500/20', text: 'text-green-400', dot: 'bg-green-500' },
    blue: { bg: 'bg-blue-500/20 dark:bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
    purple: { bg: 'bg-purple-500/20 dark:bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
    pink: { bg: 'bg-pink-500/20 dark:bg-pink-500/20', text: 'text-pink-400', dot: 'bg-pink-500' },
    default: { bg: 'bg-gray-500/20 dark:bg-gray-500/20', text: 'text-gray-400', dot: 'bg-gray-500' }
  }
  return colors[color] || colors.default
}

// 아이템 행 컴포넌트
const ItemRow = ({ 
  item, 
  itemTag,
  onQuantityChange, 
  onQuantitySet,
  onEdit, 
  onDelete,
  onWorkerJoin,
  onWorkerLeave,
  customPresets = [1, 10, 64, 100]
}) => {
  const { user } = useAuth()
  const [showPresets, setShowPresets] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  
  const isComplete = item.required > 0 && item.quantity >= item.required
  const progress = item.required > 0 ? Math.min((item.quantity / item.required) * 100, 100) : 0
  const tagColor = itemTag ? getTagColor(itemTag.color) : null
  
  // 현재 유저가 작업 중인지 확인
  const isUserWorking = item.workers?.some(w => w.userId === user?.id)
  const workersCount = item.workers?.length || 0
  
  // 프리셋 버튼들 (커스텀 프리셋)
  const presetButtons = useMemo(() => {
    const plusPresets = []
    const minusPresets = []
    
    // 커스텀 프리셋 (플러스/마이너스 분리)
    for (const p of customPresets) {
      plusPresets.push({ label: `+${p}`, delta: p })
      minusPresets.push({ label: `-${p}`, delta: -p })
    }
    
    return [...plusPresets, ...minusPresets]
  }, [customPresets])

  const handlePresetClick = (delta) => {
    onQuantityChange(item, delta)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    const newQty = parseInt(editValue, 10)
    if (!isNaN(newQty) && newQty >= 0) {
      onQuantitySet(item, newQty)
    }
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    setEditValue(item.quantity.toString())
    setIsEditing(true)
  }

  return (
    <div className={clsx(
      'bg-white dark:bg-dark-300 rounded-xl p-4 border-2 transition-all duration-200',
      isComplete 
        ? 'border-green-500/50 dark:border-green-500/30' 
        : 'border-gray-200 dark:border-dark-100 hover:border-primary-500/50'
    )}>
      {/* 헤더: 이름 + 태그 + 액션 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900 dark:text-white truncate">
              <DiscordText>{item.name}</DiscordText>
            </h3>
            {itemTag && (
              <span className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                tagColor.bg, tagColor.text
              )}>
                {itemTag.name}
              </span>
            )}
            {workersCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
                작업 중 {workersCount}명
              </span>
            )}
          </div>
          {item.type && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.type}</p>
          )}
          {/* 작업자 목록 */}
          {workersCount > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <Users size={12} className="text-blue-400" />
              {item.workers.map((w, idx) => (
                <span 
                  key={w.userId} 
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded"
                >
                  {w.userName}
                  {(w.userId === user?.id || user?.isAdmin) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onWorkerLeave(item, w.userId); }}
                      className="hover:text-red-400"
                    >
                      <X size={10} />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {user && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => isUserWorking ? onWorkerLeave(item, user.id) : onWorkerJoin(item)}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                isUserWorking 
                  ? 'bg-blue-500/20 text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-dark-200 text-gray-400'
              )}
              title={isUserWorking ? '작업 중단' : '작업 참여'}
            >
              <Package size={16} />
            </button>
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-lg text-gray-400 transition-colors"
              title="편집"
            >
              <Edit3 size={16} />
            </button>
            <button
              onClick={() => onDelete(item)}
              className="p-1.5 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400 transition-colors"
              title="삭제"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
      
      {/* 수량 정보 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <CheckCircle2 size={16} className="text-green-500" />
            ) : item.required > 0 ? (
              <AlertCircle size={16} className="text-yellow-500" />
            ) : null}
            
            {isEditing ? (
              <form onSubmit={handleEditSubmit} className="flex items-center gap-1">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-20 px-2 py-1 text-sm bg-gray-100 dark:bg-dark-200 border border-gray-300 dark:border-dark-100 rounded focus:outline-none focus:border-primary-500"
                  autoFocus
                  min="0"
                />
                <button type="submit" className="px-2 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700">
                  확인
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-1 text-xs bg-gray-200 dark:bg-dark-200 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-dark-100"
                >
                  취소
                </button>
              </form>
            ) : (
              <button 
                onClick={handleStartEdit}
                className="font-bold text-lg text-gray-900 dark:text-white hover:text-primary-500 transition-colors"
                title="클릭하여 직접 입력"
              >
                {formatQuantity(item.quantity)}
              </button>
            )}
            
            {item.required > 0 && !isEditing && (
              <span className="text-gray-500 dark:text-gray-400">
                / {formatQuantity(item.required)}
              </span>
            )}
          </div>
          
          {item.required > 0 && (
            <span className={clsx(
              'text-sm font-medium',
              isComplete ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'
            )}>
              {progress.toFixed(0)}%
            </span>
          )}
        </div>
        
        {item.required > 0 && (
          <ProgressBar current={item.quantity} target={item.required} />
        )}
      </div>
      
      {/* 수량 조절 버튼들 */}
      {user && (
        <div className="flex flex-wrap gap-2">
          {/* 빠른 버튼 */}
          <button
            onClick={() => onQuantityChange(item, -1)}
            className="flex items-center justify-center w-8 h-8 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={() => onQuantityChange(item, 1)}
            className="flex items-center justify-center w-8 h-8 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors"
          >
            <Plus size={16} />
          </button>
          
          {/* 프리셋 토글 */}
          <button
            onClick={() => setShowPresets(!showPresets)}
            className={clsx(
              'px-3 h-8 text-sm rounded-lg transition-colors',
              showPresets 
                ? 'bg-primary-600 text-white' 
                : 'bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-100'
            )}
          >
            더보기
          </button>
          
          {/* 프리셋 버튼들 */}
          {showPresets && (
            <div className="flex flex-wrap gap-1 w-full mt-1">
              {presetButtons.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePresetClick(preset.delta)}
                  className={clsx(
                    'px-3 py-1.5 text-sm rounded-lg transition-colors',
                    preset.delta > 0 
                      ? 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                      : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 카테고리 섹션 컴포넌트 (모던 익스팬더)
const CategorySection = ({ 
  category, 
  emoji,
  items, 
  isExpanded, 
  onToggle,
  itemTag,
  getItemTagInfo,
  onQuantityChange,
  onQuantitySet,
  onEdit,
  onDelete,
  onWorkerJoin,
  onWorkerLeave,
  onReset,
  user,
  customPresets
}) => {
  // 카테고리 통계 계산
  const stats = useMemo(() => {
    const total = items.length
    const completed = items.filter(item => item.required > 0 && item.quantity >= item.required).length
    const totalProgress = items.reduce((acc, item) => {
      if (item.required > 0) {
        return acc + Math.min((item.quantity / item.required) * 100, 100)
      }
      return acc + 100
    }, 0)
    const avgProgress = total > 0 ? totalProgress / total : 0
    
    return { total, completed, avgProgress }
  }, [items])

  return (
    <div className={clsx(
      'rounded-2xl border-2 overflow-hidden transition-all duration-300',
      isExpanded 
        ? 'border-primary-500/50 dark:border-primary-500/30 shadow-lg shadow-primary-500/10' 
        : 'border-gray-200 dark:border-dark-100 hover:border-gray-300 dark:hover:border-dark-50'
    )}>
      {/* 카테고리 헤더 - 클릭 가능 */}
      <button
        onClick={onToggle}
        className={clsx(
          'w-full px-6 py-5 flex items-center justify-between transition-colors',
          isExpanded 
            ? 'bg-primary-500/10 dark:bg-primary-500/10' 
            : 'bg-gray-50 dark:bg-dark-300 hover:bg-gray-100 dark:hover:bg-dark-200'
        )}
      >
        <div className="flex items-center gap-4">
          {/* 이모지 */}
          <span className="text-3xl">
            {emoji ? <DiscordText>{emoji}</DiscordText> : ''}
          </span>
          
          {/* 카테고리명 */}
          <div className="text-left">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              <DiscordText>{category}</DiscordText>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {stats.completed}/{stats.total} 완료  평균 {stats.avgProgress.toFixed(0)}% 진행
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* 미니 진행률 바 */}
          <div className="hidden sm:block w-32">
            <ProgressBar current={stats.avgProgress} target={100} />
          </div>
          
          {/* 아이템 수 배지 */}
          <span className={clsx(
            'px-3 py-1 rounded-full text-sm font-semibold',
            stats.completed === stats.total && stats.total > 0
              ? 'bg-green-500/20 text-green-500'
              : 'bg-gray-200 dark:bg-dark-200 text-gray-600 dark:text-gray-300'
          )}>
            {stats.total}개
          </span>
          
          {/* 화살표 */}
          <div className={clsx(
            'transition-transform duration-300',
            isExpanded ? 'rotate-180' : ''
          )}>
            <ChevronDown size={24} className="text-gray-400" />
          </div>
        </div>
      </button>
      
      {/* 아이템 목록 - 애니메이션 적용 */}
      <div className={clsx(
        'transition-all duration-300 ease-in-out overflow-hidden',
        isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
      )}>
        <div className="p-4 bg-white dark:bg-dark-400">
          {/* 카테고리 액션 버튼 */}
          {user && (
            <div className="flex justify-end mb-4">
              <button
                onClick={(e) => { e.stopPropagation(); onReset(category); }}
                className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg transition-colors text-sm"
              >
                <RotateCcw size={16} />
                이 카테고리 초기화
              </button>
            </div>
          )}
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {items.map((item) => (
              <ItemRow
                key={`${item.category}-${item.name}`}
                item={item}
                itemTag={getItemTagInfo(item.name)}
                onQuantityChange={onQuantityChange}
                onQuantitySet={onQuantitySet}
                onEdit={onEdit}
                onDelete={onDelete}
                onWorkerJoin={onWorkerJoin}
                onWorkerLeave={onWorkerLeave}
                customPresets={customPresets}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// 메인 인벤토리 컴포넌트
const Inventory = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('default')
  const [filterTag, setFilterTag] = useState('')
  const [expandedCategories, setExpandedCategories] = useState({})
  const [undoStack, setUndoStack] = useState([])
  const [showUndo, setShowUndo] = useState(false)
  
  // 모달 상태
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetCategory, setResetCategory] = useState(null)
  
  // 데이터 쿼리
  const { data: categories = [] } = useQuery({
    queryKey: ['items', 'inventory', 'categories'],
    queryFn: async () => {
      const res = await api.get('/items/inventory/categories')
      return res.data
    }
  })
  
  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['items', 'inventory', 'all'],
    queryFn: async () => {
      const res = await api.get('/items/inventory')
      return res.data
    }
  })
  
  const { data: tags = [] } = useQuery({
    queryKey: ['tags', 'inventory'],
    queryFn: async () => {
      const res = await api.get('/tags/inventory')
      return res.data
    }
  })
  
  const { data: categoryEmojis = {} } = useQuery({
    queryKey: ['settings', 'category-emojis'],
    queryFn: async () => {
      const res = await api.get('/settings/category-emojis')
      return res.data.inventory || {}
    }
  })
  
  const { data: quantityPresetsData } = useQuery({
    queryKey: ['settings', 'quantity-presets'],
    queryFn: async () => {
      const res = await api.get('/settings/quantity-presets')
      return res.data
    }
  })
  
  const customPresets = quantityPresetsData?.presets || [1, 10, 64, 100]
  
  // 초기 확장 상태 설정 (첫 번째 카테고리만)
  useEffect(() => {
    if (categories.length > 0 && Object.keys(expandedCategories).length === 0) {
      setExpandedCategories({ [categories[0]]: true })
    }
  }, [categories])
  
  // 태그 정보 찾기
  const getItemTag = (itemName) => {
    for (const tag of tags) {
      if (tag.items?.includes(itemName)) {
        return tag.name
      }
    }
    return null
  }
  
  const getItemTagInfo = (itemName) => {
    for (const tag of tags) {
      if (tag.items?.includes(itemName)) {
        return tag
      }
    }
    return null
  }
  
  // 카테고리 토글
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }))
  }
  
  // 뮤테이션
  const quantityMutation = useMutation({
    mutationFn: async ({ item, delta }) => {
      const res = await api.patch(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}/quantity`, { delta })
      return res.data
    },
    onMutate: async ({ item, delta }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory'] })
      
      const previousItems = queryClient.getQueryData(['items', 'inventory', 'all'])
      
      queryClient.setQueryData(['items', 'inventory', 'all'], old => 
        old?.map(i => i._id === item._id 
          ? { ...i, quantity: Math.max(0, i.quantity + delta) }
          : i
        )
      )
      
      // Undo 스택에 추가
      setUndoStack(prev => [{
        type: 'quantity',
        item,
        oldQuantity: item.quantity,
        description: `${item.name} 수량 변경 (${delta > 0 ? '+' : ''}${delta})`
      }, ...prev.slice(0, 4)])
      setShowUndo(true)
      
      return { previousItems }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['items', 'inventory', 'all'], context.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    }
  })
  
  const quantitySetMutation = useMutation({
    mutationFn: async ({ item, quantity }) => {
      const res = await api.patch(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}/quantity/set`, { value: quantity })
      return res.data
    },
    onMutate: async ({ item, quantity }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory'] })
      
      const previousItems = queryClient.getQueryData(['items', 'inventory', 'all'])
      
      queryClient.setQueryData(['items', 'inventory', 'all'], old => 
        old?.map(i => i._id === item._id 
          ? { ...i, quantity }
          : i
        )
      )
      
      setUndoStack(prev => [{
        type: 'quantity',
        item,
        oldQuantity: item.quantity,
        description: `${item.name} 수량 설정 (${item.quantity}  ${quantity})`
      }, ...prev.slice(0, 4)])
      setShowUndo(true)
      
      return { previousItems }
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(['items', 'inventory', 'all'], context.previousItems)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    }
  })
  
  const deleteMutation = useMutation({
    mutationFn: async (item) => {
      await api.delete(`/items/${item.type}/${encodeURIComponent(item.category)}/${encodeURIComponent(item.name)}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
      setDeleteModalOpen(false)
      setDeletingItem(null)
    }
  })
  
  const resetMutation = useMutation({
    mutationFn: async (category) => {
      await api.post(`/items/inventory/${encodeURIComponent(category)}/reset`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
      setResetModalOpen(false)
      setResetCategory(null)
    }
  })
  
  const workerJoinMutation = useMutation({
    mutationFn: async (item) => {
      const res = await api.post(`/items/${item.type}/${item.category}/${item.name}/workers`)
      return res.data
    },
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory'] })
      
      queryClient.setQueryData(['items', 'inventory', 'all'], old => 
        old?.map(i => i._id === item._id 
          ? { 
              ...i, 
              workers: [...(i.workers || []), { 
                userId: user.id, 
                userName: user.username,
                startedAt: new Date() 
              }] 
            }
          : i
        )
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    }
  })
  
  const workerLeaveMutation = useMutation({
    mutationFn: async ({ item, userId }) => {
      const res = await api.delete(`/items/${item.type}/${item.category}/${item.name}/workers/${userId}`)
      return res.data
    },
    onMutate: async ({ item, userId }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory'] })
      
      queryClient.setQueryData(['items', 'inventory', 'all'], old => 
        old?.map(i => i._id === item._id 
          ? { ...i, workers: (i.workers || []).filter(w => w.userId !== userId) }
          : i
        )
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    }
  })
  
  // 핸들러들
  const handleQuantityChange = (item, delta) => {
    quantityMutation.mutate({ item, delta })
  }
  
  const handleQuantitySet = (item, quantity) => {
    quantitySetMutation.mutate({ item, quantity })
  }
  
  const handleAddItem = () => {
    setEditingItem(null)
    setItemModalOpen(true)
  }
  
  const handleEditItem = (item) => {
    setEditingItem(item)
    setItemModalOpen(true)
  }
  
  const handleDeleteItem = (item) => {
    setDeletingItem(item)
    setDeleteModalOpen(true)
  }
  
  const handleConfirmDelete = () => {
    if (deletingItem) {
      deleteMutation.mutate(deletingItem)
    }
  }
  
  const handleWorkerJoin = (item) => {
    workerJoinMutation.mutate(item)
  }
  
  const handleWorkerLeave = (item, userId) => {
    workerLeaveMutation.mutate({ item, userId })
  }
  
  const handleResetCategory = (category) => {
    setResetCategory(category)
    setResetModalOpen(true)
  }
  
  const handleReset = () => {
    if (resetCategory) {
      resetMutation.mutate(resetCategory)
    }
  }
  
  const handleUndo = () => {
    if (undoStack.length === 0) return
    
    const lastAction = undoStack[0]
    if (lastAction.type === 'quantity') {
      quantitySetMutation.mutate({ 
        item: lastAction.item, 
        quantity: lastAction.oldQuantity 
      })
    }
    
    setUndoStack(prev => prev.slice(1))
    if (undoStack.length <= 1) {
      setShowUndo(false)
    }
  }
  
  // Undo 타이머
  useEffect(() => {
    if (showUndo) {
      const timer = setTimeout(() => {
        setShowUndo(false)
        setUndoStack([])
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [showUndo, undoStack])
  
  // 정렬 함수
  const sortItems = (itemList) => {
    const sorted = [...itemList]
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        break
      case 'type':
        sorted.sort((a, b) => (a.type || '').localeCompare(b.type || '', 'ko'))
        break
      case 'tag':
        sorted.sort((a, b) => {
          const tagA = getItemTag(a.name) || 'zzz'
          const tagB = getItemTag(b.name) || 'zzz'
          return tagA.localeCompare(tagB, 'ko')
        })
        break
      case 'quantity':
        sorted.sort((a, b) => b.quantity - a.quantity)
        break
      case 'progress':
        sorted.sort((a, b) => {
          const progressA = a.required > 0 ? a.quantity / a.required : 1
          const progressB = b.required > 0 ? b.quantity / b.required : 1
          return progressA - progressB
        })
        break
      default:
        sorted.sort((a, b) => (a.order || 0) - (b.order || 0))
    }
    
    return sorted
  }
  
  // 필터링된 아이템
  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesTag = !filterTag || getItemTag(item.name) === filterTag
      return matchesSearch && matchesTag
    })
  }, [allItems, searchQuery, filterTag, tags])
  
  // 카테고리별 그룹핑 + 정렬
  const groupedItems = useMemo(() => {
    const grouped = {}
    
    for (const item of filteredItems) {
      if (!grouped[item.category]) {
        grouped[item.category] = []
      }
      grouped[item.category].push(item)
    }
    
    // 각 카테고리 내 아이템 정렬
    for (const cat of Object.keys(grouped)) {
      grouped[cat] = sortItems(grouped[cat])
    }
    
    return grouped
  }, [filteredItems, sortBy])
  
  // 카테고리 정렬 (첫 번째 아이템의 order 기준)
  const sortedCategories = useMemo(() => {
    return Object.keys(groupedItems).sort((a, b) => {
      const orderA = groupedItems[a][0]?.order || 0
      const orderB = groupedItems[b][0]?.order || 0
      return orderA - orderB
    })
  }, [groupedItems])

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">재고 관리</h1>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* 추가 버튼 */}
          {user && (
            <button
              onClick={handleAddItem}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium"
            >
              <Plus size={20} />
              <span>아이템 추가</span>
            </button>
          )}
          
          {/* 검색 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="아이템 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-xl focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
            />
          </div>
          
          {/* 정렬 */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-xl focus:outline-none focus:border-primary-500 cursor-pointer text-gray-900 dark:text-white"
            >
              <option value="default">기본순</option>
              <option value="name">가나다순</option>
              <option value="type">타입순</option>
              <option value="tag">태그순</option>
              <option value="quantity">수량순</option>
              <option value="progress">진행률순</option>
            </select>
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>

          {/* 태그 필터 */}
          {tags.length > 0 && (
            <div className="relative">
              <select
                value={filterTag}
                onChange={(e) => setFilterTag(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2.5 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-xl focus:outline-none focus:border-primary-500 cursor-pointer text-gray-900 dark:text-white"
              >
                <option value="">모든 태그</option>
                {tags.map((tag) => (
                  <option key={tag.name} value={tag.name}>{tag.name}</option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
            </div>
          )}
        </div>
      </div>

      {/* 카테고리 섹션들 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : sortedCategories.length > 0 ? (
        <div className="space-y-4">
          {sortedCategories.map((cat) => (
            <CategorySection
              key={cat}
              category={cat}
              emoji={categoryEmojis[cat]}
              items={groupedItems[cat]}
              isExpanded={expandedCategories[cat] || false}
              onToggle={() => toggleCategory(cat)}
              getItemTagInfo={getItemTagInfo}
              onQuantityChange={handleQuantityChange}
              onQuantitySet={handleQuantitySet}
              onEdit={handleEditItem}
              onDelete={handleDeleteItem}
              onWorkerJoin={handleWorkerJoin}
              onWorkerLeave={handleWorkerLeave}
              onReset={handleResetCategory}
              user={user}
              customPresets={customPresets}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-gray-500 dark:text-gray-400">
          {searchQuery || filterTag ? '검색 결과가 없습니다.' : '아이템이 없습니다.'}
        </div>
      )}

      {/* 모달들 */}
      <ItemModal
        isOpen={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingItem(null); }}
        type="inventory"
        categories={categories}
        item={editingItem}
      />
      
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeletingItem(null); }}
        onConfirm={handleConfirmDelete}
        itemName={deletingItem?.name}
        isPending={deleteMutation.isPending}
      />
      
      <ResetConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleReset}
        categoryName={resetCategory}
        itemCount={resetCategory ? groupedItems[resetCategory]?.length || 0 : 0}
        isPending={resetMutation.isPending}
      />
      
      {/* 되돌리기 토스트 */}
      {showUndo && undoStack.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-5 py-3.5 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-xl shadow-xl">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {undoStack[0].description}
            </span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Undo2 size={14} />
              되돌리기
            </button>
            <button
              onClick={() => { setShowUndo(false); setUndoStack([]); }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded text-gray-400"
            >
              
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
