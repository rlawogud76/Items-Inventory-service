import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, UserPlus, X, Save, Check } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

// 기능 키 목록 (Discord 봇과 동일)
const FEATURE_KEYS = [
  { key: 'view', label: '조회', description: '재고/제작 목록 조회' },
  { key: 'quantity', label: '수량 조정', description: '아이템 수량 변경' },
  { key: 'crafting', label: '제작', description: '제작 완료/취소' },
  { key: 'recipe', label: '레시피', description: '레시피 관리' },
  { key: 'manage', label: '아이템 관리', description: '아이템 추가/삭제/이동' },
  { key: 'tag', label: '태그', description: '태그 관리' },
  { key: 'work', label: '작업', description: '작업 관리' },
  { key: 'contribution', label: '기여도', description: '기여도 조회' },
  { key: 'history', label: '수정내역', description: '수정내역 조회' },
  { key: 'settings', label: '설정', description: '봇 설정 변경' },
  { key: 'points', label: '배점', description: '배점 설정 변경' },
  { key: 'permissions', label: '권한', description: '권한 설정 변경' },
  { key: 'reset', label: '초기화', description: '데이터 초기화' },
]

function Permissions() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [newAdminId, setNewAdminId] = useState('')
  
  const [formData, setFormData] = useState({
    adminUserIds: [],
    adminAllowedFeatureKeys: ['*'],
    memberAllowedFeatureKeys: ['*'],
  })

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get('/settings/permissions').then(res => res.data),
    enabled: !!user?.isAdmin,
  })

  useEffect(() => {
    if (permissions) {
      setFormData({
        adminUserIds: permissions.adminUserIds || [],
        adminAllowedFeatureKeys: permissions.adminAllowedFeatureKeys || ['*'],
        memberAllowedFeatureKeys: permissions.memberAllowedFeatureKeys || ['*'],
      })
    }
  }, [permissions])

  const mutation = useMutation({
    mutationFn: (data) => api.patch('/settings/permissions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] })
      alert('권한 설정이 저장되었습니다.')
    },
    onError: (error) => {
      alert(error.response?.data?.error || '저장에 실패했습니다.')
    }
  })

  const handleAddAdmin = () => {
    if (!newAdminId.trim()) return
    
    // Discord ID 형식 확인 (숫자만)
    if (!/^\d{17,19}$/.test(newAdminId.trim())) {
      alert('올바른 Discord 사용자 ID를 입력해주세요. (17-19자리 숫자)')
      return
    }
    
    if (formData.adminUserIds.includes(newAdminId.trim())) {
      alert('이미 추가된 관리자입니다.')
      return
    }
    
    setFormData(prev => ({
      ...prev,
      adminUserIds: [...prev.adminUserIds, newAdminId.trim()]
    }))
    setNewAdminId('')
  }

  const handleRemoveAdmin = (id) => {
    setFormData(prev => ({
      ...prev,
      adminUserIds: prev.adminUserIds.filter(adminId => adminId !== id)
    }))
  }

  const toggleFeatureKey = (type, key) => {
    const field = type === 'admin' ? 'adminAllowedFeatureKeys' : 'memberAllowedFeatureKeys'
    const current = formData[field]
    
    // '*' 처리
    if (key === '*') {
      setFormData(prev => ({
        ...prev,
        [field]: current.includes('*') ? [] : ['*']
      }))
      return
    }
    
    // '*'가 있으면 개별 선택으로 전환
    let newKeys = current.filter(k => k !== '*')
    
    if (newKeys.includes(key)) {
      newKeys = newKeys.filter(k => k !== key)
    } else {
      newKeys = [...newKeys, key]
    }
    
    // 모든 기능이 선택되면 '*'로 변환
    if (newKeys.length === FEATURE_KEYS.length) {
      newKeys = ['*']
    }
    
    setFormData(prev => ({
      ...prev,
      [field]: newKeys
    }))
  }

  const isFeatureSelected = (type, key) => {
    const field = type === 'admin' ? 'adminAllowedFeatureKeys' : 'memberAllowedFeatureKeys'
    const keys = formData[field]
    return keys.includes('*') || keys.includes(key)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate(formData)
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-gray-400">
          <Shield className="mx-auto mb-4 text-gray-600" size={48} />
          <p className="text-lg">관리자만 접근할 수 있습니다.</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-red-400">
          <Shield className="mx-auto mb-4" size={48} />
          <p className="text-lg">권한 정보를 불러올 수 없습니다.</p>
          <p className="text-sm mt-2">{error.response?.data?.error || error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Shield className="text-green-500" />
        권한 설정
      </h1>

      <p className="text-gray-400 text-sm">
        Discord 봇의 권한을 설정합니다. 웹 대시보드의 권한은 Discord 로그인 정보를 기반으로 합니다.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 관리자 목록 */}
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            👑 관리자 목록
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Discord 사용자 ID를 입력하여 관리자를 추가합니다.
            관리자는 모든 기능에 접근할 수 있습니다.
          </p>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newAdminId}
              onChange={(e) => setNewAdminId(e.target.value)}
              placeholder="Discord 사용자 ID (예: 123456789012345678)"
              className="flex-1 px-4 py-2 bg-dark-200 border border-dark-100 rounded-lg focus:outline-none focus:border-primary-500"
            />
            <button
              type="button"
              onClick={handleAddAdmin}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg"
            >
              <UserPlus size={18} />
              추가
            </button>
          </div>
          
          <div className="space-y-2">
            {formData.adminUserIds.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">등록된 관리자가 없습니다.</p>
            ) : (
              formData.adminUserIds.map(id => (
                <div key={id} className="flex items-center justify-between py-2 px-3 bg-dark-200 rounded-lg">
                  <span className="font-mono text-sm">{id}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAdmin(id)}
                    className="p-1 hover:bg-dark-100 rounded text-red-400 hover:text-red-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 관리자 권한 범위 */}
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            🛡️ 관리자 권한 범위
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            관리자가 사용할 수 있는 기능을 선택합니다.
          </p>
          
          <div className="space-y-3">
            {/* 모든 권한 */}
            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-100">
              <input
                type="checkbox"
                checked={formData.adminAllowedFeatureKeys.includes('*')}
                onChange={() => toggleFeatureKey('admin', '*')}
                className="w-5 h-5 rounded border-dark-100 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 bg-dark-100"
              />
              <div className="flex-1">
                <span className="font-medium">모든 권한</span>
                <p className="text-xs text-gray-500">모든 기능에 접근 가능</p>
              </div>
              {formData.adminAllowedFeatureKeys.includes('*') && (
                <Check className="text-green-500" size={18} />
              )}
            </label>
            
            {/* 개별 권한 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_KEYS.map(feature => (
                <label
                  key={feature.key}
                  className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-100"
                >
                  <input
                    type="checkbox"
                    checked={isFeatureSelected('admin', feature.key)}
                    onChange={() => toggleFeatureKey('admin', feature.key)}
                    disabled={formData.adminAllowedFeatureKeys.includes('*')}
                    className="w-4 h-4 rounded border-dark-100 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 bg-dark-100 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm">{feature.label}</span>
                    <p className="text-xs text-gray-500">{feature.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 멤버 권한 범위 */}
        <div className="bg-dark-300 rounded-xl p-6 border border-dark-100">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            👤 멤버 권한 범위
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            일반 멤버가 사용할 수 있는 기능을 선택합니다.
          </p>
          
          <div className="space-y-3">
            {/* 모든 권한 */}
            <label className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-100">
              <input
                type="checkbox"
                checked={formData.memberAllowedFeatureKeys.includes('*')}
                onChange={() => toggleFeatureKey('member', '*')}
                className="w-5 h-5 rounded border-dark-100 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 bg-dark-100"
              />
              <div className="flex-1">
                <span className="font-medium">모든 권한</span>
                <p className="text-xs text-gray-500">모든 기능에 접근 가능</p>
              </div>
              {formData.memberAllowedFeatureKeys.includes('*') && (
                <Check className="text-green-500" size={18} />
              )}
            </label>
            
            {/* 개별 권한 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FEATURE_KEYS.map(feature => (
                <label
                  key={feature.key}
                  className="flex items-center gap-3 p-3 bg-dark-200 rounded-lg cursor-pointer hover:bg-dark-100"
                >
                  <input
                    type="checkbox"
                    checked={isFeatureSelected('member', feature.key)}
                    onChange={() => toggleFeatureKey('member', feature.key)}
                    disabled={formData.memberAllowedFeatureKeys.includes('*')}
                    className="w-4 h-4 rounded border-dark-100 text-primary-600 focus:ring-primary-500 focus:ring-offset-0 bg-dark-100 disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <span className="text-sm">{feature.label}</span>
                    <p className="text-xs text-gray-500">{feature.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* 저장 버튼 */}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium disabled:opacity-50"
        >
          <Save size={18} />
          {mutation.isPending ? '저장 중...' : '권한 설정 저장'}
        </button>
      </form>
    </div>
  )
}

export default Permissions
