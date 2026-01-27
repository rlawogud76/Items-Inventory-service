import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
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

  return (
    <AuthContext.Provider value={{ user, loading, logout, devLogin, checkAuth }}>
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
