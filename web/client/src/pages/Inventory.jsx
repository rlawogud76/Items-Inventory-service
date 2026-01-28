import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, NavLink } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { 
  Plus, 
  Minus, 
  Edit, 
  Trash2, 
  FolderOpen,
  ChevronRight,
  Search,
  RotateCcw,
  Undo2
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'
import { ItemModal, DeleteConfirmModal, ResetConfirmModal } from '../components/ItemModals'
import clsx from 'clsx'

function ProgressBar({ current, target }) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  let color = 'bg-red-500'
  if (percentage >= 100) color = 'bg-green-500'
  else if (percentage >= 50) color = 'bg-yellow-500'
  
  return (
    <div className="w-full bg-dark-200 rounded-full h-2">
      <div
        className={`${color} h-2 rounded-full transition-all duration-300`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}

function formatQuantity(quantity) {
  const ITEMS_PER_SET = 64
  const ITEMS_PER_BOX = 64 * 54

  if (quantity >= ITEMS_PER_BOX) {
    const boxes = Math.floor(quantity / ITEMS_PER_BOX)
    const remaining = quantity % ITEMS_PER_BOX
    const sets = Math.floor(remaining / ITEMS_PER_SET)
    const items = remaining % ITEMS_PER_SET
    
    let result = `${boxes}상자`
    if (sets > 0) result += ` ${sets}세트`
    if (items > 0) result += ` ${items}개`
    return result
  } else if (quantity >= ITEMS_PER_SET) {
    const sets = Math.floor(quantity / ITEMS_PER_SET)
    const items = quantity % ITEMS_PER_SET
    return items > 0 ? `${sets}세트 ${items}개` : `${sets}세트`
  }
  return `${quantity}개`
}

// 상수 정의
const ITEMS_PER_SET = 64
const ITEMS_PER_BOX = 64 * 54 // 3456

// 단위별 수량을 총 개수로 변환
function convertToTotal(boxes, sets, items) {
  return (boxes * ITEMS_PER_BOX) + (sets * ITEMS_PER_SET) + items
}

// 총 개수를 단위별로 분해
function decomposeQuantity(total) {
  const boxes = Math.floor(total / ITEMS_PER_BOX)
  const remaining = total % ITEMS_PER_BOX
  const sets = Math.floor(remaining / ITEMS_PER_SET)
  const items = remaining % ITEMS_PER_SET
  return { boxes, sets, items }
}

function ItemRow({ item, type, onQuantityChange, onQuantitySet, onEdit, onDelete, onWorkerToggle }) {
  const { user } = useAuth()
  const [editMode, setEditMode] = useState(null) // null, 'delta', 'set'
  
  // 단위별 입력값
  const [deltaUnits, setDeltaUnits] = useState({ boxes: 0, sets: 0, items: 0 })
  const [setUnits, setSetUnits] = useState({ boxes: 0, sets: 0, items: 0 })
  const [isAdding, setIsAdding] = useState(true) // 증감 모드에서 추가/차감
  
  const [showPresets, setShowPresets] = useState(false)

  // 프리셋 수량 정의
  const PRESETS = [
    { label: '+1', value: 1, color: 'text-green-400' },
    { label: '+32 (반세트)', value: 32, color: 'text-green-400' },
    { label: '+64 (1세트)', value: 64, color: 'text-green-400' },
    { label: '+1728 (반상자)', value: 1728, color: 'text-green-400' },
    { label: '+3456 (1상자)', value: 3456, color: 'text-green-400' },
    { label: '-1', value: -1, color: 'text-red-400' },
    { label: '-32 (반세트)', value: -32, color: 'text-red-400' },
    { label: '-64 (1세트)', value: -64, color: 'text-red-400' },
    { label: '-1728 (반상자)', value: -1728, color: 'text-red-400' },
    { label: '-3456 (1상자)', value: -3456, color: 'text-red-400' },
  ]

  // 증감 모드 제출
  const handleDeltaSubmit = (e) => {
    e.preventDefault()
    const total = convertToTotal(
      parseInt(deltaUnits.boxes) || 0,
      parseInt(deltaUnits.sets) || 0,
      parseInt(deltaUnits.items) || 0
    )
    if (total > 0) {
      onQuantityChange(item, isAdding ? total : -total)
    }
    setEditMode(null)
    setDeltaUnits({ boxes: 0, sets: 0, items: 0 })
  }

  // 직접 설정 모드 제출
  const handleSetSubmit = (e) => {
    e.preventDefault()
    const total = convertToTotal(
      parseInt(setUnits.boxes) || 0,
      parseInt(setUnits.sets) || 0,
      parseInt(setUnits.items) || 0
    )
    if (total >= 0) {
      onQuantitySet(item, total)
    }
    setEditMode(null)
    setSetUnits({ boxes: 0, sets: 0, items: 0 })
  }

  // 직접 설정 모드 시작 시 현재 수량으로 초기화
  const startSetMode = () => {
    const decomposed = decomposeQuantity(item.quantity)
    setSetUnits(decomposed)
    setEditMode('set')
  }

  // 증감 모드 시작
  const startDeltaMode = (adding = true) => {
    setIsAdding(adding)
    setDeltaUnits({ boxes: 0, sets: 0, items: 0 })
    setEditMode('delta')
  }

  const handlePresetClick = (value) => {
    onQuantityChange(item, value)
  }

  const percentage = item.required > 0 
    ? Math.min((item.quantity / item.required) * 100, 100) 
    : 0

  return (
    <div className="bg-dark-200 rounded-lg overflow-hidden hover:bg-dark-100/50 transition-colors group">
      {/* 메인 카드 영역 */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <DiscordText className="text-lg">{item.emoji || '📦'}</DiscordText>
            <DiscordText className="font-medium">{item.name}</DiscordText>
            {item.itemType === 'intermediate' && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded whitespace-nowrap">중간재</span>
            )}
            {/* 작업자 상태 */}
            {item.worker?.userId ? (
              <button
                onClick={() => user && (user.id === item.worker.userId || user.isAdmin) && onWorkerToggle(item, 'stop')}
                className={`text-xs px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                  user && (user.id === item.worker.userId || user.isAdmin)
                    ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer'
                    : 'bg-orange-500/20 text-orange-400 cursor-default'
                }`}
                title={user && (user.id === item.worker.userId || user.isAdmin) ? '클릭하여 작업 중단' : ''}
              >
                {item.worker.userName} 작업중
              </button>
            ) : user && (
              <button
                onClick={() => onWorkerToggle(item, 'start')}
                className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
              >
                작업 시작
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* 수정/삭제 버튼 */}
            {user && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(item)}
                  className="p-1 hover:bg-dark-300 rounded text-blue-400"
                  title="수정"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => onDelete(item)}
                  className="p-1 hover:bg-dark-300 rounded text-red-400"
                  title="삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
            <span className={clsx(
              'text-sm',
              percentage >= 100 ? 'text-green-400' : '',
              percentage >= 50 && percentage < 100 ? 'text-yellow-400' : '',
              percentage < 50 ? 'text-red-400' : ''
            )}>
              {percentage.toFixed(0)}%
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-sm">
            {/* 수량 클릭 시 직접 설정 모드 */}
            {user && editMode === null ? (
              <button
                onClick={startSetMode}
                className="hover:bg-dark-300 px-1.5 py-0.5 rounded transition-colors cursor-pointer group/qty"
                title="클릭하여 수량 직접 설정"
              >
                <span className="text-gray-300 group-hover/qty:text-blue-400">{formatQuantity(item.quantity)}</span>
                <span className="text-gray-500"> / </span>
                <span className="text-gray-400">{formatQuantity(item.required)}</span>
              </button>
            ) : (
              <>
                <span className="text-gray-300">{formatQuantity(item.quantity)}</span>
                <span className="text-gray-500"> / </span>
                <span className="text-gray-400">{formatQuantity(item.required)}</span>
              </>
            )}
          </div>

          {/* 수량 조절 버튼 - editMode가 null일 때만 표시 */}
          {user && editMode === null && (
            <div className="flex items-center gap-1 relative">
              {/* 빠른 조절 버튼 */}
              <button
                onClick={() => onQuantityChange(item, -1)}
                className="p-1 hover:bg-dark-300 rounded text-red-400"
                title="-1"
              >
                <Minus size={16} />
              </button>
              <button
                onClick={() => onQuantityChange(item, 1)}
                className="p-1 hover:bg-dark-300 rounded text-green-400"
                title="+1"
              >
                <Plus size={16} />
              </button>
              
              {/* 프리셋 버튼 */}
              <div className="relative">
                <button
                  onClick={() => setShowPresets(!showPresets)}
                  className="px-2 py-1 hover:bg-dark-300 rounded text-gray-400 text-xs font-medium"
                  title="프리셋 수량"
                >
                  ±세트
                </button>
                
                {showPresets && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowPresets(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 bg-dark-300 border border-dark-100 rounded-lg shadow-lg z-50 min-w-[160px]">
                      <div className="p-1">
                        <div className="text-xs text-gray-500 px-2 py-1">추가</div>
                        {PRESETS.filter(p => p.value > 0).map(preset => (
                          <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm whitespace-nowrap ${preset.color}`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <div className="border-t border-dark-100 my-1" />
                        <div className="text-xs text-gray-500 px-2 py-1">차감</div>
                        {PRESETS.filter(p => p.value < 0).map(preset => (
                          <button
                            key={preset.value}
                            onClick={() => handlePresetClick(preset.value)}
                            className={`w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm whitespace-nowrap ${preset.color}`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <div className="border-t border-dark-100 my-1" />
                        <div className="text-xs text-gray-500 px-2 py-1">직접 입력</div>
                        <button
                          onClick={() => { startDeltaMode(true); setShowPresets(false); }}
                          className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-green-400 whitespace-nowrap"
                        >
                          ➕ 추가
                        </button>
                        <button
                          onClick={() => { startDeltaMode(false); setShowPresets(false); }}
                          className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-red-400 whitespace-nowrap"
                        >
                          ➖ 차감
                        </button>
                        <button
                          onClick={() => { startSetMode(); setShowPresets(false); }}
                          className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-blue-400 whitespace-nowrap"
                        >
                          📝 직접 설정
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* 직접 수량 설정 버튼 */}
              <button
                onClick={startSetMode}
                className="px-1.5 py-0.5 hover:bg-blue-600/20 rounded text-blue-400 text-xs font-medium border border-blue-500/30"
                title="수량 직접 설정"
              >
                설정
              </button>
            </div>
          )}
        </div>

        <ProgressBar current={item.quantity} target={item.required} />
      </div>

      {/* 인라인 확장 편집 영역 */}
      {editMode && (
        <div className="border-t border-dark-100 bg-dark-300/50 p-4">
          <form onSubmit={editMode === 'delta' ? handleDeltaSubmit : handleSetSubmit}>
            {/* 모드 표시 */}
            <div className="flex items-center justify-between mb-3">
              <span className={clsx(
                'text-sm font-medium',
                editMode === 'set' ? 'text-blue-400' :
                isAdding ? 'text-green-400' : 'text-red-400'
              )}>
                {editMode === 'set' ? '📝 수량 직접 설정' :
                 isAdding ? '➕ 수량 추가' : '➖ 수량 차감'}
              </span>
              {editMode === 'delta' && (
                <button
                  type="button"
                  onClick={() => setIsAdding(!isAdding)}
                  className={clsx(
                    'text-xs px-2 py-1 rounded',
                    isAdding ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                  )}
                >
                  {isAdding ? '차감으로 전환' : '추가로 전환'}
                </button>
              )}
            </div>

            {/* 입력 필드 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">상자</label>
                <input
                  type="number"
                  value={editMode === 'delta' ? (deltaUnits.boxes || '') : (setUnits.boxes || '')}
                  onChange={(e) => editMode === 'delta' 
                    ? setDeltaUnits({...deltaUnits, boxes: e.target.value})
                    : setSetUnits({...setUnits, boxes: e.target.value})
                  }
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 bg-dark-400 border border-dark-100 rounded-lg text-center text-lg focus:border-primary-500 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">세트</label>
                <input
                  type="number"
                  value={editMode === 'delta' ? (deltaUnits.sets || '') : (setUnits.sets || '')}
                  onChange={(e) => editMode === 'delta'
                    ? setDeltaUnits({...deltaUnits, sets: e.target.value})
                    : setSetUnits({...setUnits, sets: e.target.value})
                  }
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 bg-dark-400 border border-dark-100 rounded-lg text-center text-lg focus:border-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">개</label>
                <input
                  type="number"
                  value={editMode === 'delta' ? (deltaUnits.items || '') : (setUnits.items || '')}
                  onChange={(e) => editMode === 'delta'
                    ? setDeltaUnits({...deltaUnits, items: e.target.value})
                    : setSetUnits({...setUnits, items: e.target.value})
                  }
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 bg-dark-400 border border-dark-100 rounded-lg text-center text-lg focus:border-primary-500 focus:outline-none"
                />
              </div>
            </div>

            {/* 현재 → 변경 후 미리보기 */}
            <div className="text-sm text-gray-400 mb-4 text-center">
              {editMode === 'set' ? (
                <>
                  <span className="text-gray-500">{formatQuantity(item.quantity)}</span>
                  <span className="text-blue-400 mx-2">→</span>
                  <span className="text-white">{formatQuantity(convertToTotal(
                    parseInt(setUnits.boxes) || 0,
                    parseInt(setUnits.sets) || 0,
                    parseInt(setUnits.items) || 0
                  ))}</span>
                </>
              ) : (
                <>
                  <span className="text-gray-500">{formatQuantity(item.quantity)}</span>
                  <span className={isAdding ? 'text-green-400' : 'text-red-400'}> {isAdding ? '+' : '-'} </span>
                  <span className="text-white">{formatQuantity(convertToTotal(
                    parseInt(deltaUnits.boxes) || 0,
                    parseInt(deltaUnits.sets) || 0,
                    parseInt(deltaUnits.items) || 0
                  ))}</span>
                  <span className="text-gray-500 mx-2">=</span>
                  <span className="text-white">{formatQuantity(Math.max(0, item.quantity + (isAdding ? 1 : -1) * convertToTotal(
                    parseInt(deltaUnits.boxes) || 0,
                    parseInt(deltaUnits.sets) || 0,
                    parseInt(deltaUnits.items) || 0
                  )))}</span>
                </>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditMode(null)}
                className="flex-1 px-4 py-2 bg-dark-100 hover:bg-dark-200 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                className={clsx(
                  'flex-1 px-4 py-2 rounded-lg transition-colors font-medium',
                  editMode === 'set' ? 'bg-blue-600 hover:bg-blue-700' :
                  isAdding ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                )}
              >
                {editMode === 'set' ? '설정' : isAdding ? '추가' : '차감'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function Inventory() {
  const { category } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  
  // 되돌리기 기능
  const [undoStack, setUndoStack] = useState([]) // { item, prevValue, newValue, type: 'delta' | 'set' }
  const [showUndo, setShowUndo] = useState(false)
  
  // 되돌리기 토스트 타이머
  useEffect(() => {
    if (undoStack.length > 0) {
      setShowUndo(true)
      const timer = setTimeout(() => {
        setShowUndo(false)
        setUndoStack([])
      }, 5000) // 5초 후 사라짐
      return () => clearTimeout(timer)
    }
  }, [undoStack])
  
  // 모달 상태
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', 'inventory', 'categories'],
    queryFn: () => api.get('/items/inventory/categories').then(res => res.data),
  })

  // 선택된 카테고리의 아이템 조회
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', 'inventory', category],
    queryFn: () => api.get(`/items/inventory${category ? `?category=${category}` : ''}`).then(res => res.data),
    enabled: true,
  })

  // 수량 변경 뮤테이션 (Optimistic Update)
  const quantityMutation = useMutation({
    mutationFn: ({ item, delta }) => 
      api.patch(`/items/${item.type}/${item.category}/${item.name}/quantity`, { delta }),
    onMutate: async ({ item, delta }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory', category] })
      
      // 이전 데이터 스냅샷
      const previousItems = queryClient.getQueryData(['items', 'inventory', category])
      
      // 낙관적 업데이트 - 즉시 UI 반영
      queryClient.setQueryData(['items', 'inventory', category], (old) => {
        if (!old) return old
        return old.map(i => 
          i.name === item.name && i.category === item.category
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
      })
      
      return { previousItems }
    },
    onError: (err, variables, context) => {
      // 에러 시 롤백
      if (context?.previousItems) {
        queryClient.setQueryData(['items', 'inventory', category], context.previousItems)
      }
    },
    onSettled: () => {
      // 완료 후 리페치 (서버와 동기화)
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    },
  })

  // 수량 직접 설정 뮤테이션 (Optimistic Update)
  const quantitySetMutation = useMutation({
    mutationFn: ({ item, value }) => 
      api.patch(`/items/${item.type}/${item.category}/${item.name}/quantity/set`, { value }),
    onMutate: async ({ item, value }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory', category] })
      const previousItems = queryClient.getQueryData(['items', 'inventory', category])
      
      queryClient.setQueryData(['items', 'inventory', category], (old) => {
        if (!old) return old
        return old.map(i => 
          i.name === item.name && i.category === item.category
            ? { ...i, quantity: Math.max(0, value) }
            : i
        )
      })
      
      return { previousItems }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', 'inventory', category], context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    },
  })

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (item) => api.delete(`/items/inventory/${item.category}/${item.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setDeleteModalOpen(false)
      setDeletingItem(null)
    },
  })

  // 초기화 뮤테이션
  const resetMutation = useMutation({
    mutationFn: (cat) => api.post(`/items/inventory/${cat}/reset`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setResetModalOpen(false)
    },
  })

  // 작업자 토글 뮤테이션
  const workerMutation = useMutation({
    mutationFn: ({ item, action }) => 
      api.patch(`/items/${item.type}/${item.category}/${item.name}/worker`, { action }),
    onMutate: async ({ item, action }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'inventory', category] })
      const previousItems = queryClient.getQueryData(['items', 'inventory', category])
      
      queryClient.setQueryData(['items', 'inventory', category], (old) => {
        if (!old) return old
        return old.map(i => 
          i.name === item.name && i.category === item.category
            ? { 
                ...i, 
                worker: action === 'start' 
                  ? { userId: user.id, userName: user.username, startTime: new Date() }
                  : null 
              }
            : i
        )
      })
      
      return { previousItems }
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', 'inventory', category], context.previousItems)
      }
      // 에러 메시지 표시
      const errorMessage = err.response?.data?.error || '작업 상태 변경 실패'
      alert(errorMessage)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'inventory'] })
    },
  })

  const handleQuantityChange = (item, delta) => {
    // 되돌리기용 저장
    setUndoStack([{ 
      item, 
      prevValue: item.quantity, 
      delta: -delta, // 반대로
      type: 'delta',
      description: `${item.name}: ${delta > 0 ? '+' : ''}${delta}`
    }])
    quantityMutation.mutate({ item, delta })
  }

  const handleQuantitySet = (item, value) => {
    // 되돌리기용 저장
    setUndoStack([{ 
      item, 
      prevValue: item.quantity, 
      newValue: value,
      type: 'set',
      description: `${item.name}: ${item.quantity} → ${value}`
    }])
    quantitySetMutation.mutate({ item, value })
  }

  // 되돌리기 실행
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    
    const lastAction = undoStack[0]
    if (lastAction.type === 'delta') {
      // 델타 되돌리기: 반대 값으로 변경
      quantityMutation.mutate({ item: lastAction.item, delta: lastAction.delta })
    } else if (lastAction.type === 'set') {
      // 설정 되돌리기: 이전 값으로 복원
      quantitySetMutation.mutate({ item: lastAction.item, value: lastAction.prevValue })
    }
    
    setUndoStack([])
    setShowUndo(false)
  }, [undoStack, quantityMutation, quantitySetMutation])

  const handleWorkerToggle = (item, action) => {
    workerMutation.mutate({ item, action })
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

  const handleReset = () => {
    if (category) {
      resetMutation.mutate(category)
    }
  }

  // 검색 필터링
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 카테고리별 그룹핑 (카테고리 미선택 시)
  const groupedItems = category 
    ? { [category]: filteredItems }
    : filteredItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {})

  return (
    <div className="flex gap-6">
      {/* 왼쪽 사이드바 - 카테고리 목록 */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100 sticky top-20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FolderOpen size={20} />
            카테고리
          </h2>
          <nav className="space-y-1">
            <NavLink
              to="/inventory"
              end
              className={({ isActive }) => clsx(
                'block px-3 py-2 rounded-lg transition-colors',
                isActive ? 'bg-primary-600 text-white' : 'hover:bg-dark-200 text-gray-300'
              )}
            >
              전체 보기
            </NavLink>
            {categories.map((cat) => (
              <NavLink
                key={cat}
                to={`/inventory/${encodeURIComponent(cat)}`}
                className={({ isActive }) => clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                  isActive ? 'bg-primary-600 text-white' : 'hover:bg-dark-200 text-gray-300'
                )}
              >
                <DiscordText>{cat}</DiscordText>
                <ChevronRight size={16} />
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 min-w-0">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">
            재고 {category && <>- <DiscordText>{category}</DiscordText></>}
          </h1>
          
          <div className="flex items-center gap-3">
            {/* 초기화 버튼 - 카테고리 선택 시에만 */}
            {user && category && (
              <button
                onClick={() => setResetModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-lg transition-colors"
                title="수량 초기화"
              >
                <RotateCcw size={18} />
                <span className="hidden sm:inline">초기화</span>
              </button>
            )}
            
            {/* 추가 버튼 */}
            {user && (
              <button
                onClick={handleAddItem}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
              >
                <Plus size={18} />
                <span className="hidden sm:inline">아이템 추가</span>
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
                className="w-full sm:w-64 pl-10 pr-4 py-2 bg-dark-300 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* 모바일 카테고리 선택 */}
        <div className="lg:hidden mb-4">
          <select
            value={category || ''}
            onChange={(e) => {
              const val = e.target.value
              window.location.href = val ? `/inventory/${encodeURIComponent(val)}` : '/inventory'
            }}
            className="w-full px-4 py-2 bg-dark-300 border border-dark-100 rounded-lg"
          >
            <option value="">전체 카테고리</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* 아이템 목록 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : Object.keys(groupedItems).length > 0 ? (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([cat, catItems]) => (
              <div key={cat}>
                {!category && (
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <DiscordText>{cat}</DiscordText>
                    <span className="text-sm text-gray-400">({catItems.length})</span>
                  </h2>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {catItems.map((item) => (
                    <ItemRow
                      key={`${item.category}-${item.name}`}
                      item={item}
                      type="inventory"
                      onQuantityChange={handleQuantityChange}
                      onQuantitySet={handleQuantitySet}
                      onEdit={handleEditItem}
                      onDelete={handleDeleteItem}
                      onWorkerToggle={handleWorkerToggle}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? '검색 결과가 없습니다.' : '아이템이 없습니다.'}
          </div>
        )}
      </div>

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
        categoryName={category}
        itemCount={items.length}
        isPending={resetMutation.isPending}
      />
      
      {/* 되돌리기 토스트 */}
      {showUndo && undoStack.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-4 py-3 bg-dark-300 border border-dark-100 rounded-xl shadow-lg">
            <span className="text-sm text-gray-300">
              {undoStack[0].description}
            </span>
            <button
              onClick={handleUndo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
            >
              <Undo2 size={14} />
              되돌리기
            </button>
            <button
              onClick={() => { setShowUndo(false); setUndoStack([]); }}
              className="p-1 hover:bg-dark-200 rounded text-gray-400"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Inventory
