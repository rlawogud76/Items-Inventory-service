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
  Palette
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

function TagCard({ tag, type, category, onEdit, onDelete, onColorChange }) {
  const { user } = useAuth()
  const [showColorPicker, setShowColorPicker] = useState(false)

  return (
    <div className="bg-dark-200 rounded-lg p-4 hover:bg-dark-100/50 transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${getTagColorClass(tag.color)}`} />
          <span className="font-medium">{tag.name}</span>
          <span className="text-xs text-gray-500">({tag.items?.length || 0}개 아이템)</span>
        </div>
        
        {user && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* 색상 변경 */}
            <div className="relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-1 hover:bg-dark-300 rounded text-yellow-400"
                title="색상 변경"
              >
                <Palette size={14} />
              </button>
              
              {showColorPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowColorPicker(false)} />
                  <div className="absolute right-0 top-full mt-1 bg-dark-300 border border-dark-100 rounded-lg shadow-lg z-50 p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {TAG_COLORS.map(color => (
                        <button
                          key={color.name}
                          onClick={() => {
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
              onClick={() => onDelete(tag.name)}
              className="p-1 hover:bg-dark-300 rounded text-red-400"
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
            <span key={idx} className="text-xs px-2 py-0.5 bg-dark-300 rounded-full text-gray-400">
              {itemName}
            </span>
          ))}
          {tag.items.length > 5 && (
            <span className="text-xs px-2 py-0.5 bg-dark-300 rounded-full text-gray-500">
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
      <div className="bg-dark-300 rounded-xl w-full max-w-sm border border-dark-100">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold">태그 추가</h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-200 rounded">
            ✕
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">태그 이름</label>
            <input
              type="text"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="태그 이름"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm text-gray-400 mb-2">색상</label>
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
              className="flex-1 px-4 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg"
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

function Tags() {
  const { type = 'inventory', category } = useParams()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['items', type, 'categories'],
    queryFn: () => api.get(`/items/${type}/categories`).then(res => res.data),
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

  return (
    <div className="flex gap-6">
      {/* 왼쪽 사이드바 */}
      <aside className="w-64 shrink-0 hidden lg:block">
        <div className="bg-dark-300 rounded-xl p-4 border border-dark-100 sticky top-20">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FolderOpen size={20} />
            카테고리
          </h2>
          
          {/* 타입 선택 */}
          <div className="flex gap-2 mb-4">
            <NavLink
              to="/tags/inventory"
              className={({ isActive }) => clsx(
                'flex-1 text-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                type === 'inventory' ? 'bg-primary-600 text-white' : 'bg-dark-200 hover:bg-dark-100'
              )}
            >
              재고
            </NavLink>
            <NavLink
              to="/tags/crafting"
              className={({ isActive }) => clsx(
                'flex-1 text-center px-3 py-1.5 rounded-lg text-sm transition-colors',
                type === 'crafting' ? 'bg-primary-600 text-white' : 'bg-dark-200 hover:bg-dark-100'
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
                    isActive ? 'bg-primary-600 text-white' : 'hover:bg-dark-200 text-gray-300'
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
          <h1 className="text-2xl font-bold flex items-center gap-2">
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
                type === 'inventory' ? 'bg-primary-600 text-white' : 'bg-dark-300'
              )}
            >
              재고
            </NavLink>
            <NavLink
              to="/tags/crafting"
              className={clsx(
                'flex-1 text-center px-3 py-2 rounded-lg transition-colors',
                type === 'crafting' ? 'bg-primary-600 text-white' : 'bg-dark-300'
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
            className="w-full px-4 py-2 bg-dark-300 border border-dark-100 rounded-lg"
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
      
      {/* 삭제 확인 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-300 rounded-xl w-full max-w-sm border border-dark-100 p-6 text-center">
            <h3 className="text-lg font-semibold mb-2">태그 삭제</h3>
            <p className="text-gray-400 mb-6">
              <span className="font-medium text-white">{deleteConfirm}</span> 태그를 삭제하시겠습니까?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-dark-200 hover:bg-dark-100 rounded-lg"
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
