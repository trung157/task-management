// Mock UserModel for testing
export const mockUserModel = {
  create: jest.fn(),
  findById: jest.fn(),
  findByEmail: jest.fn(),
  update: jest.fn(),
  updatePassword: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  changePassword: jest.fn(),
  verifyPassword: jest.fn(),
  updateLastLogin: jest.fn(),
  getPreferences: jest.fn(),
  updatePreferences: jest.fn(),
  validateUserData: jest.fn(),
  getUserStats: jest.fn(),
  getStatistics: jest.fn(),
  findUsersWithFilters: jest.fn(),
  findByFilters: jest.fn(),
  bulkUpdate: jest.fn(),
  deactivateUser: jest.fn(),
  reactivateUser: jest.fn(),
  softDelete: jest.fn(),
  hardDelete: jest.fn(),
};

// Mock TaskModel for testing
export const mockTaskModel = {
  create: jest.fn(),
  findById: jest.fn(),
  findByIds: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  findByUserId: jest.fn(),
  findByFilters: jest.fn(),
  findDueSoon: jest.fn(),
  findOverdue: jest.fn(),
  findDueTasks: jest.fn(),
  findOverdueTasks: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn(),
  getStats: jest.fn(),
  getStatistics: jest.fn(),
  search: jest.fn(),
  duplicate: jest.fn(),
  archive: jest.fn(),
  restore: jest.fn(),
  addTag: jest.fn(),
  removeTag: jest.fn(),
  updateTags: jest.fn(),
  getTasksByPriority: jest.fn(),
  getTasksByStatus: jest.fn(),
  getCompletedTasks: jest.fn(),
  getPendingTasks: jest.fn(),
  getTasksForReminder: jest.fn(),
};

// Mock logger for testing
export const mockLogger: any = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(() => mockLogger),
};

// Mock database pool
export const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};

// Mock AppError for testing
export class MockAppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.name = 'AppError';
  }
}

// Mock PasswordValidator
export const mockPasswordValidator = {
  validate: jest.fn(),
  hash: jest.fn(),
  compare: jest.fn(),
  verifyPassword: jest.fn(),
  generateSalt: jest.fn(),
  isStrongPassword: jest.fn(),
  getPasswordRequirements: jest.fn(),
};

// Helper functions for creating test data
export const createTestUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
  status: 'active',
  email_verified: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  last_login_at: new Date('2024-01-01T00:00:00Z'),
  timezone: 'UTC',
  language_code: 'en',
  preferences: {},
  notification_settings: {
    email_notifications: true,
    push_notifications: false,
    due_date_reminders: true,
    task_assignments: true
  },
  ...overrides
});

export const createTestTask = (overrides = {}) => ({
  id: 'test-task-id',
  title: 'Test Task',
  description: 'Test task description',
  priority: 'medium',
  status: 'pending',
  user_id: 'test-user-id',
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  due_date: new Date('2024-01-02T00:00:00Z'),
  estimated_minutes: 60,
  actual_minutes: null,
  completed_at: null,
  completed_by: null,
  tags: ['test'],
  metadata: {},
  sort_order: 1,
  category_id: null,
  reminder_date: null,
  start_date: null,
  ...overrides
});

// Mock reset helper
export const resetAllMocks = () => {
  Object.values(mockUserModel).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  Object.values(mockTaskModel).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  Object.values(mockLogger).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  Object.values(mockPasswordValidator).forEach((mock: any) => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
};
