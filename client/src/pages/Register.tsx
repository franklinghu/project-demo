import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    realName: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (formData.password.length < 6) {
      setError('密码长度至少6位')
      return
    }

    setLoading(true)

    try {
      await register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        realName: formData.realName
      })
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || '注册失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #065A82 0%, #1C7293 100%)'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: 400, 
        padding: 20 
      }}>
        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h1 style={{ fontSize: 24, color: '#065A82', marginBottom: 8 }}>注册账号</h1>
            <p style={{ color: '#64748B' }}>创建您的项目管理账号</p>
          </div>

          {error && (
            <div style={{ 
              padding: 12, 
              background: '#FEE2E2', 
              color: '#991B1B', 
              borderRadius: 6, 
              marginBottom: 16,
              fontSize: 14
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">用户名 *</label>
              <input
                type="text"
                className="input"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="请输入用户名"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">邮箱 *</label>
              <input
                type="email"
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="请输入邮箱"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">姓名</label>
              <input
                type="text"
                className="input"
                value={formData.realName}
                onChange={(e) => setFormData({ ...formData, realName: e.target.value })}
                placeholder="请输入真实姓名（可选）"
              />
            </div>

            <div className="form-group">
              <label className="form-label">密码 *</label>
              <input
                type="password"
                className="input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="请输入密码（至少6位）"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">确认密码 *</label>
              <input
                type="password"
                className="input"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="请再次输入密码"
                required
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', marginTop: 8 }}
              disabled={loading}
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#64748B' }}>
            已有账号？ <Link to="/login" style={{ color: '#065A82' }}>立即登录</Link>
          </p>
        </div>
      </div>
    </div>
  )
}