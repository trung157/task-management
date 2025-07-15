import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/config';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import pool from '../db';
import { User } from '../types/auth';

// Interface for JWT payload
interface JWTPayload {
  id: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Interface for refresh token payload
interface RefreshTokenPayload {
  id: string;
  email: string;
  role: string;
  tokenId?: string;
  iat?: number;
  exp?: number;
}

/**
 * JWT Authentication middleware
 * Verifies JWT token from Authorization header and attaches user to request
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No token provided', 401, 'NO_TOKEN');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // Optional: Check if user still exists and is active
    const userCheck = await pool.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    // Add user to request object
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    logger.debug('User authenticated:', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role,
    });

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid token', 401, 'INVALID_TOKEN');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Token expired', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof AppError) {
      throw error;
    } else {
      logger.error('Authentication error:', error);
      throw new AppError('Authentication failed', 401, 'AUTH_FAILED');
    }
  }
};

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't throw if no token is provided
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
      
      // Check if user still exists and is active
      const userCheck = await pool.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );

      if (userCheck.rows.length > 0 && userCheck.rows[0].is_active) {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
        };
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't throw errors, just continue without user
    logger.debug('Optional auth failed:', error instanceof Error ? error.message : 'Unknown error');
    next();
  }
};

/**
 * Refresh token verification middleware
 * Verifies refresh token for token renewal
 */
export const refreshTokenMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new AppError('Refresh token required', 401, 'NO_REFRESH_TOKEN');
    }

    // Verify refresh token signature
    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as RefreshTokenPayload;

    // Check if refresh token exists in database and is not expired
    const tokenCheck = await pool.query(
      'SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1',
      [refreshToken]
    );

    if (tokenCheck.rows.length === 0) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    const tokenData = tokenCheck.rows[0];
    if (new Date() > new Date(tokenData.expires_at)) {
      // Clean up expired token
      await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Verify user still exists and is active
    const userCheck = await pool.query(
      'SELECT id, email, role, is_active FROM users WHERE id = $1',
      [decoded.id]
    );

    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    } else if (error instanceof AppError) {
      throw error;
    } else {
      logger.error('Refresh token error:', error);
      throw new AppError('Refresh token verification failed', 401, 'REFRESH_FAILED');
    }
  }
};

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has required role(s)
 */
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
    }

    logger.debug('Role authorization passed:', {
      userId: req.user.id,
      role: req.user.role,
      requiredRoles: allowedRoles,
    });

    next();
  };
};

/**
 * Admin-only authorization middleware
 */
export const requireAdmin = requireRole('admin');

/**
 * User ownership or admin authorization middleware factory
 * Allows access if user owns the resource OR is an admin
 */
export const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
    }

    const targetUserId = req.params[userIdParam];
    const isOwner = req.user.id === targetUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      logger.warn('Access denied:', {
        userId: req.user.id,
        targetUserId,
        role: req.user.role,
        reason: 'Not owner and not admin',
      });
      throw new AppError('Access denied', 403, 'ACCESS_DENIED');
    }

    logger.debug('Ownership authorization passed:', {
      userId: req.user.id,
      targetUserId,
      isOwner,
      isAdmin,
    });

    next();
  };
};

/**
 * API Key authentication middleware
 * Alternative authentication method using API keys
 */
export const apiKeyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      throw new AppError('API key required', 401, 'NO_API_KEY');
    }

    // Check API key in database (implement your API key storage logic)
    const keyCheck = await pool.query(
      'SELECT user_id, is_active FROM api_keys WHERE key_hash = $1 AND expires_at > NOW()',
      [apiKey] // In production, you'd hash the API key
    );

    if (keyCheck.rows.length === 0) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    const keyData = keyCheck.rows[0];
    if (!keyData.is_active) {
      throw new AppError('API key inactive', 401, 'API_KEY_INACTIVE');
    }

    // Get user details
    const userCheck = await pool.query(
      'SELECT id, email, role FROM users WHERE id = $1 AND is_active = true',
      [keyData.user_id]
    );

    if (userCheck.rows.length === 0) {
      throw new AppError('User not found or inactive', 401, 'USER_INACTIVE');
    }

    const user = userCheck.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    logger.debug('API key authentication successful:', {
      userId: req.user.id,
      email: req.user.email,
    });

    next();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    } else {
      logger.error('API key authentication error:', error);
      throw new AppError('API key authentication failed', 401, 'API_KEY_AUTH_FAILED');
    }
  }
};

/**
 * Combined authentication middleware
 * Supports both JWT and API key authentication
 */
export const flexibleAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Use JWT authentication
    return authMiddleware(req, res, next);
  } else if (apiKey) {
    // Use API key authentication
    return apiKeyMiddleware(req, res, next);
  } else {
    throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
  }
};

/**
 * Rate limiting aware authentication
 * Tracks failed authentication attempts
 */
export const rateLimitedAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await authMiddleware(req, res, next);
  } catch (error) {
    // Log failed authentication attempt
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    logger.warn('Authentication failed:', {
      ip: clientIp,
      userAgent: req.headers['user-agent'],
      path: req.path,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // You can implement additional rate limiting logic here
    // For example, track failed attempts by IP and temporarily block
    
    throw error;
  }
};

// Export utility functions for token management
export const tokenUtils = {
  /**
   * Extract token from request without verification
   */
  extractToken: (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    return null;
  },

  /**
   * Check if token is expired without verification
   */
  isTokenExpired: (token: string): boolean => {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  },

  /**
   * Get token expiration time
   */
  getTokenExpiration: (token: string): Date | null => {
    try {
      const decoded = jwt.decode(token) as JWTPayload;
      if (!decoded || !decoded.exp) return null;
      return new Date(decoded.exp * 1000);
    } catch {
      return null;
    }
  },
};
