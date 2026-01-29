import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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
  const [toasts, setToasts] = useState([])
  const queryClient = useQueryClient()

  // 토스트 추가 함수
  const addToast = useCallback((toast) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { ...toast, id }])
    
    // 5초 후 자동 제거
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 5000)
  }, [])

  // 토스트 제거 함수
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

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

    // 데이터 변경 시 캐시 무효화 (변경된 타입에 따라 선택적 무효화)
    socketInstance.on('data-changed', (data) => {
      console.log('📡 데이터 변경 감지:', data)
      
      // 변경 타입에 따라 선택적으로 무효화
      if (data?.type === 'items') {
        queryClient.invalidateQueries({ queryKey: ['items'] })
        queryClient.invalidateQueries({ queryKey: ['crafting'] })
      } else if (data?.type === 'recipes') {
        queryClient.invalidateQueries({ queryKey: ['recipes'] })
        queryClient.invalidateQueries({ queryKey: ['crafting'] })
      } else if (data?.type === 'history') {
        queryClient.invalidateQueries({ queryKey: ['history'] })
        queryClient.invalidateQueries({ queryKey: ['contributions'] })
      } else {
        // 타입 정보 없으면 전체 무효화 (하위 호환)
        queryClient.invalidateQueries({ queryKey: ['items'] })
        queryClient.invalidateQueries({ queryKey: ['recipes'] })
        queryClient.invalidateQueries({ queryKey: ['contributions'] })
        queryClient.invalidateQueries({ queryKey: ['history'] })
      }
    })

    // 활동 알림 (수량 변경, 작업자 변경)
    socketInstance.on('activity', (data) => {
      console.log('📢 활동 알림:', data)
      
      let message = ''
      let icon = ''
      
      if (data.type === 'quantity') {
        if (data.action === 'add') {
          message = `${data.userName}님이 ${data.itemName}에 ${Math.abs(data.delta)}개 추가`
          icon = '➕'
        } else if (data.action === 'subtract') {
          message = `${data.userName}님이 ${data.itemName}에서 ${Math.abs(data.delta)}개 차감`
          icon = '➖'
        } else if (data.action === 'set') {
          message = `${data.userName}님이 ${data.itemName}을 ${data.value}개로 설정`
          icon = '📝'
        }
      } else if (data.type === 'worker') {
        if (data.action === 'start') {
          message = `${data.userName}님이 ${data.itemName} 작업 시작`
          icon = '🔨'
        } else if (data.action === 'stop') {
          message = `${data.userName}님이 ${data.itemName} 작업 완료`
          icon = '✅'
        }
      }
      
      if (message) {
        addToast({
          message,
          icon,
          type: data.type,
          action: data.action
        })
      }
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [queryClient, addToast])

  return (
    <SocketContext.Provider value={{ socket, connected, toasts, removeToast }}>
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
