import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../services/api'
import { DiscordText } from '../utils/discordEmoji'
import clsx from 'clsx'

function formatDate(timestamp) {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  
  // 1시간 이내
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return `${minutes}분 전`
  }
  // 24시간 이내
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}시간 전`
  }
  // 그 외
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getActionBadge(action) {
  switch (action) {
    case 'add':
      return { text: '추가', color: 'bg-green-500/20 text-green-400' }
    case 'remove':
      return { text: '삭제', color: 'bg-red-500/20 text-red-400' }
    case 'update_quantity':
      return { text: '수량 변경', color: 'bg-blue-500/20 text-blue-400' }
    case 'update_required':
    case 'edit_required':
      return { text: '목표 변경', color: 'bg-purple-500/20 text-purple-400' }
    case 'reset':
      return { text: '초기화', color: 'bg-orange-500/20 text-orange-400' }
    case 'rename':
      return { text: '이름 변경', color: 'bg-yellow-500/20 text-yellow-400' }
    default:
      return { text: action, color: 'bg-gray-500/20 text-gray-400' }
  }
}

function History() {
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const limit = 20

  const { data, isLoading } = useQuery({
    queryKey: ['history', page, typeFilter],
    queryFn: () => api.get('/history', {
      params: { page, limit, type: typeFilter || undefined }
    }).then(res => res.data),
  })

  const history = data?.data || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Clock className="text-primary-500" />
          수정 내역
        </h1>

        {/* 필터 */}
        <div className="flex gap-2">
          <button
            onClick={() => { setTypeFilter(''); setPage(1); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm transition-colors',
              !typeFilter ? 'bg-primary-600 text-white' : 'bg-dark-300 hover:bg-dark-200'
            )}
          >
            전체
          </button>
          <button
            onClick={() => { setTypeFilter('inventory'); setPage(1); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm transition-colors',
              typeFilter === 'inventory' ? 'bg-primary-600 text-white' : 'bg-dark-300 hover:bg-dark-200'
            )}
          >
            재고
          </button>
          <button
            onClick={() => { setTypeFilter('crafting'); setPage(1); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm transition-colors',
              typeFilter === 'crafting' ? 'bg-primary-600 text-white' : 'bg-dark-300 hover:bg-dark-200'
            )}
          >
            제작
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : history.length > 0 ? (
        <>
          {/* 테이블 */}
          <div className="bg-dark-300 rounded-xl border border-dark-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">시간</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">유형</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">카테고리</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">아이템</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">액션</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">상세</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">사용자</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100">
                  {history.map((entry, index) => {
                    const badge = getActionBadge(entry.action)
                    return (
                      <tr key={index} className="hover:bg-dark-200/50">
                        <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                          {formatDate(entry.timestamp)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs',
                            entry.type === 'inventory' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'
                          )}>
                            {entry.type === 'inventory' ? '재고' : '제작'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300"><DiscordText>{entry.category}</DiscordText></td>
                        <td className="px-4 py-3 text-sm font-medium"><DiscordText>{entry.itemName}</DiscordText></td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-0.5 rounded text-xs ${badge.color}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400 max-w-xs truncate">
                          {entry.details}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">{entry.userName}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              총 {pagination.total}개 중 {((pagination.page - 1) * limit) + 1}-{Math.min(pagination.page * limit, pagination.total)}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg bg-dark-300 hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-4 py-2 bg-dark-300 rounded-lg text-sm">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page === pagination.totalPages}
                className="p-2 rounded-lg bg-dark-300 hover:bg-dark-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Clock size={48} className="mx-auto mb-4 opacity-50" />
          <p>수정 내역이 없습니다.</p>
        </div>
      )}
    </div>
  )
}

export default History
