import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, RotateCcw, Save, ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Points() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [expandedCategories, setExpandedCategories] = useState({})
  const [editingPoints, setEditingPoints] = useState({})
  const [pendingChanges, setPendingChanges] = useState({})

  const { data: points, isLoading } = useQuery({
    queryKey: ['points'],
    queryFn: () => api.get('/settings/points').then(res => res.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ type, category, itemName, points }) =>
      api.patch(`/settings/points/${encodeURIComponent(type)}/${encodeURIComponent(category)}/${encodeURIComponent(itemName)}`, { points }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
    },
    onError: (error) => {
      alert(error.response?.data?.error || '배점 수정에 실패했습니다.')
    }
  })

  const resetMutation = useMutation({
    mutationFn: () => api.post('/settings/points/reset'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] })
      setPendingChanges({})
      alert('모든 배점이 1로 초기화되었습니다.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || '초기화에 실패했습니다.')
    }
  })

  const toggleCategory = (type, category) => {
    const key = `${type}:${category}`
    setExpandedCategories(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handlePointChange = (type, category, itemName, value) => {
    const key = `${type}:${category}:${itemName}`
    const numValue = parseInt(value) || 1
    const clampedValue = Math.max(1, Math.min(100, numValue))
    
    setEditingPoints(prev => ({
      ...prev,
      [key]: clampedValue
    }))

    const originalValue = points?.[type]?.[category]?.[itemName] || 1
    if (clampedValue !== originalValue) {
      setPendingChanges(prev => ({
        ...prev,
        [key]: { type, category, itemName, points: clampedValue }
      }))
    } else {
      setPendingChanges(prev => {
        const newChanges = { ...prev }
        delete newChanges[key]
        return newChanges
      })
    }
  }

  const handleSaveAll = async () => {
    const changes = Object.values(pendingChanges)
    if (changes.length === 0) return

    for (const change of changes) {
      await updateMutation.mutateAsync(change)
    }
    
    setPendingChanges({})
    setEditingPoints({})
    alert(`${changes.length}개 항목이 저장되었습니다.`)
  }

  const handleReset = () => {
    if (!confirm('정말로 모든 아이템의 배점을 1로 초기화하시겠습니까?')) return
    resetMutation.mutate()
  }

  const getItemPoint = (type, category, itemName) => {
    const key = `${type}:${category}:${itemName}`
    if (editingPoints[key] !== undefined) {
      return editingPoints[key]
    }
    return points?.[type]?.[category]?.[itemName] || 1
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <Star className="mx-auto mb-4 text-gray-400 dark:text-gray-600" size={48} />
          <p className="text-lg">관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const hasChanges = Object.keys(pendingChanges).length > 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <Star className="text-yellow-500" />
          배점 설정
        </h1>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <RotateCcw size={16} />
            전체 초기화
          </button>
          
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              <Save size={16} />
              {Object.keys(pendingChanges).length}개 저장
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-500 dark:text-gray-400 text-sm">
        아이템별 배점을 설정합니다. 배점은 기여도 계산에 사용됩니다. (1~100)
      </p>

      {/* 재고 배점 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-dark-100 overflow-hidden">
        <div className="p-4 bg-gray-100 dark:bg-dark-200 border-b border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
             재고 배점
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-dark-100">
          {points?.inventory && Object.keys(points.inventory).length > 0 ? (
            Object.keys(points.inventory).map(category => {
              const key = `inventory:${category}`
              const isExpanded = expandedCategories[key]
              const items = Object.keys(points.inventory[category] || {})
              
              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory('inventory', category)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{items.length}개</span>
                      {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {items.map(itemName => {
                        const itemKey = `inventory:${category}:${itemName}`
                        const hasChange = pendingChanges[itemKey]
                        
                        return (
                          <div key={itemName} className="flex items-center justify-between py-2 px-3 bg-gray-100 dark:bg-dark-200 rounded-lg">
                            <span className="text-sm text-gray-900 dark:text-white">{itemName}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={getItemPoint('inventory', category, itemName)}
                                onChange={(e) => handlePointChange('inventory', category, itemName, e.target.value)}
                                className={`w-20 px-3 py-1 text-center bg-white dark:bg-dark-100 border rounded text-sm focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white ${
                                  hasChange ? 'border-yellow-500' : 'border-gray-300 dark:border-dark-50'
                                }`}
                              />
                              <span className="text-gray-500 text-xs">점</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-4 text-center text-gray-500">
              등록된 재고 아이템이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 제작 배점 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-dark-100 overflow-hidden">
        <div className="p-4 bg-gray-100 dark:bg-dark-200 border-b border-gray-200 dark:border-dark-100">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
             제작 배점
          </h2>
        </div>
        
        <div className="divide-y divide-gray-200 dark:divide-dark-100">
          {points?.crafting && Object.keys(points.crafting).length > 0 ? (
            Object.keys(points.crafting).map(category => {
              const key = `crafting:${category}`
              const isExpanded = expandedCategories[key]
              const items = Object.keys(points.crafting[category] || {})
              
              return (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory('crafting', category)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-dark-200 transition-colors"
                  >
                    <span className="font-medium text-gray-900 dark:text-white">{category}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{items.length}개</span>
                      {isExpanded ? <ChevronDown size={18} className="text-gray-500" /> : <ChevronRight size={18} className="text-gray-500" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-2">
                      {items.map(itemName => {
                        const itemKey = `crafting:${category}:${itemName}`
                        const hasChange = pendingChanges[itemKey]
                        
                        return (
                          <div key={itemName} className="flex items-center justify-between py-2 px-3 bg-gray-100 dark:bg-dark-200 rounded-lg">
                            <span className="text-sm text-gray-900 dark:text-white">{itemName}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="1"
                                max="100"
                                value={getItemPoint('crafting', category, itemName)}
                                onChange={(e) => handlePointChange('crafting', category, itemName, e.target.value)}
                                className={`w-20 px-3 py-1 text-center bg-white dark:bg-dark-100 border rounded text-sm focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white ${
                                  hasChange ? 'border-yellow-500' : 'border-gray-300 dark:border-dark-50'
                                }`}
                              />
                              <span className="text-gray-500 text-xs">점</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="p-4 text-center text-gray-500">
              등록된 제작 아이템이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 변경사항 안내 */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto bg-yellow-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between">
          <span className="text-sm">
            {Object.keys(pendingChanges).length}개의 변경사항이 있습니다
          </span>
          <button
            onClick={handleSaveAll}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 px-3 py-1 bg-white text-yellow-700 rounded font-medium text-sm hover:bg-gray-100"
          >
            <Save size={14} />
            저장
          </button>
        </div>
      )}
    </div>
  )
}

export default Points
