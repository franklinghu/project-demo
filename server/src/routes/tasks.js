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

// Middleware: Get DB and verify token
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  
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

// Get all tasks (with filters)
router.get('/tasks', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { projectId, assigneeId, status, priority, creatorId, keyword } = req.query;
    
    let sql = `
      SELECT t.*, 
             p.name as project_name,
             c.real_name as creator_name,
             a.real_name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      sql += ' AND (t.assignee_id = ? OR t.creator_id = ?)';
      params.push(req.userId, req.userId);
    }
    
    if (projectId) { sql += ' AND t.project_id = ?'; params.push(projectId); }
    if (assigneeId) { sql += ' AND t.assignee_id = ?'; params.push(assigneeId); }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
    if (creatorId) { sql += ' AND t.creator_id = ?'; params.push(creatorId); }
    if (keyword) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    
    sql += ' ORDER BY t.created_at DESC';
    const tasks = db.prepare(sql).all(...params);
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取任务列表失败' });
  }
});

// Get task detail
router.get('/tasks/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, c.real_name as creator_name, a.real_name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(req.params.id);
    
    if (!task) return res.status(404).json({ error: '任务不存在' });
    
    const history = db.prepare(`
      SELECT h.*, u.real_name as changed_by_name
      FROM task_history h LEFT JOIN users u ON h.changed_by = u.id
      WHERE h.task_id = ? ORDER BY h.changed_at DESC
    `).all(req.params.id);
    
    res.json({ ...task, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取任务详情失败' });
  }
});

// Create task
router.post('/tasks', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { title, description, projectId, priority, assigneeId, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: '任务标题为必填项' });
    
    const taskId = uuidv4();
    db.prepare(`
      INSERT INTO tasks (id, title, description, project_id, priority, creator_id, assignee_id, due_date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(taskId, title, description || null, projectId || null, priority || 'medium', req.userId, assigneeId || null, dueDate || null);
    
    const historyId = uuidv4();
    db.prepare(`INSERT INTO task_history (id, task_id, field_name, new_value, changed_by) VALUES (?, ?, 'status', 'pending', ?)`)
      .run(historyId, taskId, req.userId);
    
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, c.real_name as creator_name, a.real_name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(taskId);
    
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建任务失败' });
  }
});

// Update task
router.put('/tasks/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { title, description, projectId, priority, assigneeId, dueDate, status } = req.body;
    const taskId = req.params.id;
    
    const exists = db.prepare('SELECT id, status, assignee_id, creator_id FROM tasks WHERE id = ?').get(taskId);
    if (!exists) return res.status(404).json({ error: '任务不存在' });
    
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      if (exists.creator_id !== req.userId && exists.assignee_id !== req.userId) {
        return res.status(403).json({ error: '无权限修改此任务' });
      }
    }
    
    if (status && status !== exists.status) {
      const historyId = uuidv4();
      db.prepare(`INSERT INTO task_history (id, task_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, 'status', ?, ?, ?)`)
        .run(historyId, taskId, exists.status, status, req.userId);
    }
    
    db.prepare(`
      UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
      project_id = COALESCE(?, project_id), priority = COALESCE(?, priority),
      assignee_id = COALESCE(?, assignee_id), due_date = COALESCE(?, due_date),
      status = COALESCE(?, status), updated_at = datetime('now')
      WHERE id = ?
    `).run(title, description, projectId, priority, assigneeId, dueDate, status, taskId);
    
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, c.real_name as creator_name, a.real_name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(taskId);
    
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新任务失败' });
  }
});

// Update task status
router.patch('/tasks/:id/status', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { status } = req.body;
    const taskId = req.params.id;
    
    const validStatuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: '无效的任务状态' });
    
    const exists = db.prepare('SELECT id, status, assignee_id, creator_id FROM tasks WHERE id = ?').get(taskId);
    if (!exists) return res.status(404).json({ error: '任务不存在' });
    
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      if (exists.creator_id !== req.userId && exists.assignee_id !== req.userId) {
        return res.status(403).json({ error: '无权限修改此任务' });
      }
    }
    
    const historyId = uuidv4();
    db.prepare(`INSERT INTO task_history (id, task_id, field_name, old_value, new_value, changed_by) VALUES (?, ?, 'status', ?, ?, ?)`)
      .run(historyId, taskId, exists.status, status, req.userId);
    
    db.prepare(`UPDATE tasks SET status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE NULL END, updated_at = datetime('now') WHERE id = ?`)
      .run(status, status, taskId);
    
    const task = db.prepare(`
      SELECT t.*, p.name as project_name, c.real_name as creator_name, a.real_name as assignee_name
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users c ON t.creator_id = c.id
      LEFT JOIN users a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(taskId);
    
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新任务状态失败' });
  }
});

// Delete task
router.delete('/tasks/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const taskId = req.params.id;
    
    const exists = db.prepare('SELECT id, creator_id FROM tasks WHERE id = ?').get(taskId);
    if (!exists) return res.status(404).json({ error: '任务不存在' });
    
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      if (exists.creator_id !== req.userId) return res.status(403).json({ error: '无权限删除此任务' });
    }
    
    db.prepare('DELETE FROM task_history WHERE task_id = ?').run(taskId);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
    res.json({ message: '任务已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除任务失败' });
  }
});

// Get task stats
router.get('/tasks/stats/summary', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const total = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    const pending = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get();
    const inProgress = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'").get();
    const completed = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    const overdue = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status NOT IN ('completed', 'cancelled') AND due_date < date('now')").get();
    
    res.json({
      total: total.count,
      pending: pending.count,
      inProgress: inProgress.count,
      completed: completed.count,
      overdue: overdue.count
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

module.exports = router;