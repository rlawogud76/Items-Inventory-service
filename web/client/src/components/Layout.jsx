import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { 
  Package, 
  Hammer, 
  Trophy, 
  History, 
  Settings, 
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  LayoutDashboard,
  Star,
  Shield,
  Tag,
  Users,
  Calendar,
  Bell,
  Sun,
  Moon,
  BookOpen,
  HelpCircle,
  ChevronDown
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import { useTheme } from '../contexts/ThemeContext'
import { useTour } from '../contexts/TourContext'
import Tour from './Tour'
import api from '../services/api'
import clsx from 'clsx'

// 전체 네비게이션 아이템 (사이드바용)
const navItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드', tourId: 'nav-dashboard' },
  { path: '/inventory', icon: Package, label: '재고', tourId: 'nav-inventory' },
  { path: '/crafting', icon: Hammer, label: '제작', tourId: 'nav-crafting' },
  { path: '/recipes', icon: BookOpen, label: '레시피', tourId: 'nav-recipes' },
  { path: '/calendar', icon: Calendar, label: '일정', tourId: 'nav-calendar' },
  { path: '/tags', icon: Tag, label: '태그', tourId: 'nav-tags' },
  { path: '/contributions', icon: Trophy, label: '기여도', featureKey: 'contribution', tourId: 'nav-contributions' },
  { path: '/history', icon: History, label: '수정내역', featureKey: 'history', tourId: 'nav-history' },
  { path: '/settings', icon: Settings, label: '설정', tourId: 'nav-settings' },
  { path: '/points', icon: Star, label: '배점', adminOnly: true, tourId: 'nav-points' },
  { path: '/permissions', icon: Shield, label: '권한', adminOnly: true, tourId: 'nav-permissions' },
  { path: '/users', icon: Users, label: '유저', adminOnly: true, tourId: 'nav-users' },
]

// 헤더에 표시할 핵심 메뉴 (경로 기준)
const headerNavPaths = ['/', '/inventory', '/crafting']

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false) // 모바일용
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // localStorage에서 상태 복원
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [guideMenuOpen, setGuideMenuOpen] = useState(false)
  const notificationRef = useRef(null)
  const guideMenuRef = useRef(null)
  const { user, logout, hasFeature, getRoleName } = useAuth()
  const { connected, toasts, removeToast } = useSocket()
  const { isDark, toggleTheme } = useTheme()
  const { startTour } = useTour()
  const location = useLocation()
  
  // 사이드바 토글 (데스크톱)
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }

  // 다가오는 이벤트 조회 (알림용)
  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['events', 'upcoming'],
    queryFn: () => api.get('/events/upcoming').then(res => res.data),
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000, // 5분마다 리페치
  })

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationOpen(false)
      }
      if (guideMenuRef.current && !guideMenuRef.current.contains(event.target)) {
        setGuideMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 메뉴 필터링: 관리자 전용 + 권한 체크
  const filteredNavItems = navItems.filter(item => {
    // 관리자 전용 메뉴
    if (item.adminOnly && !(user?.isAdmin || user?.isServerOwner)) return false
    // 기능 권한 체크
    if (item.featureKey && !hasFeature(item.featureKey)) return false
    return true
  })

  return (
    <div className="h-screen overflow-hidden bg-light-100 dark:bg-dark-400 transition-colors flex flex-col">
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-dark-300 border-b border-light-300 dark:border-dark-100 z-50 transition-colors">
        <div className="h-full px-4 flex items-center justify-between">
          {/* 왼쪽: 메뉴 버튼 + 로고 */}
          <div className="flex items-center gap-4">
            {/* 모바일 메뉴 버튼 */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg transition-colors"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            {/* 데스크톱 사이드바 토글 버튼 */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg transition-colors"
              title={sidebarCollapsed ? '메뉴 펼치기' : '메뉴 접기'}
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-2">
              <Package className="text-primary-500" size={28} />
              <span className="text-xl font-bold hidden sm:block">재고 관리</span>
            </div>
          </div>

          {/* 가운데: 핵심 네비게이션 (데스크톱) */}
          <nav className="hidden lg:flex items-center gap-1">
            {filteredNavItems
              .filter(item => headerNavPaths.includes(item.path))
              .map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'hover:bg-light-200 dark:hover:bg-dark-200 text-gray-600 dark:text-gray-300'
                  )
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* 오른쪽: 가이드 + 테마 + 알림 + 상태 + 유저 */}
          <div className="flex items-center gap-4">
            {/* 가이드 버튼 */}
            <div className="relative" ref={guideMenuRef}>
              <button
                onClick={() => setGuideMenuOpen(!guideMenuOpen)}
                className="p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg text-gray-500 dark:text-gray-400 hover:text-primary-500 transition-colors flex items-center gap-1"
                title="사용법 가이드"
                data-tour="guide-button"
              >
                <HelpCircle size={20} />
                <ChevronDown size={14} className={clsx('transition-transform', guideMenuOpen && 'rotate-180')} />
              </button>

              {/* 가이드 드롭다운 */}
              {guideMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-dark-300 border border-light-300 dark:border-dark-100 rounded-xl shadow-xl z-50 overflow-hidden">
                  <button
                    onClick={() => {
                      setGuideMenuOpen(false)
                      startTour('main')
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-light-200 dark:hover:bg-dark-200 transition-colors flex items-center gap-2"
                  >
                    <HelpCircle size={18} className="text-primary-500" />
                    <span>사용법 가이드</span>
                  </button>
                  {(user?.isAdmin || user?.isServerOwner) && (
                    <button
                      onClick={() => {
                        setGuideMenuOpen(false)
                        startTour('admin')
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-light-200 dark:hover:bg-dark-200 transition-colors flex items-center gap-2 border-t border-light-300 dark:border-dark-100"
                    >
                      <Shield size={18} className="text-yellow-500" />
                      <span>관리자 가이드</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 테마 토글 */}
            <button
              onClick={toggleTheme}
              data-tour="theme-toggle"
              className="p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg text-gray-500 dark:text-gray-400 hover:text-yellow-500 transition-colors"
              title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* 알림 벨 */}
            {user && (
              <div className="relative" ref={notificationRef} data-tour="notifications">
                <button
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  <Bell size={20} />
                  {upcomingEvents.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </button>

                {/* 알림 드롭다운 */}
                {notificationOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-dark-300 border border-light-300 dark:border-dark-100 rounded-xl shadow-xl z-50">
                    <div className="p-3 border-b border-light-300 dark:border-dark-100">
                      <h3 className="font-medium">다가오는 일정</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {upcomingEvents.length > 0 ? (
                        upcomingEvents.map((event, idx) => {
                          const eventDate = new Date(event._instanceDate || event.startDate)
                          const isToday = eventDate.toDateString() === new Date().toDateString()
                          return (
                            <NavLink
                              key={idx}
                              to="/calendar"
                              onClick={() => setNotificationOpen(false)}
                              className="block px-3 py-2 hover:bg-light-200 dark:hover:bg-dark-200 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className={clsx(
                                  'w-2 h-2 rounded-full flex-shrink-0',
                                  event.color === 'red' && 'bg-red-500',
                                  event.color === 'orange' && 'bg-orange-500',
                                  event.color === 'yellow' && 'bg-yellow-500',
                                  event.color === 'green' && 'bg-green-500',
                                  event.color === 'blue' && 'bg-blue-500',
                                  event.color === 'purple' && 'bg-purple-500',
                                  event.color === 'pink' && 'bg-pink-500',
                                  (!event.color || event.color === 'default') && 'bg-gray-400'
                                )} />
                                <span className="font-medium text-sm truncate">{event.title}</span>
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 ml-4">
                                {isToday ? '오늘' : '내일'} · {eventDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                              </div>
                            </NavLink>
                          )
                        })
                      ) : (
                        <div className="p-4 text-center text-gray-500 text-sm">
                          예정된 일정이 없습니다
                        </div>
                      )}
                    </div>
                    <NavLink
                      to="/calendar"
                      onClick={() => setNotificationOpen(false)}
                      className="block p-2 text-center text-sm text-primary-500 hover:bg-light-200 dark:hover:bg-dark-200 border-t border-light-300 dark:border-dark-100"
                    >
                      캘린더 보기
                    </NavLink>
                  </div>
                )}
              </div>
            )}

            {/* 연결 상태 */}
            <div className="flex items-center gap-2 text-sm">
              {connected ? (
                <Wifi className="text-green-500" size={18} />
              ) : (
                <WifiOff className="text-red-500" size={18} />
              )}
            </div>

            {/* 유저 정보 */}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                  {user.username}
                  <span className={clsx(
                    'ml-1 text-xs',
                    user.isServerOwner ? 'text-yellow-500 dark:text-yellow-400' : user.isAdmin ? 'text-primary-500 dark:text-primary-400' : 'text-gray-500'
                  )}>
                    ({getRoleName()})
                  </span>
                </span>
                <button
                  onClick={logout}
                  className="p-2 hover:bg-light-200 dark:hover:bg-dark-200 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title="로그아웃"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm text-white"
              >
                로그인
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* 모바일 사이드바 오버레이 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 데스크탑 사이드바 (토글 가능) */}
      <aside 
        data-tour="sidebar"
        className={clsx(
          'hidden lg:flex flex-col fixed top-16 left-0 bottom-0 bg-white dark:bg-dark-300 border-r border-light-300 dark:border-dark-100 z-30 overflow-y-auto transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        <nav className="p-2 flex flex-col gap-1 flex-1">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={sidebarCollapsed ? item.label : undefined}
              data-tour={item.tourId}
              className={({ isActive }) =>
                clsx(
                  'rounded-lg flex items-center gap-3 transition-colors',
                  sidebarCollapsed ? 'p-3 justify-center' : 'px-4 py-3',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'hover:bg-light-200 dark:hover:bg-dark-200 text-gray-600 dark:text-gray-300'
                )
              }
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 모바일 사이드바 */}
      <aside
        className={clsx(
          'fixed top-16 left-0 bottom-0 w-64 bg-white dark:bg-dark-300 border-r border-light-300 dark:border-dark-100 z-40 transition-transform lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <nav className="p-4 flex flex-col gap-2">
          {filteredNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'px-4 py-3 rounded-lg flex items-center gap-3 transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'hover:bg-light-200 dark:hover:bg-dark-200 text-gray-600 dark:text-gray-300'
                )
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className={clsx(
        'pt-16 flex-1 overflow-y-auto transition-all duration-300',
        sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'
      )}>
        <div className="p-4 lg:p-6 pb-24 min-h-full">
          <Outlet />
        </div>
      </main>

      {/* 활동 토스트 알림 (왼쪽 아래) */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-fade-in',
              'bg-white dark:bg-dark-300 border border-light-300 dark:border-dark-100'
            )}
          >
            <span className="text-lg">{toast.icon}</span>
            <span className="text-sm flex-1">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-lg leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 인터랙티브 투어 */}
      <Tour />
    </div>
  )
}

export default Layout
