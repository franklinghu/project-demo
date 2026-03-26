import { useState, useEffect } from 'react';
import { projectsAPI, departmentsAPI } from '../services/api';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  owner_id: string;
  owner_name: string;
  department_id: string;
  department_name: string;
  start_date: string;
  end_date: string;
  task_count: number;
  completed_task_count: number;
  progress?: number;
}

interface Department {
  id: string;
  name: string;
}

const statusMap: Record<string, { label: string; color: string }> = {
  planning: { label: '规划中', color: '#f59e0b' },
  active: { label: '进行中', color: '#3b82f6' },
  completed: { label: '已完成', color: '#22c55e' },
  suspended: { label: '已暂停', color: '#6b7280' },
  cancelled: { label: '已取消', color: '#ef4444' }
};

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filters, setFilters] = useState({ status: '' });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    departmentId: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [projectsData, deptsData] = await Promise.all([
        projectsAPI.getProjects(filters),
        departmentsAPI.getDepartments()
      ]);
      setProjects(projectsData);
      setDepartments(deptsData);
    } catch (err) {
      console.error(err);
      alert('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProject) {
        await projectsAPI.updateProject(editingProject.id, {
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate
        });
      } else {
        await projectsAPI.createProject(formData);
      }
      setShowModal(false);
      setEditingProject(null);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('确定要删除这个项目吗？相关的任务也会被删除。')) return;
    try {
      await projectsAPI.deleteProject(projectId);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      departmentId: project.department_id || '',
      startDate: project.start_date || '',
      endDate: project.end_date || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      departmentId: '',
      startDate: '',
      endDate: ''
    });
  };

  const openCreateModal = () => {
    setEditingProject(null);
    resetForm();
    setShowModal(true);
  };

  const calculateProgress = (project: Project) => {
    if (project.task_count === 0) return 0;
    return Math.round((project.completed_task_count / project.task_count) * 100);
  };

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>项目管理</h1>
        <button
          onClick={openCreateModal}
          style={{
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          + 创建项目
        </button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: '20px' }}>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value })}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
        >
          <option value="">全部状态</option>
          <option value="planning">规划中</option>
          <option value="active">进行中</option>
          <option value="completed">已完成</option>
          <option value="suspended">已暂停</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>

      {/* Project List */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '16px' }}>
        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', gridColumn: '1 / -1' }}>暂无项目</div>
        ) : (
          projects.map(project => (
            <div
              key={project.id}
              style={{
                padding: '20px',
                background: 'white',
                borderRadius: '12px',
                border: '1px solid #e5e7eb',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
              onClick={() => setSelectedProject(project)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    background: statusMap[project.status]?.color + '20',
                    color: statusMap[project.status]?.color
                  }}>
                    {statusMap[project.status]?.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(project); }}
                    style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', background: 'white' }}
                  >
                    编辑
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                    style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #ef4444', borderRadius: '4px', cursor: 'pointer', background: 'white', color: '#ef4444' }}
                  >
                    删除
                  </button>
                </div>
              </div>
              
              <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: '600' }}>{project.name}</h3>
              {project.description && (
                <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>{project.description}</p>
              )}
              
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#9ca3af', marginBottom: '12px' }}>
                <span>👤 {project.owner_name || '未设置'}</span>
                <span>📁 {project.department_name || '无部门'}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${calculateProgress(project)}%`, 
                    height: '100%', 
                    background: '#3b82f6',
                    borderRadius: '3px',
                    transition: 'width 0.3s'
                  }} />
                </div>
                <span style={{ fontSize: '13px', color: '#6b7280', minWidth: '40px' }}>
                  {calculateProgress(project)}%
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '8px' }}>
                任务: {project.completed_task_count}/{project.task_count}
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
            width: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h2 style={{ margin: '0 0 20px', fontSize: '20px' }}>
              {editingProject ? '编辑项目' : '创建项目'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>项目名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>所属部门</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
                >
                  <option value="">选择部门</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>开始日期</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                  />
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>结束日期</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingProject(null); }}
                  style={{ padding: '10px 20px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', background: 'white' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  style={{ padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {editingProject ? '保存' : '创建'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}