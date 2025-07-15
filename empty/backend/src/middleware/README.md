# JWT Authentication Middleware for Express.js

This module provides comprehensive JWT authentication and authorization middleware for Express.js applications.

## Features

- ✅ **JWT Token Authentication** - Verify and decode JWT tokens
- ✅ **Role-Based Authorization** - Control access based on user roles
- ✅ **Ownership Authorization** - Allow resource owners or admins
- ✅ **Optional Authentication** - Flexible authentication for public/private routes
- ✅ **Refresh Token Support** - Handle token renewal
- ✅ **API Key Authentication** - Alternative authentication method
- ✅ **Rate Limiting Integration** - Track failed authentication attempts
- ✅ **Token Utilities** - Helper functions for token management
- ✅ **Comprehensive Error Handling** - Detailed error codes and messages
- ✅ **TypeScript Support** - Full type definitions

## Quick Start

### Basic Setup

```typescript
import express from 'express';
import { authMiddleware, requireAdmin } from './middleware/auth';

const app = express();

// Protect all routes under /api
app.use('/api', authMiddleware);

// Admin-only route
app.get('/admin/dashboard', authMiddleware, requireAdmin, (req, res) => {
  res.json({ message: 'Admin Dashboard', user: req.user });
});
```

### Configuration

Ensure your config has the required JWT settings:

```typescript
// config.ts
export default {
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  }
};
```

## Middleware Reference

### Core Authentication

#### `authMiddleware`
Requires valid JWT token in Authorization header.

```typescript
app.get('/protected', authMiddleware, (req, res) => {
  console.log(req.user); // User info from token
  res.json({ user: req.user });
});
```

**Token Format:** `Authorization: Bearer <jwt-token>`

**Errors:**
- `NO_TOKEN` (401) - No token provided
- `INVALID_TOKEN` (401) - Invalid token format
- `TOKEN_EXPIRED` (401) - Token has expired
- `USER_INACTIVE` (401) - User account is inactive

#### `optionalAuthMiddleware`
Attempts authentication but doesn't fail if no token provided.

```typescript
app.get('/public-or-private', optionalAuthMiddleware, (req, res) => {
  if (req.user) {
    res.json({ message: 'Welcome back!', user: req.user });
  } else {
    res.json({ message: 'Hello, anonymous user!' });
  }
});
```

### Authorization Middleware

#### `requireRole(roles)`
Restricts access to specific roles.

```typescript
// Single role
app.get('/admin', authMiddleware, requireRole('admin'), handler);

// Multiple roles
app.get('/staff', authMiddleware, requireRole(['admin', 'moderator']), handler);
```

#### `requireAdmin`
Shorthand for admin-only access.

```typescript
app.get('/admin/users', authMiddleware, requireAdmin, handler);
```

#### `requireOwnershipOrAdmin(userIdParam)`
Allows resource owners or admins.

```typescript
// User can access their own profile OR admin can access any profile
app.get('/users/:userId/profile', 
  authMiddleware, 
  requireOwnershipOrAdmin('userId'), 
  handler
);
```

### Advanced Authentication

#### `refreshTokenMiddleware`
Handles refresh token verification for token renewal.

```typescript
app.post('/auth/refresh', refreshTokenMiddleware, (req, res) => {
  // Generate new access token
  const newAccessToken = generateAccessToken(req.user);
  res.json({ accessToken: newAccessToken });
});
```

#### `apiKeyMiddleware`
Alternative authentication using API keys.

```typescript
app.get('/api/data', apiKeyMiddleware, (req, res) => {
  res.json({ data: 'sensitive data', user: req.user });
});
```

**API Key Format:** `X-API-Key: <api-key>`

#### `flexibleAuthMiddleware`
Accepts either JWT tokens or API keys.

```typescript
app.get('/flexible', flexibleAuthMiddleware, (req, res) => {
  res.json({ message: 'Authenticated via JWT or API key' });
});
```

#### `rateLimitedAuthMiddleware`
Authentication with failed attempt tracking.

```typescript
app.post('/sensitive', rateLimitedAuthMiddleware, (req, res) => {
  res.json({ message: 'Sensitive action performed' });
});
```

## Token Utilities

```typescript
import { tokenUtils } from './middleware/auth-enhanced';

// Extract token from request
const token = tokenUtils.extractToken(req);

// Check if token is expired
const isExpired = tokenUtils.isTokenExpired(token);

// Get token expiration date
const expiration = tokenUtils.getTokenExpiration(token);
```

## User Object

After successful authentication, `req.user` contains:

```typescript
interface User {
  id: string;        // User ID
  email: string;     // User email
  role: string;      // User role (e.g., 'admin', 'user')
  iat?: number;      // Token issued at (timestamp)
  exp?: number;      // Token expires at (timestamp)
}
```

## Error Handling

```typescript
app.use((err, req, res, next) => {
  if (err.code === 'TOKEN_EXPIRED') {
    return res.status(401).json({ 
      message: 'Token expired, please refresh',
      code: 'TOKEN_EXPIRED' 
    });
  }
  
  if (err.code === 'INSUFFICIENT_PERMISSIONS') {
    return res.status(403).json({
      message: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS'
    });
  }
  
  // Handle other errors...
});
```

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NO_TOKEN` | 401 | No authentication token provided |
| `INVALID_TOKEN` | 401 | Token is malformed or invalid |
| `TOKEN_EXPIRED` | 401 | Token has expired |
| `USER_INACTIVE` | 401 | User account is inactive |
| `AUTH_REQUIRED` | 401 | Authentication required for this resource |
| `INSUFFICIENT_PERMISSIONS` | 403 | User lacks required role/permissions |
| `ACCESS_DENIED` | 403 | Access denied (ownership/admin check failed) |
| `NO_REFRESH_TOKEN` | 401 | Refresh token not provided |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token is invalid |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |

## Usage Examples

### Basic Protected Route

```typescript
app.get('/profile', authMiddleware, (req, res) => {
  res.json({
    id: req.user!.id,
    email: req.user!.email,
    role: req.user!.role
  });
});
```

### Role-Based Dashboard

```typescript
app.get('/dashboard', authMiddleware, (req, res) => {
  const { role } = req.user!;
  
  switch (role) {
    case 'admin':
      return res.json({ view: 'admin-dashboard' });
    case 'moderator':
      return res.json({ view: 'moderator-dashboard' });
    default:
      return res.json({ view: 'user-dashboard' });
  }
});
```

### Conditional Authentication

```typescript
const conditionalAuth = (req) => req.query.private === 'true';

app.get('/content/:id', 
  (req, res, next) => {
    if (conditionalAuth(req)) {
      return authMiddleware(req, res, next);
    } else {
      return optionalAuthMiddleware(req, res, next);
    }
  },
  (req, res) => {
    const isPrivate = req.query.private === 'true';
    
    if (isPrivate && !req.user) {
      return res.status(401).json({ message: 'Private content requires authentication' });
    }
    
    res.json({
      content: 'Your content here',
      isPrivate,
      user: req.user
    });
  }
);
```

### Middleware Chain

```typescript
app.post('/admin/delete-user/:userId',
  authMiddleware,           // Require authentication
  requireAdmin,            // Require admin role  
  validateRequest,         // Custom validation
  auditLog,               // Log the action
  async (req, res) => {
    // Delete user logic
    const result = await deleteUser(req.params.userId);
    res.json({ success: true, result });
  }
);
```

## Testing

```typescript
import request from 'supertest';
import jwt from 'jsonwebtoken';

const generateToken = (payload) => {
  return jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
};

describe('Authentication', () => {
  it('should protect routes', async () => {
    // Without token
    await request(app)
      .get('/protected')
      .expect(401);
    
    // With valid token
    const token = generateToken({ id: 'user123', role: 'user' });
    
    await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
```

## Security Best Practices

1. **Use strong secrets** - Use long, random secrets for JWT signing
2. **Short token expiry** - Keep access tokens short-lived (15-30 minutes)
3. **Secure token storage** - Store tokens securely on the client
4. **HTTPS only** - Always use HTTPS in production
5. **Token rotation** - Implement refresh token rotation
6. **Rate limiting** - Limit authentication attempts
7. **Audit logging** - Log authentication events
8. **Input validation** - Validate all inputs

## Dependencies

- `jsonwebtoken` - JWT token handling
- `express` - Web framework
- Your database driver (for user validation)

## License

This middleware is part of the TaskFlow project and follows the same license terms.
