import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import config from '../config/config';
import { logger } from '../utils/logger';

/**
 * Comprehensive security headers middleware
 */
export class SecurityHeaders {
  /**
   * Enhanced helmet configuration with comprehensive security headers
   */
  static getHelmetConfig() {
    const helmetConfig: any = {
      // Cross-Origin Policies
      crossOriginEmbedderPolicy: { policy: "require-corp" },
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "cross-origin" },

      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },

      // HSTS (HTTP Strict Transport Security)
      hsts: config.server.forceHttps ? {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: config.server.env === 'production'
      } : false,

      // Additional security headers
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      xssFilter: true
    };

    // Add CSP if enabled
    if (config.security.helmetCspEnabled) {
      helmetConfig.contentSecurityPolicy = {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ...(config.server.env === 'development' ? ["'unsafe-inline'", "'unsafe-eval'"] : []),
            "https://cdnjs.cloudflare.com",
            "https://cdn.jsdelivr.net"
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
            "https://cdnjs.cloudflare.com"
          ],
          fontSrc: [
            "'self'",
            "https://fonts.gstatic.com",
            "https://cdnjs.cloudflare.com"
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https:",
            "blob:"
          ],
          connectSrc: [
            "'self'",
            config.app.frontendUrl
          ],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          ...(config.server.env === 'production' ? { upgradeInsecureRequests: [] } : {})
        },
        reportOnly: config.server.env === 'development',
      };
    } else {
      helmetConfig.contentSecurityPolicy = false;
    }

    return helmet(helmetConfig);
  }

  /**
   * Additional custom security headers
   */
  static customSecurityHeaders() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Enhanced security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // API specific headers
      res.setHeader('X-API-Version', config.server.apiVersion);
      res.setHeader('X-Service-Name', config.app.name);
      
      // Cache control for API responses
      if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
      }

      // HSTS for production
      if (config.server.env === 'production' && req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      // Permissions Policy
      res.setHeader('Permissions-Policy', [
        'camera=()',
        'microphone=()',
        'geolocation=()',
        'payment=()',
        'usb=()',
        'fullscreen=(self)',
        'notifications=(self)'
      ].join(', '));

      next();
    };
  }

  /**
   * Request validation and sanitization
   */
  static requestValidation() {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Check for suspicious patterns in URL
      const suspiciousPatterns = [
        /<script[^>]*>.*?<\/script>/gi,
        /<script/gi,
        /<\/script>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /onload|onerror|onclick|onmouseover|onkeydown/gi,
        /eval\(|document\.|window\./gi,
        /union.*select|select.*from|insert.*into|delete.*from|drop.*table/gi,
        /alert\(|prompt\(|confirm\(/gi
      ];

      const url = req.url.toLowerCase();
      const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(url));

      if (isSuspicious) {
        logger.warn('Suspicious request detected', {
          ip: req.ip,
          url: req.url,
          userAgent: req.headers['user-agent']
        });
        
        res.status(400).json({
          success: false,
          error: {
            message: 'Invalid request detected',
            code: 'INVALID_REQUEST'
          }
        });
        return;
      }

      // Validate request size
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (contentLength > maxSize) {
        res.status(413).json({
          success: false,
          error: {
            message: 'Request entity too large',
            code: 'PAYLOAD_TOO_LARGE'
          }
        });
        return;
      }

      // Add request ID for tracking
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      next();
    };
  }

  /**
   * Response sanitization
   */
  static responseSanitization() {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalJson = res.json;

      res.json = function(body: any) {
        // Remove sensitive fields from response
        if (body && typeof body === 'object') {
          body = SecurityHeaders.sanitizeResponse(body);
        }

        // Add security headers to JSON responses
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('X-Content-Type-Options', 'nosniff');

        return originalJson.call(this, body);
      };

      next();
    };
  }

  /**
   * Sanitize response data to remove sensitive information
   */
  private static sanitizeResponse(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeResponse(item));
    }

    if (obj && typeof obj === 'object') {
      const sanitized = { ...obj };
      
      // Remove sensitive fields
      const sensitiveFields = [
        'password',
        'passwordHash',
        'password_hash',
        'resetToken',
        'reset_token',
        'verificationToken',
        'verification_token',
        'apiKey',
        'api_key',
        'secret',
        'privateKey',
        'private_key'
      ];

      sensitiveFields.forEach(field => {
        if (field in sanitized) {
          delete sanitized[field];
        }
      });

      // Recursively sanitize nested objects
      Object.keys(sanitized).forEach(key => {
        if (sanitized[key] && typeof sanitized[key] === 'object') {
          sanitized[key] = this.sanitizeResponse(sanitized[key]);
        }
      });

      return sanitized;
    }

    return obj;
  }
}

/**
 * Legacy security headers middleware (maintained for compatibility)
 */
export const securityHeaders = SecurityHeaders.getHelmetConfig();

/**
 * Request logging middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP Request completed with error', logData);
    } else {
      logger.info('HTTP Request completed', logData);
    }
  });

  next();
};

/**
 * Sanitize request body to prevent XSS attacks
 */
export const sanitizeRequest = (req: Request, res: Response, next: NextFunction): void => {
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Basic XSS prevention - strip HTML tags
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<[^>]*>/g, '')
                .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  next();
};

/**
 * Prevent parameter pollution
 */
export const preventParameterPollution = (req: Request, res: Response, next: NextFunction): void => {
  // List of query parameters that should be unique
  const uniqueParams = ['page', 'limit', 'sort_by', 'sort_order', 'id'];

  for (const param of uniqueParams) {
    if (req.query[param] && Array.isArray(req.query[param])) {
      // Take only the last value if parameter is repeated
      req.query[param] = (req.query[param] as string[]).pop();
    }
  }

  next();
};
