import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FiArrowLeft, FiUser } from 'react-icons/fi'

interface Department {
  id: string
  name: string
  parent_id: string | null
  manager_name: string | null
  description: string
  members: {
    id: string
    username: string
    real_name: string | null
    email: string
    role: string
  }[]
  children: { id: string; name: string }[]
}

export default function DepartmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [dept, setDept] = useState<Department | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDept = async () => {
      try {
        const response = await axios.get(`/api/org/departments/${id}`)
        setDept(response.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchDept()
  }, [id])

  const getRoleName = (role: string) => {
    const map: Record<string, string> = {
      admin: '管理员',
      manager: '项目经理',
      employee: '员工'
    }
    return map[role] || role
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  if (!dept) {
    return <div className="container">部门不存在</div>
  }

  return (
    <div className="container">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-secondary" onClick={() => navigate('/departments')}>
            <FiArrowLeft size={16} />
          </button>
          <h1 className="page-title">{dept.name}</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Department Info */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>部门信息</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>部门名称</div>
              <div>{dept.name}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>负责人</div>
              <div>{dept.manager_name || '-'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>描述</div>
              <div>{dept.description || '-'}</div>
            </div>
            {dept.children.length > 0 && (
              <div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>子部门</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {dept.children.map(child => (
                    <span
                      key={child.id}
                      className="badge badge-info"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/departments/${child.id}`)}
                    >
                      {child.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Members */}
        <div className="card">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>
            部门成员（{dept.members.length}人）
          </h3>
          {dept.members.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dept.members.map(member => (
                <div
                  key={member.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: '#F9FAFB',
                    borderRadius: 8
                  }}
                >
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: '#DBEAFE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FiUser color="#1E40AF" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{member.real_name || member.username}</div>
                    <div style={{ fontSize: 12, color: '#64748B' }}>{member.email}</div>
                  </div>
                  <span className="badge badge-info">{getRoleName(member.role)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">暂无成员</div>
          )}
        </div>
      </div>
    </div>
  )
}