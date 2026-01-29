import { useQuery } from '@tanstack/react-query'
import { History as HistoryIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import api from '../services/api'

function History() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('all')
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['history', page, filter],
    queryFn: () => api.get('/history', { 
      params: { page, limit, type: filter === 'all' ? undefined : filter } 
    }).then(res => res.data),
  })

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionBadge = (action) => {
    const badges = {
      add: { text: '추가', class: 'bg-green-500/20 text-green-400' },
      remove: { text: '제거', class: 'bg-red-500/20 text-red-400' },
      update: { text: '수정', class: 'bg-blue-500/20 text-blue-400' },
      reset: { text: '초기화', class: 'bg-yellow-500/20 text-yellow-400' },
      create: { text: '생성', class: 'bg-purple-500/20 text-purple-400' },
      delete: { text: '삭제', class: 'bg-red-500/20 text-red-400' },
    }
    const badge = badges[action] || { text: action, class: 'bg-gray-500/20 text-gray-400' }
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${badge.class}`}>
        {badge.text}
      </span>
    )
  }

  const getTypeLabel = (type) => {
    const types = {
      inventory: '재고',
      crafting: '제작',
      recipe: '레시피',
      event: '이벤트',
      tag: '태그',
      settings: '설정',
    }
    return types[type] || type
  }

  const filterOptions = [
    { value: 'all', label: '전체' },
    { value: 'inventory', label: '재고' },
    { value: 'crafting', label: '제작' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2 text-gray-900 dark:text-white">
          <HistoryIcon className="text-primary-500" />
          활동 내역
        </h1>
      </div>

      {/* 필터 */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map(option => (
          <button
            key={option.value}
            onClick={() => { setFilter(option.value); setPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-dark-300 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-dark-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-dark-200">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">시간</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">유형</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">작업</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">대상</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">사용자</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600 dark:text-gray-400">상세</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-dark-100">
              {data?.history?.length > 0 ? (
                data.history.map(item => (
                  <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-dark-200/50">
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900 dark:text-white">{getTypeLabel(item.type)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {getActionBadge(item.action)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.target || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600 dark:text-gray-400">{item.username || '시스템'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 dark:text-gray-500 max-w-xs truncate block">
                        {item.details || '-'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    기록이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {data?.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            {page} / {data.totalPages}
          </span>
          
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="p-2 rounded-lg bg-white dark:bg-dark-300 border border-gray-200 dark:border-dark-100 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}

export default History
