import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { DiscordText } from '../utils/discordEmoji'

// 분리된 수량을 총 수량으로 변환 (아이템별 크기 지원)
function calculateTotal(items, sets, boxes, setSize = 64, boxSize = 3456) {
  const ss = setSize > 0 ? setSize : 64
  const bs = boxSize > 0 ? boxSize : 3456
  return (parseInt(items) || 0) + (parseInt(sets) || 0) * ss + (parseInt(boxes) || 0) * bs
}

// 총 수량을 분리된 수량으로 변환 (아이템별 크기 지원)
function splitQuantity(total, setSize = 64, boxSize = 3456) {
  const ss = setSize > 0 ? setSize : 64
  const bs = boxSize > 0 ? boxSize : 3456
  const boxes = Math.floor(total / bs)
  const remaining = total % bs
  const sets = Math.floor(remaining / ss)
  const items = remaining % ss
  return { items, sets, boxes }
}

// 고정 상수
const SET_SIZE = 64
const BOX_SIZE = 3456

export function ItemModal({ isOpen, onClose, type, categories = [], item = null }) {
  const queryClient = useQueryClient()
  const isEdit = !!item
  
  // itemType 정규화 (normal -> material)
  const normalizeItemType = (itemType) => {
    if (itemType === 'normal' || !itemType) return 'material'
    return itemType
  }
  
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || categories[0] || '',
    newCategory: '',
    useNewCategory: false,
    emoji: item?.emoji || '',
    quantity: item?.quantity || 0,
    required: item?.required || 0,
    itemType: normalizeItemType(item?.itemType)
  })
  
  // 분리된 수량 입력 상태
  const [quantityParts, setQuantityParts] = useState({ items: 0, sets: 0, boxes: 0 })
  const [requiredParts, setRequiredParts] = useState({ items: 0, sets: 0, boxes: 0 })
  
  // 초기값 설정
  useEffect(() => {
    if (isOpen) {
      setQuantityParts(splitQuantity(item?.quantity || 0, SET_SIZE, BOX_SIZE))
      setRequiredParts(splitQuantity(item?.required || 0, SET_SIZE, BOX_SIZE))
      // formData도 업데이트
      setFormData({
        name: item?.name || '',
        category: item?.category || categories[0] || '',
        newCategory: '',
        useNewCategory: false,
        emoji: item?.emoji || '',
        quantity: item?.quantity || 0,
        required: item?.required || 0,
        itemType: normalizeItemType(item?.itemType)
      })
      setError('')
    }
  }, [isOpen, item])
  
  // 분리된 수량이 변경되면 총 수량 업데이트
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      quantity: calculateTotal(quantityParts.items, quantityParts.sets, quantityParts.boxes, SET_SIZE, BOX_SIZE),
      required: calculateTotal(requiredParts.items, requiredParts.sets, requiredParts.boxes, SET_SIZE, BOX_SIZE)
    }))
  }, [quantityParts, requiredParts])
  
  const [error, setError] = useState('')

  const addMutation = useMutation({
    mutationFn: (data) => api.post('/items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || '추가 실패')
    }
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.patch(`/items/${type}/${item.category}/${item.name}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || '수정 실패')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    
    const category = formData.useNewCategory ? formData.newCategory : formData.category
    
    if (!formData.name.trim()) {
      setError('이름을 입력하세요')
      return
    }
    if (!category.trim()) {
      setError('카테고리를 선택하거나 입력하세요')
      return
    }
    
    if (isEdit) {
      updateMutation.mutate({
        name: formData.name,
        emoji: formData.emoji,
        required: parseInt(formData.required) || 0,
        itemType: formData.itemType
      })
    } else {
      addMutation.mutate({
        name: formData.name,
        category,
        type,
        emoji: formData.emoji,
        quantity: parseInt(formData.quantity) || 0,
        required: parseInt(formData.required) || 0,
        itemType: formData.itemType
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-md border border-light-300 dark:border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-light-300 dark:border-dark-100">
          <h2 className="text-lg font-semibold">
            {isEdit ? '아이템 수정' : '아이템 추가'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-light-200 dark:hover:bg-dark-200 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {/* 이름 */}
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="아이템 이름"
            />
          </div>
          
          {/* 카테고리 - 수정 시 변경 불가 */}
          {!isEdit && (
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">카테고리 *</label>
              {!formData.useNewCategory ? (
                <div className="space-y-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, useNewCategory: true })}
                    className="text-sm text-primary-500 hover:text-primary-400"
                  >
                    + 새 카테고리 만들기
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.newCategory}
                    onChange={(e) => setFormData({ ...formData, newCategory: e.target.value })}
                    className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="새 카테고리 이름"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, useNewCategory: false })}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    기존 카테고리에서 선택
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* 이모지 */}
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">이모지</label>
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
              className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="📦 또는 <:이름:ID>"
            />
            {formData.emoji && (
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                미리보기: <DiscordText>{formData.emoji}</DiscordText>
              </div>
            )}
          </div>
          
          {/* 수량 - 추가 시에만 */}
          {!isEdit && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">현재 수량</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">상자</label>
                    <input
                      type="number"
                      value={quantityParts.boxes || ''}
                      onChange={(e) => setQuantityParts({ ...quantityParts, boxes: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">세트</label>
                    <input
                      type="number"
                      value={quantityParts.sets || ''}
                      onChange={(e) => setQuantityParts({ ...quantityParts, sets: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">낱개</label>
                    <input
                      type="number"
                      value={quantityParts.items || ''}
                      onChange={(e) => setQuantityParts({ ...quantityParts, items: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  = 총 {formData.quantity.toLocaleString()}개
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">목표 수량</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">상자</label>
                    <input
                      type="number"
                      value={requiredParts.boxes || ''}
                      onChange={(e) => setRequiredParts({ ...requiredParts, boxes: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">세트</label>
                    <input
                      type="number"
                      value={requiredParts.sets || ''}
                      onChange={(e) => setRequiredParts({ ...requiredParts, sets: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">낱개</label>
                    <input
                      type="number"
                      value={requiredParts.items || ''}
                      onChange={(e) => setRequiredParts({ ...requiredParts, items: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  = 총 {formData.required.toLocaleString()}개
                </div>
              </div>
            </div>
          )}
          
          {/* 목표 수량 - 수정 시 */}
          {isEdit && (
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">목표 수량</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상자</label>
                  <input
                    type="number"
                    value={requiredParts.boxes || ''}
                    onChange={(e) => setRequiredParts({ ...requiredParts, boxes: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">세트</label>
                  <input
                    type="number"
                    value={requiredParts.sets || ''}
                    onChange={(e) => setRequiredParts({ ...requiredParts, sets: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">낱개</label>
                  <input
                    type="number"
                    value={requiredParts.items || ''}
                    onChange={(e) => setRequiredParts({ ...requiredParts, items: e.target.value === '' ? 0 : parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">
                = 총 {formData.required.toLocaleString()}개
              </div>
            </div>
          )}
          
          {/* 아이템 타입 */}
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">아이템 타입</label>
            <select
              value={formData.itemType}
              onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
              className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 border border-light-300 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
            >
              <option value="material">재료</option>
              <option value="intermediate">중간재료</option>
              <option value="finished">완성품</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.itemType === 'material' && '기본 재료입니다.'}
              {formData.itemType === 'intermediate' && '제작 시 재료가 자동 차감됩니다.'}
              {formData.itemType === 'finished' && '제작 시 재료가 자동 차감됩니다.'}
            </p>
          </div>
          
          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 text-white"
            >
              {addMutation.isPending || updateMutation.isPending ? '처리 중...' : (isEdit ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, title, message, isPending, isLoading }) {
  if (!isOpen) return null
  
  const loading = isPending || isLoading
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-sm border border-light-300 dark:border-dark-100">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="text-red-500" size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-2">{title || '아이템 삭제'}</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {message || (
              <>
                <DiscordText className="font-medium">{itemName}</DiscordText>
                <br />이 아이템을 삭제하시겠습니까?
              </>
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 text-white"
            >
              {loading ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ResetConfirmModal({ isOpen, onClose, onConfirm, categoryName, itemCount, isPending }) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-sm border border-light-300 dark:border-dark-100">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h3 className="text-lg font-semibold mb-2">카테고리 초기화</h3>
          <p className="text-gray-400 mb-6">
            <DiscordText className="font-medium text-white">{categoryName}</DiscordText> 카테고리의
            <br />{itemCount}개 아이템 수량을 0으로 초기화하시겠습니까?
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? '초기화 중...' : '초기화'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RecipeModal({ 
  isOpen, 
  onClose, 
  item, 
  recipe, 
  onSave, 
  onDelete,
  isSaving,
  isDeleting 
}) {
  const [materials, setMaterials] = useState(recipe?.materials || [])
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  
  // 재고 아이템 목록 (재료로 선택 가능)
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['items', 'inventory'],
    queryFn: () => api.get('/items/inventory').then(res => res.data),
    enabled: isOpen,
  })
  
  // 카테고리 목록
  const inventoryCategories = [...new Set(inventoryItems.map(i => i.category))]
  
  // 모달 열릴 때 데이터 초기화
  useState(() => {
    if (isOpen) {
      setMaterials(recipe?.materials || [])
    }
  }, [isOpen, recipe])

  const handleAddMaterial = (inventoryItem) => {
    const exists = materials.find(m => m.name === inventoryItem.name && m.category === inventoryItem.category)
    if (!exists) {
      setMaterials([...materials, {
        name: inventoryItem.name,
        category: inventoryItem.category,
        quantity: 1
      }])
    }
    setShowItemPicker(false)
  }

  const handleRemoveMaterial = (index) => {
    setMaterials(materials.filter((_, i) => i !== index))
  }

  const handleQuantityChange = (index, quantity) => {
    setMaterials(materials.map((m, i) => 
      i === index ? { ...m, quantity: parseInt(quantity) || 1 } : m
    ))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (materials.length === 0) return
    
    onSave({
      category: item.category,
      resultName: item.name,
      materials
    })
  }

  if (!isOpen || !item) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-300 rounded-xl w-full max-w-lg border border-dark-100 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold">
            <DiscordText>{item.emoji || '⭐'}</DiscordText>{' '}
            <DiscordText>{item.name}</DiscordText> 레시피
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-200 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* 재료 목록 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">필요 재료</label>
            
            {materials.length > 0 ? (
              <div className="space-y-2 mb-3">
                {materials.map((material, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-dark-200 p-2 rounded-lg">
                    <div className="flex-1">
                      <DiscordText className="text-sm">{material.name}</DiscordText>
                      <span className="text-xs text-gray-500 ml-1">({material.category})</span>
                    </div>
                    <input
                      type="number"
                      value={material.quantity}
                      onChange={(e) => handleQuantityChange(idx, e.target.value)}
                      min="1"
                      className="w-20 px-2 py-1 bg-dark-300 border border-dark-100 rounded text-sm text-center"
                    />
                    <span className="text-xs text-gray-400">개</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="p-1 hover:bg-dark-300 rounded text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">재료를 추가하세요</p>
            )}
            
            {/* 재료 추가 버튼 */}
            {!showItemPicker ? (
              <button
                type="button"
                onClick={() => setShowItemPicker(true)}
                className="flex items-center gap-2 px-3 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg text-sm text-primary-400"
              >
                <Plus size={16} />
                재료 추가
              </button>
            ) : (
              <div className="bg-dark-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">재료 선택</span>
                  <button
                    type="button"
                    onClick={() => setShowItemPicker(false)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    닫기
                  </button>
                </div>
                
                {/* 카테고리 필터 */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-2 py-1 bg-dark-300 border border-dark-100 rounded text-sm"
                >
                  <option value="">전체 카테고리</option>
                  {inventoryCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                {/* 아이템 목록 */}
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {inventoryItems
                    .filter(i => !selectedCategory || i.category === selectedCategory)
                    .filter(i => !materials.find(m => m.name === i.name && m.category === i.category))
                    .map(i => (
                      <button
                        key={`${i.category}-${i.name}`}
                        type="button"
                        onClick={() => handleAddMaterial(i)}
                        className="w-full text-left px-2 py-1.5 hover:bg-dark-300 rounded text-sm"
                      >
                        <DiscordText>{i.emoji || '📦'}</DiscordText>{' '}
                        <DiscordText>{i.name}</DiscordText>
                        <span className="text-xs text-gray-500 ml-1">({i.category})</span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
          
          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            {recipe && (
              <button
                type="button"
                onClick={() => onDelete({ category: item.category, resultName: item.name })}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? '삭제 중...' : '삭제'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={materials.length === 0 || isSaving}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isSaving ? '저장 중...' : (recipe ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 제작 계획 생성 모달
export function CraftingPlanModal({ isOpen, onClose, category: initialCategory }) {
  const queryClient = useQueryClient()
  
  const [category, setCategory] = useState(initialCategory || '')
  const [newCategory, setNewCategory] = useState('')
  const [useNewCategory, setUseNewCategory] = useState(false)
  const [goals, setGoals] = useState([{ name: '', quantity: 1, emoji: '' }])
  const [eventId, setEventId] = useState('')
  const [previewData, setPreviewData] = useState(null)
  const [error, setError] = useState('')
  
  // 기간 설정 관련 상태
  const [useSchedule, setUseSchedule] = useState(false)
  const [scheduleMode, setScheduleMode] = useState('new') // 'new' | 'existing'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [eventTitle, setEventTitle] = useState('')
  const [eventColor, setEventColor] = useState('blue')
  
  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', 'inventory', 'categories'],
    queryFn: () => api.get('/items/inventory/categories').then(res => res.data),
  })
  
  // 레시피 목록 조회 (3차 제작품 선택용)
  const { data: recipes = [] } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes').then(res => res.data),
  })
  
  // 이벤트 목록 조회
  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then(res => res.data),
  })
  
  // 미리보기 mutation
  const previewMutation = useMutation({
    mutationFn: (data) => api.post('/items/crafting/calculate', data),
    onSuccess: (res) => {
      setPreviewData(res.data)
      setError('')
    },
    onError: (err) => {
      setError(err.response?.data?.error || '미리보기 실패')
      setPreviewData(null)
    }
  })
  
  // 계획 생성 mutation
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/items/crafting/plan', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crafting'] })
      queryClient.invalidateQueries({ queryKey: ['items', 'crafting'] })
      onClose()
      resetForm()
    },
    onError: (err) => {
      setError(err.response?.data?.error || '생성 실패')
    }
  })
  
  const resetForm = () => {
    setCategory('')
    setNewCategory('')
    setUseNewCategory(false)
    setGoals([{ name: '', quantity: 1, emoji: '' }])
    setEventId('')
    setPreviewData(null)
    setError('')
    // 기간 설정 초기화
    setUseSchedule(false)
    setScheduleMode('new')
    setStartDate('')
    setEndDate('')
    setEventTitle('')
    setEventColor('blue')
  }
  
  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory || '')
      setError('')
      setPreviewData(null)
    }
  }, [isOpen, initialCategory])
  
  const handleAddGoal = () => {
    setGoals([...goals, { name: '', quantity: 1, emoji: '' }])
  }
  
  const handleRemoveGoal = (index) => {
    if (goals.length > 1) {
      setGoals(goals.filter((_, i) => i !== index))
    }
  }
  
  const handleGoalChange = (index, field, value) => {
    const newGoals = [...goals]
    newGoals[index][field] = field === 'quantity' ? parseInt(value) || 0 : value
    setGoals(newGoals)
  }
  
  const handlePreview = () => {
    const targetCategory = useNewCategory ? newCategory : category
    if (!targetCategory) {
      setError('카테고리를 선택해주세요')
      return
    }
    
    const validGoals = goals.filter(g => g.name && g.quantity > 0)
    if (validGoals.length === 0) {
      setError('최소 1개 이상의 3차 제작품을 입력해주세요')
      return
    }
    
    previewMutation.mutate({
      category: targetCategory,
      tier3Goals: validGoals
    })
  }
  
  const handleSubmit = (e) => {
    e.preventDefault()
    
    const targetCategory = useNewCategory ? newCategory : category
    if (!targetCategory) {
      setError('카테고리를 선택해주세요')
      return
    }
    
    const validGoals = goals.filter(g => g.name && g.quantity > 0)
    if (validGoals.length === 0) {
      setError('최소 1개 이상의 3차 제작품을 입력해주세요')
      return
    }
    
    // 기간 설정 모드인 경우 검증
    if (useSchedule) {
      if (scheduleMode === 'new') {
        if (!startDate || !endDate) {
          setError('시작일과 종료일을 입력해주세요')
          return
        }
        if (new Date(startDate) > new Date(endDate)) {
          setError('종료일은 시작일보다 이후여야 합니다')
          return
        }
      } else if (scheduleMode === 'existing' && !eventId) {
        setError('연동할 이벤트를 선택해주세요')
        return
      }
    }
    
    const submitData = {
      category: targetCategory,
      tier3Goals: validGoals,
      eventId: (useSchedule && scheduleMode === 'existing') ? eventId : null
    }
    
    // 새 이벤트 생성 모드인 경우 일정 정보 추가
    if (useSchedule && scheduleMode === 'new') {
      submitData.createEvent = true
      submitData.eventTitle = eventTitle || `${targetCategory} 제작 계획`
      submitData.startDate = startDate
      submitData.endDate = endDate
      submitData.eventColor = eventColor
    }
    
    createMutation.mutate(submitData)
  }
  
  // 현재 카테고리의 3차 레시피만 필터링
  const tier3Recipes = recipes.filter(r => 
    r.tier === 3 && (!category || r.category === category)
  )
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-2xl border border-light-300 dark:border-dark-100 max-h-[90vh] overflow-hidden flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-light-300 dark:border-dark-200">
          <h2 className="text-lg font-semibold">새 제작 계획 생성</h2>
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="p-1 hover:bg-light-200 dark:hover:bg-dark-200 rounded transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 dark:text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-sm font-medium mb-2">카테고리</label>
            <div className="flex gap-2 mb-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!useNewCategory}
                  onChange={() => setUseNewCategory(false)}
                  className="text-primary-500"
                />
                <span className="text-sm">기존 카테고리</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={useNewCategory}
                  onChange={() => setUseNewCategory(true)}
                  className="text-primary-500"
                />
                <span className="text-sm">새 카테고리</span>
              </label>
            </div>
            
            {useNewCategory ? (
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="새 카테고리 이름"
                className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none"
              />
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-light-100 dark:bg-dark-200 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none"
              >
                <option value="">카테고리 선택...</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            )}
          </div>
          
          {/* 기간 및 이벤트 연동 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useSchedule"
                checked={useSchedule}
                onChange={(e) => setUseSchedule(e.target.checked)}
                className="w-4 h-4 rounded text-primary-500"
              />
              <label htmlFor="useSchedule" className="text-sm font-medium">기간 설정 및 일정 연동</label>
            </div>
            
            {useSchedule && (
              <div className="ml-6 space-y-3 p-3 bg-light-100 dark:bg-dark-200 rounded-lg">
                {/* 모드 선택 */}
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scheduleMode === 'new'}
                      onChange={() => setScheduleMode('new')}
                      className="text-primary-500"
                    />
                    <span className="text-sm">새 일정 생성</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={scheduleMode === 'existing'}
                      onChange={() => setScheduleMode('existing')}
                      className="text-primary-500"
                    />
                    <span className="text-sm">기존 일정 연동</span>
                  </label>
                </div>
                
                {scheduleMode === 'new' ? (
                  <div className="space-y-2">
                    {/* 일정 제목 */}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">일정 제목</label>
                      <input
                        type="text"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder={`${useNewCategory ? newCategory : category || '카테고리'} 제작 계획`}
                        className="w-full px-3 py-2 bg-white dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none text-sm"
                      />
                    </div>
                    
                    {/* 날짜 선택 */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">시작일</label>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">종료일 (마감)</label>
                        <input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="w-full px-3 py-2 bg-white dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* 색상 선택 */}
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">일정 색상</label>
                      <div className="flex gap-2 flex-wrap">
                        {['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'cyan'].map(color => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEventColor(color)}
                            className={`w-7 h-7 rounded-full transition-all ${
                              eventColor === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-dark-200' : ''
                            }`}
                            style={{ 
                              backgroundColor: {
                                blue: '#3b82f6',
                                green: '#22c55e',
                                yellow: '#eab308',
                                red: '#ef4444',
                                purple: '#a855f7',
                                pink: '#ec4899',
                                indigo: '#6366f1',
                                cyan: '#06b6d4'
                              }[color] 
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">연동할 이벤트</label>
                    <select
                      value={eventId}
                      onChange={(e) => setEventId(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none text-sm"
                    >
                      <option value="">이벤트 선택...</option>
                      {events.map(event => (
                        <option key={event._id} value={event._id}>
                          {event.title} ({new Date(event.start).toLocaleDateString()} ~ {event.end ? new Date(event.end).toLocaleDateString() : ''})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 3차 제작품 목표 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">3차 제작품 목표</label>
              <button
                type="button"
                onClick={handleAddGoal}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-primary-600 hover:bg-primary-500 rounded transition-colors text-white"
              >
                <Plus size={14} />
                추가
              </button>
            </div>
            
            <div className="space-y-2">
              {goals.map((goal, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={goal.emoji}
                    onChange={(e) => handleGoalChange(index, 'emoji', e.target.value)}
                    placeholder="🎯"
                    className="w-12 px-2 py-2 bg-light-100 dark:bg-dark-200 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none text-center"
                  />
                  <input
                    type="text"
                    value={goal.name}
                    onChange={(e) => handleGoalChange(index, 'name', e.target.value)}
                    placeholder="제작품 이름"
                    className="flex-1 px-3 py-2 bg-light-100 dark:bg-dark-200 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none"
                    list={`recipes-${index}`}
                  />
                  <datalist id={`recipes-${index}`}>
                    {tier3Recipes.map(r => (
                      <option key={r.resultName} value={r.resultName} />
                    ))}
                  </datalist>
                  <input
                    type="number"
                    value={goal.quantity}
                    onChange={(e) => handleGoalChange(index, 'quantity', e.target.value)}
                    placeholder="수량"
                    min="1"
                    className="w-24 px-3 py-2 bg-light-100 dark:bg-dark-200 rounded-lg border border-light-300 dark:border-dark-100 focus:border-primary-500 outline-none"
                  />
                  {goals.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(index)}
                      className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 미리보기 버튼 */}
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            className="w-full px-4 py-2 bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-100 rounded-lg transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? '계산 중...' : '필요 재료 미리보기'}
          </button>
          
          {/* 미리보기 결과 */}
          {previewData && (
            <div className="bg-light-200 dark:bg-dark-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">예상 아이템 생성 결과</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="text-center p-2 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">{previewData.tier1?.length || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">1차 재료</div>
                </div>
                <div className="text-center p-2 bg-purple-500/10 rounded-lg border border-purple-500/30">
                  <div className="text-2xl font-bold text-purple-500 dark:text-purple-400">{previewData.tier2?.length || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">2차 중간재</div>
                </div>
                <div className="text-center p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                  <div className="text-2xl font-bold text-yellow-500 dark:text-yellow-400">{previewData.tier3?.length || 0}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">3차 완성품</div>
                </div>
              </div>
              
              {/* 상세 목록 */}
              <div className="max-h-40 overflow-y-auto text-xs space-y-2">
                {previewData.tier3?.length > 0 && (
                  <div>
                    <div className="font-medium text-yellow-600 dark:text-yellow-400 mb-1">3차 완성품</div>
                    {previewData.tier3.map(item => (
                      <div key={item.name} className="text-gray-600 dark:text-gray-300">
                        • {item.name}: {item.required}개
                      </div>
                    ))}
                  </div>
                )}
                {previewData.tier2?.length > 0 && (
                  <div>
                    <div className="font-medium text-purple-600 dark:text-purple-400 mb-1">2차 중간재</div>
                    {previewData.tier2.map(item => (
                      <div key={item.name} className="text-gray-600 dark:text-gray-300">
                        • {item.name}: {item.required}개
                      </div>
                    ))}
                  </div>
                )}
                {previewData.tier1?.length > 0 && (
                  <div>
                    <div className="font-medium text-blue-600 dark:text-blue-400 mb-1">1차 재료</div>
                    {previewData.tier1.map(item => (
                      <div key={item.name} className="text-gray-600 dark:text-gray-300">
                        • {item.name}: {item.required}개
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1 px-4 py-2 bg-light-200 dark:bg-dark-200 hover:bg-light-300 dark:hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 text-white"
            >
              {createMutation.isPending ? '생성 중...' : '제작 계획 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
