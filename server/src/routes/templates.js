const express = require('express');
const getDb = (req) => req.app.locals.db;
const { v4: uuidv4 } = require('uuid');

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

// Middleware: Check admin or manager permission
const requireAdminOrManager = (req, res, next) => {
  if (req.userRole !== 'admin' && req.userRole !== 'manager') {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

// Get all templates
router.get('/templates', authenticate, (req, res) => {
  try {
    const templates = getDb(req).prepare(`
      SELECT pt.*, u.real_name as creator_name
      FROM project_templates pt
      LEFT JOIN users u ON pt.created_by = u.id
      ORDER BY pt.is_default DESC, pt.created_at DESC
    `).all();
    
    res.json(templates);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取模板列表失败' });
  }
});

// Get template detail with tasks
router.get('/templates/:id', authenticate, (req, res) => {
  try {
    const template = getDb(req).prepare(`
      SELECT pt.*, u.real_name as creator_name
      FROM project_templates pt
      LEFT JOIN users u ON pt.created_by = u.id
      WHERE pt.id = ?
    `).get(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    
    // Get template tasks
    const tasks = getDb(req).prepare(`
      SELECT tt.*, 
             r.name as role_name,
             d.name as department_name
      FROM template_tasks tt
      LEFT JOIN roles r ON tt.role_id = r.id
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE tt.template_id = ?
      ORDER BY tt.sort_order
    `).all(req.params.id);
    
    res.json({ ...template, tasks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取模板详情失败' });
  }
});

// Create template
router.post('/templates', authenticate, requireAdminOrManager, (req, res) => {
  try {
    const { name, description, category, isDefault, tasks } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '模板名称为必填项' });
    }
    
    // If set as default, unset other defaults
    if (isDefault) {
      getDb(req).prepare('UPDATE project_templates SET is_default = 0').run();
    }
    
    const templateId = uuidv4();
    getDb(req).prepare(`
      INSERT INTO project_templates (id, name, description, category, is_default, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(templateId, name, description || null, category || null, isDefault ? 1 : 0, req.userId);
    
    // Add tasks if provided
    if (tasks && tasks.length > 0) {
      tasks.forEach((task, index) => {
        const taskId = uuidv4();
        getDb(req).prepare(`
          INSERT INTO template_tasks (id, template_id, title, description, standard_hours, role_id, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(taskId, templateId, task.title, task.description || null, task.standardHours || 0, task.roleId || null, index);
      });
    }
    
    const template = getDb(req).prepare('SELECT * FROM project_templates WHERE id = ?').get(templateId);
    res.status(201).json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '创建模板失败' });
  }
});

// Update template
router.put('/templates/:id', authenticate, requireAdminOrManager, (req, res) => {
  try {
    const { name, description, category, isDefault, tasks } = req.body;
    const templateId = req.params.id;
    
    const exists = getDb(req).prepare('SELECT id FROM project_templates WHERE id = ?').get(templateId);
    if (!exists) {
      return res.status(404).json({ error: '模板不存在' });
    }
    
    // If set as default, unset other defaults
    if (isDefault) {
      getDb(req).prepare('UPDATE project_templates SET is_default = 0 WHERE id != ?').run(templateId);
    }
    
    getDb(req).prepare(`
      UPDATE project_templates 
      SET name = COALESCE(?, name),
          description = COALESCE(?, description),
          category = COALESCE(?, category),
          is_default = COALESCE(?, is_default),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, description, category, isDefault ? 1 : 0, templateId);
    
    // Update tasks if provided
    if (tasks !== undefined) {
      // Delete existing tasks
      getDb(req).prepare('DELETE FROM template_tasks WHERE template_id = ?').run(templateId);
      
      // Add new tasks
      if (tasks.length > 0) {
        tasks.forEach((task, index) => {
          const taskId = uuidv4();
          getDb(req).prepare(`
            INSERT INTO template_tasks (id, template_id, title, description, standard_hours, role_id, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(taskId, templateId, task.title, task.description || null, task.standardHours || 0, task.roleId || null, index);
        });
      }
    }
    
    const template = getDb(req).prepare('SELECT * FROM project_templates WHERE id = ?').get(templateId);
    res.json(template);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '更新模板失败' });
  }
});

// Delete template
router.delete('/templates/:id', authenticate, requireAdminOrManager, (req, res) => {
  try {
    const templateId = req.params.id;
    
    const exists = getDb(req).prepare('SELECT id FROM project_templates WHERE id = ?').get(templateId);
    if (!exists) {
      return res.status(404).json({ error: '模板不存在' });
    }
    
    // Delete tasks first (due to foreign key)
    getDb(req).prepare('DELETE FROM template_tasks WHERE template_id = ?').run(templateId);
    getDb(req).prepare('DELETE FROM project_templates WHERE id = ?').run(templateId);
    
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '删除模板失败' });
  }
});

// Get template tasks
router.get('/templates/:id/tasks', authenticate, (req, res) => {
  try {
    const tasks = getDb(req).prepare(`
      SELECT tt.*, 
             r.name as role_name,
             d.name as department_name
      FROM template_tasks tt
      LEFT JOIN roles r ON tt.role_id = r.id
      LEFT JOIN departments d ON r.department_id = d.id
      WHERE tt.template_id = ?
      ORDER BY tt.sort_order
    `).all(req.params.id);
    
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '获取模板任务失败' });
  }
});

module.exports = router;