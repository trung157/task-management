# Database Migration System

This document describes the database migration system for the TaskFlow application.

## Overview

The migration system provides a robust way to manage database schema changes and ensure consistency across different environments (development, staging, production).

## Migration Files

Migration files are located in the `migrations/` directory and follow a specific naming convention:

```
001_create_users_table.sql
002_create_categories_table.sql
003_create_tasks_table.sql
004_create_refresh_tokens_table.sql
005_create_category_update_triggers.sql
```

### Naming Convention

- Files must start with a 3-digit number (e.g., `001`, `002`, `003`)
- Followed by an underscore `_`
- Then a descriptive name
- Must end with `.sql`

Example: `001_create_users_table.sql`

## Available Migration Commands

### Run All Pending Migrations

```bash
npm run db:migrate:files
```

Executes all migration files that haven't been run yet, in order.

### Check Migration Status

```bash
npm run db:migrate:status
```

Shows the status of all migration files (executed or pending).

### Validate Migration Consistency

```bash
npm run db:migrate:validate
```

Validates that previously executed migrations haven't been modified.

### Validate Database Schema

```bash
npm run db:validate
```

Comprehensive validation of the entire database schema including:
- Table structure
- Indexes
- Foreign keys
- Constraints
- ENUM types
- Extensions
- Basic CRUD operations

## Migration Files Description

### 001_create_users_table.sql

Creates the `users` table with:
- User authentication (email, password hash)
- Profile information (first_name, last_name, avatar, bio)
- Account management (role, status, verification)
- Security features (failed attempts, account locking)
- User preferences and notification settings
- Audit fields (created_at, updated_at, deleted_at)

**Key Features:**
- UUID primary keys
- Email validation constraints
- Automatic display_name generation
- Comprehensive indexing for performance
- Trigger for automatic `updated_at` updates

### 002_create_categories_table.sql

Creates the `categories` table for task organization:
- User-specific categories
- Color coding and icons
- Sort ordering
- Task count statistics (maintained by triggers)
- Soft delete support

**Key Features:**
- Foreign key relationship to users
- Unique category names per user
- Automatic task count maintenance
- Color validation (hex format)

### 003_create_tasks_table.sql

Creates the `tasks` table with advanced features:
- Core task information (title, description, priority, status)
- Scheduling (due dates, reminders, start dates)
- Time tracking (estimated and actual minutes)
- Organization (tags, categories, sort order)
- Full-text search capabilities
- Flexible metadata storage

**Key Features:**
- Comprehensive indexing for performance
- Full-text search with automatic vector updates
- Tag array support with GIN indexing
- Complex constraints for data integrity
- Optimized queries for common use cases

### 004_create_refresh_tokens_table.sql

Creates the `refresh_tokens` table for JWT authentication:
- Secure token storage
- Device and session tracking
- Token expiration and revocation
- IP address logging

**Key Features:**
- Automatic cleanup of expired tokens
- Device information tracking
- Revocation support for security

### 005_create_category_update_triggers.sql

Creates triggers and functions for:
- Automatic task count updates in categories
- Search vector maintenance for tasks
- Data consistency enforcement

## Migration Tracking

The system uses a `schema_migrations` table to track executed migrations:

```sql
CREATE TABLE schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    checksum VARCHAR(64),
    execution_time_ms INTEGER
);
```

### Features:
- **Filename tracking**: Prevents duplicate execution
- **Checksum validation**: Detects modifications to executed migrations
- **Execution time**: Performance monitoring
- **Timestamp tracking**: Audit trail

## Safety Features

### Transaction Safety
- Each migration runs in a transaction
- Automatic rollback on errors
- All-or-nothing execution

### Validation
- Pre-execution validation of file format
- Post-execution schema validation
- Checksum verification for consistency

### Error Handling
- Detailed error reporting
- Graceful failure handling
- Comprehensive logging

## Best Practices

### Creating New Migrations

1. **Use sequential numbering**: Always increment the number from the last migration
2. **Descriptive names**: Use clear, descriptive names for migration files
3. **Idempotent operations**: Use `IF NOT EXISTS` and similar constructs
4. **Test thoroughly**: Test migrations on a copy of production data

### Example Migration Template

```sql
-- =====================================================
-- Migration: 006_add_user_preferences
-- Created: YYYY-MM-DD
-- Description: Add user preferences table
-- =====================================================

-- Create the table
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(100) NOT NULL,
    preference_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_user_preference UNIQUE (user_id, preference_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);

-- Add comments
COMMENT ON TABLE user_preferences IS 'User-specific preference settings';
```

### Migration Guidelines

1. **Always use transactions**: Wrap complex migrations in explicit transactions
2. **Create indexes concurrently**: For large tables, use `CREATE INDEX CONCURRENTLY`
3. **Test data migration**: Include data migration scripts when needed
4. **Document changes**: Include clear comments and descriptions
5. **Backup first**: Always backup production data before running migrations

## Troubleshooting

### Common Issues

#### Migration Already Executed
If you see "already executed" messages, check the migration status:
```bash
npm run db:migrate:status
```

#### Schema Validation Errors
Run the schema validator to identify issues:
```bash
npm run db:validate
```

#### Migration Failed
Check the logs for specific error messages. Common causes:
- Syntax errors in SQL
- Constraint violations
- Missing dependencies
- Permission issues

### Recovery

If a migration fails:

1. Check the error message in the logs
2. Fix the issue in the migration file
3. If the migration was partially executed, you may need to manually clean up
4. Re-run the migration

### Manual Migration Recovery

In extreme cases, you can manually mark a migration as executed:

```sql
INSERT INTO schema_migrations (filename, checksum, execution_time_ms)
VALUES ('problematic_migration.sql', 'checksum_here', 0);
```

## Performance Considerations

### Large Table Migrations

For large tables (>1M rows):
- Use `CREATE INDEX CONCURRENTLY` instead of `CREATE INDEX`
- Consider batching data updates
- Monitor disk space during migrations
- Plan for longer execution times

### Production Migrations

- Run during low-traffic periods
- Test on staging environment first
- Have a rollback plan
- Monitor application performance post-migration

## Environment-Specific Configurations

### Development
```bash
# Quick setup for development
npm run db:migrate:files
npm run db:validate
```

### Staging/Production
```bash
# Check status first
npm run db:migrate:status

# Validate before migration
npm run db:migrate:validate

# Run migrations
npm run db:migrate:files

# Validate after migration
npm run db:validate
```

## Integration with CI/CD

The migration system can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Database Migrations
  run: |
    npm run db:migrate:status
    npm run db:migrate:files
    npm run db:validate
```

## Security Considerations

- Migration files should be version controlled
- Use environment variables for sensitive data
- Restrict access to migration commands in production
- Regular backups before major migrations
- Audit trail through migration tracking table

## Monitoring and Alerting

- Monitor migration execution times
- Alert on migration failures
- Track schema changes through migration logs
- Regular validation of schema integrity

---

For more information, see the individual migration files and the validation scripts in `src/scripts/`.
