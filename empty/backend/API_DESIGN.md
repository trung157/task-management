# TaskFlow REST API Documentation

## Overview
Comprehensive RESTful API for TaskFlow task management system with authentication, CRUD operations, advanced filtering, search, and real-time features.

**Base URL**: `https://api.taskflow.com/v1`  
**API Version**: 1.0  
**Content-Type**: `application/json`  
**Authentication**: JWT Bearer Token  

---

## 🔐 Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "first_name": "John",
  "last_name": "Doe",
  "timezone": "America/New_York",
  "language_code": "en"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "User registered successfully. Please verify your email.",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "display_name": "John Doe",
      "status": "pending_verification",
      "created_at": "2025-07-11T10:30:00Z"
    }
  }
}
```

### POST /auth/login
Authenticate user and receive access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "remember_me": true
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "550e8400-e29b-41d4-a716-446655440000",
    "expires_in": 3600,
    "token_type": "Bearer",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "display_name": "John Doe",
      "role": "user",
      "status": "active",
      "avatar_url": null,
      "preferences": {},
      "notification_settings": {
        "email_notifications": true,
        "push_notifications": true
      }
    }
  }
}
```

### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_in": 3600,
    "token_type": "Bearer"
  }
}
```

### POST /auth/logout
Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### POST /auth/forgot-password
Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent if account exists"
}
```

### POST /auth/reset-password
Reset password using token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "new_password": "newSecurePassword123"
}
```

### POST /auth/verify-email
Verify email address.

**Request Body:**
```json
{
  "token": "verification-token-here"
}
```

---

## 👤 User Management Endpoints

### GET /users/profile
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "display_name": "John Doe",
    "avatar_url": "https://cdn.taskflow.com/avatars/user.jpg",
    "bio": "Product Manager passionate about productivity",
    "timezone": "America/New_York",
    "date_format": "YYYY-MM-DD",
    "time_format": "24h",
    "language_code": "en",
    "role": "user",
    "status": "active",
    "email_verified": true,
    "preferences": {
      "theme": "dark",
      "default_priority": "medium"
    },
    "notification_settings": {
      "email_notifications": true,
      "push_notifications": true,
      "due_date_reminders": true,
      "task_assignments": true
    },
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-07-11T10:30:00Z"
  }
}
```

### PUT /users/profile
Update current user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "bio": "Updated bio",
  "timezone": "America/Los_Angeles",
  "preferences": {
    "theme": "light",
    "default_priority": "high"
  },
  "notification_settings": {
    "email_notifications": false,
    "push_notifications": true
  }
}
```

### POST /users/change-password
Change user password.

**Request Body:**
```json
{
  "current_password": "currentPassword123",
  "new_password": "newPassword123"
}
```

### POST /users/upload-avatar
Upload user avatar.

**Content-Type:** `multipart/form-data`

**Form Data:**
- `avatar`: Image file (max 5MB, jpg/png)

---

## 📋 Task Management Endpoints

### GET /tasks
Get user's tasks with filtering and pagination.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (int, default: 1): Page number
- `limit` (int, default: 20, max: 100): Items per page
- `status` (string): Filter by status (pending, in_progress, completed, archived)
- `priority` (string): Filter by priority (high, medium, low, none)
- `category_id` (UUID): Filter by category
- `tags` (string): Comma-separated tag names
- `due_date_from` (ISO date): Tasks due after date
- `due_date_to` (ISO date): Tasks due before date
- `search` (string): Full-text search in title/description
- `sort` (string): Sort field (created_at, updated_at, due_date, title, priority)
- `order` (string): Sort order (asc, desc)
- `include_completed` (boolean, default: false): Include completed tasks
- `overdue_only` (boolean): Only overdue tasks

**Example Request:**
```
GET /tasks?status=pending&priority=high&page=1&limit=20&sort=due_date&order=asc
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-uuid-1",
        "title": "Complete API documentation",
        "description": "Write comprehensive API docs for task management",
        "status": "pending",
        "priority": "high",
        "due_date": "2025-07-15T17:00:00Z",
        "reminder_date": "2025-07-15T09:00:00Z",
        "start_date": "2025-07-11T09:00:00Z",
        "estimated_minutes": 120,
        "actual_minutes": null,
        "tags": ["documentation", "api"],
        "category": {
          "id": "cat-uuid-1",
          "name": "Work",
          "color": "#3B82F6",
          "icon": "briefcase"
        },
        "metadata": {
          "complexity": "medium",
          "external_id": "PROJ-123"
        },
        "created_at": "2025-07-11T10:30:00Z",
        "updated_at": "2025-07-11T11:45:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 45,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    },
    "filters_applied": {
      "status": "pending",
      "priority": "high"
    },
    "summary": {
      "total_tasks": 45,
      "pending": 25,
      "in_progress": 8,
      "completed": 12,
      "overdue": 3
    }
  }
}
```

### POST /tasks
Create a new task.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Complete API documentation",
  "description": "Write comprehensive API docs for task management system",
  "priority": "high",
  "status": "pending",
  "category_id": "cat-uuid-1",
  "due_date": "2025-07-15T17:00:00Z",
  "reminder_date": "2025-07-15T09:00:00Z",
  "start_date": "2025-07-11T09:00:00Z",
  "estimated_minutes": 120,
  "tags": ["documentation", "api"],
  "metadata": {
    "complexity": "medium",
    "external_id": "PROJ-123"
  }
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "task-uuid-1",
    "title": "Complete API documentation",
    "description": "Write comprehensive API docs for task management system",
    "status": "pending",
    "priority": "high",
    "due_date": "2025-07-15T17:00:00Z",
    "reminder_date": "2025-07-15T09:00:00Z",
    "start_date": "2025-07-11T09:00:00Z",
    "estimated_minutes": 120,
    "actual_minutes": null,
    "tags": ["documentation", "api"],
    "category": {
      "id": "cat-uuid-1",
      "name": "Work",
      "color": "#3B82F6",
      "icon": "briefcase"
    },
    "metadata": {
      "complexity": "medium",
      "external_id": "PROJ-123"
    },
    "created_at": "2025-07-11T10:30:00Z",
    "updated_at": "2025-07-11T10:30:00Z"
  }
}
```

### GET /tasks/{id}
Get a specific task by ID.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "task-uuid-1",
    "title": "Complete API documentation",
    "description": "Write comprehensive API docs",
    "status": "in_progress",
    "priority": "high",
    "due_date": "2025-07-15T17:00:00Z",
    "reminder_date": "2025-07-15T09:00:00Z",
    "start_date": "2025-07-11T09:00:00Z",
    "estimated_minutes": 120,
    "actual_minutes": 45,
    "tags": ["documentation", "api"],
    "category": {
      "id": "cat-uuid-1",
      "name": "Work",
      "color": "#3B82F6",
      "icon": "briefcase"
    },
    "assignments": [
      {
        "id": "assign-uuid-1",
        "assigned_to": {
          "id": "user-uuid-2",
          "display_name": "Jane Smith",
          "email": "jane@example.com"
        },
        "assigned_by": {
          "id": "user-uuid-1",
          "display_name": "John Doe"
        },
        "assigned_at": "2025-07-11T10:30:00Z",
        "notes": "Please review the API structure"
      }
    ],
    "comments": [
      {
        "id": "comment-uuid-1",
        "content": "Started working on the endpoints section",
        "user": {
          "id": "user-uuid-1",
          "display_name": "John Doe",
          "avatar_url": "https://cdn.taskflow.com/avatars/john.jpg"
        },
        "is_internal": false,
        "created_at": "2025-07-11T11:15:00Z"
      }
    ],
    "history": [
      {
        "id": "history-uuid-1",
        "action": "status_changed",
        "field_name": "status",
        "old_value": "pending",
        "new_value": "in_progress",
        "user": {
          "id": "user-uuid-1",
          "display_name": "John Doe"
        },
        "created_at": "2025-07-11T11:00:00Z"
      }
    ],
    "metadata": {
      "complexity": "medium",
      "external_id": "PROJ-123"
    },
    "created_at": "2025-07-11T10:30:00Z",
    "updated_at": "2025-07-11T11:45:00Z"
  }
}
```

### PUT /tasks/{id}
Update a specific task.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Complete comprehensive API documentation",
  "description": "Updated description",
  "priority": "medium",
  "status": "in_progress",
  "due_date": "2025-07-16T17:00:00Z",
  "actual_minutes": 75,
  "tags": ["documentation", "api", "urgent"]
}
```

### PATCH /tasks/{id}
Partially update a task (for status changes, etc.).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "status": "completed",
  "actual_minutes": 90
}
```

### DELETE /tasks/{id}
Delete a task (soft delete).

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

### POST /tasks/{id}/duplicate
Duplicate a task.

**Headers:** `Authorization: Bearer <token>`

**Request Body (optional):**
```json
{
  "title": "Copy of: Complete API documentation",
  "reset_dates": true,
  "reset_progress": true
}
```

### POST /tasks/{id}/restore
Restore a soft-deleted task.

**Headers:** `Authorization: Bearer <token>`

---

## 🔍 Advanced Search Endpoints

### GET /search
Global search across tasks, categories, and tags.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q` (string, required): Search query
- `type` (string): Search type (tasks, categories, tags, all)
- `page` (int): Page number
- `limit` (int): Items per page

**Example Request:**
```
GET /search?q=API documentation&type=tasks&page=1&limit=10
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "query": "API documentation",
    "results": {
      "tasks": [
        {
          "id": "task-uuid-1",
          "title": "Complete API documentation",
          "description": "Write comprehensive API docs...",
          "status": "pending",
          "priority": "high",
          "category": {
            "name": "Work",
            "color": "#3B82F6"
          },
          "relevance_score": 0.95,
          "matched_fields": ["title", "description"],
          "highlighted_text": "Complete <mark>API</mark> <mark>documentation</mark>"
        }
      ],
      "categories": [],
      "tags": [
        {
          "id": "tag-uuid-1",
          "name": "api",
          "color": "#10B981",
          "task_count": 5
        }
      ]
    },
    "pagination": {
      "current_page": 1,
      "per_page": 10,
      "total": 3,
      "total_pages": 1
    },
    "search_suggestions": [
      "API documentation best practices",
      "API endpoint design",
      "API testing"
    ]
  }
}
```

### GET /search/suggestions
Get search suggestions.

**Query Parameters:**
- `q` (string): Partial search query

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "API documentation",
      "API testing",
      "API design patterns"
    ]
  }
}
```

---

## 📂 Category Management Endpoints

### GET /categories
Get user's categories.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `include_stats` (boolean): Include task statistics
- `sort` (string): Sort by (name, created_at, task_count)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-uuid-1",
      "name": "Work",
      "description": "Work-related tasks",
      "color": "#3B82F6",
      "icon": "briefcase",
      "is_default": true,
      "sort_order": 0,
      "task_count": 15,
      "completed_task_count": 8,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-07-11T10:30:00Z"
    },
    {
      "id": "cat-uuid-2",
      "name": "Personal",
      "description": "Personal tasks and activities",
      "color": "#10B981",
      "icon": "user",
      "is_default": false,
      "sort_order": 1,
      "task_count": 8,
      "completed_task_count": 3,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-07-11T10:30:00Z"
    }
  ]
}
```

### POST /categories
Create a new category.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Health & Fitness",
  "description": "Health and fitness related tasks",
  "color": "#EF4444",
  "icon": "heart",
  "is_default": false
}
```

### PUT /categories/{id}
Update a category.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Health & Wellness",
  "description": "Updated description",
  "color": "#EC4899",
  "icon": "heart"
}
```

### DELETE /categories/{id}
Delete a category.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `move_tasks_to` (UUID): Category ID to move tasks to

---

## 🏷️ Tag Management Endpoints

### GET /tags
Get user's tags.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `search` (string): Filter tags by name
- `include_stats` (boolean): Include usage statistics
- `sort` (string): Sort by (name, created_at, usage_count)

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "tag-uuid-1",
      "name": "urgent",
      "color": "#EF4444",
      "usage_count": 12,
      "recent_usage": "2025-07-11T10:30:00Z",
      "created_at": "2025-01-15T10:30:00Z"
    },
    {
      "id": "tag-uuid-2",
      "name": "api",
      "color": "#3B82F6",
      "usage_count": 8,
      "recent_usage": "2025-07-10T15:20:00Z",
      "created_at": "2025-02-01T14:15:00Z"
    }
  ]
}
```

### POST /tags
Create a new tag.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "learning",
  "color": "#8B5CF6"
}
```

### PUT /tags/{id}
Update a tag.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "continuous-learning",
  "color": "#7C3AED"
}
```

### DELETE /tags/{id}
Delete a tag.

**Headers:** `Authorization: Bearer <token>`

---

## 📊 Analytics & Statistics Endpoints

### GET /analytics/dashboard
Get dashboard analytics.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `period` (string): Time period (today, week, month, quarter, year)
- `timezone` (string): User timezone

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total_tasks": 156,
      "completed_tasks": 89,
      "pending_tasks": 45,
      "in_progress_tasks": 12,
      "overdue_tasks": 8,
      "completion_rate": 74.5,
      "average_completion_time_hours": 3.2
    },
    "productivity_trend": [
      {
        "date": "2025-07-05",
        "tasks_completed": 5,
        "tasks_created": 3,
        "time_spent_hours": 6.5
      },
      {
        "date": "2025-07-06",
        "tasks_completed": 8,
        "tasks_created": 4,
        "time_spent_hours": 7.2
      }
    ],
    "category_breakdown": [
      {
        "category": "Work",
        "total_tasks": 89,
        "completed_tasks": 56,
        "completion_rate": 62.9
      },
      {
        "category": "Personal",
        "total_tasks": 34,
        "completed_tasks": 28,
        "completion_rate": 82.4
      }
    ],
    "priority_distribution": {
      "high": 23,
      "medium": 67,
      "low": 45,
      "none": 21
    },
    "upcoming_deadlines": [
      {
        "id": "task-uuid-1",
        "title": "Complete API documentation",
        "due_date": "2025-07-15T17:00:00Z",
        "days_until_due": 4,
        "priority": "high"
      }
    ]
  }
}
```

### GET /analytics/time-tracking
Get time tracking analytics.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `start_date` (ISO date): Start date for analysis
- `end_date` (ISO date): End date for analysis
- `group_by` (string): Group by (day, week, month, category, tag)

### GET /analytics/productivity
Get productivity metrics.

**Headers:** `Authorization: Bearer <token>`

---

## 🔔 Notification Endpoints

### GET /notifications
Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `unread_only` (boolean): Only unread notifications
- `type` (string): Filter by notification type
- `page` (int): Page number
- `limit` (int): Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif-uuid-1",
        "type": "due_date_reminder",
        "title": "Task Due Soon",
        "message": "Complete API documentation is due in 2 hours",
        "data": {
          "task_id": "task-uuid-1",
          "task_title": "Complete API documentation"
        },
        "read_at": null,
        "action_url": "/tasks/task-uuid-1",
        "created_at": "2025-07-11T10:30:00Z"
      }
    ],
    "unread_count": 5,
    "pagination": {
      "current_page": 1,
      "per_page": 20,
      "total": 25
    }
  }
}
```

### PATCH /notifications/{id}/mark-read
Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

### POST /notifications/mark-all-read
Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

---

## 💬 Task Comments Endpoints

### GET /tasks/{task_id}/comments
Get task comments.

**Headers:** `Authorization: Bearer <token>`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "comment-uuid-1",
      "content": "Started working on the authentication section",
      "user": {
        "id": "user-uuid-1",
        "display_name": "John Doe",
        "avatar_url": "https://cdn.taskflow.com/avatars/john.jpg"
      },
      "is_internal": false,
      "created_at": "2025-07-11T11:15:00Z",
      "updated_at": "2025-07-11T11:15:00Z"
    }
  ]
}
```

### POST /tasks/{task_id}/comments
Add a comment to a task.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Making good progress on this task",
  "is_internal": false
}
```

### PUT /comments/{id}
Update a comment.

**Headers:** `Authorization: Bearer <token>`

### DELETE /comments/{id}
Delete a comment.

**Headers:** `Authorization: Bearer <token>`

---

## 📁 Bulk Operations Endpoints

### POST /tasks/bulk
Perform bulk operations on tasks.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "task_ids": ["task-uuid-1", "task-uuid-2", "task-uuid-3"],
  "operation": "update_status",
  "data": {
    "status": "completed"
  }
}
```

**Supported Operations:**
- `update_status`: Update status for multiple tasks
- `update_priority`: Update priority for multiple tasks
- `update_category`: Move tasks to different category
- `add_tags`: Add tags to multiple tasks
- `remove_tags`: Remove tags from multiple tasks
- `delete`: Delete multiple tasks

### POST /tasks/import
Import tasks from external source.

**Headers:** `Authorization: Bearer <token>`

**Content-Type:** `multipart/form-data`

**Form Data:**
- `file`: CSV/JSON file with tasks
- `format`: Import format (csv, json)
- `mapping`: Field mapping configuration

### GET /tasks/export
Export tasks.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `format` (string): Export format (csv, json, pdf)
- `filter` (string): Apply filters (same as GET /tasks)
- `fields` (string): Comma-separated field list

---

## 🔄 Real-time Endpoints (WebSocket)

### WebSocket Connection
**Endpoint:** `wss://api.taskflow.com/v1/ws`

**Authentication:** Send JWT token in connection query parameter
```
wss://api.taskflow.com/v1/ws?token=<jwt_token>
```

**Message Types:**

**Subscribe to Events:**
```json
{
  "type": "subscribe",
  "events": ["task_created", "task_updated", "task_deleted", "notification_received"]
}
```

**Real-time Notifications:**
```json
{
  "type": "task_updated",
  "data": {
    "task_id": "task-uuid-1",
    "changes": {
      "status": {
        "old": "pending",
        "new": "in_progress"
      }
    },
    "updated_by": "user-uuid-2",
    "timestamp": "2025-07-11T12:00:00Z"
  }
}
```

---

## 🚨 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters"
      }
    ],
    "request_id": "req-uuid-123"
  }
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Too Many Requests
- `500` - Internal Server Error

### Common Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_ERROR` - Invalid credentials
- `AUTHORIZATION_ERROR` - Insufficient permissions
- `RESOURCE_NOT_FOUND` - Requested resource not found
- `RESOURCE_CONFLICT` - Resource already exists
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `SERVER_ERROR` - Internal server error

---

## 🔧 API Features

### Rate Limiting
- **Default**: 100 requests per minute per user
- **Burst**: 20 requests per 10 seconds
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Pagination
- **Default Page Size**: 20 items
- **Maximum Page Size**: 100 items
- **Headers**: `X-Total-Count`, `X-Page-Count`

### Filtering & Sorting
- **Multiple Filters**: Combine multiple filter parameters
- **Operator Support**: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `in`, `like`
- **Sort Multiple Fields**: `sort=created_at,-priority,title`

### Field Selection
- **Include**: `fields=id,title,status,due_date`
- **Exclude**: `exclude=description,metadata`

### API Versioning
- **Header**: `Accept: application/vnd.taskflow.v1+json`
- **URL**: `/v1/` prefix
- **Backward Compatibility**: Maintained for deprecated versions

This comprehensive API design provides all the necessary endpoints for a full-featured task management system with modern RESTful practices, real-time capabilities, and enterprise-level features.
