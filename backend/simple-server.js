// Simple TaskFlow Backend Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');

console.log('🚀 Starting TaskFlow Backend...');

const app = express();
const PORT = process.env.PORT || 5000;

// Mock data storage
let tasks = [];
let categories = [
  {
    id: 'cat-1',
    name: 'Work',
    description: 'Work related tasks',
    color: '#3B82F6',
    icon: 'work',
    is_default: true,
    sort_order: 1,
    task_count: 0,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'cat-2',
    name: 'Personal',
    description: 'Personal tasks',
    color: '#10B981',
    icon: 'person',
    is_default: false,
    sort_order: 2,
    task_count: 0,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

// Basic middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:8080'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'TaskFlow Backend is running!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

// Register endpoint (simple test)
app.post('/api/auth/register', (req, res) => {
  console.log('📝 Register request received:', req.body);
  
  // Match the exact structure frontend expects
  const response = {
    success: true,
    message: 'Registration successful!',
    data: {
      access_token: 'test-jwt-token-' + Date.now(),
      refresh_token: 'test-refresh-token-' + Date.now(),
      expires_in: 900, // 15 minutes in seconds
      token_type: 'Bearer',
      user: {
        id: 'test-user-id-' + Date.now(),
        email: req.body.email,
        first_name: req.body.first_name,
        last_name: req.body.last_name,
        display_name: `${req.body.first_name} ${req.body.last_name}`,
        timezone: req.body.timezone || 'UTC',
        language_code: req.body.language_code || 'en',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: false,
        role: 'user',
        status: 'active',
        avatar_url: null,
        bio: null
      }
    }
  };
  
  console.log('📤 Sending response:', JSON.stringify(response, null, 2));
  res.json(response);
});

// Task endpoints
app.get('/api/tasks', (req, res) => {
  console.log('📋 Get tasks request received:', req.query);
  
  const response = {
    success: true,
    data: {
      tasks: tasks,
      total: tasks.length,
      categories: categories
    }
  };
  
  console.log(`📤 Sending ${tasks.length} tasks`);
  res.json(response);
});

app.post('/api/tasks', (req, res) => {
  console.log('➕ Create task request received:', req.body);
  
  const { title, description, priority = 'medium', status = 'pending', category_id, due_date, reminder_date, start_date, estimated_minutes, tags = [], metadata = {} } = req.body;
  
  const newTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    description: description || '',
    status,
    priority,
    due_date,
    reminder_date,
    start_date,
    estimated_minutes,
    actual_minutes: null,
    completed_at: null,
    tags,
    category: category_id ? categories.find(c => c.id === category_id) || null : null,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  tasks.push(newTask);
  
  // Update category task count
  if (newTask.category) {
    const category = categories.find(c => c.id === category_id);
    if (category) {
      category.task_count++;
      category.updated_at = new Date().toISOString();
    }
  }
  
  const response = {
    success: true,
    message: 'Task created successfully!',
    data: newTask
  };
  
  console.log('📤 Sending created task:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.get('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  console.log('🔍 Get task request received:', id);
  
  const task = tasks.find(t => t.id === id);
  
  if (!task) {
    return res.status(404).json({
      success: false,
      message: 'Task not found'
    });
  }
  
  const response = {
    success: true,
    data: task
  };
  
  console.log('📤 Sending task:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.put('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  console.log('✏️ Update task request received:', id, req.body);
  
  const taskIndex = tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Task not found'
    });
  }
  
  const { title, description, priority, status, category_id, due_date, reminder_date, start_date, estimated_minutes, actual_minutes, tags, metadata } = req.body;
  
  const updatedTask = {
    ...tasks[taskIndex],
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(priority !== undefined && { priority }),
    ...(status !== undefined && { status }),
    ...(category_id !== undefined && { category: categories.find(c => c.id === category_id) || null }),
    ...(due_date !== undefined && { due_date }),
    ...(reminder_date !== undefined && { reminder_date }),
    ...(start_date !== undefined && { start_date }),
    ...(estimated_minutes !== undefined && { estimated_minutes }),
    ...(actual_minutes !== undefined && { actual_minutes }),
    ...(tags !== undefined && { tags }),
    ...(metadata !== undefined && { metadata }),
    updated_at: new Date().toISOString(),
    ...(status === 'completed' && !tasks[taskIndex].completed_at && { completed_at: new Date().toISOString() })
  };
  
  tasks[taskIndex] = updatedTask;
  
  const response = {
    success: true,
    message: 'Task updated successfully!',
    data: updatedTask
  };
  
  console.log('📤 Sending updated task:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.delete('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  console.log('🗑️ Delete task request received:', id);
  
  const taskIndex = tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Task not found'
    });
  }
  
  const deletedTask = tasks[taskIndex];
  tasks.splice(taskIndex, 1);
  
  // Update category task count
  if (deletedTask.category) {
    const category = categories.find(c => c.id === deletedTask.category.id);
    if (category) {
      category.task_count--;
      if (deletedTask.status === 'completed') {
        category.completed_task_count--;
      }
      category.updated_at = new Date().toISOString();
    }
  }
  
  const response = {
    success: true,
    message: 'Task deleted successfully!'
  };
  
  console.log('📤 Task deleted successfully');
  res.json(response);
});

app.patch('/api/tasks/:id/toggle', (req, res) => {
  const { id } = req.params;
  console.log('🔄 Toggle task status request received:', id);
  
  const taskIndex = tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Task not found'
    });
  }
  
  const task = tasks[taskIndex];
  const newStatus = task.status === 'completed' ? 'pending' : 'completed';
  
  const updatedTask = {
    ...task,
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...(newStatus === 'completed' && { completed_at: new Date().toISOString() }),
    ...(newStatus !== 'completed' && { completed_at: null })
  };
  
  tasks[taskIndex] = updatedTask;
  
  const response = {
    success: true,
    message: 'Task status toggled successfully!',
    data: updatedTask
  };
  
  console.log('📤 Sending toggled task:', JSON.stringify(response, null, 2));
  res.json(response);
});

// Category endpoints
app.get('/api/categories', (req, res) => {
  console.log('📂 Get categories request received');
  
  const response = {
    success: true,
    data: categories
  };
  
  console.log(`📤 Sending ${categories.length} categories`);
  res.json(response);
});

app.post('/api/categories', (req, res) => {
  console.log('➕ Create category request received:', req.body);
  
  const { name, description, color, icon } = req.body;
  
  const newCategory = {
    id: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: description || '',
    color: color || '#3B82F6',
    icon: icon || 'folder',
    is_default: false,
    sort_order: categories.length + 1,
    task_count: 0,
    completed_task_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  categories.push(newCategory);
  
  const response = {
    success: true,
    message: 'Category created successfully!',
    data: newCategory
  };
  
  console.log('📤 Sending created category:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.put('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  console.log('✏️ Update category request received:', id, req.body);
  
  const categoryIndex = categories.findIndex(c => c.id === id);
  
  if (categoryIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  const { name, description, color, icon } = req.body;
  
  const updatedCategory = {
    ...categories[categoryIndex],
    ...(name !== undefined && { name }),
    ...(description !== undefined && { description }),
    ...(color !== undefined && { color }),
    ...(icon !== undefined && { icon }),
    updated_at: new Date().toISOString()
  };
  
  categories[categoryIndex] = updatedCategory;
  
  const response = {
    success: true,
    message: 'Category updated successfully!',
    data: updatedCategory
  };
  
  console.log('📤 Sending updated category:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  console.log('🗑️ Delete category request received:', id);
  
  const categoryIndex = categories.findIndex(c => c.id === id);
  
  if (categoryIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }
  
  const category = categories[categoryIndex];
  
  // Check if category is default
  if (category.is_default) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete default category'
    });
  }
  
  // Check if category has tasks
  if (category.task_count > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete category with existing tasks'
    });
  }
  
  categories.splice(categoryIndex, 1);
  
  const response = {
    success: true,
    message: 'Category deleted successfully!'
  };
  
  console.log('📤 Category deleted successfully');
  res.json(response);
});

// User/Profile endpoints
app.get('/api/user/profile', (req, res) => {
  console.log('👤 Get user profile request received');
  
  // Mock user profile data
  const userProfile = {
    id: 'test-user-id-' + Date.now(),
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    display_name: 'John Doe',
    bio: 'Task management enthusiast',
    timezone: 'UTC',
    language_code: 'en',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_verified: true,
    role: 'user',
    status: 'active',
    avatar_url: null
  };
  
  const response = {
    success: true,
    data: userProfile
  };
  
  console.log('📤 Sending user profile');
  res.json(response);
});

app.put('/api/user/profile', (req, res) => {
  console.log('✏️ Update user profile request received:', req.body);
  
  const { first_name, last_name, bio, timezone, language_code } = req.body;
  
  // Mock updated user profile
  const updatedProfile = {
    id: 'test-user-id-' + Date.now(),
    email: 'user@example.com',
    first_name: first_name || 'John',
    last_name: last_name || 'Doe',
    display_name: `${first_name || 'John'} ${last_name || 'Doe'}`,
    bio: bio || null,
    timezone: timezone || 'UTC',
    language_code: language_code || 'en',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    email_verified: true,
    role: 'user',
    status: 'active',
    avatar_url: null
  };
  
  const response = {
    success: true,
    message: 'Profile updated successfully!',
    data: updatedProfile
  };
  
  console.log('📤 Sending updated profile:', JSON.stringify(response, null, 2));
  res.json(response);
});

app.post('/api/user/change-password', (req, res) => {
  console.log('🔐 Change password request received');
  
  const { current_password, new_password, confirm_password } = req.body;
  
  // Basic validation
  if (!current_password || !new_password || !confirm_password) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required'
    });
  }
  
  if (new_password !== confirm_password) {
    return res.status(400).json({
      success: false,
      message: 'New passwords do not match'
    });
  }
  
  if (new_password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 6 characters long'
    });
  }
  
  const response = {
    success: true,
    message: 'Password changed successfully!'
  };
  
  console.log('📤 Password changed successfully');
  res.json(response);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ TaskFlow Backend running on http://localhost:${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API test: http://localhost:${PORT}/api/test`);
  console.log(`📝 Register test: POST http://localhost:${PORT}/api/auth/register`);
});

console.log('📊 Server setup completed. Ready for connections...');
