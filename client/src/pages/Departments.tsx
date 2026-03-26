import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { FiPlus, FiEdit2, FiTrash2, FiChevronRight, FiChevronDown } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

interface Department {
  id: string
  name: string
  parent_id: string | null
  manager_id: string | null
  manager_name: string | null
  description: string
  children: Department[]
}

export default function Departments() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingDept, setEditingDept] = useState<Department | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [allDepts, setAllDepts] = useState<Department[]>([])
  const [formData, setFormData] = useState({
    name: '',
    parentId: '',
    managerId: '',
    description: ''
  })

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    fetchDepartments()
  }, [])

  const fetchDepartments = async () => {
    try {
      const response = await axios.get('/api/org/departments')
      const flatResponse = await axios.get('/api/org/departments/flat')
      setDepartments(response.data)
      setAllDepts(flatResponse.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editingDept) {
        await axios.put(`/api/org/departments/${editingDept.id}`, {
          name: formData.name,
          parentId: formData.parentId || null,
          managerId: formData.managerId || null,
          description: formData.description
        })
      } else {
        await axios.post('/api/org/departments', {
          name: formData.name,
          parentId: formData.parentId || null,
          managerId: formData.managerId || null,
          description: formData.description
        })
      }
      setShowModal(false)
      resetForm()
      fetchDepartments()
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败')
    }
  }

  const handleEdit = (dept: Department) => {
    setEditingDept(dept)
    setFormData({
      name: dept.name,
      parentId: dept.parent_id || '',
      managerId: dept.manager_id || '',
      description: dept.description || ''
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该部门吗？')) return
    try {
      await axios.delete(`/api/org/departments/${id}`)
      fetchDepartments()
    } catch (err: any) {
      alert(err.response?.data?.error || '删除失败')
    }
  }

  const resetForm = () => {
    setEditingDept(null)
    setFormData({ name: '', parentId: '', managerId: '', description: '' })
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const renderTree = (depts: Department[], level = 0) => {
    return depts.map(dept => (
      <div key={dept.id}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '12px 16px',
            background: level % 2 === 0 ? '#fff' : '#F9FAFB',
            borderBottom: '1px solid #E5E7EB',
            cursor: 'pointer',
            paddingLeft: 16 + level * 24
          }}
          onClick={() => navigate(`/departments/${dept.id}`)}
        >
          {dept.children.length > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation()
                toggleExpand(dept.id)
              }}
              style={{ marginRight: 8, color: '#64748B' }}
            >
              {expandedIds.has(dept.id) ? <FiChevronDown /> : <FiChevronRight />}
            </span>
          ) : (
            <span style={{ width: 24 }} />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{dept.name}</div>
            {dept.manager_name && (
              <div style={{ fontSize: 12, color: '#64748B' }}>负责人：{dept.manager_name}</div>
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(dept)
                }}
              >
                <FiEdit2 size={14} />
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(dept.id)
                }}
              >
                <FiTrash2 size={14} />
              </button>
            </div>
          )}
        </div>
        {expandedIds.has(dept.id) && dept.children.length > 0 && renderTree(dept.children, level + 1)}
      </div>
    ))
  }

  if (loading) {
    return <div className="loading">加载中...</div>
  }

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">组织架构</h1>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openCreateModal}>
            <FiPlus size={16} style={{ marginRight: 8 }} />
            新建部门
          </button>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {departments.length > 0 ? (
          renderTree(departments)
        ) : (
          <div className="empty">暂无部门，请先创建</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingDept ? '编辑部门' : '新建部门'}</h3>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">部门名称 *</label>
                  <input
                    type="text"
                    className="input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="请输入部门名称"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">上级部门</label>
                  <select
                    className="input"
                    value={formData.parentId}
                    onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                  >
                    <option value="">无（顶级部门）</option>
                    {allDepts
                      .filter(d => d.id !== editingDept?.id)
                      .map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">部门描述</label>
                  <textarea
                    className="input"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="请输入部门描述"
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingDept ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}