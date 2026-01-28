import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { EventModal, EventDetailModal, DeleteEventModal, getEventColor } from '../components/EventModals'
import clsx from 'clsx'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']

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
      const dateKey = new Date(event._instanceDate || event.startDate).toDateString()
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(event)
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

  // 캘린더 날짜 배열 생성
  const calendarDays = useMemo(() => {
    const days = []
    const current = new Date(calendarStart)
    
    while (current <= calendarEnd) {
      days.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    
    return days
  }, [calendarStart, calendarEnd])

  // 날짜 클릭 핸들러
  const handleDateClick = (date) => {
    setSelectedDate(date.toISOString().split('T')[0])
    const dateEvents = eventsByDate[date.toDateString()] || []
    
    if (dateEvents.length === 1) {
      setSelectedEvent(dateEvents[0])
      setDetailModalOpen(true)
    } else if (dateEvents.length > 1) {
      // 여러 이벤트면 첫 번째 선택
      setSelectedEvent(dateEvents[0])
      setDetailModalOpen(true)
    } else if (canEdit) {
      // 이벤트 없으면 새로 생성
      setEditingEvent(null)
      setEventModalOpen(true)
    }
  }

  // 이벤트 클릭 핸들러
  const handleEventClick = (e, event) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setDetailModalOpen(true)
  }

  // 수정 핸들러
  const handleEdit = (event) => {
    // 반복 이벤트 인스턴스면 원본 ID 사용
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
    <div className="max-w-4xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarIcon size={28} />
          일정
        </h1>
        
        {canEdit && (
          <button
            onClick={() => {
              setEditingEvent(null)
              setSelectedDate(new Date().toISOString().split('T')[0])
              setEventModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          >
            <Plus size={20} />
            일정 추가
          </button>
        )}
      </div>

      {/* 캘린더 네비게이션 */}
      <div className="bg-dark-300 rounded-xl border border-dark-100 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-dark-200 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            <h2 className="text-xl font-semibold ml-2">
              {currentDate.getFullYear()}년 {MONTHS[currentDate.getMonth()]}
            </h2>
          </div>
          
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-sm bg-dark-200 hover:bg-dark-100 rounded-lg transition-colors"
          >
            오늘
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-dark-100">
          {DAYS.map((day, idx) => (
            <div
              key={day}
              className={clsx(
                'py-2 text-center text-sm font-medium',
                idx === 0 && 'text-red-400',
                idx === 6 && 'text-blue-400'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* 캘린더 그리드 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((date, idx) => {
              const isCurrentMonth = date.getMonth() === currentDate.getMonth()
              const isToday = date.toDateString() === today.toDateString()
              const dayEvents = eventsByDate[date.toDateString()] || []
              const dayOfWeek = date.getDay()
              
              return (
                <div
                  key={idx}
                  onClick={() => handleDateClick(date)}
                  className={clsx(
                    'min-h-[100px] p-2 border-b border-r border-dark-100 cursor-pointer transition-colors hover:bg-dark-200',
                    !isCurrentMonth && 'bg-dark-400/50'
                  )}
                >
                  <div className={clsx(
                    'text-sm font-medium mb-1',
                    !isCurrentMonth && 'text-gray-600',
                    isCurrentMonth && dayOfWeek === 0 && 'text-red-400',
                    isCurrentMonth && dayOfWeek === 6 && 'text-blue-400',
                    isToday && 'w-7 h-7 flex items-center justify-center bg-primary-600 rounded-full text-white'
                  )}>
                    {date.getDate()}
                  </div>
                  
                  {/* 이벤트 목록 */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((event, eventIdx) => (
                      <div
                        key={eventIdx}
                        onClick={(e) => handleEventClick(e, event)}
                        className={clsx(
                          'text-xs px-1.5 py-0.5 rounded truncate cursor-pointer',
                          getEventColor(event.color).bg,
                          'text-white hover:opacity-80'
                        )}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-gray-400 px-1">
                        +{dayEvents.length - 3}개 더
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
