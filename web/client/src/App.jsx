import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Crafting from './pages/Crafting'
import Contributions from './pages/Contributions'
import History from './pages/History'
import Settings from './pages/Settings'
import Points from './pages/Points'
import Permissions from './pages/Permissions'
import Tags from './pages/Tags'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-dark-400 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }
  
  // 로그인 필수가 아닌 경우 - 그냥 보여주기
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/:category" element={<Inventory />} />
        <Route path="crafting" element={<Crafting />} />
        <Route path="crafting/:category" element={<Crafting />} />
        <Route path="contributions" element={<Contributions />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
        <Route path="points" element={<Points />} />
        <Route path="permissions" element={<Permissions />} />
        <Route path="tags" element={<Navigate to="/tags/inventory" replace />} />
        <Route path="tags/:type" element={<Tags />} />
        <Route path="tags/:type/:category" element={<Tags />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
