import { createContext, useContext, useState, useCallback } from 'react'

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [runTour, setRunTour] = useState(false)
  const [tourType, setTourType] = useState('main') // 'main' | 'admin'
  const [stepIndex, setStepIndex] = useState(0)

  // 로컬스토리지에서 완료 상태 확인
  const [completedTours, setCompletedTours] = useState(() => {
    try {
      const saved = localStorage.getItem('completedTours')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const startTour = useCallback((type = 'main') => {
    setTourType(type)
    setStepIndex(0)
    setRunTour(true)
  }, [])

  const stopTour = useCallback(() => {
    setRunTour(false)
    setStepIndex(0)
  }, [])

  const completeTour = useCallback((type) => {
    const updated = { ...completedTours, [type]: true }
    setCompletedTours(updated)
    try {
      localStorage.setItem('completedTours', JSON.stringify(updated))
    } catch {
      // localStorage 에러 무시
    }
    setRunTour(false)
  }, [completedTours])

  const resetTours = useCallback(() => {
    setCompletedTours({})
    try {
      localStorage.removeItem('completedTours')
    } catch {
      // localStorage 에러 무시
    }
  }, [])

  const isTourCompleted = useCallback((type) => {
    return !!completedTours[type]
  }, [completedTours])

  return (
    <TourContext.Provider value={{
      runTour,
      setRunTour,
      tourType,
      setTourType,
      stepIndex,
      setStepIndex,
      startTour,
      stopTour,
      completeTour,
      resetTours,
      isTourCompleted,
      completedTours
    }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within TourProvider')
  }
  return context
}
