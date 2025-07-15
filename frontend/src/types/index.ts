// ===============================
// Core API Types
// ===============================

// Base Response Types
export interface BaseResponse {
  success: boolean
}

export interface SuccessResponse extends BaseResponse {
  message?: string
}

export interface ErrorResponse extends BaseResponse {
  success: false
  error: {
    code: string
    message: string
    details?: Array<{
      field?: string
      message: string
    }>
    request_id?: string
  }
}

export interface ApiResponse<T = any> extends BaseResponse {
  data: T
  message?: string
  pagination?: Pagination
}

export interface Pagination {
  current_page: number
  per_page: number
  total: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

// ===============================
// Enum Types
// ===============================

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none'
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export enum NotificationType {
  DUE_DATE_REMINDER = 'due_date_reminder',
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  SYSTEM_UPDATE = 'system_update'
}

// ===============================
// User Types
// ===============================

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  display_name: string
  avatar_url?: string
  bio?: string
  timezone: string
  date_format: string
  time_format: string
  language_code: string
  role: UserRole
  status: UserStatus
  email_verified: boolean
  preferences: Record<string, any>
  notification_settings: Record<string, any>
  created_at: string
  updated_at: string
}

export interface UserProfile extends User {
  // Extended profile data
}

// ===============================
// Task Types
// ===============================

export interface Task {
  id: string
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  due_date?: string
  reminder_date?: string
  start_date?: string
  estimated_minutes?: number
  actual_minutes?: number
  completed_at?: string
  tags: string[]
  category?: Category
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface DetailedTask extends Task {
  assignments: TaskAssignment[]
  comments: TaskComment[]
  history: TaskHistoryEntry[]
}

export interface TaskAssignment {
  id: string
  task_id: string
  user_id: string
  assigned_by: string
  assigned_at: string
  role: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
  updated_at: string
}

export interface TaskHistoryEntry {
  id: string
  task_id: string
  user_id: string
  action: string
  changes: Record<string, any>
  created_at: string
}

// ===============================
// Category Types
// ===============================

export interface Category {
  id: string
  name: string
  description?: string
  color: string
  icon: string
  is_default: boolean
  sort_order: number
  task_count: number
  completed_task_count: number
  created_at: string
  updated_at: string
}

// ===============================
// Notification Types
// ===============================

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  data: Record<string, any>
  read_at?: string
  action_url?: string
  created_at: string
}

// ===============================
// Authentication Types
// ===============================

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: 'Bearer'
}

export interface LoginCredentials {
  email: string
  password: string
  remember_me?: boolean
}

export interface RegisterData {
  email: string
  password: string
  first_name: string
  last_name: string
  timezone?: string
  language_code?: string
}

export interface AuthState {
  user: User | null
  loading: boolean
  error: string | null
}

// ===============================
// Request Types
// ===============================

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  new_password: string
}

export interface UpdateProfileRequest {
  first_name?: string
  last_name?: string
  bio?: string
  timezone?: string
  preferences?: Record<string, any>
  notification_settings?: Record<string, any>
}

export interface CreateTaskRequest {
  title: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  category_id?: string
  due_date?: string
  reminder_date?: string
  start_date?: string
  estimated_minutes?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface UpdateTaskRequest {
  title?: string
  description?: string
  priority?: TaskPriority
  status?: TaskStatus
  category_id?: string
  due_date?: string
  reminder_date?: string
  start_date?: string
  estimated_minutes?: number
  actual_minutes?: number
  tags?: string[]
  metadata?: Record<string, any>
}

export interface PatchTaskRequest {
  status?: TaskStatus
  priority?: TaskPriority
  actual_minutes?: number
}

export interface CreateCategoryRequest {
  name: string
  description?: string
  color?: string
  icon?: string
  is_default?: boolean
}

export interface UpdateCategoryRequest {
  name?: string
  description?: string
  color?: string
  icon?: string
}

// ===============================
// Response Types
// ===============================

export interface LoginResponse extends ApiResponse<{
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: 'Bearer'
  user: User
}> {}

export interface RegisterResponse extends ApiResponse<{
  user: User
}> {}

export interface RefreshTokenResponse extends ApiResponse<{
  access_token: string
  expires_in: number
  token_type: 'Bearer'
}> {}

export interface UserProfileResponse extends ApiResponse<User> {}

export interface TaskResponse extends ApiResponse<Task> {}

export interface TasksResponse extends ApiResponse<{
  tasks: Task[]
  pagination: Pagination
  filters_applied: Record<string, any>
  summary: {
    total_tasks: number
    pending: number
    in_progress: number
    completed: number
    overdue: number
  }
}> {}

export interface DetailedTaskResponse extends ApiResponse<DetailedTask> {}

export interface CategoryResponse extends ApiResponse<Category> {}

export interface CategoriesResponse extends ApiResponse<Category[]> {}

export interface NotificationsResponse extends ApiResponse<{
  notifications: Notification[]
  unread_count: number
  pagination: Pagination
}> {}

// ===============================
// Search Types
// ===============================

export interface SearchQuery {
  q: string
  filters?: {
    status?: TaskStatus[]
    priority?: TaskPriority[]
    category_id?: string[]
    tags?: string[]
    due_date_from?: string
    due_date_to?: string
    created_from?: string
    created_to?: string
  }
  sort?: {
    field: string
    order: 'asc' | 'desc'
  }
  page?: number
  limit?: number
}

export interface SearchResult {
  tasks: Array<Task & {
    relevance_score: number
    matched_fields: string[]
    highlighted_text: string
  }>
  categories: Category[]
  tags: Array<{
    name: string
    count: number
  }>
}

export interface SearchResponse extends ApiResponse<{
  query: string
  results: SearchResult
  pagination: Pagination
  search_suggestions: string[]
}> {}

// ===============================
// Analytics Types
// ===============================

export interface ProductivityTrend {
  date: string
  tasks_completed: number
  tasks_created: number
  time_spent_hours: number
}

export interface CategoryBreakdown {
  category: string
  total_tasks: number
  completed_tasks: number
  completion_rate: number
}

export interface PriorityDistribution {
  high: number
  medium: number
  low: number
  none: number
}

export interface UpcomingDeadline {
  id: string
  title: string
  due_date: string
  days_until_due: number
  priority: TaskPriority
}

export interface DashboardAnalytics {
  summary: {
    total_tasks: number
    completed_tasks: number
    pending_tasks: number
    in_progress_tasks: number
    overdue_tasks: number
    completion_rate: number
    average_completion_time_hours: number
  }
  productivity_trend: ProductivityTrend[]
  category_breakdown: CategoryBreakdown[]
  priority_distribution: PriorityDistribution
  upcoming_deadlines: UpcomingDeadline[]
}

export interface DashboardAnalyticsResponse extends ApiResponse<DashboardAnalytics> {}

// ===============================
// Filter and Sort Types
// ===============================

export interface TaskFilters {
  status?: TaskStatus[]
  priority?: TaskPriority[]
  category_id?: string[]
  tags?: string[]
  due_date_from?: string
  due_date_to?: string
  created_from?: string
  created_to?: string
  completed_from?: string
  completed_to?: string
  search?: string
}

export interface SortOptions {
  field: 'title' | 'created_at' | 'updated_at' | 'due_date' | 'priority' | 'status'
  order: 'asc' | 'desc'
}

// ===============================
// Component Props Types
// ===============================

// Common props
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

// Loading states
export interface LoadingState {
  loading: boolean
  error: string | null
}

// Form props
export interface FormProps extends BaseComponentProps {
  onSubmit: (data: any) => void | Promise<void>
  loading?: boolean
  error?: string | null
  initialData?: any
}

// Modal props
export interface ModalProps extends BaseComponentProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

// Task-specific component props
export interface TaskListProps extends BaseComponentProps {
  tasks: Task[]
  loading?: boolean
  onTaskClick?: (task: Task) => void
  onTaskUpdate?: (task: Task) => void
  onTaskDelete?: (taskId: string) => void
}

export interface TaskFormProps extends FormProps {
  task?: Task
  categories: Category[]
  onSubmit: (data: CreateTaskRequest | UpdateTaskRequest) => void | Promise<void>
}

export interface TaskCardProps extends BaseComponentProps {
  task: Task
  onClick?: (task: Task) => void
  onUpdate?: (task: Task) => void
  onDelete?: (taskId: string) => void
  showCategory?: boolean
  showDueDate?: boolean
  compact?: boolean
}

// Category-specific component props
export interface CategoryListProps extends BaseComponentProps {
  categories: Category[]
  loading?: boolean
  onCategoryClick?: (category: Category) => void
  onCategoryUpdate?: (category: Category) => void
  onCategoryDelete?: (categoryId: string) => void
}

export interface CategoryFormProps extends FormProps {
  category?: Category
  onSubmit: (data: CreateCategoryRequest | UpdateCategoryRequest) => void | Promise<void>
}

// Filter component props
export interface FilterPanelProps extends BaseComponentProps {
  filters: TaskFilters
  onFiltersChange: (filters: TaskFilters) => void
  categories: Category[]
  availableTags: string[]
}

// ===============================
// Context State Types
// ===============================

export interface TaskState {
  tasks: Task[]
  currentTask: Task | null
  loading: boolean
  error: string | null
  filters: TaskFilters
  sort: SortOptions
  pagination: Pagination | null
}

export interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
}

// ===============================
// Hook Return Types
// ===============================

export interface UseTasksReturn {
  tasks: Task[]
  loading: boolean
  error: string | null
  filters: TaskFilters
  sort: SortOptions
  pagination: Pagination | null
  createTask: (data: CreateTaskRequest) => Promise<Task>
  updateTask: (id: string, data: UpdateTaskRequest) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  setFilters: (filters: TaskFilters) => void
  setSort: (sort: SortOptions) => void
  refreshTasks: () => Promise<void>
}

export interface UseAuthReturn {
  user: User | null
  loading: boolean
  error: string | null
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  updateProfile: (data: UpdateProfileRequest) => Promise<void>
  clearError: () => void
}

export interface UseNotificationsReturn {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  refreshNotifications: () => Promise<void>
}

// ===============================
// Error Types
// ===============================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface ValidationError {
  field: string
  message: string
}

// ===============================
// Utility Types
// ===============================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// For form handling
export type FormData<T> = Omit<T, keyof { id: any; created_at: any; updated_at: any } & keyof T>

// For API endpoints
export type CreateData<T> = FormData<T>
export type UpdateData<T> = Partial<FormData<T>>

// ===============================
// Route Types (for React Router)
// ===============================

export interface RouteParams {
  id?: string
  taskId?: string
  categoryId?: string
}

export interface LocationState {
  from?: string
  returnTo?: string
  message?: string
}

// ===============================
// Theme and UI Types
// ===============================

export type Theme = 'light' | 'dark' | 'system'

export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'

export type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface ThemeColors {
  primary: string
  secondary: string
  success: string
  warning: string
  error: string
  info: string
  background: string
  surface: string
  text: string
  border: string
}

// ===============================
// Date and Time Types
// ===============================

export type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY'
export type TimeFormat = '12h' | '24h'

export interface DateTimeOptions {
  dateFormat: DateFormat
  timeFormat: TimeFormat
  timezone: string
}

// ===============================
// File Upload Types
// ===============================

export interface FileUpload {
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  url?: string
}

export interface AttachmentFile {
  id: string
  filename: string
  original_name: string
  mime_type: string
  size: number
  url: string
  uploaded_at: string
}

// ===============================
// Export all types
// ===============================

export type {
  // Re-export commonly used types for convenience
  ReactNode,
  ReactElement,
  ComponentType,
  FC,
  PropsWithChildren
} from 'react'
