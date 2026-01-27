import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Save } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

function Settings() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  
  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(res => res.data),
  })

  const [formData, setFormData] = useState({
    uiMode: 'normal',
    barLength: 15,
    selectMessageTimeout: 30,
    infoMessageTimeout: 15,
  })

  useEffect(() => {
    if (settings) {
      setFormData(settings)
    }
  }, [settings])

  const mutation = useMutation({
    mutationFn: (data) => api.patch('/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      alert('설정이 저장되었습니다.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || '설정 저장에 실패했습니다.')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <SettingsIcon className="text-primary-500" />
        설정
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* UI 모드 */}
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <h2 className="text-lg font-semibold mb-4">UI 설정</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">UI 모드</label>
              <select
                value={formData.uiMode}
                onChange={(e) => setFormData({ ...formData, uiMode: e.target.value })}
                className="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              >
                <option value="normal">일반</option>
                <option value="detailed">상세</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                상세 모드에서는 더 많은 정보가 표시됩니다.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">
                프로그레스 바 길이: {formData.barLength}
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={formData.barLength}
                onChange={(e) => setFormData({ ...formData, barLength: parseInt(e.target.value) })}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>짧게 (5)</span>
                <span>길게 (30)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 타이머 설정 (Discord 봇 전용이지만 웹에서도 설정 가능) */}
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <h2 className="text-lg font-semibold mb-4">타이머 설정</h2>
          <p className="text-sm text-gray-400 mb-4">
            이 설정은 Discord 봇에서 사용됩니다.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                선택 메뉴 타임아웃 (초)
              </label>
              <input
                type="number"
                min="10"
                max="300"
                value={formData.selectMessageTimeout}
                onChange={(e) => setFormData({ ...formData, selectMessageTimeout: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                안내 메시지 타임아웃 (초)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={formData.infoMessageTimeout}
                onChange={(e) => setFormData({ ...formData, infoMessageTimeout: parseInt(e.target.value) })}
                className="w-full px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        {user && (
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium disabled:opacity-50"
          >
            <Save size={18} />
            {mutation.isPending ? '저장 중...' : '설정 저장'}
          </button>
        )}

        {!user && (
          <p className="text-center text-gray-400 text-sm">
            설정을 변경하려면 로그인이 필요합니다.
          </p>
        )}
      </form>
    </div>
  )
}

export default Settings
