import { useState, useEffect } from 'react'
import axios from 'axios'
import { FiPlus, FiEdit2, FiTrash2, FiSearch } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

interface User {
  id: string
  username: string
  email: string
  real_name: string | null
  phone: string | null
  role: string
  department_id: string | null
  department_name: string | null
  status: string
  created_at: string
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [formData, setFormData] = useState({
    realName: '',
    phone: '',
    role: 'employee',
    departmentId: '',
    status: 'active'
  })

  const isAdmin = currentUser?.role === 'admin'

  useEffect(() => {
    fetchUsers()
    fetchDepartments()
  }, [searchKeyword, filterDept])

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams()
      if (searchKeyword) params.append('keyword', searchKeyword)
      if (filterDept) params.append('departmentId', filterDept)
      const response = await axios.get(`/api/org/users?${params}`)
      setUsers(response.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/org/departments/flat')
      setDepartments(response.data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) {
      alert('用户编辑功能需要先创建用户')
      return
    }
    try {
      await axios.put(`/api/org/users/${editingUser.id}`, {
        realName: formData.realName,
        phone: formData.phone,
        role: formData.role,
        departmentId: formData.departmentId || null,
        status: formData.status
      })
      setShowModal(false)
      resetForm()
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      realName: user.real_name || '',
      phone: user.phone || '',
      role: user.role,
      departmentId: user.department_id || '',
      status: user.status
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要禁用该用户吗？')) return
    try {
      await axios.delete(`/api/org/users/${id}`)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败')
    }
  }

  const resetForm = () => {
    setEditingUser(null)
    setFormData({ realName: '', phone: '', role: 'employee', departmentId: '', status: 'active' })
  }

  const getRoleName = (role: string) => {
    const map: Record<string, string> = {
      admin: '管理员',
      manager: '项目经理',
      employee: '员工'
    }
    return map[role] || role
  }

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return <span className="badge badge-success">正常</span>
    }
    return <span className="badge badge-error">已禁用</span>
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">用户管理</h1>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
            <input
              type="text"
              className="input"
              placeholder="搜索用户名、姓名、邮箱..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
          <select
            className="input"
            value={filterDept}
            onChange={e => setFilterDept(e.target.value)}
            style={{ width: 200 }}
          >
            <option value="">全部部门</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* User Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>姓名</th>
              <th>邮箱</th>
              <th>部门</th>
              <th>角色</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.real_name || '-'}</td>
                <td>{user.email}</td>
                <td>{user.department_name || '-'}</td>
                <td>
                  <span className="badge badge-info">{getRoleName(user.role)}</span>
                </td>
                <td>{getStatusBadge(user.status)}</td>
                <td>
                  {isAdmin && user.id !== currentUser?.id && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleEdit(user)}
                      >
                        <FiEdit2 size={14} />
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(user.id)}
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">暂无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">编辑用户</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">姓名</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.realName}
                    onChange={e => setFormData({ ...formData, realName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">手机号</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">角色</label>
                  <select
                    className="input"
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="employee">员工</option>
                    <option value="manager">项目经理</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">部门</label>
                  <select
                    className="input"
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                  >
                    <option value="">未分配</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">状态</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">正常</option>
                    <option value="inactive">禁用</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}