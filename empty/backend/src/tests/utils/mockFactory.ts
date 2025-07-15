/**
 * Mock Factory for Test Dependencies
 * Provides properly typed mocks for services and models
 */

export const createMockUserModel = () => ({
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  changePassword: jest.fn(),
  delete: jest.fn(),
  list: jest.fn(),
  verifyPassword: jest.fn(),
  updateLoginInfo: jest.fn(),
  incrementFailedLoginAttempts: jest.fn(),
  isAccountLocked: jest.fn()
});

export const createMockTaskRepository = () => ({
  createTask: jest.fn(),
  findTaskById: jest.fn(),
  findByIdWithRelations: jest.fn(),
  findMany: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findWithFilters: jest.fn(),
  getTaskStats: jest.fn(),
  bulkUpdate: jest.fn(),
  bulkDelete: jest.fn(),
  findByIds: jest.fn()
});

export const createMockPasswordValidator = () => ({
  validate: jest.fn().mockReturnValue({
    isValid: true,
    errors: [],
    score: 8
  })
});

export const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
});

export const createMockNotificationHooks = () => ({
  executeCreateHooks: jest.fn(),
  executeUpdateHooks: jest.fn(),
  executeDeleteHooks: jest.fn(),
  executeStatusChangeHooks: jest.fn()
});

export const createMockNotificationService = () => ({
  scheduleTaskReminder: jest.fn(),
  cancelTaskReminder: jest.fn(),
  sendTaskNotification: jest.fn()
});

// Mock bcrypt functions
export const createMockBcrypt = () => ({
  hash: jest.fn(),
  compare: jest.fn()
});

// Mock validator functions
export const createMockValidator = () => ({
  escape: jest.fn((str: string) => str.replace(/[<>"'&]/g, '')),
  isEmail: jest.fn(() => true),
  isUUID: jest.fn(() => true)
});

export default {
  createMockUserModel,
  createMockTaskRepository,
  createMockPasswordValidator,
  createMockLogger,
  createMockNotificationHooks,
  createMockNotificationService,
  createMockBcrypt,
  createMockValidator
};
