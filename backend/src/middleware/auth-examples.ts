/**
 * JWT Authentication Middleware Examples
 * 
 * This file demonstrates how to use the various authentication middlewares
 * provided in the auth.ts and auth-enhanced.ts files.
 */

import express from 'express';
import { 
  authMiddleware, 
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin
} from './auth';

import {
  refreshTokenMiddleware,
  apiKeyMiddleware,
  flexibleAuthMiddleware,
  rateLimitedAuthMiddleware,
  tokenUtils
} from './auth-enhanced';

const router = express.Router();

// Example 1: Basic JWT Authentication
// Requires valid JWT token in Authorization header
router.get('/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'This is a protected route',
    user: req.user
  });
});

// Example 2: Optional Authentication
// Works with or without token, but provides user info if available
router.get('/public-or-private', optionalAuthMiddleware, (req, res) => {
  if (req.user) {
    res.json({
      message: 'Welcome back!',
      user: req.user
    });
  } else {
    res.json({
      message: 'Hello, anonymous user!'
    });
  }
});

// Example 3: Role-based Authorization
// Only users with 'admin' role can access
router.get('/admin-only', authMiddleware, requireAdmin, (req, res) => {
  res.json({
    message: 'Admin area',
    user: req.user
  });
});

// Example 4: Multiple Role Authorization
// Users with 'admin' or 'moderator' roles can access
router.get('/staff-only', authMiddleware, requireRole(['admin', 'moderator']), (req, res) => {
  res.json({
    message: 'Staff area',
    user: req.user
  });
});

// Example 5: Ownership or Admin Authorization
// User can access their own data OR admin can access anyone's data
router.get('/users/:userId/profile', authMiddleware, requireOwnershipOrAdmin('userId'), (req, res) => {
  res.json({
    message: 'User profile',
    userId: req.params.userId,
    requestedBy: req.user
  });
});

// Example 6: Refresh Token Endpoint
router.post('/auth/refresh', refreshTokenMiddleware, (req, res) => {
  // Generate new access token
  const newAccessToken = 'new-jwt-token'; // Your token generation logic here
  
  res.json({
    accessToken: newAccessToken,
    user: req.user
  });
});

// Example 7: API Key Authentication
router.get('/api/data', apiKeyMiddleware, (req, res) => {
  res.json({
    message: 'API data',
    user: req.user
  });
});

// Example 8: Flexible Authentication (JWT or API Key)
router.get('/flexible', flexibleAuthMiddleware, (req, res) => {
  res.json({
    message: 'Authenticated via JWT or API key',
    user: req.user
  });
});

// Example 9: Rate Limited Authentication
router.post('/sensitive-action', rateLimitedAuthMiddleware, (req, res) => {
  res.json({
    message: 'Sensitive action performed',
    user: req.user
  });
});

// Example 10: Token Utility Functions
router.get('/token-info', (req, res) => {
  const token = tokenUtils.extractToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const isExpired = tokenUtils.isTokenExpired(token);
  const expiration = tokenUtils.getTokenExpiration(token);

  res.json({
    hasToken: !!token,
    isExpired,
    expiration
  });
});

// Example 11: Custom Authorization Middleware
const requirePermission = (permission: string) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user has the required permission
    // This would typically check against a permissions table or user roles
    const userPermissions = getUserPermissions(req.user.id); // Your logic here
    
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

function getUserPermissions(userId: string): string[] {
  // Mock implementation - replace with actual permission checking logic
  return ['read:users', 'write:users', 'delete:posts'];
}

// Example 12: Using Custom Permission Middleware
router.delete('/posts/:id', authMiddleware, requirePermission('delete:posts'), (req, res) => {
  res.json({
    message: 'Post deleted',
    postId: req.params.id,
    deletedBy: req.user
  });
});

// Example 13: Conditional Authentication
const conditionalAuth = (condition: (req: express.Request) => boolean) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (condition(req)) {
      return authMiddleware(req, res, next);
    } else {
      return optionalAuthMiddleware(req, res, next);
    }
  };
};

// Example 14: Authentication based on request type
router.get('/content/:id', conditionalAuth(req => req.query.private === 'true'), (req, res) => {
  const isPrivateRequest = req.query.private === 'true';
  
  if (isPrivateRequest && !req.user) {
    return res.status(401).json({ message: 'Authentication required for private content' });
  }

  res.json({
    message: 'Content retrieved',
    contentId: req.params.id,
    isPrivate: isPrivateRequest,
    user: req.user
  });
});

// Example 15: Middleware Chain with Error Handling
router.post('/secure-action', 
  authMiddleware,
  requireRole('admin'),
  async (req, res, next) => {
    try {
      // Your business logic here
      const result = await performSecureAction(req.body);
      res.json({ success: true, result });
    } catch (error) {
      next(error); // Pass to error handler
    }
  }
);

async function performSecureAction(data: any): Promise<any> {
  // Mock implementation
  return { action: 'completed', data };
}

export default router;

/**
 * Usage Examples in Your Express App:
 * 
 * import express from 'express';
 * import authExamples from './middleware/auth-examples';
 * import { authMiddleware, requireAdmin } from './middleware/auth';
 * 
 * const app = express();
 * 
 * // Use the example routes
 * app.use('/examples', authExamples);
 * 
 * // Or apply middleware directly to routes:
 * app.get('/admin/dashboard', authMiddleware, requireAdmin, (req, res) => {
 *   res.json({ message: 'Admin Dashboard' });
 * });
 * 
 * // For all routes under /api to require authentication:
 * app.use('/api', authMiddleware);
 * 
 * // For specific error handling:
 * app.use((err, req, res, next) => {
 *   if (err.code === 'TOKEN_EXPIRED') {
 *     return res.status(401).json({ 
 *       message: 'Token expired', 
 *       code: 'TOKEN_EXPIRED' 
 *     });
 *   }
 *   // Handle other errors...
 * });
 */
