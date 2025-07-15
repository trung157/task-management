# Express.js Routing Setup Implementation Guide

## Overview

This implementation provides a comprehensive Express.js routing system with:

- **Modular Route Organization** - Feature-based route modules
- **API Versioning** - Support for v1, v2, v3 with backward compatibility  
- **Advanced Middleware** - Security, validation, rate limiting, monitoring
- **Comprehensive Documentation** - OpenAPI, Swagger, Postman collections
- **Enhanced Security** - CORS, Helmet, JWT authentication, input validation
- **Monitoring & Analytics** - Health checks, metrics, performance tracking

## 🚀 Quick Setup

### 1. Basic Integration

```typescript
import express from 'express';
import { initializeEnhancedRouting } from './src/routes/enhancedRouting';

const app = express();

// Initialize the enhanced routing system
async function setupApp() {
  try {
    // Initialize routing with default configuration
    await initializeEnhancedRouting(app);
    
    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to setup application:', error);
    process.exit(1);
  }
}

setupApp();
```

### 2. Custom Configuration

```typescript
import { initializeEnhancedRouting } from './src/routes/enhancedRouting';

const customConfig = {
  versioning: {
    enabled: true,
    defaultVersion: 'v2',
    supportedVersions: ['v1', 'v2', 'v3'],
    deprecationWarnings: true
  },
  security: {
    cors: {
      enabled: true,
      origins: ['http://localhost:3000', 'https://myapp.com'],
      credentials: true
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000
    }
  },
  documentation: {
    enabled: process.env.NODE_ENV !== 'production',
    path: '/api/docs'
  }
};

await initializeEnhancedRouting(app, customConfig);
```

## 📁 File Structure

```
backend/src/routes/
├── enhancedRouting.ts           # Main routing configuration
├── taskManagementRouter.ts      # Core routing logic
├── userManagementRoutes.ts      # User management endpoints
├── auth/
│   └── index.ts                 # Authentication routes
├── tasks/
│   └── taskRoutes.ts           # Task management routes
├── v1/
│   └── index.ts                # V1 API routes
├── v2/
│   └── index.ts                # V2 API routes
└── v3/
    └── index.ts                # V3 API routes (latest features)
```

## 🛣️ API Endpoints

### Authentication Routes
```
POST   /api/auth/register        # User registration
POST   /api/auth/login           # User login
POST   /api/auth/logout          # User logout
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/forgot-password # Request password reset
POST   /api/auth/reset-password  # Reset password
POST   /api/auth/verify-email    # Verify email address
GET    /api/auth/me              # Get current user
GET    /api/auth/status          # Check auth status
```

### User Management Routes
```
GET    /api/users/profile        # Get user profile
PATCH  /api/users/profile        # Update profile
PUT    /api/users/preferences    # Update preferences
POST   /api/users/change-password # Change password
GET    /api/users/admin/search   # Search users (admin)
PATCH  /api/users/admin/:id/role # Update user role (admin)
```

### Task Management Routes
```
GET    /api/tasks                # List tasks (with filtering)
POST   /api/tasks                # Create task
GET    /api/tasks/:id            # Get specific task
PUT    /api/tasks/:id            # Update task
DELETE /api/tasks/:id            # Delete task
POST   /api/tasks/bulk           # Bulk operations
GET    /api/tasks/:id/history    # Task change history
```

### System Routes
```
GET    /health                   # Health check
GET    /api/status               # API status
GET    /api/versions             # Supported versions
GET    /api/docs                 # API documentation
GET    /metrics                  # System metrics
```

## 🔒 Security Features

### Rate Limiting
- **Authentication**: 5 requests per minute
- **Default API**: 100 requests per hour
- **Sensitive Operations**: 10 requests per hour

### Input Validation
- **express-validator**: Comprehensive validation rules
- **Sanitization**: XSS protection, SQL injection prevention
- **Type Safety**: TypeScript interfaces for all data

### JWT Authentication
- **Access Tokens**: Short-lived (1 hour)
- **Refresh Tokens**: Long-lived (7 days)
- **Secure Cookies**: HTTP-only, SameSite protection

## 📊 API Versioning

### Version Strategy
- **v1**: Legacy API (stable, maintenance mode)
- **v2**: Current stable API (recommended)
- **v3**: Latest features (beta, cutting-edge)

### Version Detection
1. **Header**: `X-API-Version: v2`
2. **URL Path**: `/api/v2/users`
3. **Default**: Falls back to v2 if not specified

### Backward Compatibility
- Legacy routes work without version prefix
- Deprecation warnings in response headers
- Sunset dates for deprecated versions

## 🔧 Middleware Stack

### Global Middleware (Applied to all routes)
1. **Security Headers** (Helmet)
2. **CORS** (Cross-Origin Resource Sharing)
3. **Rate Limiting** (Express Rate Limit)
4. **Request Logging** (Winston)
5. **Input Sanitization** (express-validator)
6. **Response Time** (Performance tracking)

### Route-Specific Middleware
1. **JWT Authentication** (Protected routes)
2. **Role-Based Access** (Admin routes)
3. **Input Validation** (Per-endpoint validation)
4. **Caching** (Static content)

## 📚 Documentation Features

### OpenAPI/Swagger
- **Interactive UI**: Test endpoints directly
- **Schema Validation**: Request/response schemas
- **Authentication**: Try with real tokens

### Postman Collection
- **Pre-configured**: All endpoints ready to test
- **Environment Variables**: Easy switching between environments
- **Auth Tokens**: Automatic token management

### API Documentation Endpoints
```
GET /api/docs                    # Main documentation page
GET /api/docs/openapi.json       # OpenAPI specification
GET /api/docs/postman.json       # Postman collection
GET /api/docs/swagger            # Swagger UI
GET /api/docs/redoc              # ReDoc UI
```

## 📈 Monitoring & Analytics

### Health Checks
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "uptime": 3600,
  "memory": { "used": "150MB", "total": "512MB" },
  "version": "3.0.0",
  "environment": "production"
}
```

### Metrics
```json
{
  "process": {
    "uptime": 3600,
    "memory": { "rss": 150000000, "heapUsed": 100000000 },
    "cpu": { "user": 500000, "system": 200000 }
  },
  "api": {
    "versions": ["v1", "v2", "v3"],
    "routes": 75,
    "requests": {
      "total": 50000,
      "success": 48500,
      "errors": 1500
    }
  }
}
```

### Performance Tracking
- **Response Times**: Per-endpoint timing
- **Error Rates**: Success/failure ratios
- **Resource Usage**: Memory, CPU, network
- **Request Patterns**: Most used endpoints

## 🛠️ Development Workflow

### 1. Adding New Routes

```typescript
// Create new route module
import { Router } from 'express';
import { jwtAuth } from '../../middleware/jwtAuth';

const router = Router();

router.get('/new-feature', 
  jwtAuth,
  validation,
  asyncHandler(async (req, res) => {
    // Implementation
  })
);

export default router;
```

### 2. Adding to Version

```typescript
// In v3/index.ts
import newFeatureRoutes from '../newFeature/routes';

export function configureV3Routes(versionedRouter: VersionedRouter) {
  const router = versionedRouter.getRouter();
  router.use('/new-feature', jwtAuth, newFeatureRoutes);
  return versionedRouter;
}
```

### 3. Testing

```bash
# Run tests
npm test

# Test specific endpoint
curl -X GET "http://localhost:3000/api/v2/tasks" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

## 🔄 Migration Guide

### From Basic Express to Enhanced Routing

1. **Install Dependencies**
```bash
npm install express-rate-limit helmet cors express-validator
npm install jsonwebtoken bcrypt
npm install @types/express @types/jsonwebtoken @types/bcrypt
```

2. **Update Main App File**
```typescript
// Replace existing routing
import { initializeEnhancedRouting } from './src/routes/enhancedRouting';

// Remove old route imports
// const userRoutes = require('./routes/users');
// const taskRoutes = require('./routes/tasks');

// Initialize new system
await initializeEnhancedRouting(app);
```

3. **Migrate Existing Routes**
- Move routes to feature-based folders
- Add proper validation and middleware
- Update to use new response format

## 🚀 Production Deployment

### Environment Variables
```bash
NODE_ENV=production
API_VERSION=3.0.0
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
ALLOWED_ORIGINS=https://yourapp.com,https://app.yourapp.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1000
```

### PM2 Configuration
```json
{
  "name": "task-management-api",
  "script": "dist/index.js",
  "instances": "max",
  "exec_mode": "cluster",
  "env": {
    "NODE_ENV": "production",
    "PORT": 3000
  },
  "error_file": "./logs/err.log",
  "out_file": "./logs/out.log",
  "log_file": "./logs/combined.log"
}
```

### Docker Configuration
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## 🔍 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Check `ALLOWED_ORIGINS` environment variable
   - Verify frontend URL is included in CORS config

2. **Rate Limiting**
   - Check rate limit headers in response
   - Adjust limits in configuration

3. **Authentication Failures**
   - Verify JWT secret configuration
   - Check token expiration times

4. **Validation Errors**
   - Review request payload format
   - Check validation rules in route definitions

### Debug Mode
```bash
# Enable debug logging
DEBUG=app:* npm start

# Verbose logging
LOG_LEVEL=debug npm start
```

## 📞 Support

For questions or issues:
- Check the API documentation at `/api/docs`
- Review the health check at `/health`
- Check system metrics at `/metrics`

The routing system is production-ready with comprehensive error handling, monitoring, and security features.
