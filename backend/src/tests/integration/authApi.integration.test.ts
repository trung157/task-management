/**
 * Authentication API Integration Tests
 * 
 * Integration tests for authentication endpoints including registration,
 * login, logout, token refresh, and password reset functionality.
 */

import request from 'supertest';
import { app } from '../../index';
import { 
  IntegrationTestSetup, 
  TestContext, 
  expectApiSuccess, 
  expectApiError 
} from '../utils/integrationTestSetup';

describe('Authentication API Integration Tests', () => {
  let testContext: TestContext;

  beforeAll(async () => {
    testContext = await IntegrationTestSetup.setup();
  });

  afterAll(async () => {
    await testContext.cleanup();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const registrationData = {
        email: `newuser-${Date.now()}@test.com`,
        password: 'StrongPassword123!',
        first_name: 'New',
        last_name: 'User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registrationData)
        .expect(201);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.user.email).toBe(registrationData.email);
      expect(response.body.data.user.first_name).toBe(registrationData.first_name);
      expect(response.body.data.user.last_name).toBe(registrationData.last_name);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should return 400 for invalid registration data', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: 'weak',
        first_name: '',
        last_name: ''
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(invalidData)
        .expect(400);

      expectApiError(response, 'validation');
    });

    it('should return 409 for duplicate email', async () => {
      const registrationData = {
        email: testContext.regularUser.user.email,
        password: 'StrongPassword123!',
        first_name: 'Duplicate',
        last_name: 'User'
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(registrationData)
        .expect(409);

      expectApiError(response, 'already exists');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: testContext.regularUser.user.email,
        password: 'testpassword123!'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.user.email).toBe(loginData.email);
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid credentials', async () => {
      const invalidLogin = {
        email: testContext.regularUser.user.email,
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(invalidLogin)
        .expect(401);

      expectApiError(response, 'Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const nonExistentUser = {
        email: 'nonexistent@test.com',
        password: 'anypassword'
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(nonExistentUser)
        .expect(401);

      expectApiError(response, 'Invalid credentials');
    });

    it('should return 400 for missing email or password', async () => {
      const incompleteData = {
        email: testContext.regularUser.user.email
        // password missing
      };

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send(incompleteData)
        .expect(400);

      expectApiError(response, 'validation');
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const refreshData = {
        refreshToken: testContext.regularUser.refreshToken
      };

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send(refreshData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid refresh token', async () => {
      const invalidRefreshData = {
        refreshToken: 'invalid-refresh-token'
      };

      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send(invalidRefreshData)
        .expect(401);

      expectApiError(response, 'Invalid refresh token');
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .send({})
        .expect(400);

      expectApiError(response, 'validation');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testContext.regularUser.authToken}`)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.message).toContain('logged out');
    });

    it('should return 401 without authentication token', async () => {
      await request(app)
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should send password reset email for valid user', async () => {
      const forgotPasswordData = {
        email: testContext.regularUser.user.email
      };

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.message).toContain('reset');
    });

    it('should return 200 even for non-existent email (security)', async () => {
      const forgotPasswordData = {
        email: 'nonexistent@test.com'
      };

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(forgotPasswordData)
        .expect(200);

      expectApiSuccess(response);
    });

    it('should return 400 for invalid email format', async () => {
      const invalidEmailData = {
        email: 'invalid-email-format'
      };

      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send(invalidEmailData)
        .expect(400);

      expectApiError(response, 'validation');
    });
  });

  describe('POST /api/v1/auth/check-password-strength', () => {
    it('should return strength for strong password', async () => {
      const passwordData = {
        password: 'VeryStrongPassword123!@#'
      };

      const response = await request(app)
        .post('/api/v1/auth/check-password-strength')
        .send(passwordData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('strength');
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data.score).toBeGreaterThan(0);
    });

    it('should return low strength for weak password', async () => {
      const passwordData = {
        password: '123'
      };

      const response = await request(app)
        .post('/api/v1/auth/check-password-strength')
        .send(passwordData)
        .expect(200);

      expectApiSuccess(response);
      expect(response.body.data).toHaveProperty('strength');
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data.score).toBe(0);
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/check-password-strength')
        .send({})
        .expect(400);

      expectApiError(response, 'validation');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to login attempts', async () => {
      const loginData = {
        email: testContext.regularUser.user.email,
        password: 'wrongpassword'
      };

      // Make multiple failed login attempts
      const requests = Array.from({ length: 6 }, () =>
        request(app)
          .post('/api/v1/auth/login')
          .send(loginData)
      );

      const responses = await Promise.all(requests);
      
      // At least one should be rate limited (429)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should apply rate limiting to registration attempts', async () => {
      const requests = Array.from({ length: 6 }, (_, i) =>
        request(app)
          .post('/api/v1/auth/register')
          .send({
            email: `ratelimit${i}@test.com`,
            password: 'TestPassword123!',
            first_name: 'Rate',
            last_name: 'Limit'
          })
      );

      const responses = await Promise.all(requests);
      
      // Check if rate limiting is applied
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/auth/check-password-strength')
        .send({ password: 'test' });

      // Check for common security headers
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  describe('Session Management', () => {
    it('should invalidate session after logout', async () => {
      // First, logout the user
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${testContext.regularUser.authToken}`)
        .expect(200);

      // Then try to use the same token for an authenticated request
      await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${testContext.regularUser.authToken}`)
        .expect(401);
    });

    it('should handle concurrent sessions for the same user', async () => {
      // Login multiple times to create multiple sessions
      const loginData = {
        email: testContext.regularUser.user.email,
        password: 'testpassword123!'
      };

      const session1 = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      const session2 = await request(app)
        .post('/api/v1/auth/login')
        .send(loginData)
        .expect(200);

      // Both sessions should be valid
      await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${session1.body.data.tokens.accessToken}`)
        .expect(200);

      await request(app)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${session2.body.data.tokens.accessToken}`)
        .expect(200);
    });
  });
});
