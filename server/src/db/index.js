const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, '../../data/project_management.db');
const dataDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database wrapper for sql.js
class Database {
  constructor(db) {
    this.db = db;
  }

  prepare(sql) {
    const db = this.db;
    return {
      run: (...params) => {
        db.run(sql, params);
      },
      get: (...params) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return null;
      },
      all: (...params) => {
        const results = [];
        const stmt = db.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      }
    };
  }

  exec(sql) {
    this.db.run(sql);
  }

  save() {
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

let db;

// Initialize database
async function initDB() {
  const SQL = await initSqlJs();

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new Database(new SQL.Database(buffer));
  } else {
    db = new Database(new SQL.Database());
  }

  // Initialize tables
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      real_name TEXT,
      phone TEXT,
      role TEXT DEFAULT 'employee',
      department_id TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 部门表
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      manager_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES departments(id),
      FOREIGN KEY (manager_id) REFERENCES users(id)
    );

    -- 职位表
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      department_id TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    -- 项目表
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'planning',
      owner_id TEXT,
      department_id TEXT,
      start_date DATE,
      end_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    );

    -- 项目成员表
    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(project_id, user_id)
    );

    -- 任务表
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      project_id TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'medium',
      creator_id TEXT,
      assignee_id TEXT,
      due_date DATE,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (creator_id) REFERENCES users(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id)
    );

    -- 任务状态变更历史
    CREATE TABLE IF NOT EXISTS task_history (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      changed_by TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id),
      FOREIGN KEY (changed_by) REFERENCES users(id)
    );

    -- 工时记录表
    CREATE TABLE IF NOT EXISTS work_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      date DATE NOT NULL,
      hours REAL NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'pending',
      approver_id TEXT,
      approved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (approver_id) REFERENCES users(id)
    );
  `);

  // Create default admin user if not exists
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('Admin@2026!', 10);
    const adminId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, username, email, password, real_name, role, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, 'admin', 'admin@company.com', hashedPassword, '系统管理员', 'admin', 'active');
    
    console.log('Default admin user created: admin / Admin@2026!');
  }

  // Create default department
  const deptExists = db.prepare('SELECT id FROM departments WHERE name = ?').get('总经办');
  if (!deptExists) {
    const deptId = uuidv4();
    db.prepare(`
      INSERT INTO departments (id, name, description)
      VALUES (?, ?, ?)
    `).run(deptId, '总经办', '公司最高管理层级');
    
    // Update admin's department
    db.prepare('UPDATE users SET department_id = ? WHERE username = ?').run(deptId, 'admin');
    console.log('Default department created: 总经办');
  }

  // Save initial state
  db.save();

  // Auto-save periodically
  setInterval(() => {
    db.save();
  }, 5000);

  return db;
}

// Database instance
let dbInstance = null;

// Initialize and export
initDB().then(database => {
  dbInstance = database;
  // Override prepare to add save after write
  const originalPrepare = database.prepare.bind(database);
  database.prepare = function(sql) {
    const stmt = originalPrepare(sql);
    const originalRun = stmt.run.bind(stmt);
    stmt.run = function(...params) {
      originalRun(...params);
      database.save();
    };
    return stmt;
  };
});

// Export a function to get db synchronously
module.exports = {
  getDb: () => {
    if (!dbInstance) {
      throw new Error('Database not initialized yet');
    }
    return dbInstance;
  }
};