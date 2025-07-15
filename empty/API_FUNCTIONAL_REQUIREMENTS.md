# 🔧 TaskFlow API - Functional Requirements

## 📋 Document Information
- **Document Version:** 1.0
- **Last Updated:** July 11, 2025
- **API Version:** v1.0
- **Base URL:** `https://api.taskflow.com/v1`
- **Protocol:** HTTPS only
- **Data Format:** JSON

---

## 🎯 Overview

This document outlines the functional requirements for the TaskFlow REST API, providing comprehensive task management capabilities with secure authentication, robust data validation, and scalable architecture.

### Core Capabilities
- User authentication and authorization
- Complete task CRUD operations
- Priority and due date management
- Advanced filtering and search
- Data validation and error handling
- Rate limiting and security

---

## 🔐 Authentication & Authorization

### FR-AUTH-001: User Registration
**Endpoint:** `POST /auth/register`

**Description:** Allow new users to create accounts with email verification.

**Request Body:**
```json
{
  "email": "string",           // Required, valid email format
  "password": "string",        // Required, min 8 chars, complexity rules
  "firstName": "string",       // Required, 1-50 characters
  "lastName": "string",        // Required, 1-50 characters
  "timezone": "string"         // Optional, valid timezone identifier
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify your email.",
  "data": {
    "userId": "uuid",
    "email": "string",
    "emailVerificationRequired": true
  }
}
```

**Validation Rules:**
- Email: Valid format, unique across system
- Password: 8-128 characters, must contain uppercase, lowercase, number, special character
- Names: 1-50 characters, no special characters except spaces, hyphens, apostrophes
- Timezone: Valid IANA timezone identifier

**Error Responses:**
- 400: Invalid input data
- 409: Email already exists
- 429: Too many registration attempts

---

### FR-AUTH-002: Email Verification
**Endpoint:** `POST /auth/verify-email`

**Description:** Verify user email address using token sent via email.

**Request Body:**
```json
{
  "token": "string",           // Required, verification token
  "email": "string"            // Required, email address
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "data": {
    "accessToken": "string",
    "refreshToken": "string",
    "user": {
      "id": "uuid",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "emailVerified": true,
      "createdAt": "ISO8601"
    }
  }
}
```

**Validation Rules:**
- Token: Valid, not expired (24-hour expiry)
- Email: Must match token's associated email

---

### FR-AUTH-003: User Login
**Endpoint:** `POST /auth/login`

**Description:** Authenticate existing users and provide access tokens.

**Request Body:**
```json
{
  "email": "string",           // Required, valid email
  "password": "string",        // Required
  "rememberMe": "boolean"      // Optional, default false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "string",     // JWT, 1-hour expiry
    "refreshToken": "string",    // 30 days (7 days without rememberMe)
    "user": {
      "id": "uuid",
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "emailVerified": "boolean",
      "lastLoginAt": "ISO8601"
    }
  }
}
```

**Security Features:**
- Rate limiting: 5 attempts per 15 minutes per IP
- Account lockout: 5 failed attempts locks account for 30 minutes
- Password attempts tracking
- Device fingerprinting for suspicious activity detection

**Error Responses:**
- 401: Invalid credentials
- 423: Account locked due to failed attempts
- 403: Email not verified

---

### FR-AUTH-004: Token Refresh
**Endpoint:** `POST /auth/refresh`

**Description:** Refresh expired access tokens using valid refresh tokens.

**Request Body:**
```json
{
  "refreshToken": "string"     // Required, valid refresh token
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string"    // Optional, may provide new refresh token
  }
}
```

**Security Rules:**
- Refresh token rotation (new refresh token on each use)
- Automatic revocation of old refresh tokens
- Maximum 5 concurrent sessions per user

---

### FR-AUTH-005: Password Reset
**Endpoint:** `POST /auth/forgot-password`

**Description:** Initiate password reset process via email.

**Request Body:**
```json
{
  "email": "string"            // Required, registered email
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset email sent if account exists"
}
```

**Endpoint:** `POST /auth/reset-password`

**Request Body:**
```json
{
  "token": "string",           // Required, reset token from email
  "newPassword": "string",     // Required, meets complexity requirements
  "confirmPassword": "string"  // Required, must match newPassword
}
```

**Security Features:**
- Reset tokens expire in 1 hour
- Tokens are single-use only
- Password history check (cannot reuse last 3 passwords)
- All sessions invalidated after password reset

---

### FR-AUTH-006: Logout
**Endpoint:** `POST /auth/logout`

**Description:** Invalidate current session and tokens.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "logoutAll": "boolean"       // Optional, logout from all devices
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 📝 Task Management

### FR-TASK-001: Create Task
**Endpoint:** `POST /tasks`

**Description:** Create a new task for the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "string",           // Required, 1-255 characters
  "description": "string",     // Optional, max 2000 characters
  "priority": "string",        // Optional, enum: "high", "medium", "low", "none"
  "dueDate": "ISO8601",        // Optional, must be future date
  "tags": ["string"],          // Optional, array of strings, max 10 tags
  "estimatedMinutes": "number", // Optional, positive integer
  "categoryId": "uuid"         // Optional, valid category ID
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "priority": "string",
    "status": "pending",
    "dueDate": "ISO8601",
    "tags": ["string"],
    "estimatedMinutes": "number",
    "categoryId": "uuid",
    "userId": "uuid",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601"
  }
}
```

**Validation Rules:**
- Title: Required, 1-255 characters, no leading/trailing whitespace
- Description: Max 2000 characters
- Priority: Must be one of: "high", "medium", "low", "none"
- Due Date: Must be in future, valid ISO8601 format
- Tags: Max 10 tags, each tag 1-50 characters, alphanumeric and spaces only
- Estimated Minutes: Positive integer, max 10080 (1 week)

---

### FR-TASK-002: Get Tasks (List with Filtering)
**Endpoint:** `GET /tasks`

**Description:** Retrieve tasks for authenticated user with filtering, sorting, and pagination.

**Query Parameters:**
```
status=string           // Optional, comma-separated: "pending,in_progress,completed"
priority=string         // Optional, comma-separated: "high,medium,low,none"
search=string          // Optional, search in title and description
tags=string            // Optional, comma-separated tag names
category=uuid          // Optional, filter by category ID
due_date_from=date     // Optional, ISO8601 date
due_date_to=date       // Optional, ISO8601 date
overdue=boolean        // Optional, filter overdue tasks
sort_by=string         // Optional, "created_at,updated_at,due_date,priority,title"
sort_order=string      // Optional, "asc,desc" (default: desc)
page=number            // Optional, page number (default: 1)
limit=number           // Optional, items per page (default: 20, max: 100)
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid",
        "title": "string",
        "description": "string",
        "priority": "string",
        "status": "string",
        "dueDate": "ISO8601",
        "tags": ["string"],
        "estimatedMinutes": "number",
        "actualMinutes": "number",
        "categoryId": "uuid",
        "isOverdue": "boolean",
        "createdAt": "ISO8601",
        "updatedAt": "ISO8601"
      }
    ],
    "pagination": {
      "page": "number",
      "limit": "number",
      "total": "number",
      "totalPages": "number",
      "hasNext": "boolean",
      "hasPrev": "boolean"
    },
    "filters": {
      "appliedFilters": "object",
      "resultCount": "number"
    }
  }
}
```

**Performance Requirements:**
- Response time: < 500ms for up to 1000 tasks
- Support for database indexing on frequently filtered fields
- Cursor-based pagination for large datasets

---

### FR-TASK-003: Get Single Task
**Endpoint:** `GET /tasks/{taskId}`

**Description:** Retrieve detailed information for a specific task.

**Path Parameters:**
- `taskId`: UUID of the task

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "priority": "string",
    "status": "string",
    "dueDate": "ISO8601",
    "tags": ["string"],
    "estimatedMinutes": "number",
    "actualMinutes": "number",
    "categoryId": "uuid",
    "userId": "uuid",
    "isOverdue": "boolean",
    "createdAt": "ISO8601",
    "updatedAt": "ISO8601",
    "completedAt": "ISO8601",
    "history": [
      {
        "action": "string",
        "field": "string",
        "oldValue": "any",
        "newValue": "any",
        "timestamp": "ISO8601"
      }
    ]
  }
}
```

**Authorization Rules:**
- User can only access their own tasks
- Task must exist and belong to authenticated user

---

### FR-TASK-004: Update Task
**Endpoint:** `PUT /tasks/{taskId}`

**Description:** Update an existing task with new information.

**Request Body:**
```json
{
  "title": "string",           // Optional
  "description": "string",     // Optional
  "priority": "string",        // Optional
  "status": "string",          // Optional, enum: "pending", "in_progress", "completed"
  "dueDate": "ISO8601",        // Optional, can be null to remove
  "tags": ["string"],          // Optional
  "estimatedMinutes": "number", // Optional
  "actualMinutes": "number",   // Optional
  "categoryId": "uuid"         // Optional
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    // Updated task object (same as create response)
  }
}
```

**Business Rules:**
- Status transitions: pending → in_progress → completed
- Cannot modify completed tasks unless changing status back
- Actual minutes can only be set if status is "completed" or "in_progress"
- Completion timestamp automatically set when status becomes "completed"

---

### FR-TASK-005: Delete Task
**Endpoint:** `DELETE /tasks/{taskId}`

**Description:** Soft delete a task (move to trash, recoverable for 30 days).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task deleted successfully",
  "data": {
    "deletedAt": "ISO8601",
    "recoverable": true,
    "recoverableUntil": "ISO8601"
  }
}
```

**Endpoint:** `DELETE /tasks/{taskId}?permanent=true`

**Description:** Permanently delete a task (cannot be recovered).

**Query Parameters:**
- `permanent`: boolean, requires admin permission or task in trash > 30 days

---

### FR-TASK-006: Restore Task
**Endpoint:** `POST /tasks/{taskId}/restore`

**Description:** Restore a soft-deleted task from trash.

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Task restored successfully",
  "data": {
    // Restored task object
  }
}
```

**Business Rules:**
- Task must be in trash (soft deleted)
- Task must be within 30-day recovery period
- User must be original task owner

---

## 📊 Analytics & Statistics

### FR-STATS-001: User Statistics
**Endpoint:** `GET /users/me/stats`

**Description:** Get comprehensive statistics for the authenticated user.

**Query Parameters:**
```
period=string          // Optional, "day,week,month,year,all" (default: month)
start_date=date        // Optional, for custom date range
end_date=date          // Optional, for custom date range
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalTasks": "number",
      "completedTasks": "number",
      "pendingTasks": "number",
      "overdueTasks": "number",
      "completionRate": "number"
    },
    "trends": {
      "tasksCreated": [
        {
          "date": "string",
          "count": "number"
        }
      ],
      "tasksCompleted": [
        {
          "date": "string",
          "count": "number"
        }
      ]
    },
    "priorities": {
      "high": "number",
      "medium": "number",
      "low": "number",
      "none": "number"
    },
    "productivity": {
      "averageCompletionTime": "number",
      "currentStreak": "number",
      "longestStreak": "number"
    }
  }
}
```

---

## 🏷️ Categories Management

### FR-CAT-001: Create Category
**Endpoint:** `POST /categories`

**Request Body:**
```json
{
  "name": "string",            // Required, 1-100 characters
  "description": "string",     // Optional, max 500 characters
  "color": "string",           // Optional, hex color code
  "icon": "string"             // Optional, icon identifier
}
```

### FR-CAT-002: List Categories
**Endpoint:** `GET /categories`

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "color": "string",
      "icon": "string",
      "taskCount": "number",
      "createdAt": "ISO8601"
    }
  ]
}
```

---

## 🔍 Search Functionality

### FR-SEARCH-001: Advanced Search
**Endpoint:** `GET /search`

**Description:** Perform advanced search across tasks with multiple criteria.

**Query Parameters:**
```
q=string               // Required, search query
fields=string          // Optional, comma-separated: "title,description,tags"
filters=object         // Optional, JSON object with additional filters
highlight=boolean      // Optional, include search term highlighting
fuzzy=boolean          // Optional, enable fuzzy matching
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "task": {
          // Task object
        },
        "score": "number",
        "highlights": {
          "title": "string",
          "description": "string"
        }
      }
    ],
    "totalResults": "number",
    "searchTime": "number",
    "suggestions": ["string"]
  }
}
```

---

## ✅ Data Validation

### Global Validation Rules

#### String Validation
- **Trimming:** All string inputs are trimmed of leading/trailing whitespace
- **Length Limits:** Enforced as specified in each endpoint
- **Character Sets:** UTF-8 encoding, specific restrictions per field
- **XSS Prevention:** HTML tags stripped, entities encoded

#### Date/Time Validation
- **Format:** ISO8601 format required
- **Timezone:** UTC for storage, user timezone for display
- **Range:** Future dates for due dates, past dates for completion

#### Numeric Validation
- **Type:** Integer or float as specified
- **Range:** Positive numbers where applicable
- **Precision:** Limited to reasonable decimal places

#### UUID Validation
- **Format:** Valid UUID v4 format
- **Existence:** Referenced entities must exist
- **Permission:** User must have access to referenced entities

### Request Validation Middleware

**Common Validation Errors (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "string",
        "code": "string",
        "message": "string",
        "value": "any"
      }
    ]
  }
}
```

**Validation Error Codes:**
- `REQUIRED`: Field is required but missing
- `INVALID_FORMAT`: Field format is incorrect
- `TOO_SHORT`: String/array is too short
- `TOO_LONG`: String/array is too long
- `INVALID_TYPE`: Field type is incorrect
- `INVALID_ENUM`: Value not in allowed enum list
- `INVALID_DATE`: Date format or value is invalid
- `INVALID_UUID`: UUID format is invalid
- `DUPLICATE`: Value already exists (uniqueness constraint)
- `REFERENCE_NOT_FOUND`: Referenced entity doesn't exist

---

## 🔒 Security Requirements

### Authentication Security
- **JWT Tokens:** RS256 algorithm with key rotation
- **Token Expiry:** Access tokens (1 hour), Refresh tokens (30 days)
- **HTTPS Only:** All API endpoints require HTTPS
- **CORS:** Configured for specific allowed origins

### Authorization Rules
- **Resource Ownership:** Users can only access their own resources
- **Role-Based Access:** Future support for admin/user roles
- **Rate Limiting:** Per-user and per-IP rate limits
- **Request Size:** Maximum 10MB request body

### Data Protection
- **Password Hashing:** bcrypt with minimum 12 rounds
- **Data Encryption:** AES-256 for sensitive data at rest
- **Audit Logging:** All CRUD operations logged
- **GDPR Compliance:** Data export and deletion capabilities

---

## 📈 Performance Requirements

### Response Times
- **Authentication:** < 200ms
- **CRUD Operations:** < 300ms
- **Search/Filter:** < 500ms
- **Analytics:** < 1000ms

### Scalability
- **Concurrent Users:** Support 10,000 concurrent users
- **Database:** Optimized indexes for common queries
- **Caching:** Redis for session storage and frequently accessed data
- **CDN:** Static assets served via CDN

### Monitoring
- **Health Checks:** `/health` endpoint for system status
- **Metrics:** Response times, error rates, throughput
- **Alerting:** Automated alerts for system issues

---

## 🚦 Rate Limiting

### Limits by Endpoint Type
- **Authentication:** 5 requests per minute per IP
- **CRUD Operations:** 100 requests per minute per user
- **Search:** 20 requests per minute per user
- **Analytics:** 10 requests per minute per user

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1625097600
```

### Rate Limit Exceeded (429 Too Many Requests)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "retryAfter": 60
  }
}
```

---

## 🔄 API Versioning

### Version Strategy
- **URL Versioning:** `/v1/`, `/v2/` in URL path
- **Backward Compatibility:** Maintain previous version for 12 months
- **Deprecation Notice:** 6-month notice before version deprecation

### Version Headers
```
API-Version: 1.0
Deprecated: false
Sunset: 2026-01-01T00:00:00Z
```

---

## 📝 Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": "object",
    "timestamp": "ISO8601",
    "requestId": "string"
  }
}
```

### HTTP Status Codes
- **200:** OK - Request successful
- **201:** Created - Resource created successfully
- **400:** Bad Request - Invalid input data
- **401:** Unauthorized - Authentication required
- **403:** Forbidden - Access denied
- **404:** Not Found - Resource not found
- **409:** Conflict - Resource already exists
- **422:** Unprocessable Entity - Validation failed
- **429:** Too Many Requests - Rate limit exceeded
- **500:** Internal Server Error - Server error

### Error Categories
- **CLIENT_ERROR:** 4xx errors caused by client
- **SERVER_ERROR:** 5xx errors caused by server
- **VALIDATION_ERROR:** Input validation failures
- **AUTHENTICATION_ERROR:** Auth-related errors
- **AUTHORIZATION_ERROR:** Permission-related errors
- **BUSINESS_LOGIC_ERROR:** Domain rule violations

---

## 🧪 Testing Requirements

### Test Coverage
- **Unit Tests:** > 90% code coverage
- **Integration Tests:** All API endpoints
- **Performance Tests:** Load testing for scalability
- **Security Tests:** Penetration testing quarterly

### Test Data
- **Fixtures:** Consistent test data across environments
- **Mocking:** External service dependencies
- **Cleanup:** Automated test data cleanup

---

*Last Updated: July 11, 2025*  
*Document Version: 1.0*  
*API Version: v1.0*  
*Total Endpoints: 25+*
