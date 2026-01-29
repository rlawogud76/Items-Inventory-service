import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useCallback } from 'react'
import { useTour } from '../contexts/TourContext'
import { mainTourSteps, adminTourSteps } from '../config/tourSteps'

// 투어 스타일 설정
const tourStyles = {
  options: {
    arrowColor: '#fff',
    backgroundColor: '#fff',
    overlayColor: 'rgba(0, 0, 0, 0.6)',
    primaryColor: '#7c3aed', // primary-600
    textColor: '#1f2937',
    zIndex: 10000,
  },
  tooltip: {
    borderRadius: 12,
    padding: 20,
  },
  tooltipContent: {
    whiteSpace: 'pre-line',
    textAlign: 'left',
    fontSize: 14,
    lineHeight: 1.6,
  },
  buttonNext: {
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    color: '#fff',
    fontSize: 14,
    padding: '8px 16px',
  },
  buttonBack: {
    color: '#6b7280',
    fontSize: 14,
    marginRight: 8,
  },
  buttonSkip: {
    color: '#9ca3af',
    fontSize: 13,
  },
  buttonClose: {
    display: 'none',
  },
  spotlight: {
    borderRadius: 12,
  },
}

// 한글 로케일
const locale = {
  back: '이전',
  close: '닫기',
  last: '완료',
  next: '다음',
  skip: '건너뛰기',
}

function Tour() {
  const navigate = useNavigate()
  const location = useLocation()
  const { 
    runTour, 
    tourType, 
    stepIndex, 
    setStepIndex, 
    stopTour, 
    completeTour 
  } = useTour()

  // 투어 타입에 따른 단계 선택
  const steps = tourType === 'admin' ? adminTourSteps : mainTourSteps

  // 현재 단계의 path와 현재 위치가 다르면 이동
  useEffect(() => {
    if (!runTour) return
    
    const currentStep = steps[stepIndex]
    if (currentStep?.path && location.pathname !== currentStep.path) {
      navigate(currentStep.path)
    }
  }, [runTour, stepIndex, steps, navigate, location.pathname])

  // Joyride 콜백 처리
  const handleJoyrideCallback = useCallback((data) => {
    const { status, action, index, type } = data

    // 완료 또는 건너뛰기
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      if (status === STATUS.FINISHED) {
        completeTour(tourType)
      } else {
        stopTour()
      }
      return
    }

    // 단계 변경
    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1)
      
      // 다음 단계의 path가 있으면 먼저 이동
      const nextStep = steps[nextIndex]
      if (nextStep?.path && location.pathname !== nextStep.path) {
        navigate(nextStep.path)
        // 페이지 이동 후 약간의 딜레이를 주고 stepIndex 업데이트
        setTimeout(() => {
          setStepIndex(nextIndex)
        }, 300)
      } else {
        setStepIndex(nextIndex)
      }
    }
  }, [tourType, steps, location.pathname, navigate, setStepIndex, completeTour, stopTour])

  if (!runTour) return null

  return (
    <Joyride
      steps={steps}
      run={runTour}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      hideCloseButton
      disableScrolling={false}
      scrollOffset={100}
      spotlightPadding={8}
      callback={handleJoyrideCallback}
      styles={tourStyles}
      locale={locale}
      floaterProps={{
        disableAnimation: true,
      }}
    />
  )
}

export default Tour
