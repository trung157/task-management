# React API Client with Axios - Complete Implementation

This document provides a comprehensive overview of the robust API client implementation for the React task management application.

## 🚀 Features

### Core API Client (`src/api/apiClient.ts`)

- **JWT Authentication**: Automatic token management with refresh capabilities
- **Request/Response Interceptors**: Automatic token injection and error handling
- **Error Handling**: Comprehensive error wrapper with typed error responses
- **Token Management**: Secure storage and automatic refresh of JWT tokens
- **File Upload/Download**: Built-in helpers for file operations
- **Development Debugging**: Request timing and logging in development mode
- **TypeScript**: Full type safety with custom error classes

### API Services

#### Authentication API (`src/api/authApi.ts`)
- User login/logout
- Registration with email verification
- Password management (change, reset)
- Profile management
- Two-factor authentication
- Account verification

#### Task API (`src/api/taskApi.ts`)
- CRUD operations for tasks
- Advanced filtering and search
- Batch operations
- Task statistics
- Category management
- File attachments

#### Category API (`src/api/categoryApi.ts`)
- Category CRUD operations
- Hierarchical category support
- Category statistics
- Bulk operations

### React Hooks Integration

#### Core Hooks (`src/hooks/`)
- **`useApi`**: Generic API hook with loading states and error handling
- **`useAuthApi`**: Authentication-specific operations with notifications
- **`useTasks`**: Task management with optimistic updates
- **`useAsyncOperation`**: Reusable async operation handler

## 📁 Project Structure

```
src/
├── api/
│   ├── apiClient.ts          # Core API client with axios
│   ├── authApi.ts           # Authentication endpoints
│   ├── taskApi.ts           # Task management endpoints
│   ├── categoryApi.ts       # Category endpoints
│   └── __tests__/
│       └── apiClient.test.ts # API client tests
├── hooks/
│   ├── useApi.ts            # Generic API hook
│   ├── useAuthApi.ts        # Auth-specific hook
│   ├── useTasks.ts          # Task management hook
│   └── useAsyncOperation.ts # Async operation utilities
├── contexts/
│   ├── AuthContext.tsx      # Authentication context
│   ├── TaskContext.tsx      # Task management context
│   └── NotificationContext.tsx # Notification system
├── examples/
│   └── ApiIntegrationExample.tsx # Complete usage example
└── types/
    └── index.ts            # TypeScript definitions
```

## 🔧 Configuration

### Environment Variables

```bash
# .env
VITE_API_URL=http://localhost:3001/api
```

### API Client Configuration

```typescript
// Automatic configuration in apiClient.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Configurable options:
- baseURL: API base URL
- timeout: 30 seconds
- headers: JSON content type
- interceptors: Request/response handling
```

## 🚀 Usage Examples

### Basic API Calls

```typescript
import apiClient from '../api/apiClient'

// GET request
const users = await apiClient.get<User[]>('/users')

// POST request
const newUser = await apiClient.post<User>('/users', userData)

// With error handling
try {
  const result = await apiClient.get<Task[]>('/tasks')
  console.log('Tasks:', result.data)
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', error.message, error.status)
  }
}
```

### Using React Hooks

```typescript
import { useAuthApi } from '../hooks/useAuthApi'
import { useTasks } from '../hooks/useTasks'

function TaskManager() {
  const { user, loading: authLoading, updateProfile } = useAuthApi()
  const { 
    tasks, 
    loading: tasksLoading, 
    createTask, 
    updateTask, 
    deleteTask 
  } = useTasks()

  const handleCreateTask = async (taskData) => {
    const success = await createTask(taskData)
    if (success) {
      // Task created successfully with automatic notifications
    }
  }

  return (
    <div>
      {tasksLoading ? (
        <LoadingSpinner />
      ) : (
        <TaskList tasks={tasks} onUpdate={updateTask} onDelete={deleteTask} />
      )}
    </div>
  )
}
```

### Authentication Flow

```typescript
import { AuthApi } from '../api/authApi'
import { TokenManager } from '../api/apiClient'

// Login
const loginResult = await AuthApi.login({
  email: 'user@example.com',
  password: 'password123'
})

// Tokens are automatically stored and managed
// All subsequent API calls include the JWT token

// Logout
await AuthApi.logout()
// Tokens are automatically cleared
```

### File Upload

```typescript
import apiClient from '../api/apiClient'

const handleFileUpload = async (file: File) => {
  try {
    const result = await apiClient.uploadFile(
      '/tasks/123/attachments',
      file,
      (progress) => {
        console.log(`Upload progress: ${progress}%`)
      }
    )
    console.log('File uploaded:', result.data)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}
```

### Error Handling

```typescript
import { ApiError } from '../api/apiClient'

try {
  await apiClient.post('/tasks', taskData)
} catch (error) {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 400:
        console.error('Validation error:', error.details)
        break
      case 401:
        console.error('Authentication required')
        // Redirect to login (handled automatically by interceptors)
        break
      case 403:
        console.error('Permission denied')
        break
      case 500:
        console.error('Server error:', error.message)
        break
      default:
        console.error('Unexpected error:', error.message)
    }
  }
}
```

## 🔐 Security Features

### Token Management
- Automatic JWT token injection in requests
- Secure token storage in localStorage
- Automatic token refresh on expiry
- Token validation and expiry detection
- Automatic logout on refresh failure

### Request Security
- CSRF protection ready (can be added)
- Request/response validation
- Secure headers configuration
- Environment-based API URL configuration

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### Test Coverage
- Token management utilities
- API error handling
- Request/response interceptors
- File upload/download helpers
- Authentication flow

### Example Test
```typescript
describe('TokenManager', () => {
  it('should store and retrieve tokens', () => {
    TokenManager.setTokens('access-token', 'refresh-token')
    expect(TokenManager.getAccessToken()).toBe('access-token')
    expect(TokenManager.getRefreshToken()).toBe('refresh-token')
  })
})
```

## 🔄 Integration with Context API

The API client seamlessly integrates with React Context API:

```typescript
// AuthContext automatically handles login/logout
const { user, login, logout } = useAuth()

// TaskContext manages task state with API integration
const { tasks, createTask, updateTask } = useTask()

// NotificationContext shows API error/success messages
const { addNotification } = useNotification()
```

## 📊 Monitoring and Debugging

### Development Mode Features
- Request timing logs
- Detailed error information
- Network request debugging
- Token expiry warnings

### Production Features
- Error reporting ready
- Performance monitoring hooks
- User-friendly error messages
- Graceful degradation

## 🚀 Getting Started

1. **Install Dependencies**
   ```bash
   npm install axios
   ```

2. **Configure Environment**
   ```bash
   echo "VITE_API_URL=http://localhost:3001/api" > .env
   ```

3. **Import and Use**
   ```typescript
   import apiClient from './api/apiClient'
   import { useAuthApi } from './hooks/useAuthApi'
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **View API Demo**
   Navigate to `/api-demo` in your browser to see the complete integration example.

## 🔧 Customization

### Adding New Endpoints
1. Create API service file in `src/api/`
2. Define TypeScript interfaces
3. Create React hook in `src/hooks/`
4. Integrate with Context API if needed

### Custom Error Handling
```typescript
// Extend ApiError for custom error types
class ValidationError extends ApiError {
  constructor(message: string, details: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}
```

### Custom Interceptors
```typescript
// Add custom request interceptor
apiClient.getAxiosInstance().interceptors.request.use((config) => {
  // Custom logic
  return config
})
```

## 📈 Performance Considerations

- **Request Caching**: Implement with React Query or SWR if needed
- **Optimistic Updates**: Built into task hooks
- **Debouncing**: Implement for search functionality
- **Pagination**: Built into API responses
- **Bundle Size**: Tree-shaking friendly imports

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Add tests for new features
3. Update documentation
4. Use consistent error handling patterns
5. Follow the established folder structure

This API client provides a solid foundation for any React application requiring robust backend integration with authentication, error handling, and type safety.
