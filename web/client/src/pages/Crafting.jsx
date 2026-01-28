import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { 
  Plus, 
  Minus, 
  Edit, 
  Trash2,
  FolderOpen,
  ChevronRight,
  Search,
  BookOpen,
  RotateCcw
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'
import { ItemModal, DeleteConfirmModal, ResetConfirmModal, RecipeModal } from '../components/ItemModals'
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

function CraftingItemRow({ item, recipe, onQuantityChange, onQuantitySet, onEdit, onDelete, onWorkerToggle, onRecipeEdit }) {
  const { user } = useAuth()
  const [editMode, setEditMode] = useState(null) // null, 'delta', 'set'
  
  // 단위별 입력값
  const [deltaUnits, setDeltaUnits] = useState({ boxes: 0, sets: 0, items: 0 })
  const [setUnits, setSetUnits] = useState({ boxes: 0, sets: 0, items: 0 })
  const [isAdding, setIsAdding] = useState(true) // 증감 모드에서 추가/차감
  
  const [showRecipe, setShowRecipe] = useState(false)
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
    // 드롭다운 유지 - 연속 증감 가능
  }

  const percentage = item.required > 0 
    ? Math.min((item.quantity / item.required) * 100, 100) 
    : 0

  return (
    <div className="bg-dark-200 rounded-lg p-4 hover:bg-dark-100/50 transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <DiscordText className="text-lg">{item.emoji || '⭐'}</DiscordText>
          <DiscordText className="font-medium">{item.name}</DiscordText>
          {item.itemType === 'intermediate' && (
            <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded">중간재</span>
          )}
          {/* 작업자 상태 */}
          {item.worker?.userId ? (
            <button
              onClick={() => user && (user.id === item.worker.userId || user.isAdmin) && onWorkerToggle(item, 'stop')}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
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
              className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded transition-colors opacity-0 group-hover:opacity-100"
            >
              작업 시작
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* 수정/삭제 버튼 - 호버 시 표시 */}
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
          {/* 레시피 버튼 */}
          {recipe ? (
            <div className="flex items-center">
              <button
                onClick={() => setShowRecipe(!showRecipe)}
                className={clsx(
                  'p-1 rounded-l transition-colors',
                  showRecipe ? 'bg-primary-600 text-white' : 'hover:bg-dark-300 text-gray-400'
                )}
                title="레시피 보기"
              >
                <BookOpen size={16} />
              </button>
              {user && (
                <button
                  onClick={() => onRecipeEdit(item, recipe)}
                  className="p-1 rounded-r hover:bg-dark-300 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="레시피 편집"
                >
                  <Edit size={14} />
                </button>
              )}
            </div>
          ) : user && (
            <button
              onClick={() => onRecipeEdit(item, null)}
              className="p-1 rounded hover:bg-dark-300 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="레시피 추가"
            >
              <BookOpen size={16} />
            </button>
          )}
          <span className={clsx(
            'text-sm ml-1',
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

        {/* 수량 조절 버튼 */}
        {user && (
          <div className="flex items-center gap-1 relative">
            {editMode === 'delta' ? (
              /* 증감 모드 - 단위별 입력 */
              <form onSubmit={handleDeltaSubmit} className="flex items-center gap-1 flex-wrap">
                <span className={`text-sm font-medium ${isAdding ? 'text-green-400' : 'text-red-400'}`}>
                  {isAdding ? '+' : '-'}
                </span>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={deltaUnits.boxes || ''}
                    onChange={(e) => setDeltaUnits({...deltaUnits, boxes: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">상자</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={deltaUnits.sets || ''}
                    onChange={(e) => setDeltaUnits({...deltaUnits, sets: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">세트</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={deltaUnits.items || ''}
                    onChange={(e) => setDeltaUnits({...deltaUnits, items: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">개</span>
                </div>
                <button
                  type="submit"
                  className={`px-2 py-1 rounded text-sm ${isAdding ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                >
                  적용
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(null)}
                  className="px-2 py-1 bg-dark-100 hover:bg-dark-200 rounded text-sm"
                >
                  취소
                </button>
              </form>
            ) : editMode === 'set' ? (
              /* 직접 설정 모드 - 단위별 입력 */
              <form onSubmit={handleSetSubmit} className="flex items-center gap-1 flex-wrap">
                <span className="text-xs text-blue-400">→</span>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={setUnits.boxes || ''}
                    onChange={(e) => setSetUnits({...setUnits, boxes: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                    autoFocus
                  />
                  <span className="text-xs text-gray-400">상자</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={setUnits.sets || ''}
                    onChange={(e) => setSetUnits({...setUnits, sets: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">세트</span>
                </div>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={setUnits.items || ''}
                    onChange={(e) => setSetUnits({...setUnits, items: e.target.value})}
                    placeholder="0"
                    min="0"
                    className="w-12 px-1 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">개</span>
                </div>
                <button
                  type="submit"
                  className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                >
                  설정
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(null)}
                  className="px-2 py-1 bg-dark-100 hover:bg-dark-200 rounded text-sm"
                >
                  취소
                </button>
              </form>
            ) : (
              <>
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
                      {/* 배경 클릭 시 닫기 */}
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setShowPresets(false)}
                      />
                      {/* 프리셋 드롭다운 */}
                      <div className="absolute right-0 top-full mt-1 bg-dark-300 border border-dark-100 rounded-lg shadow-lg z-50 min-w-[140px]">
                        <div className="p-1">
                          <div className="text-xs text-gray-500 px-2 py-1">추가</div>
                          {PRESETS.filter(p => p.value > 0).map(preset => (
                            <button
                              key={preset.value}
                              onClick={() => handlePresetClick(preset.value)}
                              className={`w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm ${preset.color}`}
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
                              className={`w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm ${preset.color}`}
                            >
                              {preset.label}
                            </button>
                          ))}
                          <div className="border-t border-dark-100 my-1" />
                          <div className="text-xs text-gray-500 px-2 py-1">단위별 입력</div>
                          <button
                            onClick={() => { startDeltaMode(true); setShowPresets(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-green-400"
                          >
                            ➕ 추가 (단위입력)
                          </button>
                          <button
                            onClick={() => { startDeltaMode(false); setShowPresets(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-red-400"
                          >
                            ➖ 차감 (단위입력)
                          </button>
                          <button
                            onClick={() => { startSetMode(); setShowPresets(false); }}
                            className="w-full text-left px-2 py-1.5 hover:bg-dark-200 rounded text-sm text-blue-400"
                          >
                            📝 수량 직접 설정
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
              </>
            )}
          </div>
        )}
      </div>

      <ProgressBar current={item.quantity} target={item.required} />

      {/* 레시피 표시 */}
      {showRecipe && recipe && (
        <div className="mt-3 pt-3 border-t border-dark-100">
          <p className="text-sm text-gray-400 mb-2">필요 재료:</p>
          <div className="space-y-1">
            {recipe.materials.map((material, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  <DiscordText>{material.name}</DiscordText>
                  <span className="text-gray-500 ml-1">(<DiscordText>{material.category}</DiscordText>)</span>
                </span>
                <span className="text-gray-400">{material.quantity}개</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Crafting() {
  const { category } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  
  // 모달 상태
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [recipeModalOpen, setRecipeModalOpen] = useState(false)
  const [editingRecipe, setEditingRecipe] = useState({ item: null, recipe: null })

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', 'crafting', 'categories'],
    queryFn: () => api.get('/items/crafting/categories').then(res => res.data),
  })

  // 선택된 카테고리의 아이템 조회
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['items', 'crafting', category],
    queryFn: () => api.get(`/items/crafting${category ? `?category=${category}` : ''}`).then(res => res.data),
  })

  // 레시피 조회
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes', category],
    queryFn: () => api.get(`/recipes${category ? `?category=${category}` : ''}`).then(res => res.data),
  })

  // 수량 변경 뮤테이션 (Optimistic Update)
  const quantityMutation = useMutation({
    mutationFn: ({ item, delta }) => 
      api.patch(`/items/${item.type}/${item.category}/${item.name}/quantity`, { delta }),
    onMutate: async ({ item, delta }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: ['items', 'crafting', category] })
      
      // 이전 데이터 스냅샷
      const previousItems = queryClient.getQueryData(['items', 'crafting', category])
      
      // 낙관적 업데이트 - 즉시 UI 반영
      queryClient.setQueryData(['items', 'crafting', category], (old) => {
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
        queryClient.setQueryData(['items', 'crafting', category], context.previousItems)
      }
    },
    onSettled: () => {
      // 완료 후 리페치 (서버와 동기화)
      queryClient.invalidateQueries({ queryKey: ['items', 'crafting'] })
    },
  })

  // 수량 직접 설정 뮤테이션 (Optimistic Update)
  const quantitySetMutation = useMutation({
    mutationFn: ({ item, value }) => 
      api.patch(`/items/${item.type}/${item.category}/${item.name}/quantity/set`, { value }),
    onMutate: async ({ item, value }) => {
      await queryClient.cancelQueries({ queryKey: ['items', 'crafting', category] })
      const previousItems = queryClient.getQueryData(['items', 'crafting', category])
      
      queryClient.setQueryData(['items', 'crafting', category], (old) => {
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
        queryClient.setQueryData(['items', 'crafting', category], context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'crafting'] })
    },
  })

  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (item) => api.delete(`/items/crafting/${item.category}/${item.name}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      setDeleteModalOpen(false)
      setDeletingItem(null)
    },
  })

  // 초기화 뮤테이션
  const resetMutation = useMutation({
    mutationFn: (cat) => api.post(`/items/crafting/${cat}/reset`),
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
      await queryClient.cancelQueries({ queryKey: ['items', 'crafting', category] })
      const previousItems = queryClient.getQueryData(['items', 'crafting', category])
      
      queryClient.setQueryData(['items', 'crafting', category], (old) => {
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
        queryClient.setQueryData(['items', 'crafting', category], context.previousItems)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items', 'crafting'] })
    },
  })

  // 레시피 저장 뮤테이션
  const recipeMutation = useMutation({
    mutationFn: ({ category, resultName, materials }) => 
      api.post('/recipes', { category, resultName, materials }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setRecipeModalOpen(false)
      setEditingRecipe({ item: null, recipe: null })
    },
  })

  // 레시피 삭제 뮤테이션
  const recipeDeleteMutation = useMutation({
    mutationFn: ({ category, resultName }) => 
      api.delete(`/recipes/${category}/${resultName}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setRecipeModalOpen(false)
      setEditingRecipe({ item: null, recipe: null })
    },
  })

  const handleQuantityChange = (item, delta) => {
    quantityMutation.mutate({ item, delta })
  }

  const handleQuantitySet = (item, value) => {
    quantitySetMutation.mutate({ item, value })
  }

  const handleWorkerToggle = (item, action) => {
    workerMutation.mutate({ item, action })
  }

  const handleRecipeEdit = (item, recipe) => {
    setEditingRecipe({ item, recipe })
    setRecipeModalOpen(true)
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

  // 레시피 맵 생성
  const recipeMap = recipes.reduce((acc, recipe) => {
    acc[`${recipe.category}-${recipe.resultName}`] = recipe
    return acc
  }, {})

  // 검색 필터링
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // 카테고리별 그룹핑
  const groupedItems = category 
    ? { [category]: filteredItems }
    : filteredItems.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
      }, {})

  return (
    <div className="flex gap-6">
      {/* 왼쪽 사이드바 */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100 sticky top-20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FolderOpen size={20} />
            카테고리
          </h2>
          <nav className="space-y-1">
            <NavLink
              to="/crafting"
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
                to={`/crafting/${encodeURIComponent(cat)}`}
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
            제작 {category && <>- <DiscordText>{category}</DiscordText></>}
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
                <span className="hidden sm:inline">제작품 추가</span>
              </button>
            )}
            
            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="제작품 검색..."
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
              window.location.href = val ? `/crafting/${encodeURIComponent(val)}` : '/crafting'
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {catItems.map((item) => (
                    <CraftingItemRow
                      key={`${item.category}-${item.name}`}
                      item={item}
                      recipe={recipeMap[`${item.category}-${item.name}`]}
                      onQuantityChange={handleQuantityChange}
                      onQuantitySet={handleQuantitySet}
                      onEdit={handleEditItem}
                      onDelete={handleDeleteItem}
                      onWorkerToggle={handleWorkerToggle}
                      onRecipeEdit={handleRecipeEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            {searchQuery ? '검색 결과가 없습니다.' : '제작품이 없습니다.'}
          </div>
        )}
      </div>

      {/* 모달들 */}
      <ItemModal
        isOpen={itemModalOpen}
        onClose={() => { setItemModalOpen(false); setEditingItem(null); }}
        type="crafting"
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
      
      <RecipeModal
        isOpen={recipeModalOpen}
        onClose={() => { setRecipeModalOpen(false); setEditingRecipe({ item: null, recipe: null }); }}
        item={editingRecipe.item}
        recipe={editingRecipe.recipe}
        onSave={(data) => recipeMutation.mutate(data)}
        onDelete={(data) => recipeDeleteMutation.mutate(data)}
        isSaving={recipeMutation.isPending}
        isDeleting={recipeDeleteMutation.isPending}
      />
    </div>
  )
}

export default Crafting
