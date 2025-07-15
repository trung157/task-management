# JWT Authentication Middleware

Modern, comprehensive JWT authentication middleware for Express.js with enhanced security features and flexible configuration options.

## Features

- ✅ **JWT Token Verification** - Access and refresh token support
- ✅ **Error Handling** - Comprehensive error types and messages
- ✅ **User Context** - Extended user information in requests
- ✅ **Role-based Authorization** - Support for multiple roles
- ✅ **Permission-based Authorization** - Fine-grained permissions
- ✅ **Optional Authentication** - Flexible authentication requirements
- ✅ **Token Blacklisting** - Logout and security features
- ✅ **Database Validation** - User existence and status checking
- ✅ **Rate Limiting** - Protection against brute force attacks
- ✅ **Security Logging** - Comprehensive audit trail
- ✅ **Multiple Token Sources** - Headers, cookies, query params

## Quick Start

```typescript
import express from 'express';
import { requireAuth, optionalAuth, requireAdmin, requireRole } from './middleware/jwtAuth';

const app = express();

// Protected route - requires valid JWT
app.get('/profile', requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

// Optional authentication - user context if token provided
app.get('/public', optionalAuth, (req, res) => {
  if (req.authUser) {
    res.json({ message: 'Hello ' + req.authUser.email });
  } else {
    res.json({ message: 'Hello guest' });
  }
});

// Admin only route
app.get('/admin', requireAdmin, (req, res) => {
  res.json({ message: 'Admin area' });
});

// Role-based access
app.get('/moderator', requireRole('admin', 'moderator'), (req, res) => {
  res.json({ message: 'Moderator area' });
});
```

## Configuration Options

### AuthMiddlewareOptions

```typescript
interface AuthMiddlewareOptions {
  required?: boolean;              // Default: true
  roles?: string[];               // Required roles
  permissions?: string[];         // Required permissions
  validateUser?: boolean;         // Validate user in DB (default: true)
  allowExpiredGracePeriod?: number; // Grace period in ms
}
```

## Available Middleware Functions

### Basic Authentication

```typescript
import { jwtAuth, requireAuth, optionalAuth } from './middleware/jwtAuth';

// Custom configuration
app.use('/api', jwtAuth({ 
  required: true, 
  validateUser: true,
  allowExpiredGracePeriod: 5000 // 5 seconds grace period
}));

// Simple required auth
app.use('/protected', requireAuth);

// Optional auth
app.use('/public', optionalAuth);
```

### Role-based Authorization

```typescript
import { requireRole, requireAdmin } from './middleware/jwtAuth';

// Single role
app.get('/admin', requireRole('admin'), handler);

// Multiple roles
app.get('/staff', requireRole('admin', 'moderator', 'staff'), handler);

// Admin shortcut
app.get('/admin-panel', requireAdmin, handler);
```

### Permission-based Authorization

```typescript
import { requirePermission } from './middleware/jwtAuth';

// Single permission
app.post('/tasks', requirePermission('create:task'), handler);

// Multiple permissions
app.get('/analytics', requirePermission('view:analytics', 'view:reports'), handler);
```

### Ownership-based Authorization

```typescript
import { requireOwnershipOrAdmin } from './middleware/jwtAuth';

// Check if user owns the resource or is admin
app.get('/users/:id', requireAuth, requireOwnershipOrAdmin('id'), handler);

// Custom parameter name
app.put('/profiles/:userId', requireAuth, requireOwnershipOrAdmin('userId'), handler);
```

### Token Management

```typescript
import { requireRefreshToken, logoutMiddleware, blacklistToken } from './middleware/jwtAuth';

// Refresh token endpoint
app.post('/auth/refresh', requireRefreshToken, (req, res) => {
  // Generate new tokens using req.authUser
  const tokens = generateTokenPair(req.authUser);
  res.json(tokens);
});

// Logout endpoint
app.post('/auth/logout', requireAuth, logoutMiddleware, (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Manual token blacklisting
app.post('/auth/revoke', requireAuth, (req, res) => {
  const token = extractToken(req);
  if (token) {
    blacklistToken(token);
  }
  res.json({ message: 'Token revoked' });
});
```

### Rate Limiting

```typescript
import { authRateLimit } from './middleware/jwtAuth';

// Apply rate limiting to auth endpoints
app.use('/auth', authRateLimit(5, 15 * 60 * 1000)); // 5 attempts per 15 minutes

app.post('/auth/login', (req, res) => {
  // Login logic
});
```

## Request Context

After successful authentication, the request object is extended with:

```typescript
// User information
req.authUser: {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLoginAt?: Date;
  iat?: number;
  exp?: number;
}

// Token information
req.authTokenInfo: {
  type: 'access' | 'refresh';
  issuedAt: Date;
  expiresAt: Date;
  remainingTime: number;
}
```

## Error Codes

The middleware throws `AppError` instances with specific error codes:

| Code | Description |
|------|-------------|
| `NO_TOKEN` | No authentication token provided |
| `TOKEN_REVOKED` | Token has been blacklisted |
| `TOKEN_EXPIRED` | Token has expired |
| `TOKEN_INVALID` | Token is malformed or invalid |
| `TOKEN_SIGNATURE_INVALID` | Token signature verification failed |
| `USER_INVALID` | User not found or inactive |
| `INSUFFICIENT_ROLE` | User role insufficient |
| `INSUFFICIENT_PERMISSIONS` | User permissions insufficient |
| `ACCESS_DENIED` | General access denied |
| `RATE_LIMIT_EXCEEDED` | Too many authentication attempts |

## Token Sources

The middleware automatically checks multiple sources for tokens:

1. **Authorization Header** (recommended): `Authorization: Bearer <token>`
2. **Query Parameter**: `?token=<token>`
3. **Cookie**: `access_token=<token>`
4. **Custom Header**: `X-Access-Token: <token>`

## Security Features

### Token Blacklisting

```typescript
import { blacklistToken, isTokenBlacklisted } from './middleware/jwtAuth';

// Blacklist a token
blacklistToken(token);

// Check if blacklisted
if (isTokenBlacklisted(token)) {
  // Token is revoked
}
```

### Database User Validation

The middleware can validate that the user still exists and is active:

```typescript
app.use('/api', jwtAuth({ validateUser: true }));
```

### Grace Period for Expired Tokens

Allow slightly expired tokens for a brief period:

```typescript
app.use('/api', jwtAuth({ 
  allowExpiredGracePeriod: 5000 // 5 seconds
}));
```

## Complete Example

```typescript
import express from 'express';
import {
  requireAuth,
  optionalAuth,
  requireAdmin,
  requireRole,
  requirePermission,
  requireOwnershipOrAdmin,
  requireRefreshToken,
  logoutMiddleware,
  authRateLimit
} from './middleware/jwtAuth';

const app = express();

// Rate limiting for auth endpoints
app.use('/auth', authRateLimit(5, 15 * 60 * 1000));

// Public routes
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Optional auth routes
app.get('/posts', optionalAuth, (req, res) => {
  // Show public posts, personalized if authenticated
});

// Protected routes
app.get('/profile', requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

// Role-based routes
app.get('/admin', requireAdmin, (req, res) => {
  res.json({ message: 'Admin panel' });
});

app.get('/moderator', requireRole('admin', 'moderator'), (req, res) => {
  res.json({ message: 'Moderator tools' });
});

// Permission-based routes
app.post('/tasks', requireAuth, requirePermission('create:task'), (req, res) => {
  // Create task
});

// Ownership-based routes
app.get('/users/:id', requireAuth, requireOwnershipOrAdmin('id'), (req, res) => {
  // User can access own profile, admins can access any
});

// Token management
app.post('/auth/refresh', requireRefreshToken, (req, res) => {
  // Generate new access token
});

app.post('/auth/logout', requireAuth, logoutMiddleware, (req, res) => {
  res.json({ message: 'Logged out' });
});

export default app;
```

## Production Considerations

1. **Token Blacklisting**: Use Redis or database instead of in-memory Set
2. **Rate Limiting**: Use Redis for distributed rate limiting
3. **Logging**: Ensure sensitive data is not logged
4. **HTTPS**: Always use HTTPS in production
5. **Token Storage**: Use secure, httpOnly cookies when possible
6. **Monitoring**: Monitor failed authentication attempts

## Integration with Database

The middleware expects a `users` table with these columns:

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMP,
  permissions JSONB DEFAULT '[]',
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

This middleware provides a robust, production-ready authentication solution with comprehensive security features and flexible configuration options.
