import { useQuery } from '@tanstack/react-query'
import { Users as UsersIcon, Crown, Shield, User } from 'lucide-react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import clsx from 'clsx'

function getRoleIcon(role) {
  switch (role) {
    case 'owner':
      return <Crown className="text-yellow-400" size={18} />
    case 'admin':
      return <Shield className="text-primary-400" size={18} />
    default:
      return <User className="text-gray-400" size={18} />
  }
}

function getRoleName(role) {
  switch (role) {
    case 'owner':
      return '서버장'
    case 'admin':
      return '관리자'
    default:
      return '멤버'
  }
}

function getRoleColor(role) {
  switch (role) {
    case 'owner':
      return 'text-yellow-400 bg-yellow-500/10'
    case 'admin':
      return 'text-primary-400 bg-primary-500/10'
    default:
      return 'text-gray-400 bg-gray-500/10'
  }
}

function Users() {
  const { user } = useAuth()
  
  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/settings/users').then(res => res.data),
    enabled: !!(user?.isAdmin || user?.isServerOwner),
  })

  if (!user?.isAdmin && !user?.isServerOwner) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        관리자만 접근할 수 있습니다.
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

  const users = usersData?.users || []

  // 역할별로 그룹화
  const groupedUsers = {
    owner: users.filter(u => u.role === 'owner'),
    admin: users.filter(u => u.role === 'admin'),
    member: users.filter(u => u.role === 'member'),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UsersIcon className="text-primary-500" size={28} />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">유저 관리</h1>
      </div>

      <div className="bg-white dark:bg-dark-300 rounded-xl p-6 border border-gray-200 dark:border-dark-100">
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          로그인한 유저들의 역할을 확인할 수 있습니다. 역할 변경은 권한 설정 페이지에서 관리자 ID를 추가/제거하여 할 수 있습니다.
        </p>

        {/* 역할별 유저 목록 */}
        <div className="space-y-6">
          {/* 서버장 */}
          {groupedUsers.owner.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                <Crown className="text-yellow-400" size={20} />
                서버장
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedUsers.owner.map(u => (
                  <UserCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          {/* 관리자 */}
          {groupedUsers.admin.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                <Shield className="text-primary-400" size={20} />
                관리자 ({groupedUsers.admin.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedUsers.admin.map(u => (
                  <UserCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          {/* 멤버 */}
          {groupedUsers.member.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
                <User className="text-gray-400" size={20} />
                멤버 ({groupedUsers.member.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupedUsers.member.map(u => (
                  <UserCard key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}

          {users.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              로그인한 유저가 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserCard({ user }) {
  const avatarUrl = user.avatar 
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.discriminator || '0') % 5}.png`

  return (
    <div className="flex items-center gap-3 p-4 bg-gray-100 dark:bg-dark-200 rounded-lg">
      <img 
        src={avatarUrl} 
        alt={user.username}
        className="w-10 h-10 rounded-full"
        onError={(e) => {
          e.target.src = `https://cdn.discordapp.com/embed/avatars/0.png`
        }}
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate text-gray-900 dark:text-white">{user.username}</div>
        <div className="text-xs text-gray-500 truncate">ID: {user.id}</div>
      </div>
      <div className={clsx(
        'flex items-center gap-1 px-2 py-1 rounded-lg text-xs',
        getRoleColor(user.role)
      )}>
        {getRoleIcon(user.role)}
        <span>{getRoleName(user.role)}</span>
      </div>
    </div>
  )
}

export default Users
