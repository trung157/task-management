# Environment Configuration Guide

This guide explains how to configure environment variables for the TaskFlow Backend API. The application uses environment variables for configuration to ensure security and flexibility across different environments.

## Quick Start

### 1. Copy Environment Template
```bash
cp .env.example .env
```

### 2. Interactive Setup (Recommended)
```bash
npm run env:setup
```

### 3. Validate Configuration
```bash
npm run env:validate
```

## Configuration Categories

### Database Configuration

Required for connecting to PostgreSQL database.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_HOST` | PostgreSQL host | `localhost` | Yes |
| `DB_PORT` | PostgreSQL port | `5432` | Yes |
| `DB_NAME` | Database name | `task_management_db` | Yes |
| `DB_USER` | Database username | `postgres` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DATABASE_URL` | Full database connection URL | - | Alternative to individual params |

**Connection Pool Settings:**
| Variable | Description | Default |
|----------|-------------|---------|
| `DB_POOL_MIN` | Minimum pool connections | `2` |
| `DB_POOL_MAX` | Maximum pool connections | `20` |
| `DB_IDLE_TIMEOUT` | Connection idle timeout (ms) | `30000` |
| `DB_CONNECTION_TIMEOUT` | Connection timeout (ms) | `60000` |

#### Example Database Configuration

**Individual Parameters:**
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=your_secure_password
```

**Using DATABASE_URL (Heroku/Railway style):**
```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

### Server Configuration

Controls server behavior and API settings.

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment (development/production/test) | `development` | No |
| `PORT` | Server port | `5000` | No |
| `HOST` | Server host | `localhost` | No |
| `API_VERSION` | API version prefix | `v1` | No |
| `API_PREFIX` | API path prefix | `/api` | No |

### Security Configuration

Critical security settings for authentication and data protection.

| Variable | Description | Required | Generation |
|----------|-------------|----------|------------|
| `JWT_SECRET` | JWT signing secret | Yes (Production) | `npm run env:generate` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Yes (Production) | `npm run env:generate` |
| `SESSION_SECRET` | Session signing secret | Yes (Production) | `npm run env:generate` |
| `JWT_EXPIRES_IN` | Access token expiry | No | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | No | Default: `7d` |

**Password Security:**
| Variable | Description | Default |
|----------|-------------|---------|
| `BCRYPT_ROUNDS` | bcrypt hash rounds | `12` |
| `MIN_PASSWORD_LENGTH` | Minimum password length | `8` |

#### Security Best Practices

1. **Generate Strong Secrets:**
   ```bash
   npm run env:generate
   ```

2. **Production Requirements:**
   - JWT secrets must be at least 32 characters
   - Never use default/placeholder values
   - Use different secrets for access and refresh tokens

3. **Secret Generation Example:**
   ```bash
   # Generate cryptographically secure secrets
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
   node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
   ```

### CORS & Client Configuration

Controls cross-origin resource sharing and client connectivity.

| Variable | Description | Default |
|----------|-------------|---------|
| `FRONTEND_URL` | Primary frontend URL | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | Comma-separated allowed origins | Multiple localhost URLs |

**Example:**
```bash
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://yourdomain.com
```

### Rate Limiting

Controls API request rate limiting.

| Variable | Description | Default |
|----------|-------------|---------|
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `100` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | Auth endpoint window (ms) | `300000` (5 min) |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | Max auth requests per window | `5` |

### Email Configuration (Optional)

Email service configuration for notifications and password resets.

| Variable | Description | Default |
|----------|-------------|---------|
| `EMAIL_ENABLED` | Enable email features | `false` |
| `EMAIL_SERVICE` | Email service type | `smtp` |
| `EMAIL_HOST` | SMTP host | `smtp.gmail.com` |
| `EMAIL_PORT` | SMTP port | `587` |
| `EMAIL_SECURE` | Use SSL/TLS | `false` |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASSWORD` | SMTP password/app password | - |
| `EMAIL_FROM_NAME` | Sender name | `TaskFlow` |
| `EMAIL_FROM_ADDRESS` | Sender email | `noreply@taskflow.com` |

## Configuration Tools

### Environment Setup Script

The backend includes a comprehensive environment setup tool:

```bash
# Interactive setup (recommended for first-time setup)
npm run env:setup

# Validate current configuration
npm run env:validate

# Generate secure secrets
npm run env:generate

# Check environment health
npm run env:health
```

## Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_dev
DB_USER=postgres
DB_PASSWORD=dev_password
JWT_SECRET=dev-jwt-secret-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
SESSION_SECRET=dev-session-secret-change-in-production
EMAIL_ENABLED=false
DEV_MOCK_EMAIL=true
LOG_LEVEL=debug
```

### Production Environment

```bash
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@host:port/db
JWT_SECRET=your-super-secure-64-char-secret-generated-with-crypto
JWT_REFRESH_SECRET=your-different-super-secure-64-char-refresh-secret
SESSION_SECRET=your-secure-32-char-session-secret
EMAIL_ENABLED=true
EMAIL_HOST=smtp.sendgrid.net
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
TRUST_PROXY=true
FORCE_HTTPS=true
SECURE_COOKIES=true
LOG_LEVEL=info
```

## Security Checklist

### Pre-Production Checklist

- [ ] Strong JWT secrets (64+ characters)
- [ ] Unique secrets for access and refresh tokens
- [ ] Database password is secure
- [ ] `NODE_ENV=production`
- [ ] `TRUST_PROXY=true` (if behind reverse proxy)
- [ ] `FORCE_HTTPS=true` (for HTTPS deployments)
- [ ] `SECURE_COOKIES=true`
- [ ] No default/placeholder values
- [ ] Sensitive variables not logged
- [ ] Email credentials secured
- [ ] CORS origins properly configured

### Security Best Practices

1. **Secret Management:**
   - Use environment variables, never hardcode
   - Rotate secrets regularly
   - Use different secrets per environment
   - Store secrets securely (AWS Secrets Manager, Azure Key Vault, etc.)

2. **Database Security:**
   - Use strong database passwords
   - Enable SSL for production databases
   - Limit database user permissions
   - Use connection pooling with reasonable limits

## Common Issues & Troubleshooting

### Database Connection Issues

1. **Connection Refused:**
   ```bash
   # Check if PostgreSQL is running
   systemctl status postgresql  # Linux
   brew services list | grep postgresql  # macOS
   
   # Check connection parameters
   npm run env:validate
   ```

2. **Authentication Failed:**
   - Verify `DB_USER` and `DB_PASSWORD`
   - Check PostgreSQL user permissions
   - Ensure database exists

### JWT Configuration Issues

1. **Token Verification Failures:**
   - Ensure `JWT_SECRET` is consistent across restarts
   - Check secret length (minimum 32 chars in production)
   - Verify no leading/trailing whitespace

2. **Production Security Warnings:**
   ```bash
   # Generate strong secrets
   npm run env:generate
   ```

---

For additional help or questions about environment configuration, please refer to the [main README](./README.md) or open an issue in the project repository.
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000
DB_SSL=false
```

### JWT Configuration
```env
# JWT Secrets (REQUIRED in production)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Security Settings
```env
# Password & Session Security
BCRYPT_ROUNDS=12
MIN_PASSWORD_LENGTH=8
SESSION_SECRET=your-session-secret-here

# Security Headers
HELMET_CSP_ENABLED=true
```

### Rate Limiting
```env
# General rate limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MESSAGE=Too many requests from this IP, please try again later

# Authentication rate limiting (stricter)
AUTH_RATE_LIMIT_WINDOW_MS=300000
AUTH_RATE_LIMIT_MAX_REQUESTS=5
```

### Email Configuration (Optional)
```env
# Email service (set EMAIL_ENABLED=true to enable)
EMAIL_ENABLED=false
EMAIL_SERVICE=smtp
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM_ADDRESS=noreply@taskflow.com
EMAIL_FROM_NAME=TaskFlow
EMAIL_TEMPLATE_DIR=./templates/emails
```

### File Upload Configuration
```env
# File uploads
UPLOAD_ENABLED=true
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
MAX_FILES_PER_REQUEST=5
```

### Logging Configuration
```env
# Logging
LOG_LEVEL=info
LOG_FORMAT=combined
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=5
```

### Health Check Settings
```env
# Health monitoring
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_DATABASE=true
HEALTH_CHECK_EMAIL=false
```

### Development Settings
```env
# Development features
DEV_SEED_DATABASE=false
DEV_RESET_DATABASE=false
DEV_MOCK_EMAIL=true
```

## Configuration Validation

The application validates configuration on startup:

1. **Required in Production:**
   - `JWT_SECRET` - Must not be default value
   - `JWT_REFRESH_SECRET` - Must not be default value
   - `SESSION_SECRET` - Must not be default value
   - `DB_PASSWORD` or `DATABASE_URL` - Database access required

2. **Conditional Requirements:**
   - If `EMAIL_ENABLED=true`, then `EMAIL_USER` and `EMAIL_PASSWORD` are required

## Security Best Practices

1. **Production Secrets:**
   - Generate strong, unique secrets for JWT and session tokens
   - Use environment-specific `.env` files
   - Never commit secrets to version control

2. **Database Security:**
   - Use SSL in production (`DB_SSL=true`)
   - Limit database connection pool size appropriately
   - Use database user with minimal required permissions

3. **Rate Limiting:**
   - Adjust rate limits based on expected traffic
   - Use stricter limits for authentication endpoints
   - Consider using Redis for distributed rate limiting

4. **CORS Configuration:**
   - Specify exact frontend origins in production
   - Avoid using wildcards (`*`) in production

## Environment-Specific Examples

### Development (.env)
```env
NODE_ENV=development
PORT=5000
DB_PASSWORD=dev_password
JWT_SECRET=dev-jwt-secret
EMAIL_ENABLED=false
DEV_MOCK_EMAIL=true
```

### Production (.env.production)
```env
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://user:pass@prod-db:5432/taskflow
JWT_SECRET=complex-production-jwt-secret-here
JWT_REFRESH_SECRET=complex-production-refresh-secret-here
SESSION_SECRET=complex-production-session-secret-here
EMAIL_ENABLED=true
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=your-production-email-password
ALLOWED_ORIGINS=https://yourdomain.com
FORCE_HTTPS=true
SECURE_COOKIES=true
DB_SSL=true
```

## Testing Configuration

Use the validation script to test your configuration:

```bash
node validate-config.js
```

This will:
- Verify all environment variables are loaded correctly
- Show configuration summary
- Warn about missing production secrets
- Validate required dependencies
