import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { EventModal, EventDetailModal, DeleteEventModal, getEventColor } from '../components/EventModals'
import clsx from 'clsx'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

// 큰 날짜 카드 컴포넌트 (일주일 단위 표시용)
function DayCard({ date, events, isToday, isCurrentMonth, onEventClick, onDateClick }) {
  const dayOfWeek = date.getDay()
  const dayName = DAYS[dayOfWeek]
  const hasEvents = events.length > 0
  
  return (
    <div
      onClick={() => onDateClick(date)}
      className={clsx(
        'flex-1 min-w-0 rounded-2xl border-2 p-4 cursor-pointer transition-all hover:shadow-lg',
        isToday 
          ? 'bg-primary-500/10 dark:bg-primary-500/20 border-primary-500 shadow-lg shadow-primary-500/20' 
          : isCurrentMonth 
            ? 'bg-white dark:bg-dark-300 border-gray-200 dark:border-dark-100 hover:border-primary-500/50' 
            : 'bg-gray-50 dark:bg-dark-400 border-gray-200 dark:border-dark-200 opacity-50'
      )}
    >
      {/* 날짜 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={clsx(
            'text-3xl font-bold',
            isToday && 'text-primary-500',
            dayOfWeek === 0 && !isToday && 'text-red-500',
            dayOfWeek === 6 && !isToday && 'text-blue-500',
            !isToday && dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-gray-900 dark:text-white'
          )}>
            {date.getDate()}
          </span>
          <span className={clsx(
            'text-lg font-medium',
            dayOfWeek === 0 && 'text-red-400',
            dayOfWeek === 6 && 'text-blue-400',
            dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-gray-500 dark:text-gray-400'
          )}>
            {dayName}
          </span>
        </div>
        {hasEvents && (
          <span className="px-2 py-1 text-xs font-semibold bg-primary-500/20 text-primary-500 rounded-full">
            {events.length}개
          </span>
        )}
      </div>
      
      {/* 이벤트 목록 */}
      <div className="space-y-2 min-h-[120px]">
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-full py-8 text-gray-400 dark:text-gray-500">
            <span className="text-sm">일정 없음</span>
          </div>
        ) : (
          events.slice(0, 4).map((event, idx) => (
            <div
              key={idx}
              onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              className={clsx(
                'p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02]',
                getEventColor(event.color).bg
              )}
            >
              <div className="font-semibold text-white text-sm truncate">
                {event.title}
              </div>
              {event.description && (
                <div className="text-xs text-white/80 mt-1 line-clamp-2">
                  {event.description}
                </div>
              )}
            </div>
          ))
        )}
        {events.length > 4 && (
          <div className="text-center text-sm text-gray-400 pt-1">
            +{events.length - 4}개 더보기
          </div>
        )}
      </div>
    </div>
  )
}

function Calendar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // 현재 표시 주 (기준일)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    return new Date(today.getFullYear(), today.getMonth(), diff)
  })
  
  const [selectedDate, setSelectedDate] = useState(null)
  
  // 모달 상태
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)

  // 권한 체크
  const canEdit = user?.isAdmin || user?.isServerOwner

  // 현재 주의 날짜들 계산
  const weekDays = useMemo(() => {
    const days = []
    const current = new Date(currentWeekStart)
    for (let i = 0; i < 7; i++) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return days
  }, [currentWeekStart])

  // 주의 시작/끝
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  // 이벤트 조회
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', weekStart.toISOString(), weekEnd.toISOString()],
    queryFn: () => api.get('/events', {
      params: {
        start: weekStart.toISOString(),
        end: weekEnd.toISOString()
      }
    }).then(res => res.data),
    enabled: !!user
  })

  // 날짜별 이벤트 그룹핑
  const eventsByDate = useMemo(() => {
    const map = {}
    for (const event of events) {
      const start = new Date(event.startDate || event.start)
      const end = new Date(event.endDate || event.end || start)
      
      const current = new Date(start)
      while (current <= end) {
        const dateKey = current.toDateString()
        if (!map[dateKey]) map[dateKey] = []
        if (!map[dateKey].find(e => e._id === event._id)) {
          map[dateKey].push(event)
        }
        current.setDate(current.getDate() + 1)
      }
    }
    return map
  }, [events])

  // 이벤트 CRUD 뮤테이션
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEventModalOpen(false)
      setEditingEvent(null)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put('/events/' + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEventModalOpen(false)
      setEditingEvent(null)
      setDetailModalOpen(false)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete('/events/' + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setDeleteModalOpen(false)
      setSelectedEvent(null)
      setDetailModalOpen(false)
    }
  })

  // 주 이동
  const goToPrevWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() - 7)
      return newDate
    })
  }
  
  const goToNextWeek = () => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + 7)
      return newDate
    })
  }
  
  const goToThisWeek = () => {
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day
    setCurrentWeekStart(new Date(today.getFullYear(), today.getMonth(), diff))
  }

  // 클릭 핸들러
  const handleDateClick = (date) => {
    setSelectedDate(date.toISOString().split('T')[0])
    const dateEvents = eventsByDate[date.toDateString()] || []
    
    if (dateEvents.length === 1) {
      setSelectedEvent(dateEvents[0])
      setDetailModalOpen(true)
    } else if (dateEvents.length > 1) {
      setSelectedEvent(dateEvents[0])
      setDetailModalOpen(true)
    } else if (canEdit) {
      setEditingEvent(null)
      setEventModalOpen(true)
    }
  }

  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setDetailModalOpen(true)
  }

  const handleEdit = (event) => {
    const originalEvent = event.isInstance ? { ...event, _id: event.originalId } : event
    setEditingEvent(originalEvent)
    setDetailModalOpen(false)
    setEventModalOpen(true)
  }

  const handleDelete = (event) => {
    const originalEvent = event.isInstance ? { ...event, _id: event.originalId } : event
    setSelectedEvent(originalEvent)
    setDetailModalOpen(false)
    setDeleteModalOpen(true)
  }

  const handleEventSubmit = (formData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent._id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleDeleteConfirm = (event) => {
    deleteMutation.mutate(event._id)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 주간 범위 표시 문자열
  const weekRangeStr = `${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`

  return (
    <div className="max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3 text-gray-900 dark:text-white">
          <CalendarIcon className="w-8 h-8 text-primary-500" />
          일정
        </h1>
        
        {canEdit && (
          <button
            onClick={() => {
              setEditingEvent(null)
              setSelectedDate(new Date().toISOString().split('T')[0])
              setEventModalOpen(true)
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-colors font-medium"
          >
            <Plus size={20} />
            일정 추가
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="bg-white dark:bg-dark-300 rounded-2xl border-2 border-gray-200 dark:border-dark-100 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPrevWeek}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-xl transition-colors"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={goToNextWeek}
              className="p-2.5 hover:bg-gray-100 dark:hover:bg-dark-200 rounded-xl transition-colors"
            >
              <ChevronRight size={24} />
            </button>
            <div className="ml-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {currentWeekStart.getFullYear()}년 {MONTHS[currentWeekStart.getMonth()]}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {weekRangeStr}
              </p>
            </div>
          </div>
          
          <button
            onClick={goToThisWeek}
            className="px-5 py-2.5 text-sm font-medium bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-xl transition-colors text-gray-700 dark:text-gray-300"
          >
            이번 주
          </button>
        </div>
      </div>

      {/* 주간 카드 그리드 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((date, idx) => {
            const dateKey = date.toDateString()
            const dayEvents = eventsByDate[dateKey] || []
            const isToday = date.toDateString() === today.toDateString()
            const isCurrentMonth = date.getMonth() === currentWeekStart.getMonth()
            
            return (
              <DayCard
                key={idx}
                date={date}
                events={dayEvents}
                isToday={isToday}
                isCurrentMonth={isCurrentMonth}
                onEventClick={handleEventClick}
                onDateClick={handleDateClick}
              />
            )
          })}
        </div>
      )}

      {/* 이번 주 요약 */}
      <div className="mt-6 p-5 bg-white dark:bg-dark-300 rounded-2xl border-2 border-gray-200 dark:border-dark-100">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Clock size={20} className="text-primary-500" />
          이번 주 일정 요약
        </h3>
        <div className="space-y-2">
          {events.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-sm">이번 주 일정이 없습니다.</p>
          ) : (
            events.slice(0, 5).map((event, idx) => {
              const startDate = new Date(event.startDate || event.start)
              return (
                <div 
                  key={idx}
                  onClick={() => handleEventClick(event)}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-200 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-100 transition-colors"
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getEventColor(event.color).hex }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {event.title}
                    </div>
                    {event.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {event.description}
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                    {startDate.getMonth() + 1}/{startDate.getDate()}
                  </div>
                </div>
              )
            })
          )}
          {events.length > 5 && (
            <p className="text-sm text-gray-400 text-center pt-2">
              +{events.length - 5}개 더
            </p>
          )}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 p-4 bg-white dark:bg-dark-300 rounded-xl border border-gray-200 dark:border-dark-100">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">파란색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">초록색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">노란색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">빨간색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-sm text-gray-600 dark:text-gray-400">보라색</span>
          </div>
        </div>
      </div>

      {/* 모달들 */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={() => { setEventModalOpen(false); setEditingEvent(null); }}
        onSubmit={handleEventSubmit}
        event={editingEvent}
        selectedDate={selectedDate}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      <EventDetailModal
        isOpen={detailModalOpen}
        onClose={() => { setDetailModalOpen(false); setSelectedEvent(null); }}
        event={selectedEvent}
        onEdit={handleEdit}
        onDelete={handleDelete}
        canEdit={canEdit}
      />

      <DeleteEventModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setSelectedEvent(null); }}
        onConfirm={handleDeleteConfirm}
        event={selectedEvent}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

export default Calendar
