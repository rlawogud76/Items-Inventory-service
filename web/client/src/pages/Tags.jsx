import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { 
  Tag, 
  Plus, 
  Edit, 
  Trash2, 
  FolderOpen,
  ChevronRight,
  Palette,
  Check,
  X
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'
import clsx from 'clsx'

// 태그 색상 옵션
const TAG_COLORS = [
  { name: 'default', label: '기본', class: 'bg-gray-500' },
  { name: 'red', label: '빨강', class: 'bg-red-500' },
  { name: 'orange', label: '주황', class: 'bg-orange-500' },
  { name: 'yellow', label: '노랑', class: 'bg-yellow-500' },
  { name: 'green', label: '초록', class: 'bg-green-500' },
  { name: 'blue', label: '파랑', class: 'bg-blue-500' },
  { name: 'purple', label: '보라', class: 'bg-purple-500' },
  { name: 'pink', label: '분홍', class: 'bg-pink-500' },
]

function getTagColorClass(colorName) {
  return TAG_COLORS.find(c => c.name === colorName)?.class || 'bg-gray-500'
}

function TagCard({ tag, type, category, onEdit, onDelete, onColorChange, onManageItems }) {
  const { user } = useAuth()
  const [showColorPicker, setShowColorPicker] = useState(false)

  return (
    <div 
      className="bg-gray-100 dark:bg-dark-200 rounded-lg p-4 hover:bg-gray-200 dark:hover:bg-dark-100/50 transition-colors group cursor-pointer"
      onClick={() => onManageItems(tag)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getTagColorClass(tag.color)}`} />
          <span className="font-medium text-gray-900 dark:text-white">{tag.name}</span>
          <span className="text-xs text-gray-500">({tag.items?.length || 0}개 아이템)</span>
        </div>
        
        {user && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 색상 변경 */}
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowColorPicker(!showColorPicker)
                }}
                className="p-1 hover:bg-gray-300 dark:hover:bg-dark-300 rounded text-yellow-400"
                title="색상 변경"
              >
                <Palette size={14} />
              </button>
              
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={(e) => {
                    e.stopPropagation()
                    setShowColorPicker(false)
                  }} />
                  <div className="absolute right-0 top-full mt-1 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-lg shadow-lg z-50 p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color.name}
                          onClick={(e) => {
                            e.stopPropagation()
                            onColorChange(tag.name, color.name)
                            setShowColorPicker(false)
                          }}
                          className={`w-6 h-6 rounded-full ${color.class} hover:ring-2 ring-white/50`}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(tag.name)
              }}
              className="p-1 hover:bg-gray-300 dark:hover:bg-dark-300 rounded text-red-400"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
      
      {/* 소속 아이템 */}
      {tag.items && tag.items.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tag.items.slice(0, 5).map((itemName, idx) => (
            <span key={idx} className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-dark-300 rounded-full text-gray-600 dark:text-gray-400">
              {itemName}
            </span>
          ))}
          {tag.items.length > 5 && (
            <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-dark-300 rounded-full text-gray-500">
              +{tag.items.length - 5}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function CreateTagModal({ isOpen, onClose, onSubmit, isPending }) {
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState('default')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!tagName.trim()) return
    onSubmit({ tagName: tagName.trim(), color: tagColor })
    setTagName('')
    setTagColor('default')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-sm border border-gray-200 dark:border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">태그 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded text-gray-500 dark:text-gray-400">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">태그 이름</label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
              placeholder="태그 이름"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">색상</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map(color => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setTagColor(color.name)}
                  className={clsx(
                    'w-8 h-8 rounded-full transition-all',
                    color.class,
                    tagColor === color.name ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                  )}
                  title={color.label}
                />
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-lg text-gray-900 dark:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!tagName.trim() || isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50"
            >
              {isPending ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 아이템 관리 모달
function ManageItemsModal({ isOpen, onClose, tag, type, category, allItems, onAddItems, onRemoveItems, isPending }) {
  const [selectedItems, setSelectedItems] = useState(new Set())
  const taggedItems = new Set(tag?.items || [])
  
  // 태그에 없는 아이템들
  const availableItems = allItems.filter(item => !taggedItems.has(item.name))
  
  const handleToggleItem = (itemName) => {
    const newSelected = new Set(selectedItems)
    if (newSelected.has(itemName)) {
      newSelected.delete(itemName)
    } else {
      newSelected.add(itemName)
    }
    setSelectedItems(newSelected)
  }
  
  const handleAddSelected = () => {
    if (selectedItems.size > 0) {
      onAddItems(Array.from(selectedItems))
      setSelectedItems(new Set())
    }
  }
  
  const handleRemoveItem = (itemName) => {
    onRemoveItems([itemName])
  }

  if (!isOpen || !tag) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-2xl border border-gray-200 dark:border-dark-100 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${getTagColorClass(tag.color)}`} />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{tag.name} - 아이템 관리</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-dark-200 rounded text-gray-500 dark:text-gray-400">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* 현재 태그에 있는 아이템 */}
          <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-gray-200 dark:border-dark-100 overflow-auto">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              태그된 아이템 ({tag.items?.length || 0})
            </h3>
            {tag.items?.length > 0 ? (
              <div className="space-y-1">
                {tag.items.map(itemName => (
                  <div 
                    key={itemName}
                    className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-dark-200 rounded-lg group"
                  >
                    <span className="text-gray-900 dark:text-white">{itemName}</span>
                    <button
                      onClick={() => handleRemoveItem(itemName)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-dark-300 rounded text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="제거"
                      disabled={isPending}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">태그된 아이템이 없습니다</p>
            )}
          </div>
          
          {/* 추가 가능한 아이템 */}
          <div className="flex-1 p-4 overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                추가 가능 ({availableItems.length})
              </h3>
              {selectedItems.size > 0 && (
                <button
                  onClick={handleAddSelected}
                  className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 rounded"
                  disabled={isPending}
                >
                  선택 추가 ({selectedItems.size})
                </button>
              )}
            </div>
            {availableItems.length > 0 ? (
              <div className="space-y-1">
                {availableItems.map(item => (
                  <div 
                    key={item.name}
                    onClick={() => handleToggleItem(item.name)}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors',
                      selectedItems.has(item.name) 
                        ? 'bg-primary-600/30 border border-primary-500' 
                        : 'bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100'
                    )}
                  >
                    <div className={clsx(
                      'w-4 h-4 rounded border flex items-center justify-center',
                      selectedItems.has(item.name) 
                        ? 'bg-primary-500 border-primary-500' 
                        : 'border-gray-500'
                    )}>
                      {selectedItems.has(item.name) && <Check size={12} />}
                    </div>
                    <DiscordText className="text-sm">{item.emoji || '📦'}</DiscordText>
                    <span className="text-gray-900 dark:text-white">{item.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">모든 아이템이 이미 태그되어 있습니다</p>
            )}
          </div>
        </div>
        
        <div className="p-4 border-t border-gray-200 dark:border-dark-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-lg text-gray-900 dark:text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function Tags() {
  const { type = 'inventory', category } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [manageItemsTag, setManageItemsTag] = useState(null)

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', type, 'categories'],
    queryFn: () => api.get(`/items/${type}/categories`).then(res => res.data),
  })

  // 해당 카테고리의 모든 아이템 조회
  const { data: allItems = [] } = useQuery({
    queryKey: ['items', type, category],
    queryFn: () => category 
      ? api.get(`/items/${type}?category=${encodeURIComponent(category)}`).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!category,
  })

  // 태그 목록 조회
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags', type, category],
    queryFn: () => category 
      ? api.get(`/tags/${type}/${category}`).then(res => res.data)
      : Promise.resolve([]),
    enabled: !!category,
  })

  // 태그 생성
  const createMutation = useMutation({
    mutationFn: ({ tagName, color }) => 
      api.post('/tags', { type, category, tagName, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setCreateModalOpen(false)
    },
  })

  // 태그 삭제
  const deleteMutation = useMutation({
    mutationFn: (tagName) => 
      api.delete(`/tags/${type}/${category}/${tagName}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      setDeleteConfirm(null)
    },
  })

  // 태그 색상 변경
  const colorMutation = useMutation({
    mutationFn: ({ tagName, color }) => 
      api.patch(`/tags/${type}/${category}/${tagName}/color`, { color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  // 태그에 아이템 추가
  const addItemsMutation = useMutation({
    mutationFn: ({ tagName, items }) => 
      api.post(`/tags/${type}/${category}/${tagName}/items`, { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  // 태그에서 아이템 제거
  const removeItemsMutation = useMutation({
    mutationFn: ({ tagName, items }) => 
      api.delete(`/tags/${type}/${category}/${tagName}/items`, { data: { items } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    },
  })

  const handleCreateTag = (data) => {
    createMutation.mutate(data)
  }

  const handleDeleteTag = (tagName) => {
    setDeleteConfirm(tagName)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteMutation.mutate(deleteConfirm)
    }
  }

  const handleColorChange = (tagName, color) => {
    colorMutation.mutate({ tagName, color })
  }

  const handleManageItems = (tag) => {
    if (user) {
      setManageItemsTag(tag)
    }
  }

  const handleAddItems = (items) => {
    if (manageItemsTag) {
      addItemsMutation.mutate({ tagName: manageItemsTag.name, items })
    }
  }

  const handleRemoveItems = (items) => {
    if (manageItemsTag) {
      removeItemsMutation.mutate({ tagName: manageItemsTag.name, items })
    }
  }

  // 태그 데이터 갱신 시 모달에도 반영
  const currentTag = manageItemsTag 
    ? tags.find(t => t.name === manageItemsTag.name) || manageItemsTag
    : null

  return (
    <div className="flex gap-6">
      {/* 왼쪽 사이드바 */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="bg-white dark:bg-dark-300 rounded-xl p-4 border border-gray-200 dark:border-dark-100 sticky top-20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
            <FolderOpen size={20} />
            카테고리
          </h2>
          
          {/* 타입 선택 */}
          <div className="flex gap-2 mb-4">
            <NavLink
              to="/tags/inventory"
              className={({ isActive }) => clsx(
                'flex-1 text-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                type === 'inventory' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 text-gray-900 dark:text-white'
              )}
            >
              재고
            </NavLink>
            <NavLink
              to="/tags/crafting"
              className={({ isActive }) => clsx(
                'flex-1 text-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                type === 'crafting' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 text-gray-900 dark:text-white'
              )}
            >
              제작
            </NavLink>
          </div>
          
          <nav className="space-y-1">
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 px-3 py-2">카테고리가 없습니다</p>
            ) : (
              categories.map((cat) => (
                <NavLink
                  key={cat}
                  to={`/tags/${type}/${encodeURIComponent(cat)}`}
                  className={({ isActive }) => clsx(
                    'flex items-center justify-between px-3 py-2 rounded-lg transition-colors',
                    isActive ? 'bg-primary-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-dark-200 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <DiscordText>{cat}</DiscordText>
                  <ChevronRight size={16} />
                </NavLink>
              ))
            )}
          </nav>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 min-w-0">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
            <Tag className="text-primary-500" />
            태그 관리
            {category && <>- <DiscordText>{category}</DiscordText></>}
          </h1>
          
          {user && category && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              <Plus size={18} />
              태그 추가
            </button>
          )}
        </div>

        {/* 모바일 타입/카테고리 선택 */}
        <div className="lg:hidden space-y-2 mb-4">
          <div className="flex gap-2">
            <NavLink
              to="/tags/inventory"
              className={clsx(
                'flex-1 text-center px-3 py-2 rounded-lg transition-colors',
                type === 'inventory' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-300 text-gray-900 dark:text-white'
              )}
            >
              재고
            </NavLink>
            <NavLink
              to="/tags/crafting"
              className={clsx(
                'flex-1 text-center px-3 py-2 rounded-lg transition-colors',
                type === 'crafting' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-dark-300 text-gray-900 dark:text-white'
              )}
            >
              제작
            </NavLink>
          </div>
          <select
            value={category || ''}
            onChange={(e) => {
              if (e.target.value) {
                window.location.href = `/tags/${type}/${encodeURIComponent(e.target.value)}`
              }
            }}
            className="w-full px-4 py-2 bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 rounded-lg text-gray-900 dark:text-white"
          >
            <option value="">카테고리 선택</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* 태그 목록 */}
        {!category ? (
          <div className="text-center py-12 text-gray-400">
            왼쪽에서 카테고리를 선택하세요
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : tags.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {tags.map((tag) => (
              <TagCard
                key={tag.name}
                tag={tag}
                type={type}
                category={category}
                onEdit={() => {}}
                onDelete={handleDeleteTag}
                onColorChange={handleColorChange}
                onManageItems={handleManageItems}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400">
            태그가 없습니다
          </div>
        )}
      </div>

      {/* 모달 */}
      <CreateTagModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTag}
        isPending={createMutation.isPending}
      />
      
      {/* 아이템 관리 모달 */}
      <ManageItemsModal
        isOpen={!!manageItemsTag}
        onClose={() => setManageItemsTag(null)}
        tag={currentTag}
        type={type}
        category={category}
        allItems={allItems}
        onAddItems={handleAddItems}
        onRemoveItems={handleRemoveItems}
        isPending={addItemsMutation.isPending || removeItemsMutation.isPending}
      />
      
      {/* 삭제 확인 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-300 rounded-xl w-full max-w-sm border border-gray-200 dark:border-dark-100 p-6 text-center">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">태그 삭제</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              <span className="font-medium text-gray-900 dark:text-white">{deleteConfirm}</span> 태그를 삭제하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-lg text-gray-900 dark:text-white"
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                {deleteMutation.isPending ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tags
