import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Trash2, 
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Save,
  AlertCircle
} from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { DiscordText } from '../utils/discordEmoji'
import { DeleteConfirmModal } from '../components/ItemModals'
import clsx from 'clsx'
import { TIER_CONFIG } from '../utils/tierConfig'

// 레시피 카드 컴포넌트
function RecipeCard({ recipe, onEdit, onDelete, canManage }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="bg-white dark:bg-dark-400 rounded-lg border border-light-300 dark:border-dark-300 overflow-hidden">
      {/* 헤더 */}
      <div 
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-light-100 dark:hover:bg-dark-300 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="p-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
        
        <div className="flex-1">
          <div className="font-medium">
            <DiscordText>{recipe.resultName}</DiscordText>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {recipe.materials?.length || 0}개 재료
          </div>
        </div>
        
        {recipe.tier && (
          <span className={clsx(
            'text-xs px-2 py-0.5 rounded',
            TIER_CONFIG[recipe.tier]?.textColor,
            'bg-opacity-20'
          )}>
            {recipe.tier}차
          </span>
        )}
        
        {canManage && (
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onEdit(recipe)}
              className="p-1.5 hover:bg-light-200 dark:hover:bg-dark-200 rounded transition-colors"
            >
              <Edit3 className="w-4 h-4 text-gray-400 hover:text-primary-400" />
            </button>
            <button
              onClick={() => onDelete(recipe)}
              className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            >
              <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
            </button>
          </div>
        )}
      </div>
      
      {/* 재료 목록 */}
      {expanded && recipe.materials && recipe.materials.length > 0 && (
        <div className="border-t border-light-300 dark:border-dark-300 p-3 bg-light-100 dark:bg-dark-300/50">
          <div className="text-xs text-gray-500 mb-2">필요 재료</div>
          <div className="space-y-1">
            {recipe.materials.map((mat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>
                  <DiscordText>{mat.name}</DiscordText>
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  x{mat.quantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// 레시피 편집 모달
function RecipeModal({ isOpen, onClose, recipe, category, existingItems }) {
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    resultName: '',
    tier: 2,
    materials: [{ name: '', category: category || '', quantity: 1 }]
  })
  const [error, setError] = useState('')
  
  // 모달이 열릴 때마다 form 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData({
        resultName: recipe?.resultName || '',
        tier: recipe?.tier || 2,
        materials: recipe?.materials?.length > 0 
          ? recipe.materials.map(m => ({ ...m }))
          : [{ name: '', category: category || '', quantity: 1 }]
      })
      setError('')
    }
  }, [isOpen, recipe, category])
  
  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (recipe) {
        return api.put(`/recipes/${encodeURIComponent(category)}/${encodeURIComponent(recipe.resultName)}`, data)
      }
      return api.post('/recipes', { ...data, category })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      onClose()
    },
    onError: (err) => {
      setError(err.response?.data?.error || '저장 실패')
    }
  })
  
  const handleAddMaterial = () => {
    setFormData(prev => ({
      ...prev,
      materials: [...prev.materials, { name: '', category: category || '', quantity: 1 }]
    }))
  }
  
  const handleRemoveMaterial = (index) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index)
    }))
  }
  
  const handleMaterialChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      materials: prev.materials.map((mat, i) => 
        i === index ? { ...mat, [field]: field === 'quantity' ? parseInt(value) || 1 : value } : mat
      )
    }))
  }
  
  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    
    if (!formData.resultName.trim()) {
      setError('결과물 이름을 입력하세요')
      return
    }
    
    const validMaterials = formData.materials.filter(m => m.name.trim())
    if (validMaterials.length === 0) {
      setError('최소 1개의 재료가 필요합니다')
      return
    }
    
    saveMutation.mutate({
      resultName: formData.resultName,
      tier: formData.tier,
      materials: validMaterials
    })
  }
  
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-400 rounded-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-light-300 dark:border-dark-300">
          <h2 className="text-lg font-bold">
            {recipe ? '레시피 수정' : '새 레시피'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-light-200 dark:hover:bg-dark-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 text-red-400 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          {/* 결과물 이름 */}
          <div>
            <label className="block text-sm font-medium mb-1">결과물</label>
            <input
              type="text"
              value={formData.resultName}
              onChange={(e) => setFormData(prev => ({ ...prev, resultName: e.target.value }))}
              placeholder="제작 결과물 이름"
              className="w-full px-3 py-2 bg-light-100 dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-200 focus:border-primary-500 outline-none"
            />
          </div>
          
          {/* 티어 */}
          <div>
            <label className="block text-sm font-medium mb-1">티어</label>
            <div className="flex gap-2">
              {[1, 2, 3].map(tier => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, tier }))}
                  className={clsx(
                    'flex-1 py-2 rounded-lg transition-colors',
                    formData.tier === tier
                      ? `${TIER_CONFIG[tier].color} text-white`
                      : 'bg-light-200 dark:bg-dark-300 hover:bg-light-300 dark:hover:bg-dark-200'
                  )}
                >
                  {tier}차
                </button>
              ))}
            </div>
          </div>
          
          {/* 재료 목록 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">재료</label>
              <button
                type="button"
                onClick={handleAddMaterial}
                className="text-xs text-primary-400 hover:text-primary-300"
              >
                + 재료 추가
              </button>
            </div>
            
            <div className="space-y-2">
              {formData.materials.map((mat, idx) => (
                <div key={idx} className="flex gap-2">
                  <select
                    value={mat.name}
                    onChange={(e) => {
                      const selectedItem = existingItems?.find(i => i.name === e.target.value)
                      handleMaterialChange(idx, 'name', e.target.value)
                      if (selectedItem) {
                        handleMaterialChange(idx, 'category', selectedItem.category)
                      }
                    }}
                    className="flex-1 px-3 py-2 bg-light-100 dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-200 focus:border-primary-500 outline-none text-sm"
                  >
                    <option value="">재료 선택...</option>
                    {existingItems?.map(item => (
                      <option key={`${item.category}-${item.name}`} value={item.name}>
                        {item.name} ({item.category})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={mat.quantity}
                    onChange={(e) => handleMaterialChange(idx, 'quantity', e.target.value)}
                    min="1"
                    className="w-20 px-3 py-2 bg-light-100 dark:bg-dark-300 rounded-lg border border-light-300 dark:border-dark-200 focus:border-primary-500 outline-none text-sm text-center"
                  />
                  {formData.materials.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(idx)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* 저장 버튼 */}
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? '저장 중...' : '저장'}
          </button>
        </form>
      </div>
    </div>
  )
}

// 메인 페이지
export default function Recipes() {
  const { hasFeature } = useAuth()
  const queryClient = useQueryClient()
  const canManage = hasFeature('recipe')
  
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  
  // 레시피 조회
  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => api.get('/recipes').then(res => res.data)
  })
  
  // 인벤토리 아이템 조회 (재료 자동완성용)
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['items', 'inventory'],
    queryFn: () => api.get('/items/inventory').then(res => res.data)
  })
  
  // 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (recipe) => api.delete(`/recipes/${encodeURIComponent(recipe.category)}/${encodeURIComponent(recipe.resultName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      setDeleteTarget(null)
    }
  })
  
  // 카테고리 목록
  const categories = useMemo(() => {
    const cats = [...new Set(recipes.map(r => r.category))]
    return cats.sort()
  }, [recipes])
  
  // 필터링된 레시피
  const filteredRecipes = useMemo(() => {
    let result = recipes
    
    if (selectedCategory) {
      result = result.filter(r => r.category === selectedCategory)
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(r => 
        r.resultName.toLowerCase().includes(query) ||
        r.category.toLowerCase().includes(query) ||
        r.materials?.some(m => m.name.toLowerCase().includes(query))
      )
    }
    
    return result
  }, [recipes, selectedCategory, searchQuery])
  
  // 티어별 그룹화
  const groupedByTier = useMemo(() => {
    const groups = { 3: [], 2: [], 1: [], undefined: [] }
    filteredRecipes.forEach(recipe => {
      const tier = recipe.tier || undefined
      if (groups[tier]) {
        groups[tier].push(recipe)
      } else {
        groups.undefined.push(recipe)
      }
    })
    return groups
  }, [filteredRecipes])
  
  const handleEdit = (recipe) => {
    setEditingRecipe(recipe)
    setModalOpen(true)
  }
  
  const handleDelete = (recipe) => {
    setDeleteTarget(recipe)
  }
  
  const handleCloseModal = () => {
    setModalOpen(false)
    setEditingRecipe(null)
  }
  
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
            <BookOpen className="w-7 h-7 text-primary-500" />
            레시피 관리
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            제작에 필요한 재료 레시피를 관리합니다
          </p>
        </div>
        
        {canManage && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 레시피
          </button>
        )}
      </div>
      
      {/* 카테고리 탭 */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
              !selectedCategory
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-dark-400 hover:bg-light-200 dark:hover:bg-dark-300 border border-light-300 dark:border-transparent'
            )}
          >
            전체 ({recipes.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'px-4 py-2 rounded-lg whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-dark-400 hover:bg-light-200 dark:hover:bg-dark-300 border border-light-300 dark:border-transparent'
              )}
            >
              <DiscordText>{cat}</DiscordText>
              <span className="ml-1 text-xs opacity-60">
                ({recipes.filter(r => r.category === cat).length})
              </span>
            </button>
          ))}
        </div>
      )}
      
      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="레시피 또는 재료 검색..."
          className="w-full pl-10 pr-4 py-2 bg-white dark:bg-dark-400 rounded-lg border border-light-300 dark:border-dark-300 focus:border-primary-500 outline-none"
        />
      </div>
      
      {/* 레시피 목록 */}
      {filteredRecipes.length > 0 ? (
        <div className="space-y-6">
          {[3, 2, 1].map(tier => {
            const tierRecipes = groupedByTier[tier]
            if (!tierRecipes || tierRecipes.length === 0) return null
            
            const config = TIER_CONFIG[tier]
            const Icon = config.icon
            
            return (
              <div key={tier}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={clsx('p-1.5 rounded-lg', config.color)}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <h2 className={clsx('font-semibold', config.textColor)}>
                    {config.name}
                  </h2>
                  <span className="text-sm text-gray-500">
                    ({tierRecipes.length})
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {tierRecipes.map(recipe => (
                    <RecipeCard
                      key={`${recipe.category}-${recipe.resultName}`}
                      recipe={recipe}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      canManage={canManage}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          
          {/* 티어 미지정 레시피 */}
          {groupedByTier.undefined.length > 0 && (
            <div>
              <h2 className="font-semibold text-gray-400 mb-3">기타</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedByTier.undefined.map(recipe => (
                  <RecipeCard
                    key={`${recipe.category}-${recipe.resultName}`}
                    recipe={recipe}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">레시피가 없습니다</p>
          {canManage && (
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 px-6 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
            >
              첫 레시피 추가
            </button>
          )}
        </div>
      )}
      
      {/* 레시피 모달 */}
      <RecipeModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        recipe={editingRecipe}
        category={selectedCategory || categories[0]}
        existingItems={inventoryItems}
      />
      
      {/* 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget)}
        itemName={deleteTarget?.resultName}
        title="레시피 삭제"
        message={<><DiscordText className="font-medium">{deleteTarget?.resultName}</DiscordText><br />이 레시피를 삭제하시겠습니까?</>}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
