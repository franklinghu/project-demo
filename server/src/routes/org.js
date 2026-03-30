const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const router = express.Router();

// Middleware: Verify token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'project-management-secret-key-2026';
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
};

// Middleware: Check admin permission
const requireAdmin = (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'manager') {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

// Get all departments (tree structure)
router.get('/departments', authenticate, (req, res) => {
  try {
    const departments = db.prepare(`
      SELECT d.*, u.real_name as manager_name
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      ORDER BY d.name
    `).all();
    
    // Build tree structure
    const deptMap = {};
    departments.forEach(dept => {
      deptMap[dept.id] = { ...dept, children: [] };
    });
    
    const tree = [];
    departments.forEach(dept => {
      if (dept.parent_id && deptMap[dept.parent_id]) {
        deptMap[dept.parent_id].children.push(deptMap[dept.id]);
      } else {
        tree.push(deptMap[dept.id]);
      }
    });
    
    res.json(tree);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取部门列表失败' });
  }
});

// Get all departments (flat list)
router.get('/departments/flat', authenticate, (req, res) => {
  try {
    const departments = db.prepare(`
      SELECT d.*, u.real_name as manager_name
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      ORDER BY d.name
    `).all();
    
    res.json(departments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取部门列表失败' });
  }
});

// Get department detail
router.get('/departments/:id', authenticate, (req, res) => {
  try {
    const dept = db.prepare(`
      SELECT d.*, u.real_name as manager_name
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.id
      WHERE d.id = ?
    `).get(req.params.id);
    
    if (!dept) {
      return res.status(404).json({ error: '部门不存在' });
    }
    
    // Get members
    const members = db.prepare(`
      SELECT id, username, real_name, email, phone, role, position
      FROM users WHERE department_id = ?
    `).all(req.params.id);
    
    // Get child departments
    const children = db.prepare(`
      SELECT id, name FROM departments WHERE parent_id = ?
    `).all(req.params.id);
    
    res.json({ ...dept, members, children });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取部门详情失败' });
  }
});

// Create department
router.post('/departments', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, parentId, managerId, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '部门名称为必填项' });
    }
    
    // Check name uniqueness
    const exists = db.prepare('SELECT id FROM departments WHERE name = ?').get(name);
    if (exists) {
      return res.status(400).json({ error: '部门名称已存在' });
    }
    
    const deptId = uuidv4();
    db.prepare(`
      INSERT INTO departments (id, name, parent_id, manager_id, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(deptId, name, parentId || null, managerId || null, description || null);
    
    // Update manager's department if specified
    if (managerId) {
      db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(deptId, managerId);
    }
    
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
    res.status(201).json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建部门失败' });
  }
});

// Update department
router.put('/departments/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, parentId, managerId, description } = req.body;
    const deptId = req.params.id;
    
    const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(deptId);
    if (!exists) {
      return res.status(404).json({ error: '部门不存在' });
    }
    
    // Check name uniqueness (exclude self)
    if (name) {
      const nameExists = db.prepare('SELECT id FROM departments WHERE name = ? AND id != ?').get(name, deptId);
      if (nameExists) {
        return res.status(400).json({ error: '部门名称已存在' });
      }
    }
    
    db.prepare(`
      UPDATE departments 
      SET name = COALESCE(?, name),
          parent_id = COALESCE(?, parent_id),
          manager_id = COALESCE(?, manager_id),
          description = COALESCE(?, description),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, parentId, managerId, description, deptId);
    
    // Update manager's department if specified
    if (managerId) {
      db.prepare('UPDATE users SET department_id = ? WHERE id = ?').run(deptId, managerId);
    }
    
    const dept = db.prepare('SELECT * FROM departments WHERE id = ?').get(deptId);
    res.json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新部门失败' });
  }
});

// Delete department
router.delete('/departments/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const deptId = req.params.id;
    
    const exists = db.prepare('SELECT id FROM departments WHERE id = ?').get(deptId);
    if (!exists) {
      return res.status(404).json({ error: '部门不存在' });
    }
    
    // Check if has members
    const members = db.prepare('SELECT COUNT(*) as count FROM users WHERE department_id = ?').get(deptId);
    if (members.count > 0) {
      return res.status(400).json({ error: '该部门下有成员，无法删除' });
    }
    
    // Check if has children
    const children = db.prepare('SELECT COUNT(*) as count FROM departments WHERE parent_id = ?').get(deptId);
    if (children.count > 0) {
      return res.status(400).json({ error: '该部门有子部门，无法删除' });
    }
    
    db.prepare('DELETE FROM departments WHERE id = ?').run(deptId);
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除部门失败' });
  }
});

// Get all users
router.get('/users', authenticate, (req, res) => {
  try {
    const { departmentId, role, keyword } = req.query;
    
    let sql = `
      SELECT u.id, u.username, u.email, u.real_name, u.phone, u.role, u.department_id, u.status, u.created_at,
             d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE 1=1
    `;
    const params = [];
    
    if (departmentId) {
      sql += ' AND u.department_id = ?';
      params.push(departmentId);
    }
    
    if (role) {
      sql += ' AND u.role = ?';
      params.push(role);
    }
    
    if (keyword) {
      sql += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
    
    sql += ' ORDER BY u.created_at DESC';
    
    const users = db.prepare(sql).all(...params);
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// Get user detail
router.get('/users/:id', authenticate, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT u.*, d.name as department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `).get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // Remove password
    delete user.password;
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取用户详情失败' });
  }
});

// Update user
router.put('/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { realName, phone, role, departmentId, status } = req.body;
    const userId = req.params.id;
    
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!exists) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    db.prepare(`
      UPDATE users 
      SET real_name = COALESCE(?, real_name),
          phone = COALESCE(?, phone),
          role = COALESCE(?, role),
          department_id = COALESCE(?, department_id),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(realName, phone, role, departmentId, status, userId);
    
    const user = db.prepare(`
      SELECT id, username, email, real_name, phone, role, department_id, status
      FROM users WHERE id = ?
    `).get(userId);
    
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新用户失败' });
  }
});

// Delete user (soft delete - set status to inactive)
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const userId = req.params.id;
    
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({ error: '无法删除管理员' });
    }
    
    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run('inactive', userId);
    
    res.json({ message: '用户已禁用' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除用户失败' });
  }
});

// Get organization stats
router.get('/stats', authenticate, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE status = ?').get('active');
    const totalDepartments = db.prepare('SELECT COUNT(*) as count FROM departments').get();
    const byRole = db.prepare(`
      SELECT role, COUNT(*) as count FROM users WHERE status = 'active' GROUP BY role
    `).all();
    const byDepartment = db.prepare(`
      SELECT d.name, COUNT(u.id) as count 
      FROM departments d 
      LEFT JOIN users u ON d.id = u.department_id AND u.status = 'active'
      GROUP BY d.id, d.name
      ORDER BY count DESC
    `).all();
    
    res.json({
      totalUsers: totalUsers.count,
      totalDepartments: totalDepartments.count,
      byRole,
      byDepartment
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

module.exports = router;