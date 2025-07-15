/**
 * Enhanced Task Routes
 * Comprehensive task management endpoints with advanced features
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { jwtAuth } from '../../middleware/jwtAuth';
import { validateRequest } from '../../middleware/validation';
import { defaultLimiter } from '../../middleware/rateLimiting';
import { asyncHandler } from '../../middleware/errorHandler';

const router = Router();

/**
 * Task validation rules
 */
const taskValidation = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must not exceed 2000 characters'),
    
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
    
  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'completed', 'cancelled'])
    .withMessage('Invalid status value'),
    
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
    
  body('assignee_id')
    .optional()
    .isUUID()
    .withMessage('Assignee ID must be a valid UUID')
];

const taskQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),
    
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority filter'),
    
  query('assignee_id')
    .optional()
    .isUUID()
    .withMessage('Assignee ID must be a valid UUID'),
    
  query('sort')
    .optional()
    .isIn(['created_at', 'updated_at', 'due_date', 'priority', 'title'])
    .withMessage('Invalid sort field'),
    
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];

/**
 * @route   GET /api/tasks
 * @desc    Get tasks with filtering, sorting, and pagination
 * @access  Private
 */
router.get('/',
  jwtAuth,
  taskQueryValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignee_id,
      sort = 'created_at',
      order = 'desc',
      search
    } = req.query;

    // Mock task data (replace with actual service call)
    const tasks = {
      data: [
        {
          id: '1',
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication system',
          status: 'in_progress',
          priority: 'high',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T14:30:00Z',
          due_date: '2024-01-20T23:59:59Z',
          assignee: {
            id: '123',
            name: 'John Doe',
            email: 'john@example.com'
          },
          tags: ['backend', 'security']
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        totalPages: 1
      }
    };

    res.json({
      success: true,
      data: tasks,
      message: 'Tasks retrieved successfully'
    });
  })
);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post('/',
  jwtAuth,
  taskValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const taskData = req.body;
    const userId = req.user.id;

    // Mock task creation (replace with actual service call)
    const newTask = {
      id: '2',
      ...taskData,
      creator_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: newTask,
      message: 'Task created successfully'
    });
  })
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private
 */
router.get('/:id',
  jwtAuth,
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    // Mock task data (replace with actual service call)
    const task = {
      id,
      title: 'Sample Task',
      description: 'This is a sample task',
      status: 'todo',
      priority: 'medium',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z'
    };

    res.json({
      success: true,
      data: task,
      message: 'Task retrieved successfully'
    });
  })
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.put('/:id',
  jwtAuth,
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  taskValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const updateData = req.body;

    // Mock task update (replace with actual service call)
    const updatedTask = {
      id,
      ...updateData,
      updated_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: updatedTask,
      message: 'Task updated successfully'
    });
  })
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id',
  jwtAuth,
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    // Mock task deletion (replace with actual service call)
    res.json({
      success: true,
      data: { id },
      message: 'Task deleted successfully'
    });
  })
);

/**
 * @route   POST /api/tasks/bulk
 * @desc    Bulk operations on tasks
 * @access  Private
 */
router.post('/bulk',
  jwtAuth,
  defaultLimiter,
  body('operation').isIn(['update', 'delete']).withMessage('Invalid bulk operation'),
  body('task_ids').isArray({ min: 1, max: 100 }).withMessage('Task IDs must be an array of 1-100 items'),
  body('task_ids.*').isUUID().withMessage('Each task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { operation, task_ids, data } = req.body;

    // Mock bulk operation (replace with actual service call)
    const result = {
      operation,
      processed: task_ids.length,
      successful: task_ids.length,
      failed: 0,
      errors: []
    };

    res.json({
      success: true,
      data: result,
      message: `Bulk ${operation} completed successfully`
    });
  })
);

/**
 * @route   GET /api/tasks/:id/history
 * @desc    Get task change history
 * @access  Private
 */
router.get('/:id/history',
  jwtAuth,
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;

    // Mock history data (replace with actual service call)
    const history = [
      {
        id: '1',
        action: 'created',
        changes: {},
        user: {
          id: '123',
          name: 'John Doe'
        },
        timestamp: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        action: 'updated',
        changes: {
          status: { from: 'todo', to: 'in_progress' }
        },
        user: {
          id: '123',
          name: 'John Doe'
        },
        timestamp: '2024-01-15T14:30:00Z'
      }
    ];

    res.json({
      success: true,
      data: history,
      message: 'Task history retrieved successfully'
    });
  })
);

export default router;
