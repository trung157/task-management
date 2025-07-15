# Environment Configuration Setup Guide

This guide provides step-by-step instructions for setting up and managing environment configuration for the TaskFlow Backend API.

## Overview

The TaskFlow Backend uses a comprehensive environment configuration system that:

- ✅ Validates all configuration on startup
- 🔐 Generates secure secrets automatically  
- 🏥 Provides health checks and monitoring
- 📝 Offers interactive setup for new deployments
- 🚨 Prevents production deployment with weak configuration

## Quick Setup

### 1. Initial Setup (First Time)

```bash
# Clone the repository and navigate to backend
cd task-management/backend

# Install dependencies
npm install

# Run interactive environment setup
npm run env:setup
```

The interactive setup will guide you through:
- Environment selection (development/production)
- Database configuration
- Security secret generation
- Email configuration (optional)
- CORS and server settings

### 2. Manual Setup

If you prefer manual setup, copy the template and edit:

```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
npm run env:generate

# Edit .env file with your configuration
# (Add the generated secrets and your database credentials)

# Validate configuration
npm run env:validate
```

## Environment Commands

The backend provides several npm scripts for environment management:

| Command | Description | Use Case |
|---------|-------------|----------|
| `npm run env:setup` | Interactive environment setup | First-time setup, new environments |
| `npm run env:validate` | Validate current configuration | Before deployment, troubleshooting |
| `npm run env:generate` | Generate secure secrets | Initial setup, secret rotation |
| `npm run env:health` | Complete environment health check | System monitoring, debugging |

## Configuration Validation

### Automatic Validation

The application automatically validates configuration on startup:

```bash
npm run dev

# Output:
🔍 Performing environment validation...

📊 Environment Info:
   Node.js: v22.17.0
   Environment: development
   API Version: v1
   Database: ✅ Connected
   JWT Config: ✅ Valid

✅ Environment validation passed!
```

### Manual Validation

Run validation anytime to check your configuration:

```bash
npm run env:validate

# Output:
🔍 Configuration Validation
✓ .env file found
✓ Database connection successful
✓ JWT configuration valid
✓ Configuration validation passed!
```

## Required Environment Variables

### Minimum Configuration (Development)

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=your_password

# Server  
NODE_ENV=development
PORT=5000

# Security (can use defaults in development)
JWT_SECRET=generated_secret_here
JWT_REFRESH_SECRET=different_generated_secret_here
SESSION_SECRET=session_secret_here
```

### Production Configuration

Production requires all security variables to be explicitly set with strong values:

```env
# Environment
NODE_ENV=production

# Database (use DATABASE_URL for hosted databases)
DATABASE_URL=postgresql://user:pass@host:port/database

# Security (must be strong, unique secrets)
JWT_SECRET=very_long_cryptographically_secure_secret_64_chars_min
JWT_REFRESH_SECRET=different_very_long_secure_secret_for_refresh_tokens
SESSION_SECRET=secure_session_secret_32_chars_minimum

# Production Security
TRUST_PROXY=true
FORCE_HTTPS=true
SECURE_COOKIES=true

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

## Security Best Practices

### Secret Generation

Always use cryptographically secure secrets:

```bash
# Generate secrets with the built-in tool
npm run env:generate

# Manual generation (if needed)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Production Checklist

Before deploying to production:

- [ ] Run `npm run env:validate` 
- [ ] All secrets are 32+ characters and unique
- [ ] No default/placeholder values remain
- [ ] Database connection is secured (SSL enabled)
- [ ] CORS origins are properly configured
- [ ] Security flags are enabled (`TRUST_PROXY`, `FORCE_HTTPS`, etc.)

### Environment Isolation

Use different configurations for each environment:

```bash
# Development
cp .env.example .env.development

# Staging  
cp .env.example .env.staging

# Production
cp .env.example .env.production
```

## Database Configuration

### Local Development

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_dev
DB_USER=postgres
DB_PASSWORD=dev_password
DB_SSL=false
```

### Production/Hosted Database

```env
# Option 1: Connection URL (recommended for hosted DBs)
DATABASE_URL=postgresql://username:password@host:port/database?ssl=true

# Option 2: Individual parameters
DB_HOST=your-db-host.com
DB_PORT=5432
DB_NAME=production_db
DB_USER=app_user
DB_PASSWORD=secure_production_password
DB_SSL=true
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   npm run env:health
   
   # Verify credentials
   npm run env:validate
   
   # Test specific connection
   npm run db:test
   ```

2. **JWT Configuration Invalid**
   ```bash
   # Generate new secrets
   npm run env:generate
   
   # Copy secrets to .env file
   # Restart application
   ```

3. **Port Already in Use**
   ```bash
   # Change port in .env
   PORT=3001
   
   # Or find process using port
   netstat -ano | findstr :5000  # Windows
   lsof -ti:5000 | xargs kill -9  # macOS/Linux
   ```

### Validation Errors

The validation system provides specific error messages:

```bash
❌ Configuration validation failed:
   - Database password is required (DB_PASSWORD or DATABASE_URL)
   - JWT_SECRET must be set in production
   - JWT_REFRESH_SECRET must be set in production
```

Fix each error and re-run validation.

### Debug Mode

Enable debug logging for detailed information:

```env
LOG_LEVEL=debug
DEBUG=taskflow:*
```

## Health Monitoring

### Health Check Endpoints

The application provides health check endpoints:

```bash
# Basic health check
curl http://localhost:5000/api/v1/health

# Detailed health check (includes database, JWT, etc.)
curl http://localhost:5000/api/v1/health/detailed
```

### Environment Status API

Check environment status programmatically:

```bash
curl http://localhost:5000/api/v1/health/environment
```

Response:
```json
{
  "valid": true,
  "environment": "development", 
  "nodeVersion": "v22.17.0",
  "apiVersion": "v1",
  "services": {
    "database": true,
    "jwt": true
  },
  "issueCount": {
    "errors": 0,
    "warnings": 2
  }
}
```

## Docker Configuration

### Environment Variables in Docker

```dockerfile
# Dockerfile
ENV NODE_ENV=production
ENV PORT=5000
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: .
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/taskflow
    env_file:
      - .env.production
    ports:
      - "5000:5000"
```

### Container Health Checks

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:5000/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Advanced Configuration

### Multiple Environment Files

Load different configurations per environment:

```javascript
// Custom dotenv loading
import dotenv from 'dotenv';

const envFile = process.env.NODE_ENV === 'production' 
  ? '.env.production' 
  : '.env.development';

dotenv.config({ path: envFile });
```

### Environment Variable Precedence

1. System environment variables (highest priority)
2. `.env.local` file
3. `.env.{environment}` file  
4. `.env` file
5. Default values (lowest priority)

### Cloud Platform Configuration

#### Heroku
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set DATABASE_URL=postgres://...
```

#### Railway
Set environment variables in the Railway dashboard or `railway.json`:

```json
{
  "deploy": {
    "envVars": {
      "NODE_ENV": "production",
      "JWT_SECRET": "${{ secrets.JWT_SECRET }}"
    }
  }
}
```

#### Vercel
```bash
vercel env add JWT_SECRET
vercel env add DATABASE_URL
```

---

## Next Steps

After setting up your environment configuration:

1. [Database Setup](DATABASE_SETUP.md) - Initialize your database
2. [Development Guide](README.md#development) - Start developing
3. [API Documentation](openapi.yaml) - Explore the API
4. [Deployment Guide](README.md#deployment) - Deploy to production

For additional help, please refer to the [main documentation](README.md) or open an issue.
