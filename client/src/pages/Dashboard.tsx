import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import axios from 'axios'
import { FiUsers, FiFolder, FiActivity, FiCheckSquare, FiClock, FiAlertCircle } from 'react-icons/fi'

interface OrgStats {
  totalUsers: number
  totalDepartments: number
  byRole: { role: string; count: number }[]
  byDepartment: { name: string; count: number }[]
}

interface TaskStats {
  total: number
  pending: number
  inProgress: number
  completed: number
  overdue: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<OrgStats | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [orgRes, taskRes] = await Promise.all([
          axios.get('/api/org/stats'),
          axios.get('/api/tasks/stats/summary')
        ])
        setStats(orgRes.data)
        setTaskStats(taskRes.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const getRoleName = (role: string) => {
    const map: Record<string, string> = {
      admin: '管理员',
      manager: '项目经理',
      employee: '普通员工'
    }
    return map[role] || role
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">欢迎回来，{user?.realName || user?.username}！</h1>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
        gap: 20, 
        marginBottom: 24 
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: 12, 
            background: '#DBEAFE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FiUsers size={24} color="#1E40AF" />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>
              {stats?.totalUsers || 0}
            </div>
            <div style={{ fontSize: 14, color: '#64748B' }}>活跃用户</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: 12, 
            background: '#DCFCE7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FiFolder size={24} color="#166534" />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>
              {stats?.totalDepartments || 0}
            </div>
            <div style={{ fontSize: 14, color: '#64748B' }}>部门数量</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ 
            width: 56, 
            height: 56, 
            borderRadius: 12, 
            background: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FiActivity size={24} color="#92400E" />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>
              {stats?.byRole.find(r => r.role === 'admin')?.count || 0}
            </div>
            <div style={{ fontSize: 14, color: '#64748B' }}>管理员</div>
          </div>
        </div>
      </div>

      {/* Task Stats Cards */}
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>任务概览</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: 16, 
        marginBottom: 24 
      }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCheckSquare size={20} color="#6b7280" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{taskStats?.total || 0}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>总任务</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiClock size={20} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{taskStats?.pending || 0}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>待处理</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiActivity size={20} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{taskStats?.inProgress || 0}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>进行中</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiCheckSquare size={20} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{taskStats?.completed || 0}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>已完成</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FiAlertCircle size={20} color="#ef4444" />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{taskStats?.overdue || 0}</div>
            <div style={{ fontSize: 12, color: '#64748B' }}>已逾期</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
        {/* Role Distribution */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>角色分布</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats?.byRole.map(item => (
              <div key={item.role} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748B' }}>{getRoleName(item.role)}</span>
                <span style={{ fontWeight: 600 }}>{item.count} 人</span>
              </div>
            ))}
            {(!stats?.byRole || stats.byRole.length === 0) && (
              <div className="empty">暂无数据</div>
            )}
          </div>
        </div>

        {/* Department Distribution */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>部门人员分布</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats?.byDepartment.map(item => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#64748B' }}>{item.name}</span>
                <span style={{ fontWeight: 600 }}>{item.count} 人</span>
              </div>
            ))}
            {(!stats?.byDepartment || stats.byDepartment.length === 0) && (
              <div className="empty">暂无数据</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}