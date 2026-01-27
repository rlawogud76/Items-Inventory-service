import { useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../services/api'
import { DiscordText } from '../utils/discordEmoji'

export function ItemModal({ isOpen, onClose, type, categories = [], item = null }) {
  const queryClient = useQueryClient()
  const isEdit = !!item
  
  const [formData, setFormData] = useState({
    name: item?.name || '',
    category: item?.category || categories[0] || '',
    newCategory: '',
    useNewCategory: false,
    emoji: item?.emoji || '',
    quantity: item?.quantity || 0,
    required: item?.required || 0,
    itemType: item?.itemType || 'normal'
  })
  
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">현재 수량</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">목표 수량</label>
                <input
                  type="number"
                  value={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                  min="0"
                />
              </div>
            </div>
          )}
          
          {/* 목표 수량 - 수정 시 */}
          {isEdit && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">목표 수량</label>
              <input
                type="number"
                value={formData.required}
                onChange={(e) => setFormData({ ...formData, required: e.target.value })}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                min="0"
              />
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
              <option value="normal">일반</option>
              <option value="intermediate">중간재</option>
            </select>
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
