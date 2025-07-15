/**
 * JWT Authentication Middleware Tests
 * 
 * Comprehensive test suite for the authentication middleware
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { 
  authMiddleware, 
  optionalAuthMiddleware,
  requireRole,
  requireAdmin,
  requireOwnershipOrAdmin
} from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import config from '../config/config';

// Mock dependencies
jest.mock('../config/config');
jest.mock('../utils/logger');
jest.mock('../db');

// Test app setup
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Test routes
  app.get('/protected', authMiddleware, (req, res) => {
    res.json({ user: req.user });
  });

  app.get('/optional', optionalAuthMiddleware, (req, res) => {
    res.json({ user: req.user || null });
  });

  app.get('/admin', authMiddleware, requireAdmin, (req, res) => {
    res.json({ message: 'admin access' });
  });

  app.get('/users/:userId', authMiddleware, requireOwnershipOrAdmin('userId'), (req, res) => {
    res.json({ userId: req.params.userId });
  });

  // Error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ 
        message: err.message, 
        code: err.code 
      });
    }
    res.status(500).json({ message: 'Internal server error' });
  });

  return app;
};

// Helper functions
const generateTestToken = (payload: any) => {
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
};

const generateExpiredToken = (payload: any) => {
  return jwt.sign(payload, 'test-secret', { expiresIn: '-1h' });
};

describe('JWT Authentication Middleware', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
    (config as any).jwt = {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret'
    };
  });

  describe('authMiddleware', () => {
    it('should authenticate valid JWT token', async () => {
      const token = generateTestToken({
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toEqual({
        id: 'user123',
        email: 'test@example.com',
        role: 'user',
        iat: expect.any(Number),
        exp: expect.any(Number)
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body.code).toBe('NO_TOKEN');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should reject expired token', async () => {
      const expiredToken = generateExpiredToken({
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should reject malformed Authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'InvalidFormat token123')
        .expect(401);

      expect(response.body.code).toBe('NO_TOKEN');
    });
  });

  describe('optionalAuthMiddleware', () => {
    it('should authenticate valid token', async () => {
      const token = generateTestToken({
        id: 'user123',
        email: 'test@example.com',
        role: 'user'
      });

      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.user).toBeTruthy();
      expect(response.body.user.id).toBe('user123');
    });

    it('should continue without token', async () => {
      const response = await request(app)
        .get('/optional')
        .expect(200);

      expect(response.body.user).toBeNull();
    });

    it('should continue with invalid token', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', 'Bearer invalid-token')
        .expect(200);

      expect(response.body.user).toBeNull();
    });
  });

  describe('requireRole middleware', () => {
    it('should allow access for correct role', async () => {
      const token = generateTestToken({
        id: 'admin123',
        email: 'admin@example.com',
        role: 'admin'
      });

      await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should deny access for incorrect role', async () => {
      const token = generateTestToken({
        id: 'user123',
        email: 'user@example.com',
        role: 'user'
      });

      const response = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should deny access without authentication', async () => {
      const response = await request(app)
        .get('/admin')
        .expect(401);

      expect(response.body.code).toBe('NO_TOKEN');
    });
  });

  describe('requireOwnershipOrAdmin middleware', () => {
    it('should allow access for resource owner', async () => {
      const token = generateTestToken({
        id: 'user123',
        email: 'user@example.com',
        role: 'user'
      });

      await request(app)
        .get('/users/user123')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should allow access for admin', async () => {
      const token = generateTestToken({
        id: 'admin123',
        email: 'admin@example.com',
        role: 'admin'
      });

      await request(app)
        .get('/users/user456')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should deny access for non-owner non-admin', async () => {
      const token = generateTestToken({
        id: 'user123',
        email: 'user@example.com',
        role: 'user'
      });

      const response = await request(app)
        .get('/users/user456')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.code).toBe('ACCESS_DENIED');
    });
  });
});

describe('Token Utilities', () => {
  const { tokenUtils } = require('../middleware/auth-enhanced');

  describe('extractToken', () => {
    it('should extract token from valid Authorization header', () => {
      const req = {
        headers: {
          authorization: 'Bearer token123'
        }
      } as any;

      const token = tokenUtils.extractToken(req);
      expect(token).toBe('token123');
    });

    it('should return null for invalid header', () => {
      const req = {
        headers: {
          authorization: 'Invalid token123'
        }
      } as any;

      const token = tokenUtils.extractToken(req);
      expect(token).toBeNull();
    });

    it('should return null when no header present', () => {
      const req = { headers: {} } as any;
      const token = tokenUtils.extractToken(req);
      expect(token).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const token = generateTestToken({ id: 'user123' });
      const isExpired = tokenUtils.isTokenExpired(token);
      expect(isExpired).toBe(false);
    });

    it('should return true for expired token', () => {
      const expiredToken = generateExpiredToken({ id: 'user123' });
      const isExpired = tokenUtils.isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it('should return true for invalid token', () => {
      const isExpired = tokenUtils.isTokenExpired('invalid-token');
      expect(isExpired).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const token = generateTestToken({ id: 'user123' });
      const expiration = tokenUtils.getTokenExpiration(token);
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      const expiration = tokenUtils.getTokenExpiration('invalid-token');
      expect(expiration).toBeNull();
    });
  });
});

// Integration tests
describe('Authentication Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = createTestApp();
    (config as any).jwt = {
      secret: 'test-secret',
      refreshSecret: 'test-refresh-secret'
    };
  });

  it('should handle complete authentication flow', async () => {
    // 1. Access protected route without token - should fail
    await request(app)
      .get('/protected')
      .expect(401);

    // 2. Access with valid token - should succeed
    const token = generateTestToken({
      id: 'user123',
      email: 'test@example.com',
      role: 'user'
    });

    const response = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.user.id).toBe('user123');

    // 3. Access admin route with user token - should fail
    await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    // 4. Access admin route with admin token - should succeed
    const adminToken = generateTestToken({
      id: 'admin123',
      email: 'admin@example.com',
      role: 'admin'
    });

    await request(app)
      .get('/admin')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('should handle ownership scenarios correctly', async () => {
    const userToken = generateTestToken({
      id: 'user123',
      email: 'user@example.com',
      role: 'user'
    });

    const adminToken = generateTestToken({
      id: 'admin123',
      email: 'admin@example.com',
      role: 'admin'
    });

    // User accessing own resource
    await request(app)
      .get('/users/user123')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // User accessing other's resource - denied
    await request(app)
      .get('/users/user456')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // Admin accessing any resource - allowed
    await request(app)
      .get('/users/user456')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});

export {};
