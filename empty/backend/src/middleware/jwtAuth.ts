/**
 * Modern JWT Authentication Middleware
 * 
 * Enhanced JWT authentication middleware for Express.js with:
 * - Token verification and validation
 * - Comprehensive error handling
 * - User context setting with extended properties
 * - Role-based authorization
 * - Permission-based authorization
 * - Optional authentication
 * - Token refresh handling
 * - Security features (rate limiting, blacklisting)
 * - Database user validation
 */

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, verifyRefreshToken, JWTPayload } from '../config/jwt';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import db from '../config/database';

// Enhanced User interface for authentication
export interface AuthUser {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: Date;
  iat?: number;
  exp?: number;
}

// Token information interface
export interface AuthTokenInfo {
  type: 'access' | 'refresh';
  issuedAt: Date;
  expiresAt: Date;
  remainingTime: number;
}

// Extend Express Request interface for this middleware
declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
    authTokenInfo?: AuthTokenInfo;
  }
}

// Authentication options
export interface AuthMiddlewareOptions {
  required?: boolean;
  roles?: string[];
  permissions?: string[];
  validateUser?: boolean;
  allowExpiredGracePeriod?: number;
}

// Token blacklist (in production, use Redis or database)
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
 * Hash token for secure logging
 */
const hashToken = (token: string): string => {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 16);
};

/**
 * Extract JWT token from various sources
 */
const extractToken = (req: Request): string | null => {
  // 1. Authorization header (most common)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // 2. Query parameter (for WebSocket upgrades, downloads, etc.)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  
  // 3. Cookie (for web applications)
  if (req.cookies && req.cookies.access_token) {
    return req.cookies.access_token;
  }
  
  // 4. Custom header
  if (req.headers['x-access-token'] && typeof req.headers['x-access-token'] === 'string') {
    return req.headers['x-access-token'];
  }
  
  return null;
};

/**
 * Validate user exists and is active in database
 */
const validateUserInDatabase = async (userId: string): Promise<AuthUser | null> => {
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
      WHERE id = $1 AND deleted_at IS NULL
    `, [userId]);

    if (result.rows.length === 0) {
      logger.warn('User not found in database', { userId });
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
      lastLoginAt: user.last_login_at ? new Date(user.last_login_at) : undefined,
      permissions: user.permissions ? JSON.parse(user.permissions) : [],
    };
  } catch (error) {
    logger.error('Error validating user in database', { userId, error });
    return null;
  }
};

/**
 * Main JWT Authentication Middleware Factory
 */
export const jwtAuth = (options: AuthMiddlewareOptions = {}) => {
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
        logger.debug('No token provided for optional authentication');
        return next();
      }

      // Check if token is blacklisted
      if (isTokenBlacklisted(token)) {
        throw new AppError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }

      let payload: JWTPayload;
      let tokenType: 'access' | 'refresh' = 'access';

      // Verify token with grace period handling
      try {
        payload = verifyAccessToken(token);
      } catch (error) {
        if (error instanceof Error && error.message.includes('expired') && allowExpiredGracePeriod > 0) {
          // Check if within grace period
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token) as any;
            if (decoded && decoded.exp) {
              const expiredTime = Date.now() - (decoded.exp * 1000);
              
              if (expiredTime <= allowExpiredGracePeriod) {
                payload = decoded;
                logger.warn('Using expired token within grace period', {
                  userId: decoded.userId,
                  expiredTime: `${expiredTime}ms`,
                  gracePeriod: `${allowExpiredGracePeriod}ms`,
                });
              } else {
                throw error;
              }
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
      let userFromDb: AuthUser | null = null;
      if (validateUser) {
        userFromDb = await validateUserInDatabase(payload.userId);
        if (!userFromDb) {
          throw new AppError('User not found or inactive', 401, 'USER_INVALID');
        }
      }

      // Create user context
      const authUser: AuthUser = userFromDb || {
        id: payload.userId,
        email: payload.email,
        role: payload.role || 'user',
        iat: payload.iat,
        exp: payload.exp,
      };

      // Check role-based authorization
      if (roles.length > 0 && !roles.includes(authUser.role)) {
        logger.warn('Role authorization failed', {
          userId: authUser.id,
          userRole: authUser.role,
          requiredRoles: roles,
        });
        throw new AppError(
          `Access denied. Required roles: ${roles.join(', ')}`,
          403,
          'INSUFFICIENT_ROLE'
        );
      }

      // Check permission-based authorization
      if (permissions.length > 0 && authUser.permissions) {
        const hasPermission = permissions.some(permission => 
          authUser.permissions?.includes(permission)
        );
        if (!hasPermission) {
          logger.warn('Permission authorization failed', {
            userId: authUser.id,
            userPermissions: authUser.permissions,
            requiredPermissions: permissions,
          });
          throw new AppError(
            `Access denied. Required permissions: ${permissions.join(', ')}`,
            403,
            'INSUFFICIENT_PERMISSIONS'
          );
        }
      }

      // Set user context on request
      req.authUser = authUser;

      // Set token info for monitoring and debugging
      req.authTokenInfo = {
        type: tokenType,
        issuedAt: new Date((payload.iat || 0) * 1000),
        expiresAt: new Date((payload.exp || 0) * 1000),
        remainingTime: (payload.exp || 0) * 1000 - Date.now(),
      };

      // Log successful authentication
      logger.debug('User authenticated successfully', {
        userId: authUser.id,
        email: authUser.email,
        role: authUser.role,
        tokenHash: hashToken(token),
        remainingTime: req.authTokenInfo.remainingTime,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      next();
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
      } else if (error instanceof Error) {
        const tokenHash = extractToken(req) ? hashToken(extractToken(req)!) : 'none';
        
        logger.error('Authentication error', {
          error: error.message,
          stack: error.stack,
          tokenHash,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
        
        // Map specific JWT errors to user-friendly messages
        if (error.message.includes('expired')) {
          next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
        } else if (error.message.includes('invalid') || error.message.includes('malformed')) {
          next(new AppError('Invalid token', 401, 'TOKEN_INVALID'));
        } else if (error.message.includes('signature')) {
          next(new AppError('Invalid token signature', 401, 'TOKEN_SIGNATURE_INVALID'));
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
 * Convenience middleware functions
 */

// Required authentication
export const requireAuth = jwtAuth({ required: true });

// Optional authentication
export const optionalAuth = jwtAuth({ required: false });

// Role-based authentication
export const requireRole = (...roles: string[]) => 
  jwtAuth({ required: true, roles });

// Permission-based authentication
export const requirePermission = (...permissions: string[]) => 
  jwtAuth({ required: true, permissions });

// Admin-only authentication
export const requireAdmin = jwtAuth({ 
  required: true, 
  roles: ['admin', 'super_admin'] 
});

// User ownership or admin access
export const requireOwnershipOrAdmin = (userIdParam = 'id') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.authUser) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      const targetUserId = req.params[userIdParam] || req.body.userId || req.body.id;
      const isOwner = req.authUser.id === targetUserId;
      const isAdmin = ['admin', 'super_admin'].includes(req.authUser.role);

      if (!isOwner && !isAdmin) {
        logger.warn('Ownership/admin check failed', {
          userId: req.authUser.id,
          targetUserId,
          userRole: req.authUser.role,
          isOwner,
          isAdmin,
        });
        throw new AppError('Access denied', 403, 'ACCESS_DENIED');
      }

      logger.debug('Ownership/admin check passed', {
        userId: req.authUser.id,
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

    req.authUser = userFromDb;
    req.authTokenInfo = {
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
export const logoutMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      blacklistToken(token);
      logger.info('User logged out', {
        userId: req.authUser?.id,
        tokenHash: hashToken(token),
        ip: req.ip,
      });
    }

    // Clear user context
    req.authUser = undefined;
    req.authTokenInfo = undefined;

    next();
  } catch (error) {
    logger.error('Logout error', { error });
    next(error instanceof AppError ? error : new AppError('Logout failed', 500, 'LOGOUT_ERROR'));
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    
    const userAttempts = attempts.get(identifier);
    
    if (userAttempts && now < userAttempts.resetTime) {
      if (userAttempts.count >= maxAttempts) {
        logger.warn('Rate limit exceeded for authentication', {
          ip: identifier,
          attempts: userAttempts.count,
          maxAttempts,
        });
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

// Export default object with all middleware functions
export default {
  jwtAuth,
  requireAuth,
  optionalAuth,
  requireRole,
  requirePermission,
  requireAdmin,
  requireOwnershipOrAdmin,
  requireRefreshToken,
  logoutMiddleware,
  authRateLimit,
  blacklistToken,
  isTokenBlacklisted,
  extractToken,
  validateUserInDatabase,
};
