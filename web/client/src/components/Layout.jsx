import { Outlet, NavLink, useLocation } from 'react-router-dom'
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
  LayoutDashboard
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import clsx from 'clsx'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드' },
  { path: '/inventory', icon: Package, label: '재고' },
  { path: '/crafting', icon: Hammer, label: '제작' },
  { path: '/contributions', icon: Trophy, label: '기여도' },
  { path: '/history', icon: History, label: '수정내역' },
  { path: '/settings', icon: Settings, label: '설정' },
]

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-dark-400">
      {/* 상단 헤더 */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-dark-300 border-b border-dark-100 z-50">
        <div className="h-full px-4 flex items-center justify-between">
          {/* 왼쪽: 메뉴 버튼 + 로고 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 hover:bg-dark-200 rounded-lg"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <div className="flex items-center gap-2">
              <Package className="text-primary-500" size={28} />
              <span className="text-xl font-bold hidden sm:block">재고 관리</span>
            </div>
          </div>

          {/* 가운데: 네비게이션 (데스크톱) */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'hover:bg-dark-200 text-gray-300'
                  )
                }
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* 오른쪽: 상태 + 유저 */}
          <div className="flex items-center gap-4">
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
                <span className="text-sm text-gray-300 hidden sm:block">
                  {user.username}
                  {user.isAdmin && (
                    <span className="ml-1 text-xs text-primary-400">(관리자)</span>
                  )}
                </span>
                <button
                  onClick={logout}
                  className="p-2 hover:bg-dark-200 rounded-lg text-gray-400 hover:text-white"
                  title="로그아웃"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm"
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

      {/* 모바일 사이드바 */}
      <aside
        className={clsx(
          'fixed top-16 left-0 bottom-0 w-64 bg-dark-300 border-r border-dark-100 z-40 transition-transform lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <nav className="p-4 flex flex-col gap-2">
          {navItems.map((item) => (
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
                    : 'hover:bg-dark-200 text-gray-300'
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
      <main className="pt-16 min-h-screen">
        <div className="p-4 lg:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

export default Layout
