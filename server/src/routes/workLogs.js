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

// Middleware: Verify token
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

// Get my work logs (for employees)
router.get('/work-logs/my', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { startDate, endDate, projectId, status } = req.query;
    
    let sql = `
      SELECT wl.*, p.name as project_name, u.real_name as approver_name
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      LEFT JOIN users u ON wl.approver_id = u.id
      WHERE wl.user_id = ?
    `;
    const params = [req.userId];
    
    if (startDate) { sql += ' AND wl.date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND wl.date <= ?'; params.push(endDate); }
    if (projectId) { sql += ' AND wl.project_id = ?'; params.push(projectId); }
    if (status) { sql += ' AND wl.status = ?'; params.push(status); }
    
    sql += ' ORDER BY wl.date DESC, wl.created_at DESC';
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取工时记录失败' });
  }
});

// Get all work logs (for managers)
router.get('/work-logs', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { startDate, endDate, projectId, userId, status, departmentId } = req.query;
    
    // Non-managers can only see their own
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    let sql = `
      SELECT wl.*, p.name as project_name, u.real_name as user_name, u.department_id,
             d.name as department_name, a.real_name as approver_name
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      LEFT JOIN users u ON wl.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users a ON wl.approver_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (startDate) { sql += ' AND wl.date >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND wl.date <= ?'; params.push(endDate); }
    if (projectId) { sql += ' AND wl.project_id = ?'; params.push(projectId); }
    if (userId) { sql += ' AND wl.user_id = ?'; params.push(userId); }
    if (status) { sql += ' AND wl.status = ?'; params.push(status); }
    if (departmentId) { sql += ' AND u.department_id = ?'; params.push(departmentId); }
    
    sql += ' ORDER BY wl.date DESC, wl.created_at DESC';
    const logs = db.prepare(sql).all(...params);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取工时记录失败' });
  }
});

// Create work log
router.post('/work-logs', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { projectId, date, hours, description } = req.body;
    
    if (hours === undefined || hours === null || isNaN(hours)) {
      return res.status(400).json({ error: '工时为必填项' });
    }
    
    if (hours < 0.5 || hours > 24) {
      return res.status(400).json({ error: '工时必须大于0.5且不超过24小时' });
    }
    
    // Check if already submitted for this date (only today can be modified)
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
      return res.status(400).json({ error: '只能修改今日的工时' });
    }
    
    const logId = uuidv4();
    
    // If there's an existing log for this date, update it instead
    const existing = db.prepare('SELECT id FROM work_logs WHERE user_id = ? AND date = ?').get(req.userId, date);
    
    if (existing) {
      db.prepare(`
        UPDATE work_logs SET project_id = ?, hours = ?, description = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(projectId || null, hours, description || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO work_logs (id, user_id, project_id, date, hours, description, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `).run(logId, req.userId, projectId || null, date, hours, description || null);
    }
    
    // Get the (updated) record
    const log = db.prepare(`
      SELECT wl.*, p.name as project_name
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      WHERE wl.user_id = ? AND wl.date = ?
    `).get(req.userId, date);
    
    res.status(201).json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '提交工时失败' });
  }
});

// Update work log (for own logs)
router.put('/work-logs/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { projectId, date, hours, description } = req.body;
    const logId = req.params.id;
    
    const existing = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(logId);
    if (!existing) return res.status(404).json({ error: '工时记录不存在' });
    
    // Only owner or manager can update
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      if (existing.user_id !== req.userId) {
        return res.status(403).json({ error: '无权限修改此记录' });
      }
    }
    
    // Cannot modify approved logs
    if (existing.status === 'approved') {
      return res.status(400).json({ error: '已审批的记录无法修改' });
    }
    
    db.prepare(`
      UPDATE work_logs SET project_id = COALESCE(?, project_id), date = COALESCE(?, date),
      hours = COALESCE(?, hours), description = COALESCE(?, description), updated_at = datetime('now')
      WHERE id = ?
    `).run(projectId, date, hours, description, logId);
    
    const log = db.prepare(`
      SELECT wl.*, p.name as project_name
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      WHERE wl.id = ?
    `).get(logId);
    
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新工时失败' });
  }
});

// Approve/reject work log (for managers)
router.patch('/work-logs/:id/review', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { status, comment } = req.body; // status: 'approved' or 'rejected'
    
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      return res.status(403).json({ error: '权限不足' });
    }
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '无效的审批状态' });
    }
    
    const logId = req.params.id;
    const existing = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(logId);
    if (!existing) return res.status(404).json({ error: '工时记录不存在' });
    
    // Include comment in description if provided
    const description = comment ? `${existing.description || ''}\n\n审批意见: ${comment}` : existing.description;
    
    db.prepare(`
      UPDATE work_logs SET status = ?, approver_id = ?, approved_at = datetime('now'),
      description = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, req.userId, description, logId);
    
    const log = db.prepare(`
      SELECT wl.*, p.name as project_name, u.real_name as approver_name
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      LEFT JOIN users u ON wl.approver_id = u.id
      WHERE wl.id = ?
    `).get(logId);
    
    res.json(log);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '审批失败' });
  }
});

// Get work log statistics
router.get('/work-logs/stats', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const { startDate, endDate, userId, departmentId } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    
    // Non-managers see only their own
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      whereClause += ' AND wl.user_id = ?';
      params.push(req.userId);
    }
    
    if (startDate) { whereClause += ' AND wl.date >= ?'; params.push(startDate); }
    if (endDate) { whereClause += ' AND wl.date <= ?'; params.push(endDate); }
    if (userId) { whereClause += ' AND wl.user_id = ?'; params.push(userId); }
    if (departmentId) { whereClause += ' AND u.department_id = ?'; params.push(departmentId); }
    
    const total = db.prepare(`
      SELECT SUM(wl.hours) as total_hours, COUNT(*) as total_count
      FROM work_logs wl
      LEFT JOIN users u ON wl.user_id = u.id
      ${whereClause}
    `).get(...params);
    
    const byStatus = db.prepare(`
      SELECT wl.status, SUM(wl.hours) as hours, COUNT(*) as count
      FROM work_logs wl
      LEFT JOIN users u ON wl.user_id = u.id
      ${whereClause}
      GROUP BY wl.status
    `).all(...params);
    
    const byProject = db.prepare(`
      SELECT p.name as project_name, SUM(wl.hours) as hours, COUNT(*) as count
      FROM work_logs wl
      LEFT JOIN projects p ON wl.project_id = p.id
      LEFT JOIN users u ON wl.user_id = u.id
      ${whereClause} AND wl.project_id IS NOT NULL
      GROUP BY wl.project_id
    `).all(...params);
    
    const byUser = db.prepare(`
      SELECT u.real_name as user_name, u.id as user_id, SUM(wl.hours) as hours, COUNT(*) as count
      FROM work_logs wl
      LEFT JOIN users u ON wl.user_id = u.id
      ${whereClause}
      GROUP BY wl.user_id
      ORDER BY hours DESC
    `).all(...params);
    
    res.json({
      totalHours: total.total_hours || 0,
      totalCount: total.total_count || 0,
      byStatus,
      byProject,
      byUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取统计失败' });
  }
});

// Delete work log
router.delete('/work-logs/:id', authenticate, async (req, res) => {
  try {
    const db = req.db;
    const logId = req.params.id;
    
    const existing = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(logId);
    if (!existing) return res.status(404).json({ error: '工时记录不存在' });
    
    // Only owner or manager can delete
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      if (existing.user_id !== req.userId) {
        return res.status(403).json({ error: '无权限删除此记录' });
      }
    }
    
    // Cannot delete approved logs
    if (existing.status === 'approved') {
      return res.status(400).json({ error: '已审批的记录无法删除' });
    }
    
    db.prepare('DELETE FROM work_logs WHERE id = ?').run(logId);
    res.json({ message: '工时记录已删除' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除工时失败' });
  }
});

module.exports = router;