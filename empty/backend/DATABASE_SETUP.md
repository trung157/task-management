# PostgreSQL Database Setup Guide

This guide will help you set up PostgreSQL for the TaskFlow backend API.

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js 18+ and npm
- Environment variables configured (see [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md))

## Quick Setup

### Option 1: Automated Setup (Recommended)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run automated database setup
npm run db:setup
```

This will:
- Create the database if it doesn't exist
- Initialize the schema with all tables, indexes, and triggers
- Create default admin user and categories
- Verify the setup with connection tests

### Option 2: Manual Setup

```bash
# 1. Create database manually
createdb task_management_db

# 2. Initialize schema
npm run db:init

# 3. Test connection
npm run db:test
```

## Database Configuration

### Connection Settings

Configure your database connection in `.env`:

```env
# Individual connection parameters
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=your_password_here

# OR use a connection string
DATABASE_URL=postgresql://username:password@hostname:port/database_name
```

### Connection Pool Settings

```env
# Pool configuration
DB_POOL_MIN=2          # Minimum connections
DB_POOL_MAX=20         # Maximum connections
DB_IDLE_TIMEOUT=30000  # Idle timeout (ms)
DB_CONNECTION_TIMEOUT=60000  # Connection timeout (ms)
DB_SSL=false           # Enable SSL (true for production)
```

## Database Schema

The database includes the following main tables:

- **users** - User accounts with authentication
- **tasks** - Task management with priorities, statuses, and categories
- **categories** - Task categorization with colors
- **tags** - Flexible tagging system
- **task_tags** - Many-to-many relationship between tasks and tags
- **user_sessions** - Session management
- **audit_logs** - Activity tracking

### Schema Features

- ✅ **Foreign Key Constraints** - Data integrity
- ✅ **Indexes** - Optimized queries
- ✅ **Triggers** - Automatic timestamp updates
- ✅ **Enums** - Type safety for statuses and priorities
- ✅ **Row Level Security** - User data isolation
- ✅ **Soft Deletes** - Data recovery capabilities

## Database Commands

### Setup Commands

```bash
# Complete database setup (creates DB + schema)
npm run db:setup

# Test database connection
npm run db:test

# Initialize schema only (database must exist)
npm run db:init

# Reset database (drops and recreates all tables)
npm run db:reset
```

### Data Management

```bash
# Seed with sample data
npm run db:seed

# Run migrations (schema updates)
npm run db:migrate
```

### Development Commands

```bash
# Start development server (with database connection)
npm run dev

# Build and validate (includes type checking)
npm run build
npm run validate
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```
   Error: connect ECONNREFUSED 127.0.0.1:5432
   ```
   - **Solution**: Ensure PostgreSQL is running
   - **Check**: `pg_ctl status` or `systemctl status postgresql`

2. **Authentication Failed**
   ```
   Error: password authentication failed for user "postgres"
   ```
   - **Solution**: Check DB_USER and DB_PASSWORD in .env
   - **Alternative**: Use peer authentication for local development

3. **Database Does Not Exist**
   ```
   Error: database "task_management_db" does not exist
   ```
   - **Solution**: Run `npm run db:setup` to create it automatically
   - **Manual**: `createdb task_management_db`

4. **Permission Denied**
   ```
   Error: permission denied to create database
   ```
   - **Solution**: Use a user with CREATEDB privileges
   - **Grant permissions**: `ALTER USER postgres CREATEDB;`

### Checking Database Status

```bash
# Test connection and display config
npm run db:test

# Check health endpoint
curl http://localhost:5000/api/health

# View database logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Reset Everything

If you need to start fresh:

```bash
# Drop database
dropdb task_management_db

# Recreate everything
npm run db:setup
```

## Production Considerations

### Security

```env
# Enable SSL in production
DB_SSL=true

# Use connection string with SSL parameters
DATABASE_URL=postgresql://user:pass@hostname:5432/dbname?sslmode=require
```

### Performance

```env
# Increase pool size for production
DB_POOL_MIN=5
DB_POOL_MAX=50

# Tune timeouts
DB_IDLE_TIMEOUT=10000
DB_CONNECTION_TIMEOUT=5000
```

### Monitoring

- Enable health checks: `HEALTH_CHECK_DATABASE=true`
- Monitor connection pool metrics via `/api/health`
- Set up database connection alerts
- Regular backup procedures

### Backup Strategy

```bash
# Create backup
pg_dump task_management_db > backup.sql

# Restore backup
psql task_management_db < backup.sql

# Automated daily backups (cron job)
0 2 * * * pg_dump task_management_db > /backups/taskflow_$(date +\%Y\%m\%d).sql
```

## Environment-Specific Setups

### Development

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_dev
DB_USER=postgres
DB_PASSWORD=dev_password
DB_SSL=false
```

### Testing

```env
NODE_ENV=test
DB_NAME=task_management_test
# Use separate test database
```

### Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-host:5432/task_management_prod?sslmode=require
DB_SSL=true
DB_POOL_MIN=5
DB_POOL_MAX=50
```

## Integration with Application

The database connection is automatically established when the server starts:

1. Configuration is loaded from environment variables
2. Connection pool is created with proper settings
3. Health checks verify connectivity
4. Graceful shutdown handles cleanup

```typescript
// Connection is available throughout the app
import pool from './db';

// Example usage
const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1', [userId]);
```
