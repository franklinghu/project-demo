const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Cached database instance
let dbInstance = null;

// Get DB instance (cached)
async function getDB() {
  if (!dbInstance) {
    dbInstance = await require('../db');
  }
  return dbInstance;
}

const JWT_SECRET = process.env.JWT_SECRET || 'project-management-secret-key-2026';

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '未登录' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    req.db = await getDB();
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
};

const requireManager = async (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'manager') {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

// Get all projects
router.get('/projects', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { status, departmentId, keyword } = req.query;
    
    let sql = `
      SELECT p.*, 
             u.real_name as owner_name,
             d.name as department_name,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id) as task_count,
             (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'completed') as completed_task_count
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (departmentId) { sql += ' AND p.department_id = ?'; params.push(departmentId); }
    if (keyword) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    
    sql += ' ORDER BY p.created_at DESC';
    const projects = db.prepare(sql).all(...params);
    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取项目列表失败' });
  }
});

// Get project detail
router.get('/projects/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const project = db.prepare(`
      SELECT p.*, u.real_name as owner_name, d.name as department_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `).get(req.params.id);
    
    if (!project) return res.status(404).json({ error: '项目不存在' });
    
    const members = db.prepare(`
      SELECT pm.*, u.username, u.real_name, u.email
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `).all(req.params.id);
    
    const tasks = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.created_at DESC
    `).all(req.params.id);
    
    const taskStats = db.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM tasks WHERE project_id = ?
    `).get(req.params.id);
    
    const progress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
    
    res.json({ ...project, members, tasks, progress });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取项目详情失败' });
  }
});

// Create project
router.post('/projects', authenticate, requireManager, async (req, res) => {
  try {
    const db = req.db;
    const { name, description, departmentId, startDate, endDate } = req.body;
    if (!name) return res.status(400).json({ error: '项目名称为必填项' });
    
    const projectId = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, name, description, owner_id, department_id, start_date, end_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'planning')
    `).run(projectId, name, description || null, req.userId, departmentId || null, startDate || null, endDate || null);
    
    const memberId = uuidv4();
    db.prepare(`INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'owner')`)
      .run(memberId, projectId, req.userId);
    
    const project = db.prepare(`
      SELECT p.*, u.real_name as owner_name, d.name as department_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `).get(projectId);
    
    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建项目失败' });
  }
});

// Update project
router.put('/projects/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { name, description, status, departmentId, startDate, endDate } = req.body;
    const projectId = req.params.id;
    
    const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!exists) return res.status(404).json({ error: '项目不存在' });
    
    db.prepare(`
      UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
      status = COALESCE(?, status), department_id = COALESCE(?, department_id),
      start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
      updated_at = datetime('now')
      WHERE id = ?
    `).run(name, description, status, departmentId, startDate, endDate, projectId);
    
    const project = db.prepare(`
      SELECT p.*, u.real_name as owner_name, d.name as department_name
      FROM projects p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE p.id = ?
    `).get(projectId);
    
    res.json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新项目失败' });
  }
});

// Delete project
router.delete('/projects/:id', authenticate, requireManager, async (req, res) => {
  try {
    const db = req.db;
    const projectId = req.params.id;
    
    const exists = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!exists) return res.status(404).json({ error: '项目不存在' });
    
    db.prepare('DELETE FROM task_history WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)').run(projectId);
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId);
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
    
    res.json({ message: '项目已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除项目失败' });
  }
});

// Add project member
router.post('/projects/:id/members', authenticate, requireManager, async (req, res) => {
  try {
    const db = req.db;
    const { userId, role } = req.body;
    const projectId = req.params.id;
    
    if (!userId) return res.status(400).json({ error: '用户ID为必填项' });
    
    const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
    if (!project) return res.status(404).json({ error: '项目不存在' });
    
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    
    const exists = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND user_id = ?').get(projectId, userId);
    if (exists) return res.status(400).json({ error: '该成员已在项目中' });
    
    const memberId = uuidv4();
    db.prepare(`INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)`)
      .run(memberId, projectId, userId, role || 'member');
    
    const member = db.prepare(`
      SELECT pm.*, u.username, u.real_name, u.email
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.id = ?
    `).get(memberId);
    
    res.status(201).json(member);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '添加成员失败' });
  }
});

// Remove project member
router.delete('/projects/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { id, userId } = req.params;
    
    const member = db.prepare('SELECT id, role FROM project_members WHERE project_id = ? AND user_id = ?').get(id, userId);
    if (!member) return res.status(404).json({ error: '成员不存在' });
    
    if (member.role === 'owner') return res.status(400).json({ error: '无法移除项目负责人' });
    
    db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(id, userId);
    res.json({ message: '成员已移除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '移除成员失败' });
  }
});

module.exports = router;