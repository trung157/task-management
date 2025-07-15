/**
 * TaskFlow API Routes with JWT Authentication
 * 
 * This file demonstrates how to integrate the JWT authentication middleware
 * into the existing TaskFlow application routes.
 */

import express from 'express';
import { 
  authMiddleware, 
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin
} from '../middleware/auth';
import { refreshTokenMiddleware } from '../middleware/auth-enhanced';

const router = express.Router();

// ============================================================================
// AUTH ROUTES (No authentication required)
// ============================================================================

// These routes handle authentication themselves
router.post('/auth/register', (req, res) => { res.json({ message: 'Register endpoint placeholder' }); });
router.post('/auth/login', (req, res) => { res.json({ message: 'Login endpoint placeholder' }); });
router.post('/auth/forgot-password', (req, res) => { res.json({ message: 'Forgot password placeholder' }); });
router.post('/auth/reset-password', (req, res) => { res.json({ message: 'Reset password placeholder' }); });

// ============================================================================
// AUTH ROUTES (With authentication)
// ============================================================================

// Refresh token endpoint
router.post('/auth/refresh', refreshTokenMiddleware, (req, res) => {
  // Generate new access token using the validated user from refresh token
  // const authController = new AuthController();
  // const newAccessToken = authController.generateToken(req.user!);
  
  res.json({
    success: true,
    data: {
      // accessToken: newAccessToken,
      message: 'Refresh token placeholder',
      user: req.user
    }
  });
});

// Logout (requires auth to invalidate tokens)
router.post('/auth/logout', authMiddleware, (req, res) => { res.json({ message: 'Logout endpoint placeholder' }); });

// Verify token endpoint
router.get('/auth/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    data: {
      user: req.user,
      valid: true
    }
  });
});

// ============================================================================
// USER ROUTES
// ============================================================================

// Get current user profile (must be authenticated)
router.get('/users/profile', authMiddleware, (req, res) => { res.json({ message: 'Get user profile placeholder' }); });

// Update current user profile (must be authenticated)
router.put('/users/profile', authMiddleware, (req, res) => { res.json({ message: 'Update user profile placeholder' }); });

// Get any user profile (must be owner or admin)
router.get('/users/:userId', authMiddleware, requireOwnershipOrAdmin('userId'), (req, res) => { res.json({ message: 'Get user placeholder' }); });

// Update any user (admin only)
router.put('/users/:userId', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Update user placeholder' }); });

// Delete user (admin only)
router.delete('/users/:userId', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Delete user placeholder' }); });

// Get user statistics (must be owner or admin)
router.get('/users/:userId/stats', authMiddleware, requireOwnershipOrAdmin('userId'), (req, res) => { res.json({ message: 'Get user stats placeholder' }); });

// Export user data (must be owner or admin)
router.get('/users/:userId/export', authMiddleware, requireOwnershipOrAdmin('userId'), (req, res) => { res.json({ message: 'Export user data placeholder' }); });

// ============================================================================
// TASK ROUTES
// ============================================================================

// Get user's tasks (must be authenticated)
router.get('/tasks', authMiddleware, (req, res) => { res.json({ message: 'Get tasks placeholder' }); });

// Create new task (must be authenticated)
router.post('/tasks', authMiddleware, (req, res) => { res.json({ message: 'Create task placeholder' }); });

// Get specific task (must be owner or admin)
router.get('/tasks/:taskId', authMiddleware, (req, res) => { res.json({ message: 'Get task placeholder' }); });

// Update task (must be owner or admin)
router.put('/tasks/:taskId', authMiddleware, (req, res) => { res.json({ message: 'Update task placeholder' }); });

// Delete task (must be owner or admin)
router.delete('/tasks/:taskId', authMiddleware, (req, res) => { res.json({ message: 'Delete task placeholder' }); });

// Bulk operations (must be authenticated, operations check individual ownership)
router.post('/tasks/bulk/update', authMiddleware, (req, res) => { res.json({ message: 'Bulk update tasks placeholder' }); });
router.post('/tasks/bulk/delete', authMiddleware, (req, res) => { res.json({ message: 'Bulk delete tasks placeholder' }); });

// Task search (must be authenticated, only returns user's tasks)
router.get('/tasks/search', authMiddleware, (req, res) => { res.json({ message: 'Search tasks placeholder' }); });

// ============================================================================
// TAG ROUTES
// ============================================================================

// Get user's tags (must be authenticated)
router.get('/tags', authMiddleware, (req, res) => { res.json({ message: 'Get tags placeholder' }); });

// Create tag (must be authenticated)
router.post('/tags', authMiddleware, (req, res) => { res.json({ message: 'Create tag placeholder' }); });

// Update tag (must be owner or admin)
router.put('/tags/:tagId', authMiddleware, (req, res) => { res.json({ message: 'Update tag placeholder' }); });

// Delete tag (must be owner or admin)
router.delete('/tags/:tagId', authMiddleware, (req, res) => { res.json({ message: 'Delete tag placeholder' }); });

// Get tag suggestions (must be authenticated)
router.get('/tags/suggestions', authMiddleware, (req, res) => { res.json({ message: 'Get tag suggestions placeholder' }); });

// ============================================================================
// CATEGORY ROUTES
// ============================================================================

// Get user's categories (must be authenticated)
router.get('/categories', authMiddleware, (req, res) => { res.json({ message: 'Get categories placeholder' }); });

// Create category (must be authenticated)
router.post('/categories', authMiddleware, (req, res) => { res.json({ message: 'Create category placeholder' }); });

// Update category (must be owner or admin)
router.put('/categories/:categoryId', authMiddleware, (req, res) => { res.json({ message: 'Update category placeholder' }); });

// Delete category (must be owner or admin)
router.delete('/categories/:categoryId', authMiddleware, (req, res) => { res.json({ message: 'Delete category placeholder' }); });

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// Admin dashboard (admin only)
router.get('/admin/dashboard', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Admin dashboard placeholder' }); });

// Get all users (admin only)
router.get('/admin/users', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Get all users placeholder' }); });

// System statistics (admin only)
router.get('/admin/stats', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'System stats placeholder' }); });

// System health (admin only)
router.get('/admin/health', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'System health placeholder' }); });

// Manage user roles (admin only)
router.put('/admin/users/:userId/role', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Update user role placeholder' }); });

// Deactivate/activate users (admin only)
router.put('/admin/users/:userId/status', authMiddleware, requireAdmin, (req, res) => { res.json({ message: 'Update user status placeholder' }); });

// ============================================================================
// PUBLIC/OPTIONAL AUTH ROUTES
// ============================================================================

// Public statistics (no auth required, but enhanced for authenticated users)
router.get('/public/stats', optionalAuthMiddleware, (req, res) => {
  if (req.user) {
    // Return personalized stats for authenticated users
    res.json({ personalizedStats: true, user: req.user });
  } else {
    // Return general public stats
    res.json({ publicStats: true });
  }
});

// Health check (no auth required)
router.get('/health', (req, res) => { res.json({ message: 'Health check placeholder' }); });

// API documentation (no auth required)
router.get('/docs', (req, res) => { res.json({ message: 'API docs placeholder' }); });

// ============================================================================
// MIDDLEWARE COMBINATIONS EXAMPLES
// ============================================================================

// Complex authorization example
router.post('/tasks/:taskId/assign', 
  authMiddleware,                    // Must be authenticated
  requireRole(['admin', 'manager']), // Must be admin or manager
  (req, res) => { res.json({ message: 'Assign task placeholder' }); }
);

// Conditional authentication example
const conditionalAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const isPrivateEndpoint = req.query.private === 'true';
  
  if (isPrivateEndpoint) {
    return authMiddleware(req, res, next);
  } else {
    return optionalAuthMiddleware(req, res, next);
  }
};

router.get('/content/:id', conditionalAuth, (req, res) => {
  const isPrivate = req.query.private === 'true';
  
  if (isPrivate && !req.user) {
    return res.status(401).json({ 
      message: 'Authentication required for private content' 
    });
  }
  
  // Return content based on authentication status
  res.json({
    content: 'Content here',
    isPrivate,
    user: req.user || null
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Authentication error handler
router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Handle authentication-specific errors
  if (err.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        details: 'Please refresh your token or log in again'
      }
    });
  }
  
  if (err.code === 'INSUFFICIENT_PERMISSIONS') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        details: 'You do not have the required permissions for this action'
      }
    });
  }
  
  if (err.code === 'ACCESS_DENIED') {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Access denied',
        code: 'ACCESS_DENIED',
        details: 'You can only access your own resources'
      }
    });
  }
  
  // Pass to general error handler
  next(err);
});

export default router;

/**
 * USAGE IN MAIN APP:
 * 
 * import express from 'express';
 * import taskFlowRoutes from './routes/taskflow-auth-routes';
 * 
 * const app = express();
 * 
 * // Use the authenticated routes
 * app.use('/api', taskFlowRoutes);
 * 
 * // Start server
 * app.listen(5000, () => {
 *   console.log('TaskFlow API server running on port 5000');
 * });
 */
