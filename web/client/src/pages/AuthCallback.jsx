import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function AuthCallback() {
  const navigate = useNavigate()
  const { checkAuth } = useAuth()

  useEffect(() => {
    // 인증 상태 확인 후 홈으로 이동
    checkAuth().then(() => {
      navigate('/')
    })
  }, [checkAuth, navigate])

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-dark-400 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-gray-500 dark:text-gray-400">로그인 처리 중...</p>
      </div>
    </div>
  )
}

export default AuthCallback
