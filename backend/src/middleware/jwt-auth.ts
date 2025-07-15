/**
 * JWT Authentication Middleware
 * 
 * Comprehensive JWT authentication middleware for Express.js with:
 * - Token verification and validation
 * - Error handling with specific error types
 * - User context setting
 * - Role-based authorization
 * - Optional authentication
 * - Token refresh handling
 * - Security features (rate limiting, blacklisting)
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, JWTPayload } from '../config/jwt';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import db from '../config/database';
import { User, TokenInfo, AuthOptions } from '../types/auth';

// Authentication options interface

// Token blacklist cache (in production, use Redis)
const tokenBlacklist = new Set<string>();

/**
 * Add token to blacklist
 */
export const blacklistToken = (token: string): void => {
  tokenBlacklist.add(token);
  logger.info('Token blacklisted', { tokenHash: hashToken(token) });
};

/**
 * Check if token is blacklisted
 */
export const isTokenBlacklisted = (token: string): boolean => {
  return tokenBlacklist.has(token);
};

/**
 * Hash token for logging (security)
 */
const hashToken = (token: string): string => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
};

/**
 * Extract token from request headers
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  // Check Authorization header
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check query parameter (less secure, use sparingly)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  
  // Check cookie (for web apps)
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  
  return null;
};

/**
 * Validate user exists and is active
 */
const validateUserInDatabase = async (userId: string): Promise<User | null> => {
  try {
    const result = await db.query(`
      SELECT 
        id, 
        email, 
        role, 
        is_active, 
        last_login_at,
        permissions
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];
    
    if (!user.is_active) {
      logger.warn('Attempt to authenticate with inactive user', { userId });
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
    };
  } catch (error) {
    logger.error('Error validating user in database', { userId, error });
    return null;
  }
};

/**
 * Main JWT Authentication Middleware
 */
export const authenticate = (options: AuthOptions = {}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        required = true,
        roles = [],
        permissions = [],
        validateUser = true,
        allowExpiredGracePeriod = 0,
      } = options;

      // Extract token from request
      const token = extractToken(req);

      // Handle missing token
      if (!token) {
        if (required) {
          throw new AppError('Authentication token required', 401, 'NO_TOKEN');
        }
        return next(); // Optional auth, continue without user
      }

      // Check if token is blacklisted
      if (isTokenBlacklisted(token)) {
        throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }

      let payload: JWTPayload;
      let tokenType: 'access' | 'refresh' = 'access';

      // Verify token
      try {
        payload = verifyAccessToken(token);
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired') && allowExpiredGracePeriod > 0) {
          // Check if within grace period
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token) as any;
            const expiredTime = Date.now() - (decoded.exp * 1000);
            
            if (expiredTime <= allowExpiredGracePeriod) {
              payload = decoded;
              logger.warn('Using expired token within grace period', {
                userId: decoded.userId,
                expiredTime: `${expiredTime}ms`,
              });
            } else {
              throw error;
            }
          } catch {
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Validate user in database if requested
      let userFromDb: User | null = null;
      if (validateUser) {
        userFromDb = await validateUserInDatabase(payload.userId);
        if (!userFromDb) {
          throw new AppError('User not found or inactive', 401, 'USER_INVALID');
        }
      }

      // Create user context
      const user: User = userFromDb || {
        id: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
        iat: payload.iat,
        exp: payload.exp,
      };

      // Check role-based authorization
      if (roles.length > 0 && !roles.includes(user.role)) {
        throw new AppError(
          `Access denied. Required roles: ${roles.join(', ')}`,
          403,
          'INSUFFICIENT_ROLE'
        );
      }

      // Check permission-based authorization
      if (permissions.length > 0 && user.permissions) {
        const hasPermission = permissions.some(permission => 
          user.permissions?.includes(permission)
        );
        if (!hasPermission) {
          throw new AppError(
            `Access denied. Required permissions: ${permissions.join(', ')}`,
            403,
            'INSUFFICIENT_PERMISSIONS'
          );
        }
      }

      // Set user context on request
      req.user = user;

      // Set token info for monitoring
      req.tokenInfo = {
        type: tokenType,
        issuedAt: new Date((payload.iat || 0) * 1000),
        expiresAt: new Date((payload.exp || 0) * 1000),
        remainingTime: (payload.exp || 0) * 1000 - Date.now(),
      };

      // Log successful authentication
      logger.debug('User authenticated successfully', {
        userId: user.id,
        email: user.email,
        role: user.role,
        tokenHash: hashToken(token),
        remainingTime: req.tokenInfo.remainingTime,
      });

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else if (error instanceof Error) {
        logger.error('Authentication error', {
          error: error.message,
          stack: error.stack,
          tokenHash: req.headers.authorization ? hashToken(extractToken(req) || '') : 'none',
        });
        
        // Map specific JWT errors
        if (error.message.includes('expired')) {
          next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
        } else if (error.message.includes('invalid')) {
          next(new AppError('Invalid token', 401, 'TOKEN_INVALID'));
        } else {
          next(new AppError('Authentication failed', 401, 'AUTH_FAILED'));
        }
      } else {
        next(new AppError('Authentication failed', 500, 'AUTH_ERROR'));
      }
    }
  };
};

/**
 * Required authentication middleware
 */
export const requireAuth = authenticate({ required: true });

/**
 * Optional authentication middleware
 */
export const optionalAuth = authenticate({ required: false });

/**
 * Role-based authentication middleware
 */
export const requireRole = (...roles: string[]) => 
  authenticate({ required: true, roles });

/**
 * Permission-based authentication middleware
 */
export const requirePermission = (...permissions: string[]) => 
  authenticate({ required: true, permissions });

/**
 * Admin-only authentication middleware
 */
export const requireAdmin = authenticate({ 
  required: true, 
  roles: ['admin', 'super_admin'] 
});

/**
 * User ownership or admin middleware
 */
export const requireOwnershipOrAdmin = (userIdParam = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      const targetUserId = req.params[userIdParam] || req.body.userId;
      const isOwner = req.user.id === targetUserId;
      const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

      if (!isOwner && !isAdmin) {
        logger.warn('Access denied - not owner or admin', {
          userId: req.user.id,
          targetUserId,
          userRole: req.user.role,
        });
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      logger.debug('Ownership/admin check passed', {
        userId: req.user.id,
        targetUserId,
        isOwner,
        isAdmin,
      });

      next();
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Authorization failed', 500, 'AUTH_ERROR'));
    }
  };
};

/**
 * Refresh token middleware
 */
export const requireRefreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      throw new AppError('Refresh token required', 401, 'NO_REFRESH_TOKEN');
    }

    if (isTokenBlacklisted(token)) {
      throw new AppError('Refresh token has been revoked', 401, 'REFRESH_TOKEN_REVOKED');
    }

    const payload = verifyRefreshToken(token);

    // Validate user
    const userFromDb = await validateUserInDatabase(payload.userId);
    if (!userFromDb) {
      throw new AppError('User not found or inactive', 401, 'USER_INVALID');
    }

    req.user = userFromDb;
    req.tokenInfo = {
      type: 'refresh',
      issuedAt: new Date((payload.iat || 0) * 1000),
      expiresAt: new Date((payload.exp || 0) * 1000),
      remainingTime: (payload.exp || 0) * 1000 - Date.now(),
    };

    logger.debug('Refresh token validated', {
      userId: userFromDb.id,
      tokenHash: hashToken(token),
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else if (error instanceof Error) {
      logger.error('Refresh token validation error', { error: error.message });
      
      if (error.message.includes('expired')) {
        next(new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED'));
      } else if (error.message.includes('invalid')) {
        next(new AppError('Invalid refresh token', 401, 'REFRESH_TOKEN_INVALID'));
      } else {
        next(new AppError('Refresh token validation failed', 401, 'REFRESH_TOKEN_FAILED'));
      }
    } else {
      next(new AppError('Refresh token validation failed', 500, 'REFRESH_TOKEN_ERROR'));
    }
  }
};

/**
 * Logout middleware - blacklists the current token
 */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      blacklistToken(token);
      logger.info('User logged out', {
        userId: req.user?.id,
        tokenHash: hashToken(token),
      });
    }

    // Clear user context
    req.user = undefined;
    req.tokenInfo = undefined;

    next();
  } catch (error) {
    logger.error('Logout error', { error });
    next(error instanceof AppError ? error : new AppError('Logout failed', 500, 'LOGOUT_ERROR'));
  }
};

/**
 * Rate limiting for auth endpoints
 */
export const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const userAttempts = attempts.get(identifier);
    
    if (userAttempts && now < userAttempts.resetTime) {
      if (userAttempts.count >= maxAttempts) {
        throw new AppError(
          'Too many authentication attempts. Please try again later.',
          429,
          'RATE_LIMIT_EXCEEDED'
        );
      }
      userAttempts.count++;
    } else {
      attempts.set(identifier, { count: 1, resetTime: now + windowMs });
    }

    next();
  };
};

// Export all middleware functions
export default {
  authenticate,
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireOwnershipOrAdmin,
  requireRefreshToken,
  logout,
  authRateLimit,
  blacklistToken,
  isTokenBlacklisted,
};
