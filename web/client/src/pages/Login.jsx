import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Package, LogIn, AlertCircle } from 'lucide-react'

function Login() {
  const { devLogin } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // URL 파라미터에서 에러 확인
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'oauth_failed') {
      setError('Discord 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } else if (errorParam === 'no_code') {
      setError('Discord 인증 코드가 없습니다.')
    } else if (errorParam) {
      setError('로그인 중 오류가 발생했습니다.')
    }
  }, [searchParams])

  const handleDiscordLogin = () => {
    setError('')
    window.location.href = '/api/auth/discord'
  }

  const handleDevLogin = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    
    setLoading(true)
    const success = await devLogin(username.trim())
    setLoading(false)
    
    if (success) {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-400 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Package className="mx-auto text-primary-500 mb-4" size={48} />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">재고 관리 시스템</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">로그인하여 시작하세요</p>
        </div>

        <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100 space-y-6">
          {/* 에러 메시지 */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-500 dark:text-red-400 text-sm">
              <AlertCircle size={18} />
              {error}
            </div>
          )}
          
          {/* Discord 로그인 */}
          <button
            onClick={handleDiscordLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            Discord로 로그인
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-dark-100"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-dark-300 text-gray-500">또는</span>
            </div>
          </div>

          {/* 개발용 로그인 (프로덕션에서는 숨김) */}
          <form onSubmit={handleDevLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-2">
                테스트 사용자명 (개발용)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="사용자명 입력"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-dark-200 border border-gray-200 dark:border-dark-100 rounded-lg focus:outline-none focus:border-primary-500 text-gray-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-dark-200 hover:bg-gray-200 dark:hover:bg-dark-100 rounded-lg font-medium transition-colors disabled:opacity-50 text-gray-900 dark:text-white"
            >
              <LogIn size={18} />
              {loading ? '로그인 중...' : '테스트 로그인'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500">
            로그인 없이도 조회는 가능합니다.{' '}
            <a href="/" className="text-primary-500 hover:underline">
              둘러보기
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
