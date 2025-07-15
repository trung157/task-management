import { body, param, query } from 'express-validator';

/**
 * Validation rules for creating a new task
 */
export const validateCreateTask = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title is required and must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Due date must be a valid ISO 8601 date'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
];

/**
 * Validation rules for updating a task
 */
export const validateUpdateTask = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be less than 2000 characters'),
  
  body('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled'),
  
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  body('dueDate')
    .optional()
    .custom((value) => {
      if (value === null || value === '') {
        return true; // Allow null/empty to clear due date
      }
      if (!new Date(value).getTime()) {
        throw new Error('Due date must be a valid date or null');
      }
      return true;
    }),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),
];

/**
 * Validation rules for task ID parameter
 */
export const validateTaskId = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
];

/**
 * Validation rules for task search and filtering
 */
export const validateTaskSearch = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query must be less than 100 characters'),
  
  query('status')
    .optional()
    .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'archived'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled, archived'),
  
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be one of: low, medium, high, urgent'),
  
  query('tags')
    .optional()
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          if (!Array.isArray(parsed)) {
            throw new Error('Tags must be an array');
          }
          return true;
        } catch {
          // If not JSON, treat as single tag
          return true;
        }
      }
      return true;
    })
    .withMessage('Tags must be a valid array or string'),
  
  query('dueDateFrom')
    .optional()
    .isISO8601()
    .withMessage('Due date from must be a valid ISO 8601 date'),
  
  query('dueDateTo')
    .optional()
    .isISO8601()
    .withMessage('Due date to must be a valid ISO 8601 date'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be an integer between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  
  query('sortBy')
    .optional()
    .isIn(['title', 'status', 'priority', 'due_date', 'created_at', 'updated_at'])
    .withMessage('Sort by must be one of: title, status, priority, due_date, created_at, updated_at'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be either asc or desc'),
];

/**
 * Validation rules for bulk operations
 */
export const validateBulkTaskOperation = [
  body('taskIds')
    .isArray({ min: 1 })
    .withMessage('Task IDs must be a non-empty array'),
  
  body('taskIds.*')
    .isUUID()
    .withMessage('Each task ID must be a valid UUID'),
];

/**
 * Validation rules for bulk status update
 */
export const validateBulkStatusUpdate = [
  ...validateBulkTaskOperation,
  
  body('status')
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled'),
];

/**
 * Validation rules for task statistics query
 */
export const validateTaskStats = [
  query('period')
    .optional()
    .isIn(['day', 'week', 'month', 'year'])
    .withMessage('Period must be one of: day, week, month, year'),
];

/**
 * Validation rules for tasks due soon
 */
export const validateTasksDueSoon = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage('Days must be an integer between 1 and 30'),
];

/**
 * Validation rules for archiving old tasks
 */
export const validateArchiveOldTasks = [
  body('daysOld')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days old must be an integer between 1 and 365'),
];

/**
 * Validation rules for marking task as completed
 */
export const validateMarkCompleted = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
  
  body('actual_minutes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Actual minutes must be a positive integer'),
];

/**
 * Validation rules for duplicating a task
 */
export const validateDuplicateTask = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
  
  body('new_title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('New title must be between 1 and 200 characters'),
];

/**
 * Validation rules for sending task reminder
 */
export const validateSendReminder = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
];

/**
 * Validation rules for advanced task search
 */
export const validateAdvancedSearch = [
  query('query')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search query is required'),
  
  query('filters')
    .optional()
    .custom((value) => {
      if (value) {
        try {
          JSON.parse(value);
          return true;
        } catch {
          throw new Error('Filters must be valid JSON');
        }
      }
      return true;
    }),
  
  query('sort')
    .optional()
    .custom((value) => {
      if (value) {
        try {
          JSON.parse(value);
          return true;
        } catch {
          throw new Error('Sort options must be valid JSON');
        }
      }
      return true;
    }),
];

/**
 * Validation rules for bulk operations with better error handling
 */
export const validateBulkTaskOperationModern = [
  body('task_ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('Task IDs must be a non-empty array with maximum 100 items'),
  
  body('task_ids.*')
    .isUUID()
    .withMessage('Each task ID must be a valid UUID'),
];

/**
 * Validation rules for bulk status update with modern format
 */
export const validateBulkStatusUpdateModern = [
  ...validateBulkTaskOperationModern,
  
  body('status')
    .isIn(['pending', 'in_progress', 'completed', 'cancelled'])
    .withMessage('Status must be one of: pending, in_progress, completed, cancelled'),
];
