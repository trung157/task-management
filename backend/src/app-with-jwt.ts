/**
 * JWT Authentication Integration Example
 * 
 * This file demonstrates how to integrate the JWT authentication middleware
 * into your main Express application.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { 
  requireAuth, 
  optionalAuth, 
  requireAdmin, 
  requireRole,
  requirePermission,
  authRateLimit 
} from './middleware/jwtAuth';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/authRoutes';
import { logger } from './utils/logger';

// Create Express app
const app = express();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info('Request received', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Authentication routes
app.use('/auth', authRoutes);

// Public API routes (optional authentication)
app.get('/api/posts', optionalAuth, (req, res) => {
  const posts = [
    { id: 1, title: 'Public Post 1', content: 'This is public content' },
    { id: 2, title: 'Public Post 2', content: 'More public content' },
  ];

  if (req.authUser) {
    // Add personalized data for authenticated users
    posts.push({
      id: 3,
      title: 'Personalized Post',
      content: `Hello ${req.authUser.email}! This is personalized content.`,
    });
  }

  res.json({ posts, authenticated: !!req.authUser });
});

// Protected API routes
app.use('/api', requireAuth); // All routes below require authentication

app.get('/api/dashboard', (req, res) => {
  res.json({
    message: 'Welcome to your dashboard',
    user: req.authUser,
    notifications: [
      { id: 1, message: 'Welcome back!', type: 'info' },
      { id: 2, message: 'You have 3 new messages', type: 'notification' },
    ],
    stats: {
      totalTasks: 15,
      completedTasks: 8,
      pendingTasks: 7,
    },
  });
});

app.get('/api/tasks', (req, res) => {
  res.json({
    tasks: [
      { 
        id: 1, 
        title: 'Complete project proposal', 
        status: 'pending',
        assignedTo: req.authUser?.id,
        dueDate: '2025-07-20',
      },
      { 
        id: 2, 
        title: 'Review code changes', 
        status: 'completed',
        assignedTo: req.authUser?.id,
        completedAt: '2025-07-13',
      },
    ],
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, description, dueDate } = req.body;
  
  const newTask = {
    id: Date.now(),
    title,
    description,
    dueDate,
    status: 'pending',
    createdBy: req.authUser?.id,
    assignedTo: req.authUser?.id,
    createdAt: new Date().toISOString(),
  };

  res.status(201).json({
    message: 'Task created successfully',
    task: newTask,
  });
});

// Admin routes
app.use('/api/admin', requireAdmin);

app.get('/api/admin/users', (req, res) => {
  res.json({
    users: [
      { id: 1, email: 'user1@example.com', role: 'user', isActive: true },
      { id: 2, email: 'user2@example.com', role: 'user', isActive: true },
      { id: 3, email: 'admin@example.com', role: 'admin', isActive: true },
    ],
    total: 3,
    currentUser: req.authUser,
  });
});

app.get('/api/admin/system-stats', (req, res) => {
  res.json({
    systemInfo: {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    },
    databaseConnections: 5,
    activeUsers: 12,
    totalRequests: 1423,
  });
});

// Moderator routes
app.use('/api/moderator', requireRole('admin', 'moderator'));

app.get('/api/moderator/reports', (req, res) => {
  res.json({
    reports: [
      { id: 1, type: 'spam', status: 'pending', reportedBy: 'user123' },
      { id: 2, type: 'inappropriate', status: 'resolved', reportedBy: 'user456' },
    ],
    moderator: req.authUser,
  });
});

// Premium feature routes
app.use('/api/premium', requirePermission('access:premium'));

app.get('/api/premium/analytics', (req, res) => {
  res.json({
    analytics: {
      userGrowth: '+15% this month',
      engagement: '87%',
      revenue: '$12,450',
    },
    user: req.authUser,
  });
});

// Rate limited routes
app.use('/api/upload', authRateLimit(10, 60 * 1000)); // 10 uploads per minute
app.post('/api/upload', requireAuth, (req, res) => {
  res.json({
    message: 'File upload endpoint (rate limited)',
    user: req.authUser,
    uploadId: Date.now(),
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
  });
});

export default app;

// Example usage in server.ts:
/*
import app from './app-with-jwt';
import config from './config/config';

const PORT = config.server.port || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🔐 Authentication endpoints:`);
  console.log(`   POST /auth/login - User login`);
  console.log(`   POST /auth/refresh - Refresh token`);
  console.log(`   POST /auth/logout - User logout`);
  console.log(`   GET  /auth/profile - Get user profile`);
  console.log(`   GET  /auth/verify - Verify token`);
  console.log(`🛡️  Protected endpoints:`);
  console.log(`   GET  /api/dashboard - User dashboard`);
  console.log(`   GET  /api/tasks - User tasks`);
  console.log(`   GET  /api/admin/users - Admin user management`);
  console.log(`   GET  /api/moderator/reports - Moderator tools`);
});
*/
