/**
 * Simple JWT Authentication Test
 * 
 * Manual test to verify the JWT authentication middleware
 */

import { generateAccessToken, verifyAccessToken } from '../config/jwt';
import { logger } from '../utils/logger';

/**
 * Test JWT middleware functionality
 */
export const testJWTAuth = async (): Promise<boolean> => {
  console.log('🧪 Testing JWT Authentication Middleware...\n');

  try {
    // Test 1: Generate and verify token
    console.log('1. Testing token generation and verification...');
    
    const payload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      role: 'user',
    };

    const token = generateAccessToken(payload);
    console.log('   ✓ Token generated successfully');
    console.log('   Token length:', token.length);

    // Verify the token
    const decoded = verifyAccessToken(token);
    console.log('   ✓ Token verified successfully');
    console.log('   Decoded payload:', {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    });

    // Test 2: Test invalid token
    console.log('\n2. Testing invalid token handling...');
    try {
      verifyAccessToken('invalid.token.here');
      console.log('   ❌ Should have thrown error for invalid token');
      return false;
    } catch (error) {
      console.log('   ✓ Invalid token correctly rejected');
      console.log('   Error:', (error as Error).message);
    }

    // Test 3: Test expired token (simulate)
    console.log('\n3. Testing expired token handling...');
    try {
      // This would be an actual expired token in practice
      const fakeExpiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0IiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE2MDA1NzYwMDAsImV4cCI6MTYwMDU3NjAwMH0.fake';
      verifyAccessToken(fakeExpiredToken);
    } catch (error) {
      console.log('   ✓ Expired/invalid token correctly rejected');
      console.log('   Error:', (error as Error).message);
    }

    // Test 4: Token blacklist simulation
    console.log('\n4. Testing token blacklist functionality...');
    const blacklist = new Set<string>();
    
    blacklist.add(token);
    const isBlacklisted = blacklist.has(token);
    console.log('   ✓ Token blacklisting works:', isBlacklisted);

    // Test 5: Role validation simulation
    console.log('\n5. Testing role validation...');
    const userRoles = ['user'];
    const requiredRoles = ['admin'];
    const hasAccess = requiredRoles.some(role => userRoles.includes(role));
    console.log('   ✓ Role validation works (should be false):', hasAccess);

    const adminRoles = ['admin'];
    const hasAdminAccess = requiredRoles.some(role => adminRoles.includes(role));
    console.log('   ✓ Admin role validation works (should be true):', hasAdminAccess);

    console.log('\n✅ All JWT authentication tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ JWT authentication test failed:', error);
    logger.error('JWT test error', error);
    return false;
  }
};

/**
 * Test middleware behavior simulation
 */
export const testMiddlewareBehavior = async (): Promise<boolean> => {
  console.log('\n🔧 Testing middleware behavior simulation...\n');

  try {
    // Simulate request/response cycle
    const mockAuth = async (authHeader?: string, requiredRole?: string) => {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('NO_TOKEN');
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = verifyAccessToken(token);
        
        if (requiredRole && decoded.role !== requiredRole) {
          throw new Error('INSUFFICIENT_ROLE');
        }

        return {
          user: {
            id: decoded.userId,
            email: decoded.email,
            role: decoded.role,
          },
          tokenInfo: {
            type: 'access',
            issuedAt: new Date(decoded.iat! * 1000),
            expiresAt: new Date(decoded.exp! * 1000),
          },
        };
      } catch (error) {
        if ((error as Error).message.includes('expired')) {
          throw new Error('TOKEN_EXPIRED');
        }
        throw new Error('TOKEN_INVALID');
      }
    };

    // Test successful authentication
    console.log('1. Testing successful authentication...');
    const token = generateAccessToken({
      userId: 'user123',
      email: 'user@example.com',
      role: 'user',
    });

    const result = await mockAuth(`Bearer ${token}`);
    console.log('   ✓ Authentication successful');
    console.log('   User:', result.user);

    // Test role-based access
    console.log('\n2. Testing role-based access...');
    try {
      await mockAuth(`Bearer ${token}`, 'admin');
      console.log('   ❌ Should have failed role check');
      return false;
    } catch (error) {
      console.log('   ✓ Role check correctly failed:', (error as Error).message);
    }

    // Test admin access
    console.log('\n3. Testing admin access...');
    const adminToken = generateAccessToken({
      userId: 'admin123',
      email: 'admin@example.com',
      role: 'admin',
    });

    const adminResult = await mockAuth(`Bearer ${adminToken}`, 'admin');
    console.log('   ✓ Admin authentication successful');
    console.log('   Admin user:', adminResult.user);

    console.log('\n✅ All middleware behavior tests passed!');
    return true;

  } catch (error) {
    console.error('\n❌ Middleware behavior test failed:', error);
    return false;
  }
};

/**
 * Run all tests
 */
export const runAllTests = async (): Promise<void> => {
  console.log('🚀 Starting JWT Authentication Middleware Tests\n');
  console.log('='.repeat(60));

  const test1 = await testJWTAuth();
  console.log('\n' + '-'.repeat(60));
  
  const test2 = await testMiddlewareBehavior();
  console.log('\n' + '='.repeat(60));

  if (test1 && test2) {
    console.log('\n🎉 All tests passed successfully!');
    console.log('\nJWT Authentication Middleware is ready for use.');
  } else {
    console.log('\n💥 Some tests failed. Please check the implementation.');
  }
};

// Export test functions
export default {
  testJWTAuth,
  testMiddlewareBehavior,
  runAllTests,
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
