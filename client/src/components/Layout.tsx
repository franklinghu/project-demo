import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiHome, FiUsers, FiFolder, FiUser, FiLogOut, FiCheckSquare, FiBriefcase, FiClock } from 'react-icons/fi'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const navItems = [
    { path: '/', icon: FiHome, label: '首页' },
    { path: '/projects', icon: FiBriefcase, label: '项目管理' },
    { path: '/tasks', icon: FiCheckSquare, label: '任务管理' },
    { path: '/work-logs', icon: FiClock, label: '工时填报' },
    { path: '/departments', icon: FiFolder, label: '组织架构' },
    { path: '/users', icon: FiUsers, label: '用户管理' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ 
        width: 240, 
        background: '#065A82', 
        color: '#fff',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: 20, 
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>项目管理系统</h2>
        </div>

        <nav style={{ flex: 1, padding: 16 }}>
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                borderRadius: 8,
                color: isActive ? '#fff' : 'rgba(255,255,255,0.7)',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                textDecoration: 'none',
                marginBottom: 4,
                transition: 'all 0.2s'
              })}
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ 
          padding: 16, 
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <FiUser size={18} />
            <div>
              <div style={{ fontSize: 14 }}>{user?.realName || user?.username}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{user?.role === 'admin' ? '管理员' : '用户'}</div>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            <FiLogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}