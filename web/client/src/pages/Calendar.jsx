import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { EventModal, EventDetailModal, DeleteEventModal, getEventColor } from '../components/EventModals'
import clsx from 'clsx'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

// 날짜 카드 컴포넌트
function DateCard({ date, events, isToday, isCurrentMonth, onEventClick, onDateClick }) {
  const dayOfWeek = date.getDay()
  const dayName = DAYS[dayOfWeek]
  const hasEvents = events.length > 0
  
  return (
    <div
      onClick={() => onDateClick(date)}
      className={clsx(
        'flex-shrink-0 w-24 sm:w-28 md:w-32 rounded-xl border p-3 cursor-pointer transition-all hover:scale-105',
        isToday 
          ? 'bg-primary-600/20 border-primary-500' 
          : isCurrentMonth 
            ? 'bg-dark-400 border-dark-300 hover:border-dark-200' 
            : 'bg-dark-500 border-dark-400 opacity-60',
        hasEvents && !isToday && 'border-l-4',
        hasEvents && events[0] && `border-l-${getEventColor(events[0].color).name}`
      )}
      style={hasEvents && events[0] ? { borderLeftColor: getEventColor(events[0].color).hex } : {}}
    >
      {/* 날짜 헤더 */}
      <div className="text-center mb-2">
        <div className={clsx(
          'text-xs font-medium',
          dayOfWeek === 0 && 'text-red-400',
          dayOfWeek === 6 && 'text-blue-400',
          dayOfWeek !== 0 && dayOfWeek !== 6 && 'text-gray-400'
        )}>
          {dayName}
        </div>
        <div className={clsx(
          'text-2xl font-bold',
          isToday && 'text-primary-400',
          !isCurrentMonth && 'text-gray-600'
        )}>
          {date.getDate()}
        </div>
      </div>
      
      {/* 구분선 */}
      <div className="border-t border-dark-300 my-2"></div>
      
      {/* 이벤트 목록 */}
      <div className="space-y-1 min-h-[60px]">
        {events.length === 0 ? (
          <div className="text-xs text-gray-500 text-center py-2">
            비수기
          </div>
        ) : (
          events.slice(0, 3).map((event, idx) => (
            <div
              key={idx}
              onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
              className={clsx(
                'text-xs px-2 py-1 rounded truncate cursor-pointer transition-colors',
                getEventColor(event.color).bg,
                'text-white hover:opacity-80'
              )}
              title={event.title}
            >
              {event.title}
            </div>
          ))
        )}
        {events.length > 3 && (
          <div className="text-xs text-gray-400 text-center">
            +{events.length - 3}
          </div>
        )}
      </div>
    </div>
  )
}

// 주간 행 컴포넌트
function WeekRow({ weekNumber, days, eventsByDate, today, currentMonth, onEventClick, onDateClick }) {
  const startDate = days[0]
  const endDate = days[days.length - 1]
  
  const formatDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`
  
  return (
    <div className="mb-6">
      {/* 주차 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-medium text-gray-400">
          {weekNumber}주차
        </span>
        <span className="text-xs text-gray-500">
          ({formatDate(startDate)} ~ {formatDate(endDate)})
        </span>
      </div>
      
      {/* 날짜 카드들 - 가로 스크롤 */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-200 scrollbar-track-dark-400">
        {days.map((date, idx) => {
          const dateKey = date.toDateString()
          const events = eventsByDate[dateKey] || []
          const isToday = date.toDateString() === today.toDateString()
          const isCurrentMonth = date.getMonth() === currentMonth
          
          return (
            <DateCard
              key={idx}
              date={date}
              events={events}
              isToday={isToday}
              isCurrentMonth={isCurrentMonth}
              onEventClick={onEventClick}
              onDateClick={onDateClick}
            />
          )
        })}
      </div>
    </div>
  )
}

function Calendar() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  // 현재 표시 월
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)
  
  // 모달 상태
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)

  // 권한 체크
  const canEdit = user?.isAdmin || user?.isServerOwner

  // 현재 월의 시작/끝 날짜 계산
  const { monthStart, monthEnd, calendarStart, calendarEnd } = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const monthStart = new Date(year, month, 1)
    const monthEnd = new Date(year, month + 1, 0)
    
    // 캘린더 그리드 시작 (이전 달 포함)
    const calendarStart = new Date(monthStart)
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay())
    
    // 캘린더 그리드 끝 (다음 달 포함)
    const calendarEnd = new Date(monthEnd)
    const remaining = 6 - calendarEnd.getDay()
    calendarEnd.setDate(calendarEnd.getDate() + remaining)
    
    return { monthStart, monthEnd, calendarStart, calendarEnd }
  }, [currentDate])

  // 이벤트 조회
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', calendarStart.toISOString(), calendarEnd.toISOString()],
    queryFn: () => api.get('/events', {
      params: {
        start: calendarStart.toISOString(),
        end: calendarEnd.toISOString()
      }
    }).then(res => res.data),
    enabled: !!user
  })

  // 날짜별 이벤트 그룹핑
  const eventsByDate = useMemo(() => {
    const map = {}
    for (const event of events) {
      // 이벤트 기간 내 모든 날짜에 이벤트 추가
      const start = new Date(event.startDate || event.start)
      const end = new Date(event.endDate || event.end || start)
      
      const current = new Date(start)
      while (current <= end) {
        const dateKey = current.toDateString()
        if (!map[dateKey]) map[dateKey] = []
        // 중복 체크
        if (!map[dateKey].find(e => e._id === event._id)) {
          map[dateKey].push(event)
        }
        current.setDate(current.getDate() + 1)
      }
    }
    return map
  }, [events])

  // 이벤트 생성
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEventModalOpen(false)
      setEditingEvent(null)
    }
  })

  // 이벤트 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put('/events/' + id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEventModalOpen(false)
      setEditingEvent(null)
      setDetailModalOpen(false)
    }
  })

  // 이벤트 삭제
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete('/events/' + id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setDeleteModalOpen(false)
      setSelectedEvent(null)
      setDetailModalOpen(false)
    }
  })

  // 월 이동
  const goToPrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }
  
  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }
  
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // 주별로 날짜 그룹핑
  const weeklyDays = useMemo(() => {
    const weeks = []
    const current = new Date(calendarStart)
    let currentWeek = []
    
    while (current <= calendarEnd) {
      currentWeek.push(new Date(current))
      
      if (current.getDay() === 6) {
        weeks.push(currentWeek)
        currentWeek = []
      }
      
      current.setDate(current.getDate() + 1)
    }
    
    if (currentWeek.length > 0) {
      weeks.push(currentWeek)
    }
    
    return weeks
  }, [calendarStart, calendarEnd])

  // 날짜 클릭 핸들러
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

  // 이벤트 클릭 핸들러
  const handleEventClick = (event) => {
    setSelectedEvent(event)
    setDetailModalOpen(true)
  }

  // 수정 핸들러
  const handleEdit = (event) => {
    const originalEvent = event.isInstance ? { ...event, _id: event.originalId } : event
    setEditingEvent(originalEvent)
    setDetailModalOpen(false)
    setEventModalOpen(true)
  }

  // 삭제 핸들러
  const handleDelete = (event) => {
    const originalEvent = event.isInstance ? { ...event, _id: event.originalId } : event
    setSelectedEvent(originalEvent)
    setDetailModalOpen(false)
    setDeleteModalOpen(true)
  }

  // 이벤트 제출 핸들러
  const handleEventSubmit = (formData) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent._id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  // 삭제 확인 핸들러
  const handleDeleteConfirm = (event) => {
    deleteMutation.mutate(event._id)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="w-full">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon className="w-7 h-7 text-primary-500" />
          일정
        </h1>
        
        {canEdit && (
          <button
            onClick={() => {
              setEditingEvent(null)
              setSelectedDate(new Date().toISOString().split('T')[0])
              setEventModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg transition-colors"
          >
            <Plus size={20} />
            일정 추가
          </button>
        )}
      </div>

      {/* 네비게이션 */}
      <div className="bg-dark-400 rounded-xl border border-dark-300 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-dark-300 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-dark-300 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            <h2 className="text-xl font-semibold ml-2">
              {currentDate.getFullYear()}년 {MONTHS[currentDate.getMonth()]}
            </h2>
          </div>
          
          <button
            onClick={goToToday}
            className="px-4 py-2 text-sm bg-dark-300 hover:bg-dark-200 rounded-lg transition-colors"
          >
            오늘
          </button>
        </div>
      </div>

      {/* 날짜 카드 그리드 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="space-y-2">
          {weeklyDays.map((week, weekIdx) => (
            <WeekRow
              key={weekIdx}
              weekNumber={weekIdx + 1}
              days={week}
              eventsByDate={eventsByDate}
              today={today}
              currentMonth={currentDate.getMonth()}
              onEventClick={handleEventClick}
              onDateClick={handleDateClick}
            />
          ))}
        </div>
      )}

      {/* 범례 */}
      <div className="mt-8 p-4 bg-dark-400 rounded-xl border border-dark-300">
        <div className="text-sm text-gray-400 mb-2">범례</div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-blue-500"></div>
            <span className="text-sm">파란색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-green-500"></div>
            <span className="text-sm">초록색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-yellow-500"></div>
            <span className="text-sm">노란색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-red-500"></div>
            <span className="text-sm">빨간색</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-purple-500"></div>
            <span className="text-sm">보라색</span>
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
