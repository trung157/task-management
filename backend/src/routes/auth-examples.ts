/**
 * Authentication Routes
 * 
 * Example routes demonstrating JWT authentication middleware usage
 */

import { Router, Request, Response, NextFunction } from 'express';
import { 
  requireAuth, 
  optionalAuth, 
  requireAdmin, 
  requireRole,
  requirePermission,
  requireOwnershipOrAdmin,
  requireRefreshToken,
  logoutMiddleware,
  authRateLimit 
} from '../middleware/jwtAuth';
import { generateTokenPair, generateAccessToken } from '../config/jwt';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import bcrypt from 'bcrypt';
import db from '../config/database';

const router = Router();

/**
 * Apply rate limiting to all auth routes
 */
router.use(authRateLimit(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes

/**
 * POST /auth/login
 * User login with email and password
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Find user in database
    const result = await db.query(
      'SELECT id, email, password_hash, role, is_active, permissions FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw new AppError('Account is disabled', 401, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update last login
    await db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    );

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ip: req.ip,
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions ? JSON.parse(user.permissions) : [],
      },
      tokens,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', requireRefreshToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.authUser) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: req.authUser.id,
      email: req.authUser.email,
      role: req.authUser.role,
    });

    logger.debug('Access token refreshed', {
      userId: req.authUser.id,
      email: req.authUser.email,
    });

    res.json({
      message: 'Token refreshed successfully',
      accessToken,
      expiresIn: '15m',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout
 * Logout user and blacklist current token
 */
router.post('/logout', requireAuth, logoutMiddleware, (req: Request, res: Response) => {
  res.json({
    message: 'Logged out successfully',
  });
});

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: req.authUser,
    tokenInfo: req.authTokenInfo,
  });
});

/**
 * PUT /auth/profile
 * Update current user profile (requires authentication)
 */
router.put('/profile', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, bio } = req.body;
    const userId = req.authUser!.id;

    const result = await db.query(`
      UPDATE users 
      SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        bio = COALESCE($3, bio),
        updated_at = NOW()
      WHERE id = $4 AND deleted_at IS NULL
      RETURNING id, email, first_name, last_name, bio, role
    `, [firstName, lastName, bio, userId]);

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    logger.info('User profile updated', {
      userId,
      updatedFields: { firstName, lastName, bio },
    });

    res.json({
      message: 'Profile updated successfully',
      user: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/public
 * Public route with optional authentication
 */
router.get('/public', optionalAuth, (req: Request, res: Response) => {
  if (req.authUser) {
    res.json({
      message: `Hello ${req.authUser.email}! This is a public route.`,
      authenticated: true,
      user: req.authUser,
    });
  } else {
    res.json({
      message: 'Hello guest! This is a public route.',
      authenticated: false,
    });
  }
});

/**
 * GET /auth/admin
 * Admin-only route
 */
router.get('/admin', requireAdmin, (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to the admin area!',
    user: req.authUser,
    adminFeatures: [
      'User Management',
      'System Settings',
      'Analytics Dashboard',
      'Audit Logs',
    ],
  });
});

/**
 * GET /auth/moderator
 * Route for admins and moderators
 */
router.get('/moderator', requireRole('admin', 'moderator'), (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to the moderation panel!',
    user: req.authUser,
    features: [
      'Content Moderation',
      'User Reports',
      'Community Guidelines',
    ],
  });
});

/**
 * GET /auth/premium
 * Route requiring specific permission
 */
router.get('/premium', requirePermission('access:premium'), (req: Request, res: Response) => {
  res.json({
    message: 'Welcome to premium features!',
    user: req.authUser,
    premiumFeatures: [
      'Advanced Analytics',
      'Priority Support',
      'Custom Themes',
      'API Access',
    ],
  });
});

/**
 * GET /auth/users/:id
 * Get user by ID (users can only access their own profile, admins can access any)
 */
router.get('/users/:id', requireAuth, requireOwnershipOrAdmin('id'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    const result = await db.query(`
      SELECT id, email, first_name, last_name, bio, role, created_at, last_login_at
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      user: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /auth/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    // Soft delete user
    const result = await db.query(
      'UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    logger.warn('User deleted by admin', {
      deletedUserId: userId,
      adminUserId: req.authUser!.id,
      adminEmail: req.authUser!.email,
    });

    res.json({
      message: 'User deleted successfully',
      deletedUserId: userId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /auth/verify
 * Verify token validity
 */
router.get('/verify', requireAuth, (req: Request, res: Response) => {
  res.json({
    valid: true,
    user: req.authUser,
    tokenInfo: req.authTokenInfo,
    expiresAt: req.authTokenInfo?.expiresAt,
    remainingTime: req.authTokenInfo?.remainingTime,
  });
});

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.authUser!.id;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400, 'MISSING_PASSWORDS');
    }

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters long', 400, 'PASSWORD_TOO_SHORT');
    }

    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400, 'INVALID_CURRENT_PASSWORD');
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );

    logger.info('Password changed successfully', {
      userId,
      email: req.authUser!.email,
    });

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
