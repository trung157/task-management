# TaskFlow Database - Entity Relationship Diagram (ERD)

## Overview
This document describes the complete Entity Relationship Diagram for the TaskFlow task management system database. The schema is designed for PostgreSQL with advanced features like full-text search, audit logging, and normalized tag management.

## Database Schema Version
- **Version**: 1.1
- **Database**: PostgreSQL 12+
- **Extensions Used**: uuid-ossp, pgcrypto, pg_trgm
- **Character Set**: UTF-8

---

## Core Entities

### 1. USERS (Primary Entity)
**Purpose**: Central user management and authentication

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique user identifier |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email address |
| `password_hash` | TEXT | NOT NULL | bcrypt hashed password |
| `first_name` | VARCHAR(100) | NOT NULL | User's first name |
| `last_name` | VARCHAR(100) | NOT NULL | User's last name |
| `display_name` | VARCHAR(200) | GENERATED ALWAYS AS (first_name \|\| ' ' \|\| last_name) STORED | Full display name |
| `avatar_url` | TEXT | | Profile picture URL |
| `bio` | TEXT | | User biography |
| `timezone` | VARCHAR(50) | DEFAULT 'UTC' | User's timezone |
| `date_format` | VARCHAR(20) | DEFAULT 'YYYY-MM-DD' | Preferred date format |
| `time_format` | VARCHAR(20) | DEFAULT '24h' | Preferred time format |
| `language_code` | VARCHAR(5) | DEFAULT 'en' | Language preference |
| `role` | user_role | DEFAULT 'user' | User role (user, admin, super_admin) |
| `status` | user_status | DEFAULT 'pending_verification' | Account status |
| `email_verified` | BOOLEAN | DEFAULT FALSE | Email verification status |
| `email_verified_at` | TIMESTAMPTZ | | Email verification timestamp |
| `password_changed_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last password change |
| `failed_login_attempts` | INTEGER | DEFAULT 0 | Failed login counter |
| `locked_until` | TIMESTAMPTZ | | Account lock expiration |
| `last_login_at` | TIMESTAMPTZ | | Last successful login |
| `last_login_ip` | INET | | Last login IP address |
| `preferences` | JSONB | DEFAULT '{}' | User preferences |
| `notification_settings` | JSONB | DEFAULT notification object | Notification preferences |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `deleted_at` | TIMESTAMPTZ | | Soft deletion timestamp |

**Indexes**:
- `idx_users_email` ON (email)
- `idx_users_status` ON (status)
- `idx_users_role` ON (role)
- `idx_users_created_at` ON (created_at)
- `idx_users_deleted_at` ON (deleted_at) WHERE deleted_at IS NOT NULL

**Constraints**:
- `check_email_format`: Email format validation
- `check_timezone`: Timezone not null
- `check_names_not_empty`: Names must not be empty

---

### 2. CATEGORIES (User-owned Entity)
**Purpose**: Task organization and categorization

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique category identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Category owner |
| `name` | VARCHAR(100) | NOT NULL | Category name |
| `description` | TEXT | | Category description |
| `color` | VARCHAR(7) | DEFAULT '#6366f1' | Hex color code |
| `icon` | VARCHAR(50) | DEFAULT 'folder' | Icon identifier |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `is_default` | BOOLEAN | DEFAULT FALSE | Default category flag |
| `task_count` | INTEGER | DEFAULT 0 | Task count (maintained by triggers) |
| `completed_task_count` | INTEGER | DEFAULT 0 | Completed task count |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `deleted_at` | TIMESTAMPTZ | | Soft deletion timestamp |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

**Indexes**:
- `idx_categories_user_id` ON (user_id)
- `idx_categories_name` ON (name)
- `idx_categories_deleted_at` ON (deleted_at) WHERE deleted_at IS NOT NULL
- `idx_categories_unique_default_per_user` UNIQUE ON (user_id) WHERE is_default = TRUE

**Constraints**:
- `unique_category_name_per_user`: UNIQUE (user_id, name)
- `check_color_format`: Hex color validation
- `check_name_not_empty`: Name must not be empty

---

### 3. TASKS (Primary Business Entity)
**Purpose**: Core task management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique task identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Task owner |
| `category_id` | UUID | REFERENCES categories(id) ON DELETE SET NULL | Task category |
| `title` | VARCHAR(255) | NOT NULL | Task title |
| `description` | TEXT | | Task description |
| `priority` | task_priority | DEFAULT 'none' | Task priority level |
| `status` | task_status | DEFAULT 'pending' | Task status |
| `due_date` | TIMESTAMPTZ | | Task due date |
| `reminder_date` | TIMESTAMPTZ | | Reminder date |
| `start_date` | TIMESTAMPTZ | | Task start date |
| `estimated_minutes` | INTEGER | | Estimated time in minutes |
| `actual_minutes` | INTEGER | | Actual time spent |
| `completed_at` | TIMESTAMPTZ | | Completion timestamp |
| `completed_by` | UUID | REFERENCES users(id) | User who completed task |
| `tags` | TEXT[] | DEFAULT '{}' | Tag names array (synced with normalized tags) |
| `sort_order` | INTEGER | DEFAULT 0 | Display order |
| `metadata` | JSONB | DEFAULT '{}' | Additional metadata |
| `search_vector` | TSVECTOR | | Full-text search vector |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last update time |
| `deleted_at` | TIMESTAMPTZ | | Soft deletion timestamp |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)
- `category_id` → `categories.id` (Many-to-One, Optional)
- `completed_by` → `users.id` (Many-to-One, Optional)

**Indexes**:
- `idx_tasks_user_id` ON (user_id)
- `idx_tasks_category_id` ON (category_id)
- `idx_tasks_status` ON (status)
- `idx_tasks_priority` ON (priority)
- `idx_tasks_due_date` ON (due_date)
- `idx_tasks_created_at` ON (created_at)
- `idx_tasks_deleted_at` ON (deleted_at) WHERE deleted_at IS NOT NULL
- `idx_tasks_search_vector` GIN ON (search_vector)
- `idx_tasks_tags` GIN ON (tags)

**Constraints**:
- `check_title_not_empty`: Title must not be empty
- `check_positive_minutes`: Minutes must be positive
- `check_due_date_future`: Due date must be in future
- `check_completed_status`: Completion consistency check

---

### 4. TAGS (Normalized Tag System)
**Purpose**: Normalized tag management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique tag identifier |
| `name` | VARCHAR(50) | NOT NULL | Tag name |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Tag owner |
| `color` | VARCHAR(7) | DEFAULT '#6366f1' | Hex color code |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation time |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

**Indexes**:
- `idx_tags_user_id` ON (user_id)
- `idx_tags_name` ON (name)

**Constraints**:
- `unique_tag_name_per_user`: UNIQUE (user_id, name)
- `check_tag_name_not_empty`: Name must not be empty
- `check_tag_color_format`: Hex color validation

---

### 5. TASK_TAGS (Junction Table)
**Purpose**: Many-to-Many relationship between tasks and tags

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Unique identifier |
| `task_id` | UUID | NOT NULL, REFERENCES tasks(id) ON DELETE CASCADE | Associated task |
| `tag_id` | UUID | NOT NULL, REFERENCES tags(id) ON DELETE CASCADE | Associated tag |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation time |

**Relationships**:
- `task_id` → `tasks.id` (Many-to-One)
- `tag_id` → `tags.id` (Many-to-One)

**Indexes**:
- `idx_task_tags_task_id` ON (task_id)
- `idx_task_tags_tag_id` ON (tag_id)

**Constraints**:
- `unique_task_tag`: UNIQUE (task_id, tag_id)

---

## Authentication & Security Entities

### 6. USER_SESSIONS
**Purpose**: JWT token and session management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY, DEFAULT uuid_generate_v4() | Session identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Session owner |
| `token_hash` | TEXT | NOT NULL, UNIQUE | Hashed refresh token |
| `device_info` | JSONB | | Device information |
| `ip_address` | INET | | Client IP address |
| `user_agent` | TEXT | | Browser/client info |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Session expiration |
| `last_used_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last activity |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Session start |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

---

### 7. PASSWORD_RESET_TOKENS
**Purpose**: Password reset token management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Token identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User requesting reset |
| `token_hash` | TEXT | NOT NULL, UNIQUE | Hashed reset token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Token expiration |
| `used_at` | TIMESTAMPTZ | | Token usage timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Token creation |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

---

### 8. EMAIL_VERIFICATION_TOKENS
**Purpose**: Email verification token management

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Token identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User verifying email |
| `email` | VARCHAR(255) | NOT NULL | Email being verified |
| `token_hash` | TEXT | NOT NULL, UNIQUE | Hashed verification token |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Token expiration |
| `verified_at` | TIMESTAMPTZ | | Verification timestamp |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Token creation |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

---

## Collaboration & Communication Entities

### 9. TASK_ASSIGNMENTS
**Purpose**: Task assignment for team collaboration

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Assignment identifier |
| `task_id` | UUID | NOT NULL, REFERENCES tasks(id) ON DELETE CASCADE | Assigned task |
| `assigned_to` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Assignee |
| `assigned_by` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Assigner |
| `assigned_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Assignment time |
| `due_date` | TIMESTAMPTZ | | Assignment due date |
| `completed_at` | TIMESTAMPTZ | | Assignment completion |
| `notes` | TEXT | | Assignment notes |

**Relationships**:
- `task_id` → `tasks.id` (Many-to-One)
- `assigned_to` → `users.id` (Many-to-One)
- `assigned_by` → `users.id` (Many-to-One)

**Constraints**:
- `unique_task_assignment`: UNIQUE (task_id, assigned_to)

---

### 10. TASK_COMMENTS
**Purpose**: Task comments and notes

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Comment identifier |
| `task_id` | UUID | NOT NULL, REFERENCES tasks(id) ON DELETE CASCADE | Associated task |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Comment author |
| `content` | TEXT | NOT NULL | Comment content |
| `is_internal` | BOOLEAN | DEFAULT FALSE | Internal vs public comment |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Comment creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last update |
| `deleted_at` | TIMESTAMPTZ | | Soft deletion |

**Relationships**:
- `task_id` → `tasks.id` (Many-to-One)
- `user_id` → `users.id` (Many-to-One)

---

### 11. NOTIFICATIONS
**Purpose**: User notification system

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Notification identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Notification recipient |
| `type` | notification_type | NOT NULL | Notification type |
| `title` | VARCHAR(255) | NOT NULL | Notification title |
| `message` | TEXT | NOT NULL | Notification message |
| `data` | JSONB | DEFAULT '{}' | Additional data |
| `read_at` | TIMESTAMPTZ | | Read timestamp |
| `action_url` | TEXT | | Action URL |
| `expires_at` | TIMESTAMPTZ | | Expiration time |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Creation time |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

---

## Audit & Logging Entities

### 12. AUDIT_LOGS
**Purpose**: Comprehensive audit trail

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Log entry identifier |
| `user_id` | UUID | REFERENCES users(id) ON DELETE SET NULL | User performing action |
| `table_name` | VARCHAR(100) | NOT NULL | Affected table |
| `record_id` | UUID | NOT NULL | Affected record ID |
| `action` | audit_action | NOT NULL | Action performed |
| `old_values` | JSONB | | Previous values |
| `new_values` | JSONB | | New values |
| `ip_address` | INET | | Client IP |
| `user_agent` | TEXT | | Client info |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Action timestamp |

**Relationships**:
- `user_id` → `users.id` (Many-to-One, Optional)

---

### 13. TASK_HISTORY
**Purpose**: Detailed task change history

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | History entry identifier |
| `task_id` | UUID | NOT NULL, REFERENCES tasks(id) ON DELETE CASCADE | Associated task |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | User making change |
| `action` | VARCHAR(50) | NOT NULL | Action description |
| `field_name` | VARCHAR(100) | | Changed field |
| `old_value` | TEXT | | Previous value |
| `new_value` | TEXT | | New value |
| `change_reason` | TEXT | | Reason for change |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Change timestamp |

**Relationships**:
- `task_id` → `tasks.id` (Many-to-One)
- `user_id` → `users.id` (Many-to-One)

---

## Analytics & Reporting Entity

### 14. USER_STATISTICS
**Purpose**: User activity and productivity metrics

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Statistics identifier |
| `user_id` | UUID | NOT NULL, REFERENCES users(id) ON DELETE CASCADE | Statistics owner |
| `date` | DATE | NOT NULL | Statistics date |
| `tasks_created` | INTEGER | DEFAULT 0 | Tasks created count |
| `tasks_completed` | INTEGER | DEFAULT 0 | Tasks completed count |
| `tasks_deleted` | INTEGER | DEFAULT 0 | Tasks deleted count |
| `total_estimated_minutes` | INTEGER | DEFAULT 0 | Total estimated time |
| `total_actual_minutes` | INTEGER | DEFAULT 0 | Total actual time |
| `completion_rate` | DECIMAL(5,2) | DEFAULT 0.00 | Completion percentage |
| `average_completion_time_minutes` | INTEGER | DEFAULT 0 | Average completion time |
| `login_count` | INTEGER | DEFAULT 0 | Daily login count |
| `session_duration_minutes` | INTEGER | DEFAULT 0 | Total session time |
| `created_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Record creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP | Last update |

**Relationships**:
- `user_id` → `users.id` (Many-to-One)

**Constraints**:
- `unique_user_date_stats`: UNIQUE (user_id, date)

---

## Custom Data Types (ENUMs)

### task_priority
```sql
CREATE TYPE task_priority AS ENUM ('high', 'medium', 'low', 'none');
```

### task_status
```sql
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'archived');
```

### user_role
```sql
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
```

### user_status
```sql
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
```

### audit_action
```sql
CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'view', 'login', 'logout');
```

### notification_type
```sql
CREATE TYPE notification_type AS ENUM ('due_date_reminder', 'task_assigned', 'task_completed', 'system_update');
```

---

## Key Database Features

### 1. Full-Text Search
- **Search Vector**: Tasks have `search_vector` TSVECTOR field
- **Automatic Updates**: Triggers maintain search vectors
- **GIN Index**: Optimized for fast text search
- **Multi-language**: Supports English text search

### 2. Soft Deletion
- **Deleted At**: Most entities have `deleted_at` timestamp
- **Filtered Indexes**: Indexes exclude deleted records
- **Data Recovery**: Soft-deleted data can be recovered

### 3. Audit Trail
- **Comprehensive Logging**: All changes tracked in audit_logs
- **Task History**: Detailed task change history
- **User Attribution**: All actions linked to users

### 4. Row-Level Security (RLS)
- **User Isolation**: Users can only access their own data
- **Policy-Based**: Declarative security policies
- **Multi-tenancy**: Supports multiple users securely

### 5. Normalized Tag System
- **Efficient Storage**: Tags stored once, referenced many times
- **Color Support**: Each tag has customizable color
- **Array Sync**: Tags array in tasks synced automatically
- **Search Integration**: Tags included in full-text search

### 6. Trigger System
- **Auto Timestamps**: Updated_at automatically maintained
- **Search Sync**: Search vectors updated automatically
- **Tag Sync**: Tag arrays synchronized with normalized data
- **Statistics**: Category counts maintained automatically
- **Audit Logging**: Changes logged automatically

### 7. Performance Optimization
- **Strategic Indexes**: Covering common query patterns
- **GIN Indexes**: For arrays and full-text search
- **Partial Indexes**: For soft-deleted and specific conditions
- **Query Optimization**: Views for common queries

---

## Entity Relationships Summary

```
USERS (1) ←→ (∞) CATEGORIES
USERS (1) ←→ (∞) TASKS
USERS (1) ←→ (∞) TAGS
CATEGORIES (1) ←→ (∞) TASKS
TASKS (∞) ←→ (∞) TAGS (via TASK_TAGS)
USERS (1) ←→ (∞) USER_SESSIONS
USERS (1) ←→ (∞) PASSWORD_RESET_TOKENS
USERS (1) ←→ (∞) EMAIL_VERIFICATION_TOKENS
TASKS (1) ←→ (∞) TASK_ASSIGNMENTS
TASKS (1) ←→ (∞) TASK_COMMENTS
TASKS (1) ←→ (∞) TASK_HISTORY
USERS (1) ←→ (∞) NOTIFICATIONS
USERS (1) ←→ (∞) AUDIT_LOGS
USERS (1) ←→ (∞) USER_STATISTICS
```

---

## Data Integrity Rules

1. **Referential Integrity**: All foreign keys properly constrained
2. **Business Logic**: Check constraints enforce business rules
3. **Data Validation**: Email formats, positive numbers, etc.
4. **Cascade Rules**: Proper CASCADE and SET NULL behaviors
5. **Unique Constraints**: Prevent duplicate data where needed
6. **Default Values**: Sensible defaults for all fields

This ERD represents a robust, scalable, and feature-rich task management database suitable for production use with proper normalization, security, and performance considerations.
