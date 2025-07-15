# TaskFlow Backend API

A comprehensive Node.js/TypeScript backend API for the TaskFlow task management application, built with Express.js and PostgreSQL.

## Features

- ✅ **Complete CRUD Operations** for tasks, categories, and tags
- ✅ **Advanced Filtering & Search** with pagination
- ✅ **PostgreSQL Database** with comprehensive schema
- ✅ **User Management** with role-based access control
- ✅ **Data Validation** with custom validation functions
- ✅ **Soft Delete** support for data recovery
- ✅ **Task Statistics** and analytics endpoints
- ✅ **Recurring Tasks** support
- ✅ **Tag Management** system
- ✅ **Category Organization** with color coding
- ✅ **Audit Logging** for security and compliance
- ✅ **Database Triggers** for automatic timestamp updates
- ✅ **Connection Pooling** for optimal performance

## Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

**Quick Setup (Recommended):**
```bash
# Interactive environment setup
npm run env:setup
```

**Manual Setup:**
```bash
# Copy environment template
cp .env.example .env

# Generate secure secrets
npm run env:generate

# Edit .env with your configuration
# Add the generated secrets and database credentials

# Validate configuration
npm run env:validate
```

**Required Environment Variables:**
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Security (use npm run env:generate to create these)
JWT_SECRET=cryptographically_secure_secret_64_chars_minimum
JWT_REFRESH_SECRET=different_secure_secret_for_refresh_tokens
SESSION_SECRET=secure_session_secret_32_chars_min

# Server
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

📖 **Detailed Configuration Guide:** See [ENVIRONMENT_SETUP_GUIDE.md](./ENVIRONMENT_SETUP_GUIDE.md) for comprehensive setup instructions and best practices.

### 3. Database Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE task_management_db;
```
DB_PORT=5432
DB_NAME=task_management_db
DB_USER=postgres
DB_PASSWORD=your_password
```

### 3. Initialize Database Schema

```bash
# Initialize the database with schema and default data
npm run db:init
```

This will:
- Create all tables with proper relationships
- Set up database triggers and functions
- Create enum types for priorities, statuses, etc.
- Insert default admin user and categories
- Set up Row Level Security (RLS) policies

### 4. Configuration Validation

Verify your configuration is correct:

```bash
node validate-config.js
```

This will show a summary of your configuration and warn about any issues.

### 5. Start Development Server

```bash
npm run dev
```

The API server will start on `http://localhost:5000`

## Configuration

For detailed information about all available environment variables and configuration options, see [ENVIRONMENT_CONFIG.md](./ENVIRONMENT_CONFIG.md).

Key configuration areas:
- **Database**: Connection settings, pooling, SSL
- **Authentication**: JWT secrets, session management
- **Security**: Rate limiting, password hashing, CORS
- **Email**: SMTP settings for notifications (optional)
- **File Uploads**: File size limits, allowed types
- **Logging**: Log levels, file rotation

## API Endpoints

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks with filtering |
| GET | `/api/tasks/stats` | Get task statistics |
| GET | `/api/tasks/:id` | Get single task by ID |
| POST | `/api/tasks` | Create new task |
| PUT | `/api/tasks/:id` | Update task |
| PATCH | `/api/tasks/:id/toggle` | Toggle task completion |
| DELETE | `/api/tasks/:id` | Delete task (soft delete) |

### Query Parameters for GET /api/tasks

- `status` - Filter by status: pending, in_progress, completed, archived
- `priority` - Filter by priority: high, medium, low, none
- `category_id` - Filter by category UUID
- `search` - Search in title and description
- `completed` - Filter by completion status (true/false)
- `due_date_from` - Filter tasks due after this date
- `due_date_to` - Filter tasks due before this date
- `tags` - Filter by tag names
- `limit` - Number of results per page (default: 50)
- `offset` - Number of results to skip (default: 0)
- `sort_by` - Sort field: created_at, updated_at, due_date, priority, title
- `sort_order` - Sort direction: asc, desc

### Example Requests

#### Create a Task
```bash
curl -X POST http://localhost:5000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete project documentation",
    "description": "Write comprehensive API documentation",
    "priority": "high",
    "due_date": "2025-01-15T18:00:00Z",
    "tags": ["documentation", "project"],
    "estimated_duration": 120
  }'
```

#### Get Tasks with Filtering
```bash
curl "http://localhost:5000/api/tasks?status=pending&priority=high&limit=10"
```

#### Update a Task
```bash
curl -X PUT http://localhost:5000/api/tasks/task-uuid-here \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "completion_percentage": 100,
    "actual_duration": 90
  }'
```

## Database Schema

The database includes comprehensive tables for:

- **Users** - User accounts with roles and preferences
- **Tasks** - Core task data with rich metadata
- **Categories** - Task categorization with color coding
- **Tags** - Flexible tagging system
- **Task Dependencies** - Task relationships and dependencies
- **Audit Logs** - Complete activity tracking
- **Notifications** - User notification system
- **User Sessions** - Session management

### Key Features

- **UUID Primary Keys** for better security and distribution
- **Soft Delete** with `deleted_at` timestamps
- **Automatic Timestamps** via database triggers
- **Data Validation** through CHECK constraints
- **Row Level Security** for multi-tenant support
- **Full Text Search** capabilities
- **JSON Fields** for flexible metadata storage

## Development Commands

### Environment & Configuration
```bash
# Interactive environment setup
npm run env:setup

# Validate current configuration
npm run env:validate

# Generate secure secrets
npm run env:generate

# Check environment health
npm run env:health
```

### Application Commands
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Database Commands
```bash
# Initialize database schema
npm run db:init

# Reset database (WARNING: Deletes all data)
npm run db:reset

# Test database connection
npm run db:test
```

### Testing & Quality
```bash
# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Full validation (type-check + lint + test)
npm run validate
```

## Database Management

### Reset Database
```bash
npm run db:reset
```
⚠️ **Warning**: This will delete all data and recreate the schema.

### Default Admin User
- Email: `admin@taskflow.com`
- Password: `admin123`
- Role: `super_admin`

### Default Categories
The system creates 6 default categories:
- Work (Blue)
- Personal (Green)
- Shopping (Yellow)
- Health (Red)
- Learning (Purple)
- Home (Cyan)

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request** - Validation errors
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **422 Unprocessable Entity** - Business logic errors
- **500 Internal Server Error** - Server errors

## Security Features

- Input validation and sanitization
- SQL injection prevention via parameterized queries
- Rate limiting support
- CORS configuration
- Helmet.js security headers
- Password hashing with bcrypt
- JWT token authentication (ready for implementation)

## Performance Optimizations

- Database connection pooling
- Indexed queries for fast searches
- Pagination for large datasets
- Efficient JOIN queries
- Database-level constraints and triggers

## Future Enhancements

- [ ] JWT Authentication middleware
- [ ] Real-time notifications with WebSockets
- [ ] File attachment handling
- [ ] Email notifications
- [ ] API rate limiting
- [ ] Comprehensive unit tests
- [ ] API documentation with Swagger
- [ ] Docker containerization
- [ ] CI/CD pipeline setup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the ISC License.
