import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
    
    // 401 에러 이벤트 리스너 (api.js에서 발생)
    const handleUnauthorized = () => {
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
    }
  }, [])

  async function checkAuth() {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data)
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
    setUser(null)
  }

  async function devLogin(username) {
    try {
      await api.post('/auth/dev-login', { username })
      await checkAuth()
      return true
    } catch (error) {
      console.error('개발 로그인 실패:', error)
      return false
    }
  }

  // 특정 기능에 대한 권한 확인
  const hasFeature = useCallback((featureKey) => {
    if (!user) return false
    if (user.isServerOwner) return true
    if (!user.allowedFeatures) return true // 기본적으로 허용
    if (user.allowedFeatures.includes('*')) return true
    return user.allowedFeatures.includes(featureKey)
  }, [user])

  // 역할 이름 반환
  const getRoleName = useCallback(() => {
    if (!user) return null
    if (user.role === 'owner') return '서버장'
    if (user.role === 'admin') return '관리자'
    return '멤버'
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, logout, devLogin, checkAuth, hasFeature, getRoleName }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
