import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import config from '../config/config';
import { logger } from '../utils/logger';

// Store for tracking failed attempts
const failedAttempts = new Map<string, { count: number; lastAttempt: Date }>();

/**
 * Enhanced rate limiting with logging and dynamic blocking
 */
class EnhancedRateLimiter {
  /**
   * Custom key generator that considers both IP and user
   */
  static generateKey(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.id;
    return userId ? `${ip}:${userId}` : ip;
  }

  /**
   * Log rate limit violations
   */
  static logViolation(req: Request, rateLimitInfo: any): void {
    const key = this.generateKey(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    logger.warn('Rate limit exceeded', {
      key,
      ip: req.ip,
      userAgent,
      path: req.path,
      method: req.method,
      limit: rateLimitInfo.limit,
      current: rateLimitInfo.current,
      remaining: rateLimitInfo.remaining,
      resetTime: new Date(rateLimitInfo.resetTime)
    });
  }

  /**
   * Track failed authentication attempts
   */
  static trackFailedAttempt(req: Request): void {
    const key = this.generateKey(req);
    const now = new Date();
    const attempt = failedAttempts.get(key);

    if (attempt) {
      // Reset count if last attempt was more than 1 hour ago
      if (now.getTime() - attempt.lastAttempt.getTime() > 60 * 60 * 1000) {
        failedAttempts.set(key, { count: 1, lastAttempt: now });
      } else {
        failedAttempts.set(key, { count: attempt.count + 1, lastAttempt: now });
      }
    } else {
      failedAttempts.set(key, { count: 1, lastAttempt: now });
    }

    // Log suspicious activity
    const currentAttempt = failedAttempts.get(key)!;
    if (currentAttempt.count >= 3) {
      logger.warn('Multiple failed authentication attempts detected', {
        key,
        ip: req.ip,
        count: currentAttempt.count,
        userAgent: req.headers['user-agent']
      });
    }
  }

  /**
   * Check if IP should be temporarily blocked due to failed attempts
   */
  static isTemporarilyBlocked(req: Request): boolean {
    const key = this.generateKey(req);
    const attempt = failedAttempts.get(key);
    
    if (!attempt) return false;
    
    const now = new Date();
    const timeSinceLastAttempt = now.getTime() - attempt.lastAttempt.getTime();
    
    // Block for increasing durations based on attempt count
    let blockDuration = 0;
    if (attempt.count >= 10) blockDuration = 60 * 60 * 1000; // 1 hour
    else if (attempt.count >= 5) blockDuration = 15 * 60 * 1000; // 15 minutes
    else if (attempt.count >= 3) blockDuration = 5 * 60 * 1000; // 5 minutes
    
    return blockDuration > 0 && timeSinceLastAttempt < blockDuration;
  }

  /**
   * Clear failed attempts for successful authentication
   */
  static clearFailedAttempts(req: Request): void {
    const key = this.generateKey(req);
    failedAttempts.delete(key);
  }
}

// Default rate limiting
export const defaultLimiter = rateLimit({
  windowMs: config.rateLimiting.windowMs,
  max: config.rateLimiting.max,
  message: {
    success: false,
    error: {
      message: config.rateLimiting.message,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: EnhancedRateLimiter.generateKey,
  handler: (req: Request, res: Response, next, options) => {
    EnhancedRateLimiter.logViolation(req, { 
      limit: options.max, 
      current: options.max, 
      remaining: 0,
      resetTime: Date.now() + options.windowMs 
    });
    res.status(429).json({
      success: false,
      error: {
        message: config.rateLimiting.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(options.windowMs / 1000)
      }
    });
  },
});

// Enhanced authentication rate limiting with progressive delays
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts. Please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: 900 // 15 minutes in seconds
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: EnhancedRateLimiter.generateKey,
  skip: (req: Request) => {
    // Additional check for temporarily blocked IPs
    if (EnhancedRateLimiter.isTemporarilyBlocked(req)) {
      return false; // Don't skip, apply rate limit
    }
    return false;
  },
  handler: (req: Request, res: Response, next, options) => {
    EnhancedRateLimiter.logViolation(req, { 
      limit: options.max, 
      current: options.max, 
      remaining: 0,
      resetTime: Date.now() + options.windowMs 
    });
    EnhancedRateLimiter.trackFailedAttempt(req);
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many authentication attempts. Please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        retryAfter: 900
      }
    });
  },
});

// Strict rate limiting for failed login attempts
export const loginAttemptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Maximum 10 failed attempts per hour
  message: {
    success: false,
    error: {
      message: 'Too many failed login attempts. Please try again in 1 hour.',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed requests
  keyGenerator: (req: Request) => {
    // Use email if provided, otherwise IP
    const email = req.body?.email;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return email ? `login:${email}` : `login:${ip}`;
  },
  handler: (req: Request, res: Response, next, options) => {
    EnhancedRateLimiter.logViolation(req, { 
      limit: options.max, 
      current: options.max, 
      remaining: 0,
      resetTime: Date.now() + options.windowMs 
    });
    EnhancedRateLimiter.trackFailedAttempt(req);
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many failed login attempts. Please try again in 1 hour.',
        code: 'LOGIN_RATE_LIMIT_EXCEEDED',
        retryAfter: 3600
      }
    });
  },
});

// Password reset rate limiting
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  message: {
    success: false,
    error: {
      message: 'Too many password reset attempts. Please try again in 1 hour.',
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return email ? `reset:${email}` : `reset:${ip}`;
  }
});

// Email verification rate limiting
export const emailVerificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 verification emails per hour
  message: {
    success: false,
    error: {
      message: 'Too many verification email requests. Please try again in 1 hour.',
      code: 'EMAIL_VERIFICATION_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const email = req.body?.email;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return email ? `verify:${email}` : `verify:${ip}`;
  }
});

// Registration rate limiting
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Maximum 3 registrations per IP per hour
  message: {
    success: false,
    error: {
      message: 'Too many registration attempts. Please try again later.',
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED',
      retryAfter: 3600
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// API endpoint rate limiting (more restrictive for sensitive operations)
export const sensitiveOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute for sensitive operations
  message: {
    success: false,
    error: {
      message: 'Too many requests for this operation. Please wait before trying again.',
      code: 'SENSITIVE_OPERATION_RATE_LIMIT_EXCEEDED',
      retryAfter: 60
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to check for temporarily blocked IPs
export const checkTemporaryBlock = (req: Request, res: Response, next: Function): void => {
  if (EnhancedRateLimiter.isTemporarilyBlocked(req)) {
    const key = EnhancedRateLimiter.generateKey(req);
    const attempt = failedAttempts.get(key);
    
    logger.warn('Temporarily blocked IP attempted access', {
      key,
      ip: req.ip,
      failedAttempts: attempt?.count,
      path: req.path
    });

    res.status(429).json({
      success: false,
      error: {
        message: 'Too many failed attempts. Please try again later.',
        code: 'TEMPORARILY_BLOCKED',
        retryAfter: 300 // 5 minutes minimum
      }
    });
    return;
  }
  
  next();
};

// Export the enhanced rate limiter for use in auth controllers
export { EnhancedRateLimiter };
