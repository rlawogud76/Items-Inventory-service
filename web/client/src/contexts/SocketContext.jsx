import { createContext, useContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'

const SocketContext = createContext(null)

// 프로덕션: 같은 서버에서 소켓 연결 (ngrok 지원)
const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }
  
  // 프로덕션: 현재 origin 사용
  return window.location.origin
}

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    const socketInstance = io(getSocketUrl(), {
      withCredentials: true,
    })

    socketInstance.on('connect', () => {
      console.log('🔌 소켓 연결됨')
      setConnected(true)
    })

    socketInstance.on('disconnect', () => {
      console.log('🔌 소켓 연결 해제')
      setConnected(false)
    })

    // 데이터 변경 시 캐시 무효화
    socketInstance.on('data-changed', (data) => {
      console.log('📡 데이터 변경 감지:', data)
      // 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['contributions'] })
      queryClient.invalidateQueries({ queryKey: ['history'] })
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [queryClient])

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider')
  }
  return context
}
