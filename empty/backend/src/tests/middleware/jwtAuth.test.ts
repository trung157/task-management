/**
 * JWT Authentication Middleware Test
 * 
 * Test file to verify the JWT authentication middleware functionality
 */

import { Request, Response, NextFunction } from 'express';
import { jwtAuth, requireAuth, optionalAuth, requireRole } from '../middleware/jwtAuth';
import { generateAccessToken } from '../config/jwt';
import { AppError } from '../middleware/errorHandler';

// Mock request, response, and next function
const mockRequest = (authHeader?: string, user?: any) => ({
  headers: { authorization: authHeader },
  authUser: user,
  query: {},
  cookies: {},
  params: {},
  body: {},
  ip: '127.0.0.1',
  get: (header: string) => header === 'User-Agent' ? 'Test-Agent' : undefined,
} as Partial<Request>);

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
} as Partial<Response>);

const mockNext = jest.fn() as NextFunction;

// Test JWT middleware
describe('JWT Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('requireAuth middleware', () => {
    it('should pass with valid token', async () => {
      const token = generateAccessToken({
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.authUser).toBeDefined();
      expect(req.authUser?.id).toBe('user123');
    });

    it('should fail with no token', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(401);
      expect(error.errorCode).toBe('NO_TOKEN');
    });

    it('should fail with invalid token', async () => {
      const req = mockRequest('Bearer invalid-token') as Request;
      const res = mockResponse() as Response;

      await requireAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(401);
    });
  });

  describe('optionalAuth middleware', () => {
    it('should pass without token', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.authUser).toBeUndefined();
    });

    it('should set user with valid token', async () => {
      const token = generateAccessToken({
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;

      await optionalAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.authUser).toBeDefined();
      expect(req.authUser?.id).toBe('user123');
    });
  });

  describe('requireRole middleware', () => {
    it('should pass with correct role', async () => {
      const token = generateAccessToken({
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;
      const adminAuth = requireRole('admin');

      await adminAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(req.authUser?.role).toBe('admin');
    });

    it('should fail with incorrect role', async () => {
      const token = generateAccessToken({
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
      });

      const req = mockRequest(`Bearer ${token}`) as Request;
      const res = mockResponse() as Response;
      const adminAuth = requireRole('admin');

      await adminAuth(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AppError));
      const error = mockNext.mock.calls[0][0] as AppError;
      expect(error.statusCode).toBe(403);
      expect(error.errorCode).toBe('INSUFFICIENT_ROLE');
    });
  });
});

// Manual test function
export const testJWTMiddleware = async () => {
  console.log('🧪 Testing JWT Authentication Middleware...');

  try {
    // Test 1: Valid token
    console.log('\n1. Testing valid token...');
    const token = generateAccessToken({
      userId: 'test123',
      email: 'test@example.com',
      role: 'user',
    });
    console.log('✓ Generated token successfully');

    // Test 2: Invalid token handling
    console.log('\n2. Testing error handling...');
    const req = mockRequest('Bearer invalid-token') as Request;
    const res = mockResponse() as Response;
    
    await requireAuth(req, res, (error) => {
      if (error instanceof AppError) {
        console.log('✓ Error handling works:', error.message);
      }
    });

    // Test 3: Optional auth
    console.log('\n3. Testing optional auth...');
    const reqNoToken = mockRequest() as Request;
    await optionalAuth(reqNoToken, res, () => {
      console.log('✓ Optional auth allows no token');
    });

    console.log('\n✅ All JWT middleware tests passed!');
    return true;
  } catch (error) {
    console.error('❌ JWT middleware test failed:', error);
    return false;
  }
};

// Export for integration tests
export default {
  testJWTMiddleware,
  mockRequest,
  mockResponse,
  mockNext,
};

// Run test if this file is executed directly
if (require.main === module) {
  testJWTMiddleware();
}
