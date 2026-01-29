import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Save, Package, Hammer, Trash2, Plus, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'

function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(res => res.data),
  })

  // 카테고리 목록 조회
  const { data: inventoryCategories = [] } = useQuery({
    queryKey: ['items', 'inventory', 'categories'],
    queryFn: () => api.get('/items/inventory/categories').then(res => res.data),
  })

  const { data: craftingCategories = [] } = useQuery({
    queryKey: ['items', 'crafting', 'categories'],
    queryFn: () => api.get('/items/crafting/categories').then(res => res.data),
  })

  // 카테고리 이모지 조회
  const { data: categoryEmojis = { inventory: {}, crafting: {} } } = useQuery({
    queryKey: ['settings', 'category-emojis'],
    queryFn: () => api.get('/settings/category-emojis').then(res => res.data),
  })

  // 수량 프리셋 조회
  const { data: presetsData } = useQuery({
    queryKey: ['settings', 'quantity-presets'],
    queryFn: () => api.get('/settings/quantity-presets').then(res => res.data),
  })

  const [formData, setFormData] = useState({
    uiMode: 'normal',
    barLength: 15,
    selectMessageTimeout: 30,
    infoMessageTimeout: 15,
  })

  // 이모지 편집 상태
  const [emojiEdits, setEmojiEdits] = useState({})
  const [activeEmojiTab, setActiveEmojiTab] = useState('inventory')
  
  // 프리셋 편집 상태
  const [presetEdits, setPresetEdits] = useState([])
  const [newPresetValue, setNewPresetValue] = useState('')
  
  // 프리셋 초기화
  useEffect(() => {
    if (presetsData?.presets) {
      setPresetEdits(presetsData.presets)
    }
  }, [presetsData])

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: (data) => api.patch('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      alert('설정이 저장되었습니다.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || '설정 저장에 실패했습니다.')
    }
  })

  // 카테고리 이모지 저장 뮤테이션
  const emojiMutation = useMutation({
    mutationFn: ({ type, category, emoji }) => 
      api.patch(`/settings/category-emojis/${type}/${encodeURIComponent(category)}`, { emoji }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'category-emojis'] })
    },
    onError: (error) => {
      alert(error.response?.data?.error || '이모지 저장에 실패했습니다.')
    }
  })

  // 카테고리 이모지 삭제 뮤테이션
  const emojiDeleteMutation = useMutation({
    mutationFn: ({ type, category }) => 
      api.delete(`/settings/category-emojis/${type}/${encodeURIComponent(category)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'category-emojis'] })
    }
  })
  
  // 프리셋 저장 뮤테이션
  const presetMutation = useMutation({
    mutationFn: (presets) => api.patch('/settings/quantity-presets', { presets }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'quantity-presets'] })
      alert('프리셋이 저장되었습니다.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || '프리셋 저장에 실패했습니다.')
    }
  })

  const handleEmojiSave = (type, category) => {
    const emoji = emojiEdits[`${type}-${category}`]
    if (emoji?.trim()) {
      emojiMutation.mutate({ type, category, emoji: emoji.trim() })
      setEmojiEdits(prev => {
        const next = { ...prev }
        delete next[`${type}-${category}`]
        return next
      })
    }
  }

  const handleEmojiDelete = (type, category) => {
    if (confirm(`"${category}" 카테고리의 이모지를 삭제하시겠습니까?`)) {
      emojiDeleteMutation.mutate({ type, category })
    }
  }
  
  const handlePresetAdd = () => {
    const value = parseInt(newPresetValue)
    if (!isNaN(value) && value > 0 && !presetEdits.includes(value)) {
      setPresetEdits([...presetEdits, value].sort((a, b) => a - b))
      setNewPresetValue('')
    }
  }
  
  const handlePresetRemove = (value) => {
    setPresetEdits(presetEdits.filter(p => p !== value))
  }
  
  const handlePresetSave = () => {
    if (presetEdits.length > 0) {
      presetMutation.mutate(presetEdits)
    }
  }

  const getEmojiValue = (type, category) => {
    const editKey = `${type}-${category}`
    if (editKey in emojiEdits) {
      return emojiEdits[editKey]
    }
    return categoryEmojis[type]?.[category] || ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
        <SettingsIcon className="text-primary-500" />
        설정
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* UI 모드 */}
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">UI 설정</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">UI 모드</label>
              <select
                value={formData.uiMode}
                onChange={(e) => setFormData({ ...formData, uiMode: e.target.value })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
              >
                <option value="normal">일반</option>
                <option value="detailed">상세</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                상세 모드에서는 더 많은 정보가 표시됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                프로그레스 바 길이: {formData.barLength}
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={formData.barLength}
                onChange={(e) => setFormData({ ...formData, barLength: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>짧게 (5)</span>
                <span>길게 (30)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 타이머 설정 (Discord 봇 전용이지만 웹에서도 설정 가능) */}
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">타이머 설정</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            이 설정은 Discord 봇에서 사용됩니다.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                선택 메뉴 타임아웃 (초)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={formData.selectMessageTimeout}
                onChange={(e) => setFormData({ ...formData, selectMessageTimeout: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                안내 메시지 타임아웃 (초)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={formData.infoMessageTimeout}
                onChange={(e) => setFormData({ ...formData, infoMessageTimeout: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        {user && (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium disabled:opacity-50 text-white"
          >
            <Save size={18} />
            {mutation.isPending ? '저장 중...' : '설정 저장'}
          </button>
        )}

        {!user && (
          <p className="text-center text-gray-400 text-sm">
            설정을 변경하려면 로그인이 필요합니다.
          </p>
        )}
      </form>

      {/* 카테고리 이모지 설정 (관리자 전용) */}
      {user && (
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            � 수량 프리셋 설정
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            재고/제작 페이지에서 빠른 수량 증감에 사용할 프리셋 값을 설정합니다.
          </p>
          
          {/* 현재 프리셋 목록 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {presetEdits.map((preset) => (
              <div
                key={preset}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 dark:bg-dark-200 rounded-lg"
              >
                <span className="font-medium text-gray-900 dark:text-white">{preset}</span>
                <button
                  type="button"
                  onClick={() => handlePresetRemove(preset)}
                  className="p-0.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {presetEdits.length === 0 && (
              <span className="text-gray-500">프리셋이 없습니다.</span>
            )}
          </div>
          
          {/* 새 프리셋 추가 */}
          <div className="flex gap-2 mb-4">
            <input
              type="number"
              value={newPresetValue}
              onChange={(e) => setNewPresetValue(e.target.value)}
              placeholder="숫자 입력..."
              min="1"
              className="flex-1 px-4 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handlePresetAdd}
              disabled={!newPresetValue || isNaN(parseInt(newPresetValue)) || parseInt(newPresetValue) <= 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:dark:bg-dark-100 text-white disabled:text-gray-500 rounded-lg transition-colors"
            >
              <Plus size={18} />
              추가
            </button>
          </div>
          
          {/* 저장 버튼 */}
          <button
            type="button"
            onClick={handlePresetSave}
            disabled={presetMutation.isPending || presetEdits.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:dark:bg-dark-100 text-white disabled:text-gray-500 rounded-lg font-medium transition-colors"
          >
            <Save size={18} />
            {presetMutation.isPending ? '저장 중...' : '프리셋 저장'}
          </button>
        </div>
      )}

      {/* 카테고리 이모지 설정 (관리자 전용) */}
      {user && (
        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            �📦 카테고리 이모지 설정
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            각 카테고리에 표시될 이모지를 설정합니다. Discord 이모지 문법 (예: :emoji_name:)도 지원됩니다.
          </p>

          {/* 탭 */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveEmojiTab('inventory')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium',
                activeEmojiTab === 'inventory'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-100'
              )}
            >
              <Package size={18} />
              재고
            </button>
            <button
              type="button"
              onClick={() => setActiveEmojiTab('crafting')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium',
                activeEmojiTab === 'crafting'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-dark-200 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-100'
              )}
            >
              <Hammer size={18} />
              제작
            </button>
          </div>

          {/* 카테고리 목록 */}
          <div className="space-y-3">
            {(activeEmojiTab === 'inventory' ? inventoryCategories : craftingCategories).map((category) => (
              <div
                key={category}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-200 rounded-lg"
              >
                {/* 미리보기 */}
                <div className="w-10 h-10 flex items-center justify-center text-2xl bg-white dark:bg-dark-300 rounded-lg border border-gray-200 dark:border-dark-100">
                  {categoryEmojis[activeEmojiTab]?.[category] ? (
                    <DiscordText>{categoryEmojis[activeEmojiTab][category]}</DiscordText>
                  ) : (
                    '📦'
                  )}
                </div>

                {/* 카테고리명 */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    <DiscordText>{category}</DiscordText>
                  </p>
                </div>

                {/* 이모지 입력 */}
                <input
                  type="text"
                  placeholder="이모지 입력..."
                  value={getEmojiValue(activeEmojiTab, category)}
                  onChange={(e) => setEmojiEdits(prev => ({
                    ...prev,
                    [`${activeEmojiTab}-${category}`]: e.target.value
                  }))}
                  className="w-32 px-3 py-2 text-sm bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
                />

                {/* 저장 버튼 */}
                <button
                  type="button"
                  onClick={() => handleEmojiSave(activeEmojiTab, category)}
                  disabled={!emojiEdits[`${activeEmojiTab}-${category}`]?.trim()}
                  className="px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:dark:bg-dark-100 text-white disabled:text-gray-500 rounded-lg transition-colors"
                >
                  <Save size={16} />
                </button>

                {/* 삭제 버튼 */}
                {categoryEmojis[activeEmojiTab]?.[category] && (
                  <button
                    type="button"
                    onClick={() => handleEmojiDelete(activeEmojiTab, category)}
                    className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            {(activeEmojiTab === 'inventory' ? inventoryCategories : craftingCategories).length === 0 && (
              <p className="text-center py-8 text-gray-400">
                {activeEmojiTab === 'inventory' ? '재고' : '제작'} 카테고리가 없습니다.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Settings
