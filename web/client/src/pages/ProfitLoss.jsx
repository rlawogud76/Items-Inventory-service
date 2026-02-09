import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Save, FileText, Calculator, TrendingUp, TrendingDown, Download, RefreshCw, RotateCcw } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useSocket } from '../contexts/SocketContext'
import clsx from 'clsx'

// 빈 항목 생성
const createEmptyEntry = () => ({
  item: '',
  price: '',
  qty: '',
  direct: '',
  note: ''
})

// 기본 수입/지출 항목
const defaultIncomeItems = ['아이템 판매', '재료 판매', '서비스 수수료', '농작물 판매', '기타 수입']
const defaultExpenseItems = ['재료 구매', '장비 구매', '수리/유지비', '인건비', '건축 자재', '기타 지출']

function ProfitLoss() {
  const { user } = useAuth()
  const { socket } = useSocket()
  const queryClient = useQueryClient()
  
  // 현재 편집 중인 문서 ID (localStorage에서 초기화)
  const [currentId, setCurrentId] = useState(() => {
    return localStorage.getItem('profitloss_currentId') || null
  })
  const [title, setTitle] = useState('손익계산서')
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0])
  const [income, setIncome] = useState([])
  const [expense, setExpense] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [initialized, setInitialized] = useState(false)

  // 목록 조회
  const { data: profitLossList = [], isLoading } = useQuery({
    queryKey: ['profitloss'],
    queryFn: () => api.get('/profitloss').then(res => res.data)
  })

  // 상세 조회
  const { data: currentDoc } = useQuery({
    queryKey: ['profitloss', currentId],
    queryFn: () => api.get(`/profitloss/${currentId}`).then(res => res.data),
    enabled: !!currentId
  })

  // 문서 로드 시 state 업데이트
  useEffect(() => {
    if (currentDoc) {
      setTitle(currentDoc.title || '손익계산서')
      setRecordDate(currentDoc.recordDate ? new Date(currentDoc.recordDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      setIncome(currentDoc.income?.length > 0 ? currentDoc.income : defaultIncomeItems.map(item => ({ ...createEmptyEntry(), item })))
      setExpense(currentDoc.expense?.length > 0 ? currentDoc.expense : defaultExpenseItems.map(item => ({ ...createEmptyEntry(), item })))
    }
  }, [currentDoc])

  // 새 문서 생성
  const createMutation = useMutation({
    mutationFn: (data) => api.post('/profitloss', data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
      setCurrentId(res.data._id)
      localStorage.setItem('profitloss_currentId', res.data._id)
      setLastSaved(new Date())
    }
  })

  // 문서 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => api.put(`/profitloss/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
      setLastSaved(new Date())
    }
  })

  // 문서 삭제
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/profitloss/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
      handleNew()
    }
  })

  // 소켓 실시간 업데이트
  useEffect(() => {
    if (!socket) return

    const handleUpdated = (data) => {
      if (data.id === currentId) {
        // 현재 보고 있는 문서가 업데이트됨
        queryClient.invalidateQueries({ queryKey: ['profitloss', currentId] })
      }
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
    }

    const handleCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
    }

    const handleDeleted = (data) => {
      if (data.id === currentId) {
        handleNew()
      }
      queryClient.invalidateQueries({ queryKey: ['profitloss'] })
    }

    socket.on('profitloss:updated', handleUpdated)
    socket.on('profitloss:created', handleCreated)
    socket.on('profitloss:deleted', handleDeleted)

    return () => {
      socket.off('profitloss:updated', handleUpdated)
      socket.off('profitloss:created', handleCreated)
      socket.off('profitloss:deleted', handleDeleted)
    }
  }, [socket, currentId, queryClient])

  // 새 문서
  const handleNew = useCallback(() => {
    setCurrentId(null)
    localStorage.removeItem('profitloss_currentId')
    setTitle('손익계산서')
    setRecordDate(new Date().toISOString().split('T')[0])
    setIncome(defaultIncomeItems.map(item => ({ ...createEmptyEntry(), item })))
    setExpense(defaultExpenseItems.map(item => ({ ...createEmptyEntry(), item })))
    setLastSaved(null)
  }, [])

  // 입력값만 초기화 (문서는 유지)
  const handleReset = useCallback(() => {
    setIncome(income.map(entry => ({ ...createEmptyEntry(), item: entry.item })))
    setExpense(expense.map(entry => ({ ...createEmptyEntry(), item: entry.item })))
  }, [income, expense])

  // 초기 로드: 저장된 문서가 없으면 가장 최근 문서 로드
  useEffect(() => {
    if (initialized) return
    
    if (profitLossList.length > 0 && !currentId) {
      // 가장 최근 문서 자동 로드
      const latestDoc = profitLossList[0]
      setCurrentId(latestDoc._id)
      localStorage.setItem('profitloss_currentId', latestDoc._id)
    } else if (profitLossList.length === 0 && !currentId && !isLoading) {
      // 문서가 없으면 빈 폼 초기화
      setIncome(defaultIncomeItems.map(item => ({ ...createEmptyEntry(), item })))
      setExpense(defaultExpenseItems.map(item => ({ ...createEmptyEntry(), item })))
    }
    
    if (!isLoading) {
      setInitialized(true)
    }
  }, [profitLossList, currentId, isLoading, initialized])

  // 문서 선택 시 localStorage 업데이트
  const handleSelectDocument = (id) => {
    setCurrentId(id)
    localStorage.setItem('profitloss_currentId', id)
  }

  // 저장
  const handleSave = async () => {
    if (!user) {
      alert('로그인이 필요합니다')
      return
    }
    
    setIsSaving(true)
    try {
      const data = { title, recordDate, income, expense }
      
      if (currentId) {
        await updateMutation.mutateAsync({ id: currentId, data })
      } else {
        await createMutation.mutateAsync(data)
      }
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  // 자동 저장 (디바운스)
  useEffect(() => {
    if (!currentId || !user) return
    
    const timer = setTimeout(() => {
      const data = { title, recordDate, income, expense }
      updateMutation.mutate({ id: currentId, data })
    }, 2000)

    return () => clearTimeout(timer)
  }, [title, recordDate, income, expense, currentId, user])

  // 항목 추가
  const addEntry = (type) => {
    const setter = type === 'income' ? setIncome : setExpense
    setter(prev => [...prev, createEmptyEntry()])
  }

  // 항목 삭제
  const removeEntry = (type, index) => {
    const setter = type === 'income' ? setIncome : setExpense
    setter(prev => prev.filter((_, i) => i !== index))
  }

  // 항목 수정
  const updateEntry = (type, index, field, value) => {
    const setter = type === 'income' ? setIncome : setExpense
    setter(prev => prev.map((entry, i) => 
      i === index ? { ...entry, [field]: value } : entry
    ))
  }

  // 소계 계산
  const calculateSubtotal = (entry) => {
    const price = parseFloat(entry.price) || 0
    const qty = parseFloat(entry.qty) || 0
    const direct = parseFloat(entry.direct) || 0
    return (price * qty) > 0 ? (price * qty) : direct
  }

  // 합계 계산
  const totals = useMemo(() => {
    const incomeTotal = income.reduce((sum, entry) => sum + calculateSubtotal(entry), 0)
    const expenseTotal = expense.reduce((sum, entry) => sum + calculateSubtotal(entry), 0)
    return {
      income: incomeTotal,
      expense: expenseTotal,
      profit: incomeTotal - expenseTotal
    }
  }, [income, expense])

  // 내보내기
  const handleExport = () => {
    let text = `${title}\n`
    text += `날짜: ${recordDate}\n\n`
    
    text += `=== 수입 ===\n`
    income.forEach(entry => {
      const subtotal = calculateSubtotal(entry)
      if (subtotal > 0 || entry.item) {
        text += `${entry.item}: ${subtotal.toLocaleString()} (${entry.note || ''})\n`
      }
    })
    text += `수입 합계: ${totals.income.toLocaleString()}\n\n`
    
    text += `=== 지출 ===\n`
    expense.forEach(entry => {
      const subtotal = calculateSubtotal(entry)
      if (subtotal > 0 || entry.item) {
        text += `${entry.item}: ${subtotal.toLocaleString()} (${entry.note || ''})\n`
      }
    })
    text += `지출 합계: ${totals.expense.toLocaleString()}\n\n`
    
    text += `=== 요약 ===\n`
    text += `순이익: ${totals.profit >= 0 ? '+' : ''}${totals.profit.toLocaleString()}\n`
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title}_${recordDate}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 테이블 행 렌더링
  const renderEntryRow = (entry, index, type) => {
    const subtotal = calculateSubtotal(entry)
    
    return (
      <tr key={index} className="border-b border-light-300 dark:border-dark-100">
        <td className="p-2">
          <input
            type="text"
            value={entry.item}
            onChange={(e) => updateEntry(type, index, 'item', e.target.value)}
            placeholder="항목명"
            className="w-full px-3 py-2 rounded-lg bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            value={entry.price}
            onChange={(e) => updateEntry(type, index, 'price', e.target.value)}
            placeholder="단가"
            className="w-full px-3 py-2 rounded-lg bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            value={entry.qty}
            onChange={(e) => updateEntry(type, index, 'qty', e.target.value)}
            placeholder="수량"
            className="w-full px-3 py-2 rounded-lg bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
          />
        </td>
        <td className="p-2">
          <input
            type="number"
            value={entry.direct}
            onChange={(e) => updateEntry(type, index, 'direct', e.target.value)}
            placeholder="또는 금액"
            className="w-full px-3 py-2 rounded-lg bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-center"
          />
        </td>
        <td className="p-2 text-center font-semibold">
          {subtotal.toLocaleString()}
        </td>
        <td className="p-2">
          <input
            type="text"
            value={entry.note}
            onChange={(e) => updateEntry(type, index, 'note', e.target.value)}
            placeholder="메모"
            className="w-full px-3 py-2 rounded-lg bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </td>
        <td className="p-2">
          <button
            onClick={() => removeEntry(type, index)}
            className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      </tr>
    )
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-7 h-7 text-primary-500" />
            손익계산서
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            마을 공동은행 수입/지출 관리
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-light-300 dark:bg-dark-200 hover:bg-light-400 dark:hover:bg-dark-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            새 문서
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-600 dark:text-orange-400 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-light-300 dark:bg-dark-200 hover:bg-light-400 dark:hover:bg-dark-100 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !user}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              user
                ? 'bg-primary-500 hover:bg-primary-600 text-white'
                : 'bg-gray-300 dark:bg-dark-100 text-gray-500 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-dark-300 rounded-xl p-5 border border-light-300 dark:border-dark-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/10 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">총 수입</p>
              <p className="text-2xl font-bold text-green-500">{totals.income.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-300 rounded-xl p-5 border border-light-300 dark:border-dark-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">총 지출</p>
              <p className="text-2xl font-bold text-red-500">{totals.expense.toLocaleString()}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-300 rounded-xl p-5 border border-light-300 dark:border-dark-100">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'p-3 rounded-xl',
              totals.profit >= 0 ? 'bg-primary-500/10' : 'bg-orange-500/10'
            )}>
              <FileText className={clsx(
                'w-6 h-6',
                totals.profit >= 0 ? 'text-primary-500' : 'text-orange-500'
              )} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">순이익</p>
              <p className={clsx(
                'text-2xl font-bold',
                totals.profit >= 0 ? 'text-primary-500' : 'text-orange-500'
              )}>
                {totals.profit >= 0 ? '+' : ''}{totals.profit.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-light-300 dark:border-dark-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">날짜</label>
            <input
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-light-200 dark:bg-dark-200 border border-light-300 dark:border-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        {lastSaved && (
          <p className="text-sm text-gray-400 mt-3">
            마지막 저장: {lastSaved.toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* 수입 테이블 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-light-300 dark:border-dark-100 overflow-hidden">
        <div className="p-4 border-b border-light-300 dark:border-dark-100 bg-green-500/10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            수입 (Income)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-light-200 dark:bg-dark-200 text-sm">
                <th className="p-3 text-left font-medium">항목</th>
                <th className="p-3 text-center font-medium w-24">단가</th>
                <th className="p-3 text-center font-medium w-24">수량</th>
                <th className="p-3 text-center font-medium w-28">직접입력</th>
                <th className="p-3 text-center font-medium w-28">소계</th>
                <th className="p-3 text-left font-medium">비고</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {income.map((entry, index) => renderEntryRow(entry, index, 'income'))}
            </tbody>
            <tfoot>
              <tr className="bg-green-500/10 font-bold">
                <td colSpan={4} className="p-3 text-right">수입 합계</td>
                <td className="p-3 text-center text-green-600 dark:text-green-400">
                  {totals.income.toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-3 border-t border-light-300 dark:border-dark-100">
          <button
            onClick={() => addEntry('income')}
            className="flex items-center gap-2 px-4 py-2 text-green-600 dark:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            수입 항목 추가
          </button>
        </div>
      </div>

      {/* 지출 테이블 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-light-300 dark:border-dark-100 overflow-hidden">
        <div className="p-4 border-b border-light-300 dark:border-dark-100 bg-red-500/10">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            지출 (Expense)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-light-200 dark:bg-dark-200 text-sm">
                <th className="p-3 text-left font-medium">항목</th>
                <th className="p-3 text-center font-medium w-24">단가</th>
                <th className="p-3 text-center font-medium w-24">수량</th>
                <th className="p-3 text-center font-medium w-28">직접입력</th>
                <th className="p-3 text-center font-medium w-28">소계</th>
                <th className="p-3 text-left font-medium">비고</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {expense.map((entry, index) => renderEntryRow(entry, index, 'expense'))}
            </tbody>
            <tfoot>
              <tr className="bg-red-500/10 font-bold">
                <td colSpan={4} className="p-3 text-right">지출 합계</td>
                <td className="p-3 text-center text-red-600 dark:text-red-400">
                  {totals.expense.toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="p-3 border-t border-light-300 dark:border-dark-100">
          <button
            onClick={() => addEntry('expense')}
            className="flex items-center gap-2 px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            지출 항목 추가
          </button>
        </div>
      </div>

      {/* 저장된 문서 목록 */}
      <div className="bg-white dark:bg-dark-300 rounded-xl border border-light-300 dark:border-dark-100 overflow-hidden">
        <div className="p-4 border-b border-light-300 dark:border-dark-100">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-500" />
            저장된 문서
          </h2>
        </div>
        <div className="divide-y divide-light-300 dark:divide-dark-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">불러오는 중...</div>
          ) : profitLossList.length === 0 ? (
            <div className="p-8 text-center text-gray-400">저장된 문서가 없습니다</div>
          ) : (
            profitLossList.map((doc) => {
              const docIncome = doc.income?.reduce((sum, e) => {
                const p = parseFloat(e.price) || 0
                const q = parseFloat(e.qty) || 0
                const d = parseFloat(e.direct) || 0
                return sum + ((p * q) > 0 ? (p * q) : d)
              }, 0) || 0
              const docExpense = doc.expense?.reduce((sum, e) => {
                const p = parseFloat(e.price) || 0
                const q = parseFloat(e.qty) || 0
                const d = parseFloat(e.direct) || 0
                return sum + ((p * q) > 0 ? (p * q) : d)
              }, 0) || 0
              const docProfit = docIncome - docExpense
              
              return (
                <div
                  key={doc._id}
                  onClick={() => handleSelectDocument(doc._id)}
                  className={clsx(
                    'flex items-center justify-between p-4 cursor-pointer transition-colors',
                    currentId === doc._id
                      ? 'bg-primary-500/10'
                      : 'hover:bg-light-200 dark:hover:bg-dark-200'
                  )}
                >
                  <div>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(doc.recordDate).toLocaleDateString()}
                      {doc.createdByName && ` · ${doc.createdByName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={clsx(
                      'font-semibold',
                      docProfit >= 0 ? 'text-green-500' : 'text-red-500'
                    )}>
                      {docProfit >= 0 ? '+' : ''}{docProfit.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">+{docIncome.toLocaleString()}</span>
                      <span className="text-red-500">-{docExpense.toLocaleString()}</span>
                    </div>
                  </div>
                  {currentId === doc._id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('이 문서를 삭제하시겠습니까?')) {
                          deleteMutation.mutate(doc._id)
                        }
                      }}
                      className="ml-4 p-2 text-red-500 hover:bg-red-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfitLoss
