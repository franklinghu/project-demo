const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const dbWrapper = require('../db');
const getDb = dbWrapper.getDb;

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'project-management-secret-key-2026';

// Middleware: Verify token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期' });
  }
};

// Register
router.post('/register', (req, res) => {
  try {
    const { username, email, password, realName, phone } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱、密码为必填项' });
    }
    
    // Password strength validation
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: '密码必须包含字母和数字' });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    
    // Check if user exists
    const existing = getDb().prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(400).json({ error: '用户名或邮箱已存在' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    const userId = uuidv4();
    
    getDb().prepare(`
      INSERT INTO users (id, username, email, password, real_name, phone, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'employee', 'active')
    `).run(userId, username, email, hashedPassword, realName || username, phone || null);
    
    const token = jwt.sign({ userId, role: 'employee' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: '注册成功',
      token,
      user: { id: userId, username, email, realName, role: 'employee' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '注册失败' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码为必填项' });
    }
    
    const user = getDb().prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    if (user.status !== 'active') {
      return res.status(401).json({ error: '账号已被禁用' });
    }
    
    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    // Get department name
    let departmentName = null;
    if (user.department_id) {
      const dept = getDb().prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
      departmentName = dept?.name;
    }
    
    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        realName: user.real_name,
        phone: user.phone,
        role: user.role,
        departmentId: user.department_id,
        departmentName,
        status: user.status
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '登录失败' });
  }
});

// Get current user info
router.get('/me', authenticate, (req, res) => {
  try {
    const user = getDb().prepare(`
      SELECT id, username, email, real_name, phone, role, department_id, status, created_at
      FROM users WHERE id = ?
    `).get(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    let departmentName = null;
    if (user.department_id) {
      const dept = getDb().prepare('SELECT name FROM departments WHERE id = ?').get(user.department_id);
      departmentName = dept?.name;
    }
    
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.real_name,
      phone: user.phone,
      role: user.role,
      departmentId: user.department_id,
      departmentName,
      status: user.status,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// Change password
router.post('/change-password', authenticate, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码为必填项' });
    }
    
    const user = getDb().prepare('SELECT password FROM users WHERE id = ?').get(req.userId);
    if (!bcrypt.compareSync(oldPassword, user.password)) {
      return res.status(400).json({ error: '旧密码错误' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    getDb().prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, req.userId);
    
    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '密码修改失败' });
  }
});

// Logout (client-side token removal, just return success)
router.post('/logout', (req, res) => {
  res.json({ message: '退出登录成功' });
});

module.exports = router;