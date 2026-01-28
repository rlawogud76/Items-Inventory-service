import { useState, useEffect } from 'react'
import { X, Calendar, Clock, Repeat } from 'lucide-react'
import clsx from 'clsx'

// 이벤트 색상 정의
const EVENT_COLORS = {
  default: { bg: 'bg-gray-600', text: 'text-gray-300', dot: 'bg-gray-400' },
  red: { bg: 'bg-red-600', text: 'text-red-400', dot: 'bg-red-500' },
  orange: { bg: 'bg-orange-600', text: 'text-orange-400', dot: 'bg-orange-500' },
  yellow: { bg: 'bg-yellow-600', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  green: { bg: 'bg-green-600', text: 'text-green-400', dot: 'bg-green-500' },
  blue: { bg: 'bg-blue-600', text: 'text-blue-400', dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-600', text: 'text-purple-400', dot: 'bg-purple-500' },
  pink: { bg: 'bg-pink-600', text: 'text-pink-400', dot: 'bg-pink-500' },
}

export function getEventColor(color) {
  return EVENT_COLORS[color] || EVENT_COLORS.blue
}

const REPEAT_OPTIONS = [
  { value: 'none', label: '반복 안함' },
  { value: 'daily', label: '매일' },
  { value: 'weekly', label: '매주' },
  { value: 'monthly', label: '매월' },
]

// 날짜를 input[type=date] 형식으로
function formatDateForInput(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toISOString().split('T')[0]
}

// 이벤트 생성/수정 모달
export function EventModal({ isOpen, onClose, onSubmit, event, selectedDate, isPending }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    color: 'blue',
    repeat: 'none',
    repeatEndDate: ''
  })

  useEffect(() => {
    if (isOpen) {
      if (event) {
        setFormData({
          title: event.title || '',
          description: event.description || '',
          startDate: formatDateForInput(event.startDate),
          endDate: formatDateForInput(event.endDate),
          color: event.color || 'blue',
          repeat: event.repeat || 'none',
          repeatEndDate: formatDateForInput(event.repeatEndDate)
        })
      } else {
        setFormData({
          title: '',
          description: '',
          startDate: selectedDate || formatDateForInput(new Date()),
          endDate: '',
          color: 'blue',
          repeat: 'none',
          repeatEndDate: ''
        })
      }
    }
  }, [isOpen, event, selectedDate])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.title.trim() || !formData.startDate) return
    onSubmit(formData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-dark-300 rounded-xl w-full max-w-md border border-dark-100 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <h2 className="text-lg font-semibold">
            {event ? '일정 수정' : '새 일정'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-dark-200 rounded">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 제목 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">제목 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              placeholder="일정 제목"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 resize-none"
              rows={3}
              placeholder="일정 설명 (선택사항)"
            />
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">시작일 *</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">종료일</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">색상</label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(EVENT_COLORS).map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={clsx(
                    'w-8 h-8 rounded-full transition-all',
                    EVENT_COLORS[color].bg,
                    formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-300' : 'hover:scale-110'
                  )}
                />
              ))}
            </div>
          </div>

          {/* 반복 */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">반복</label>
            <select
              value={formData.repeat}
              onChange={(e) => setFormData(prev => ({ ...prev, repeat: e.target.value }))}
              className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
            >
              {REPEAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 반복 종료일 */}
          {formData.repeat !== 'none' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">반복 종료일</label>
              <input
                type="date"
                value={formData.repeatEndDate}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatEndDate: e.target.value }))}
                className="w-full px-3 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          )}

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-dark-100 hover:bg-dark-200 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isPending ? '저장 중...' : (event ? '수정' : '추가')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// 이벤트 상세 보기 모달
export function EventDetailModal({ isOpen, onClose, event, onEdit, onDelete, canEdit }) {
  if (!isOpen || !event) return null

  const repeatLabel = {
    none: null,
    daily: '매일 반복',
    weekly: '매주 반복',
    monthly: '매월 반복'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-dark-300 rounded-xl w-full max-w-md border border-dark-100 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <span className={clsx('w-3 h-3 rounded-full', getEventColor(event.color).dot)} />
            <h2 className="text-lg font-semibold">{event.title}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-dark-200 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* 날짜 */}
          <div className="flex items-center gap-2 text-gray-300">
            <Calendar size={18} />
            <span>
              {new Date(event.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              {event.endDate && event.endDate !== event.startDate && (
                <> ~ {new Date(event.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</>
              )}
            </span>
          </div>

          {/* 반복 */}
          {event.repeat !== 'none' && (
            <div className="flex items-center gap-2 text-gray-400">
              <Repeat size={18} />
              <span>{repeatLabel[event.repeat]}</span>
              {event.repeatEndDate && (
                <span className="text-sm">
                  (~ {new Date(event.repeatEndDate).toLocaleDateString('ko-KR')})
                </span>
              )}
            </div>
          )}

          {/* 설명 */}
          {event.description && (
            <div className="text-gray-300 bg-dark-200 rounded-lg p-3">
              {event.description}
            </div>
          )}

          {/* 생성자 */}
          {event.createdByName && (
            <div className="text-sm text-gray-500">
              작성자: {event.createdByName}
            </div>
          )}

          {/* 버튼 */}
          {canEdit && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onDelete(event)}
                className="flex-1 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors"
              >
                삭제
              </button>
              <button
                onClick={() => onEdit(event)}
                className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors font-medium"
              >
                수정
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 삭제 확인 모달
export function DeleteEventModal({ isOpen, onClose, onConfirm, event, isPending }) {
  if (!isOpen || !event) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-dark-300 rounded-xl w-full max-w-sm border border-dark-100 shadow-xl p-6">
        <h2 className="text-lg font-semibold mb-4">일정 삭제</h2>
        <p className="text-gray-300 mb-2">
          정말로 <span className="text-white font-medium">"{event.title}"</span> 일정을 삭제하시겠습니까?
        </p>
        {event.repeat !== 'none' && (
          <p className="text-yellow-400 text-sm mb-4">
             반복 일정이 모두 삭제됩니다.
          </p>
        )}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-dark-100 hover:bg-dark-200 rounded-lg transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(event)}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {isPending ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  )
}
