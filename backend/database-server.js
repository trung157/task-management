// TaskFlow Backend with PostgreSQL Database Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

console.log('🚀 Starting TaskFlow Backend with Database...');

const app = express();
const PORT = process.env.PORT || 5000;

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'task_management_db',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Database connection status
let databaseConnected = false;

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
    console.log('🔍 Database config:', {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'task_management_db',
      port: process.env.DB_PORT || 5432,
      // password: '***hidden***'
    });
    console.log('⚠️  Continuing with mock mode...');
    databaseConnected = false;
  } else {
    console.log('✅ Connected to PostgreSQL database');
    databaseConnected = true;
    release();
  }
});

// Mock data for fallback mode
let mockUsers = new Map();
let mockTasks = new Map();
let mockCategories = new Map([
  ['cat-1', {
    id: 'cat-1',
    name: 'Work',
    description: 'Work related tasks',
    color: '#3B82F6',
    icon: 'work',
    is_default: true,
    sort_order: 1,
    user_id: null,
    task_count: 0,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }],
  ['cat-2', {
    id: 'cat-2',
    name: 'Personal',
    description: 'Personal tasks',
    color: '#10B981',
    icon: 'person',
    is_default: false,
    sort_order: 2,
    user_id: null,
    task_count: 0,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }]
]);

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'TaskFlow Backend with Database is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'API with Database is working!' });
});

// Authentication endpoints
app.post('/api/auth/register', async (req, res) => {
  console.log('📝 Register request received:', req.body);
  
  try {
    const { email, password, first_name, last_name, timezone, language_code } = req.body;
    
    // Validate input
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }
    
    if (databaseConnected) {
      // Database mode - real implementation
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user
      const userId = uuidv4();
      const now = new Date().toISOString();
      
      const insertResult = await pool.query(`
        INSERT INTO users (
          id, email, password_hash, first_name, last_name, 
          timezone, language_code, created_at, updated_at,
          email_verified, role, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id, email, first_name, last_name, timezone, language_code, 
                  created_at, updated_at, email_verified, role, status, avatar_url, bio
      `, [
        userId, email, hashedPassword, first_name, last_name,
        timezone || 'UTC', language_code || 'en', now, now,
        false, 'user', 'active'
      ]);
      
      const user = insertResult.rows[0];
      
      // Generate JWT tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };
      
      const accessToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        tokenPayload,
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        { expiresIn: '7d' }
      );
      
      // Store refresh token in database
      await pool.query(`
        INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        uuidv4(),
        user.id,
        refreshToken,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        now
      ]);
      
      const response = {
        success: true,
        message: 'Registration successful! (Database mode)',
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 900,
          token_type: 'Bearer',
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: `${user.first_name} ${user.last_name}`,
            timezone: user.timezone,
            language_code: user.language_code,
            created_at: user.created_at,
            updated_at: user.updated_at,
            email_verified: user.email_verified,
            role: user.role,
            status: user.status,
            avatar_url: user.avatar_url,
            bio: user.bio
          }
        }
      };
      
      console.log('📤 User registered successfully (DB):', user.email);
      res.json(response);
      
    } else {
      // Mock mode - fallback when database not available
      console.log('🔄 Using mock mode for registration');
      
      // Check if user already exists in mock storage
      for (let [id, user] of mockUsers) {
        if (user.email === email) {
          return res.status(400).json({
            success: false,
            message: 'User with this email already exists'
          });
        }
      }
      
      // Create mock user
      const userId = `mock-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const user = {
        id: userId,
        email,
        password_hash: hashedPassword,
        first_name,
        last_name,
        timezone: timezone || 'UTC',
        language_code: language_code || 'en',
        created_at: now,
        updated_at: now,
        email_verified: false,
        role: 'user',
        status: 'active',
        avatar_url: null,
        bio: null
      };
      
      mockUsers.set(userId, user);
      
      // Generate tokens
      const tokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };
      
      const accessToken = jwt.sign(
        tokenPayload,
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '15m' }
      );
      
      const refreshToken = jwt.sign(
        tokenPayload,
        process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
        { expiresIn: '7d' }
      );
      
      const response = {
        success: true,
        message: 'Registration successful! (Mock mode)',
        data: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: 900,
          token_type: 'Bearer',
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            display_name: `${user.first_name} ${user.last_name}`,
            timezone: user.timezone,
            language_code: user.language_code,
            created_at: user.created_at,
            updated_at: user.updated_at,
            email_verified: user.email_verified,
            role: user.role,
            status: user.status,
            avatar_url: user.avatar_url,
            bio: user.bio
          }
        }
      };
      
      console.log('📤 User registered successfully (Mock):', user.email);
      res.json(response);
    }
    
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  console.log('🔐 Login request received:', { email: req.body.email });
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user
    const userResult = await pool.query(`
      SELECT id, email, password_hash, first_name, last_name, 
             timezone, language_code, created_at, updated_at,
             email_verified, role, status, avatar_url, bio
      FROM users WHERE email = $1
    `, [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    const user = userResult.rows[0];
    
    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    const accessToken = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '15m' }
    );
    
    const refreshToken = jwt.sign(
      tokenPayload,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
      { expiresIn: '7d' }
    );
    
    // Store refresh token
    await pool.query(`
      INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      uuidv4(),
      user.id,
      refreshToken,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      new Date().toISOString()
    ]);
    
    const response = {
      success: true,
      message: 'Login successful!',
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: 900,
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          display_name: `${user.first_name} ${user.last_name}`,
          timezone: user.timezone,
          language_code: user.language_code,
          created_at: user.created_at,
          updated_at: user.updated_at,
          email_verified: user.email_verified,
          role: user.role,
          status: user.status,
          avatar_url: user.avatar_url,
          bio: user.bio
        }
      }
    };
    
    console.log('📤 User logged in successfully:', user.email);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Task endpoints
app.get('/api/tasks', authenticateToken, async (req, res) => {
  console.log('📋 Get tasks request received for user:', req.user.userId);
  
  try {
    const tasksResult = await pool.query(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
    `, [req.user.userId]);
    
    const categoriesResult = await pool.query(`
      SELECT * FROM categories 
      WHERE user_id = $1 OR is_default = true
      ORDER BY sort_order ASC
    `, [req.user.userId]);
    
    const tasks = tasksResult.rows.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      due_date: task.due_date,
      reminder_date: task.reminder_date,
      start_date: task.start_date,
      estimated_minutes: task.estimated_minutes,
      actual_minutes: task.actual_minutes,
      completed_at: task.completed_at,
      tags: task.tags || [],
      category: task.category_id ? {
        id: task.category_id,
        name: task.category_name,
        color: task.category_color,
        icon: task.category_icon
      } : null,
      metadata: task.metadata || {},
      created_at: task.created_at,
      updated_at: task.updated_at
    }));
    
    const response = {
      success: true,
      data: {
        tasks: tasks,
        total: tasks.length,
        categories: categoriesResult.rows
      }
    };
    
    console.log(`📤 Sending ${tasks.length} tasks`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  console.log('➕ Create task request received:', req.body);
  
  try {
    const { 
      title, description, priority = 'medium', status = 'pending', 
      category_id, due_date, reminder_date, start_date, 
      estimated_minutes, tags = [], metadata = {} 
    } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Task title is required'
      });
    }
    
    const taskId = uuidv4();
    const now = new Date().toISOString();
    
    const insertResult = await pool.query(`
      INSERT INTO tasks (
        id, user_id, title, description, status, priority,
        category_id, due_date, reminder_date, start_date,
        estimated_minutes, tags, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      taskId, req.user.userId, title, description || '', status, priority,
      category_id || null, due_date || null, reminder_date || null, start_date || null,
      estimated_minutes || null, tags || [], JSON.stringify(metadata), now, now
    ]);
    
    const task = insertResult.rows[0];
    
    // Get category info if exists
    let category = null;
    if (task.category_id) {
      const categoryResult = await pool.query(
        'SELECT id, name, color, icon FROM categories WHERE id = $1',
        [task.category_id]
      );
      if (categoryResult.rows.length > 0) {
        category = categoryResult.rows[0];
      }
    }
    
    const response = {
      success: true,
      message: 'Task created successfully!',
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        reminder_date: task.reminder_date,
        start_date: task.start_date,
        estimated_minutes: task.estimated_minutes,
        actual_minutes: task.actual_minutes,
        completed_at: task.completed_at,
        tags: task.tags || [],
        category: category,
        metadata: task.metadata || {},
        created_at: task.created_at,
        updated_at: task.updated_at
      }
    };
    
    console.log('📤 Task created successfully:', task.title);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
});

// Get single task
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
  console.log('📋 Get task request received for task:', req.params.id);
  
  try {
    const taskResult = await pool.query(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = $1 AND t.user_id = $2
    `, [req.params.id, req.user.userId]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const task = taskResult.rows[0];
    let category = null;
    
    if (task.category_id) {
      category = {
        id: task.category_id,
        name: task.category_name,
        color: task.category_color,
        icon: task.category_icon
      };
    }
    
    const response = {
      success: true,
      message: 'Task retrieved successfully',
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        reminder_date: task.reminder_date,
        start_date: task.start_date,
        estimated_minutes: task.estimated_minutes,
        actual_minutes: task.actual_minutes,
        completed_at: task.completed_at,
        tags: task.tags || [],
        category: category,
        metadata: task.metadata || {},
        created_at: task.created_at,
        updated_at: task.updated_at
      }
    };
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ Get task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get task'
    });
  }
});

// Update task
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  console.log('📝 Update task request received for task:', req.params.id);
  console.log('📝 Update data:', req.body);
  
  try {
    // First check if task exists and belongs to user
    const existingTask = await pool.query(`
      SELECT id FROM tasks WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);
    
    if (existingTask.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const { 
      title, description, priority, status, 
      category_id, due_date, reminder_date, start_date, 
      estimated_minutes, tags, metadata 
    } = req.body;
    
    const now = new Date().toISOString();
    
    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (priority !== undefined) {
      updateFields.push(`priority = $${paramCount++}`);
      values.push(priority);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      values.push(status);
      
      // If marking as completed, set completed_at
      if (status === 'completed') {
        updateFields.push(`completed_at = $${paramCount++}`);
        values.push(now);
      } else if (status !== 'completed') {
        updateFields.push(`completed_at = NULL`);
      }
    }
    if (category_id !== undefined) {
      updateFields.push(`category_id = $${paramCount++}`);
      values.push(category_id || null);
    }
    if (due_date !== undefined) {
      updateFields.push(`due_date = $${paramCount++}`);
      values.push(due_date || null);
    }
    if (reminder_date !== undefined) {
      updateFields.push(`reminder_date = $${paramCount++}`);
      values.push(reminder_date || null);
    }
    if (start_date !== undefined) {
      updateFields.push(`start_date = $${paramCount++}`);
      values.push(start_date || null);
    }
    if (estimated_minutes !== undefined) {
      updateFields.push(`estimated_minutes = $${paramCount++}`);
      values.push(estimated_minutes || null);
    }
    if (tags !== undefined) {
      updateFields.push(`tags = $${paramCount++}`);
      values.push(tags || []);
    }
    if (metadata !== undefined) {
      updateFields.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(metadata || {}));
    }
    
    // Always update updated_at
    updateFields.push(`updated_at = $${paramCount++}`);
    values.push(now);
    
    // Add WHERE condition parameters
    values.push(req.params.id, req.user.userId);
    
    const updateQuery = `
      UPDATE tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING *
    `;
    
    const updateResult = await pool.query(updateQuery, values);
    const task = updateResult.rows[0];
    
    // Get category info if exists
    let category = null;
    if (task.category_id) {
      const categoryResult = await pool.query(`
        SELECT id, name, color, icon FROM categories WHERE id = $1
      `, [task.category_id]);
      
      if (categoryResult.rows.length > 0) {
        const cat = categoryResult.rows[0];
        category = {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon
        };
      }
    }
    
    const response = {
      success: true,
      message: 'Task updated successfully',
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
        reminder_date: task.reminder_date,
        start_date: task.start_date,
        estimated_minutes: task.estimated_minutes,
        actual_minutes: task.actual_minutes,
        completed_at: task.completed_at,
        tags: task.tags || [],
        category: category,
        metadata: task.metadata || {},
        created_at: task.created_at,
        updated_at: task.updated_at
      }
    };
    
    console.log('📤 Task updated successfully:', task.title);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
});

// Delete task
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  console.log('🗑️ Delete task request received for task:', req.params.id);
  
  try {
    // First check if task exists and belongs to user
    const existingTask = await pool.query(`
      SELECT id, title FROM tasks WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);
    
    if (existingTask.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const taskTitle = existingTask.rows[0].title;
    
    // Delete the task
    await pool.query(`
      DELETE FROM tasks WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);
    
    console.log('📤 Task deleted successfully:', taskTitle);
    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
});

// Toggle task status (quick complete/uncomplete)
app.patch('/api/tasks/:id/toggle', authenticateToken, async (req, res) => {
  console.log('🔄 Toggle task status request received for task:', req.params.id);
  
  try {
    // Get current task status
    const taskResult = await pool.query(`
      SELECT id, title, status FROM tasks WHERE id = $1 AND user_id = $2
    `, [req.params.id, req.user.userId]);
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    const task = taskResult.rows[0];
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const now = new Date().toISOString();
    
    // Update task status
    const updateResult = await pool.query(`
      UPDATE tasks 
      SET status = $1, 
          completed_at = $2,
          updated_at = $3
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [
      newStatus, 
      newStatus === 'completed' ? now : null,
      now,
      req.params.id, 
      req.user.userId
    ]);
    
    const updatedTask = updateResult.rows[0];
    
    // Get category info if exists
    let category = null;
    if (updatedTask.category_id) {
      const categoryResult = await pool.query(`
        SELECT id, name, color, icon FROM categories WHERE id = $1
      `, [updatedTask.category_id]);
      
      if (categoryResult.rows.length > 0) {
        const cat = categoryResult.rows[0];
        category = {
          id: cat.id,
          name: cat.name,
          color: cat.color,
          icon: cat.icon
        };
      }
    }
    
    const response = {
      success: true,
      message: `Task marked as ${newStatus}`,
      data: {
        id: updatedTask.id,
        title: updatedTask.title,
        description: updatedTask.description,
        status: updatedTask.status,
        priority: updatedTask.priority,
        due_date: updatedTask.due_date,
        reminder_date: updatedTask.reminder_date,
        start_date: updatedTask.start_date,
        estimated_minutes: updatedTask.estimated_minutes,
        actual_minutes: updatedTask.actual_minutes,
        completed_at: updatedTask.completed_at,
        tags: updatedTask.tags || [],
        category: category,
        metadata: updatedTask.metadata || {},
        created_at: updatedTask.created_at,
        updated_at: updatedTask.updated_at
      }
    };
    
    console.log('📤 Task status toggled successfully:', updatedTask.title, '→', newStatus);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Toggle task status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle task status'
    });
  }
});

// Categories endpoints
app.get('/api/categories', authenticateToken, async (req, res) => {
  console.log('📂 Get categories request received for user:', req.user.userId);
  
  try {
    const result = await pool.query(`
      SELECT c.*, 
             COALESCE(task_counts.task_count, 0) as task_count,
             COALESCE(task_counts.completed_task_count, 0) as completed_task_count
      FROM categories c
      LEFT JOIN (
        SELECT category_id,
               COUNT(*) as task_count,
               COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_task_count
        FROM tasks 
        WHERE user_id = $1
        GROUP BY category_id
      ) task_counts ON c.id = task_counts.category_id
      WHERE c.user_id = $1
      ORDER BY c.sort_order ASC
    `, [req.user.userId]);
    
    const response = {
      success: true,
      data: result.rows
    };
    
    console.log(`📤 Sending ${result.rows.length} categories`);
    res.json(response);
    
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
});

// Test endpoint without auth to debug
app.post('/api/categories/test', async (req, res) => {
  console.log('🧪 TEST Create category request received (no auth):', req.body);
  
  res.status(200).json({
    success: true,
    message: 'Test endpoint working',
    receivedData: req.body
  });
});

// Create category
app.post('/api/categories', authenticateToken, async (req, res) => {
  console.log('➕ Create category request received:', req.body);
  
  try {
    const { name, description, color, icon, sort_order } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    const result = await pool.query(`
      INSERT INTO categories (user_id, name, description, color, icon, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      req.user.userId,
      name.trim(),
      description || null,
      color || '#6366f1',
      icon || 'folder',
      sort_order || 0
    ]);
    
    const newCategory = result.rows[0];
    console.log(`📤 Category created successfully: ${newCategory.name}`);
    
    res.status(201).json({
      success: true,
      data: newCategory
    });
    
  } catch (error) {
    console.error('❌ Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
});

// Update category
app.put('/api/categories/:id', authenticateToken, async (req, res) => {
  console.log(`📝 Update category request received for category: ${req.params.id}`);
  console.log('📝 Update data:', req.body);
  
  try {
    const { id } = req.params;
    const { name, description, color, icon, sort_order } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required'
      });
    }
    
    const result = await pool.query(`
      UPDATE categories 
      SET name = $1, description = $2, color = $3, icon = $4, sort_order = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND user_id = $7
      RETURNING *
    `, [
      name.trim(),
      description || null,
      color || '#6366f1',
      icon || 'folder',
      sort_order || 0,
      id,
      req.user.userId
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or you do not have permission to update it'
      });
    }
    
    const updatedCategory = result.rows[0];
    console.log(`📤 Category updated successfully: ${updatedCategory.name}`);
    
    res.json({
      success: true,
      data: updatedCategory
    });
    
  } catch (error) {
    console.error('❌ Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
    });
  }
});

// Delete category
app.delete('/api/categories/:id', authenticateToken, async (req, res) => {
  console.log(`🗑️ Delete category request received for category: ${req.params.id}`);
  
  try {
    const { id } = req.params;
    
    // Check if category has tasks
    const tasksCheck = await pool.query(
      'SELECT COUNT(*) as task_count FROM tasks WHERE category_id = $1 AND user_id = $2',
      [id, req.user.userId]
    );
    
    const taskCount = parseInt(tasksCheck.rows[0].task_count);
    if (taskCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category. It contains ${taskCount} task(s). Please move or delete the tasks first.`
      });
    }
    
    const result = await pool.query(`
      DELETE FROM categories 
      WHERE id = $1 AND user_id = $2
      RETURNING name
    `, [id, req.user.userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or you do not have permission to delete it'
      });
    }
    
    const deletedCategory = result.rows[0];
    console.log(`📤 Category deleted successfully: ${deletedCategory.name}`);
    
    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ TaskFlow Backend with Database running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API test: http://localhost:${PORT}/api/test`);
  console.log(`📝 Register: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`🔐 Login: POST http://localhost:${PORT}/api/auth/login`);
});

console.log('📊 Database server setup completed. Ready for connections...');
