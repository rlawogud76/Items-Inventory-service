import axios from 'axios'

// 프로덕션: 같은 서버에서 API 제공 (ngrok 지원)
const getApiUrl = () => {
  // 환경변수가 있으면 사용
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // 프로덕션: 같은 origin 사용 (ngrok, 배포 환경)
  // 개발: Vite 프록시가 처리
  return '/api'
}

const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 에러 인터셉터
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 인증 에러 시 커스텀 이벤트 발생 (로그아웃 처리용)
      window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export default api
