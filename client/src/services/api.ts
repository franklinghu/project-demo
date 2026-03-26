const API_BASE = '/api';

// Get auth token
const getToken = () => localStorage.getItem('token');

const headers = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${getToken()}`
});

// Tasks API
export const tasksAPI = {
  // Get all tasks
  getTasks: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/tasks?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取任务失败');
    return res.json();
  },
  
  // Get task by ID
  getTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('获取任务详情失败');
    return res.json();
  },
  
  // Create task
  createTask: async (data: any) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '创建任务失败');
    }
    return res.json();
  },
  
  // Update task
  updateTask: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '更新任务失败');
    }
    return res.json();
  },
  
  // Update task status
  updateTaskStatus: async (id: string, status: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}/status`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '更新状态失败');
    }
    return res.json();
  },
  
  // Delete task
  deleteTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!res.ok) throw new Error('删除任务失败');
    return res.json();
  },
  
  // Get task stats
  getStats: async () => {
    const res = await fetch(`${API_BASE}/tasks/stats/summary`, { headers: headers() });
    if (!res.ok) throw new Error('获取统计失败');
    return res.json();
  }
};

// Projects API
export const projectsAPI = {
  // Get all projects
  getProjects: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/projects?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取项目失败');
    return res.json();
  },
  
  // Get project by ID
  getProject: async (id: string) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, { headers: headers() });
    if (!res.ok) throw new Error('获取项目详情失败');
    return res.json();
  },
  
  // Create project
  createProject: async (data: any) => {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '创建项目失败');
    }
    return res.json();
  },
  
  // Update project
  updateProject: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '更新项目失败');
    }
    return res.json();
  },
  
  // Delete project
  deleteProject: async (id: string) => {
    const res = await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!res.ok) throw new Error('删除项目失败');
    return res.json();
  },
  
  // Add member
  addMember: async (projectId: string, userId: string, role: string = 'member') => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/members`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ userId, role })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '添加成员失败');
    }
    return res.json();
  },
  
  // Remove member
  removeMember: async (projectId: string, userId: string) => {
    const res = await fetch(`${API_BASE}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
      headers: headers()
    });
    if (!res.ok) throw new Error('移除成员失败');
    return res.json();
  }
};

// Users API (for task assignment)
export const usersAPI = {
  getUsers: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/org/users?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取用户失败');
    return res.json();
  }
};

// Departments API (for project filter)
export const departmentsAPI = {
  getDepartments: async () => {
    const res = await fetch(`${API_BASE}/org/departments/flat`, { headers: headers() });
    if (!res.ok) throw new Error('获取部门失败');
    return res.json();
  }
};

// Work Logs API
export const workLogsAPI = {
  // Get my work logs
  getMyLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/work-logs/my?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取工时记录失败');
    return res.json();
  },
  
  // Get all work logs (managers only)
  getLogs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/work-logs?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取工时记录失败');
    return res.json();
  },
  
  // Create/update work log
  submitLog: async (data: any) => {
    const res = await fetch(`${API_BASE}/work-logs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '提交工时失败');
    }
    return res.json();
  },
  
  // Update work log
  updateLog: async (id: string, data: any) => {
    const res = await fetch(`${API_BASE}/work-logs/${id}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '更新工时失败');
    }
    return res.json();
  },
  
  // Approve/reject work log
  reviewLog: async (id: string, status: string, comment?: string) => {
    const res = await fetch(`${API_BASE}/work-logs/${id}/review`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ status, comment })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '审批失败');
    }
    return res.json();
  },
  
  // Delete work log
  deleteLog: async (id: string) => {
    const res = await fetch(`${API_BASE}/work-logs/${id}`, {
      method: 'DELETE',
      headers: headers() 
    });
    if (!res.ok) throw new Error('删除工时失败');
    return res.json();
  },
  
  // Get work log stats
  getStats: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/work-logs/stats?${query}`, { headers: headers() });
    if (!res.ok) throw new Error('获取统计失败');
    return res.json();
  }
};