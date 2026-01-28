import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '../services/api'
import { DiscordText } from '../utils/discordEmoji'

// 수량 계산 상수
const ITEMS_PER_SET = 64
const ITEMS_PER_BOX = 64 * 54 // 3456

// 분리된 수량을 총 수량으로 변환
function calculateTotal(items, sets, boxes) {
  return (parseInt(items) || 0) + (parseInt(sets) || 0) * ITEMS_PER_SET + (parseInt(boxes) || 0) * ITEMS_PER_BOX
}

// 총 수량을 분리된 수량으로 변환
function splitQuantity(total) {
  const boxes = Math.floor(total / ITEMS_PER_BOX)
  const remaining = total % ITEMS_PER_BOX
  const sets = Math.floor(remaining / ITEMS_PER_SET)
  const items = remaining % ITEMS_PER_SET
  return { items, sets, boxes }
}

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
      setQuantityParts(splitQuantity(item?.quantity || 0))
      setRequiredParts(splitQuantity(item?.required || 0))
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
      quantity: calculateTotal(quantityParts.items, quantityParts.sets, quantityParts.boxes),
      required: calculateTotal(requiredParts.items, requiredParts.sets, requiredParts.boxes)
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
      <div className="bg-dark-300 rounded-xl w-full max-w-md border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold">
            {isEdit ? '아이템 수정' : '아이템 추가'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-200 rounded">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {/* 이름 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">이름 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="아이템 이름"
            />
          </div>
          
          {/* 카테고리 - 수정 시 변경 불가 */}
          {!isEdit && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">카테고리 *</label>
              {!formData.useNewCategory ? (
                <div className="space-y-2">
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                  >
                    <option value="">카테고리 선택</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, useNewCategory: true })}
                    className="text-sm text-primary-400 hover:text-primary-300"
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
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                    placeholder="새 카테고리 이름"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, useNewCategory: false })}
                    className="text-sm text-gray-400 hover:text-gray-300"
                  >
                    기존 카테고리에서 선택
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* 이모지 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">이모지</label>
            <input
              type="text"
              value={formData.emoji}
              onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="📦 또는 <:이름:ID>"
            />
            {formData.emoji && (
              <div className="mt-1 text-sm text-gray-400">
                미리보기: <DiscordText>{formData.emoji}</DiscordText>
              </div>
            )}
          </div>
          
          {/* 수량 - 추가 시에만 */}
          {!isEdit && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-2">현재 수량</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">상자</label>
                    <input
                      type="number"
                      value={quantityParts.boxes}
                      onChange={(e) => setQuantityParts({ ...quantityParts, boxes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">세트</label>
                    <input
                      type="number"
                      value={quantityParts.sets}
                      onChange={(e) => setQuantityParts({ ...quantityParts, sets: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">낱개</label>
                    <input
                      type="number"
                      value={quantityParts.items}
                      onChange={(e) => setQuantityParts({ ...quantityParts, items: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      min="0"
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1 text-right">
                  = 총 {formData.quantity.toLocaleString()}개
                </div>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-2">목표 수량</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">상자</label>
                    <input
                      type="number"
                      value={requiredParts.boxes}
                      onChange={(e) => setRequiredParts({ ...requiredParts, boxes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">세트</label>
                    <input
                      type="number"
                      value={requiredParts.sets}
                      onChange={(e) => setRequiredParts({ ...requiredParts, sets: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">낱개</label>
                    <input
                      type="number"
                      value={requiredParts.items}
                      onChange={(e) => setRequiredParts({ ...requiredParts, items: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
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
              <label className="block text-sm text-gray-400 mb-2">목표 수량</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상자</label>
                  <input
                    type="number"
                    value={requiredParts.boxes}
                    onChange={(e) => setRequiredParts({ ...requiredParts, boxes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">세트</label>
                  <input
                    type="number"
                    value={requiredParts.sets}
                    onChange={(e) => setRequiredParts({ ...requiredParts, sets: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">낱개</label>
                  <input
                    type="number"
                    value={requiredParts.items}
                    onChange={(e) => setRequiredParts({ ...requiredParts, items: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-center"
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
            <label className="block text-sm text-gray-400 mb-1">아이템 타입</label>
            <select
              value={formData.itemType}
              onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
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
              className="flex-1 px-4 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={addMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {addMutation.isPending || updateMutation.isPending ? '처리 중...' : (isEdit ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, isPending }) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-300 rounded-xl w-full max-w-sm border border-dark-100">
        <div className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <X className="text-red-500" size={24} />
          </div>
          <h3 className="text-lg font-semibold mb-2">아이템 삭제</h3>
          <p className="text-gray-400 mb-6">
            <DiscordText className="font-medium text-white">{itemName}</DiscordText>
            <br />이 아이템을 삭제하시겠습니까?
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
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isPending ? '삭제 중...' : '삭제'}
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
      <div className="bg-dark-300 rounded-xl w-full max-w-sm border border-dark-100">
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
