import { useState, useEffect } from 'react';
import { workLogsAPI, projectsAPI } from '../services/api';

interface WorkLog {
  id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  date: string;
  hours: number;
  description: string;
  status: string;
  approver_name: string;
  approved_at: string;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
}

interface Stats {
  totalHours: number;
  totalCount: number;
  byStatus: { status: string; hours: number; count: number }[];
  byProject: { project_name: string; hours: number; count: number }[];
}

const statusMap: Record<string, { label: string; color: string }> = {
  pending: { label: '待审批', color: '#f59e0b' },
  approved: { label: '已通过', color: '#22c55e' },
  rejected: { label: '已驳回', color: '#ef4444' }
};

export default function WorkLogs() {
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userRole, setUserRole] = useState<string>('');
  const [viewMode, setViewMode] = useState<'my' | 'all'>('my');
  const [filters, setFilters] = useState({ startDate: '', endDate: '', projectId: '' });
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  
  const [formData, setFormData] = useState({
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    hours: 8,
    description: ''
  });

  // Get user role from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = JSON.parse(atob(token.split('.')[1]));
        setUserRole(decoded.role);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, viewMode]);

  const loadData = async () => {
    try {
      setLoading(true);
      const params = {
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        projectId: filters.projectId || undefined
      };
      
      const [logsData, projectsData, statsData] = await Promise.all([
        viewMode === 'my' ? workLogsAPI.getMyLogs(params) : workLogsAPI.getLogs(params),
        projectsAPI.getProjects(),
        workLogsAPI.getStats(params)
      ]);
      
      setLogs(logsData);
      setProjects(projectsData);
      setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await workLogsAPI.submitLog(formData);
      setShowModal(false);
      setFormData({
        projectId: '',
        date: new Date().toISOString().split('T')[0],
        hours: 8,
        description: ''
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleReview = async (logId: string, status: 'approved' | 'rejected') => {
    const comment = prompt('请输入审批意见（可选）:');
    try {
      await workLogsAPI.reviewLog(logId, status, comment || undefined);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (logId: string) => {
    if (!confirm('确定要删除这条工时记录吗？')) return;
    try {
      await workLogsAPI.deleteLog(logId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (log: WorkLog) => {
    setEditingLog(log);
    setFormData({
      projectId: log.project_id || '',
      date: log.date,
      hours: log.hours,
      description: log.description || ''
    });
    setShowModal(true);
  };

  const getTodayHours = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayLog = logs.find(l => l.date === today);
    return todayLog?.hours || 0;
  };

  const getWeekHours = () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    return logs
      .filter(l => l.date >= weekStartStr)
      .reduce((sum, l) => sum + l.hours, 0);
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>工时填报</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {userRole === 'admin' || userRole === 'manager' ? (
            <div style={{ display: 'flex', gap: '8px', marginRight: '16px' }}>
              <button
                onClick={() => setViewMode('my')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: viewMode === 'my' ? '#3b82f6' : 'white',
                  color: viewMode === 'my' ? 'white' : '#333',
                  cursor: 'pointer'
                }}
              >
                我的工时
              </button>
              <button
                onClick={() => setViewMode('all')}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  background: viewMode === 'all' ? '#3b82f6' : 'white',
                  color: viewMode === 'all' ? 'white' : '#333',
                  cursor: 'pointer'
                }}
              >
                全部工时
              </button>
            </div>
          ) : null}
          <button
            onClick={() => { setEditingLog(null); setShowModal(true); }}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            + 填报工时
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '16px', 
        marginBottom: '24px' 
      }}>
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>今日工时</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{getTodayHours()}h</div>
        </div>
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>本周工时</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{getWeekHours()}h</div>
        </div>
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>本月工时</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats?.totalHours || 0}h</div>
        </div>
        <div style={{ padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>待审批</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b' }}>
            {stats?.byStatus.find(s => s.status === 'pending')?.count || 0}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
          placeholder="开始日期"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
          placeholder="结束日期"
        />
        <select
          value={filters.projectId}
          onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
        >
          <option value="">全部项目</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Work Log List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>暂无工时记录</div>
        ) : (
          logs.map(log => (
            <div
              key={log.id}
              style={{
                padding: '16px',
                background: 'white',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '600' }}>{log.date}</span>
                    <span style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      background: statusMap[log.status]?.color + '20',
                      color: statusMap[log.status]?.color
                    }}>
                      {statusMap[log.status]?.label}
                    </span>
                    {log.project_name && (
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>📁 {log.project_name}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '24px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#3b82f6' }}>{log.hours}h</span>
                  </div>
                  {log.description && (
                    <p style={{ margin: '0', fontSize: '14px', color: '#6b7280' }}>{log.description}</p>
                  )}
                  {log.approver_name && (
                    <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                      审批人: {log.approver_name} | {log.approved_at?.split('T')[0]}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {viewMode === 'my' && log.status === 'pending' && (
                    <>
                      <button
                        onClick={() => openEditModal(log)}
                        style={{ padding: '6px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: 'white' }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        style={{ padding: '6px 12px', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', background: 'white', color: '#ef4444' }}
                      >
                        删除
                      </button>
                    </>
                  )}
                  {viewMode === 'all' && log.status === 'pending' && (userRole === 'admin' || userRole === 'manager') && (
                    <>
                      <button
                        onClick={() => handleReview(log.id, 'approved')}
                        style={{ padding: '6px 12px', border: '1px solid #22c55e', borderRadius: '4px', cursor: 'pointer', background: '#22c55e', color: 'white' }}
                      >
                        通过
                      </button>
                      <button
                        onClick={() => handleReview(log.id, 'rejected')}
                        style={{ padding: '6px 12px', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', background: '#ef4444', color: 'white' }}
                      >
                        驳回
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '450px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px' }}>
              {editingLog ? '编辑工时' : '填报工时'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>日期 *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>工时（小时）*</label>
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={formData.hours}
                  onChange={(e) => setFormData({ ...formData, hours: parseFloat(e.target.value) })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>项目</label>
                <select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                >
                  <option value="">选择项目（可选）</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>工作内容</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="描述一下今天的工作内容..."
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingLog(null); }}
                  style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  提交
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}