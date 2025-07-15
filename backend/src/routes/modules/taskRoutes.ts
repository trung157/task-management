/**
 * Task Routes Module
 * Comprehensive task management endpoints with validation
 */

import { Router } from 'express';
import { body, query, param } from 'express-validator';
import { jwtAuth } from '../../middleware/jwtAuth';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * Task validation schemas
 */
const createTaskValidation = [
  body('title')
    .isString()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Title must be between 1 and 200 characters'),
    
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
    
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Priority must be low, medium, high, or urgent'),
    
  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'completed'])
    .withMessage('Invalid status value'),
    
  body('due_date')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date'),
    
  body('assignee_id')
    .optional()
    .isUUID()
    .withMessage('Assignee ID must be a valid UUID'),
    
  body('project_id')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
    
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array')
];

const updateTaskValidation = [
  param('id')
    .isUUID()
    .withMessage('Task ID must be a valid UUID'),
  ...createTaskValidation
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
    .isIn(['todo', 'in_progress', 'review', 'completed'])
    .withMessage('Invalid status filter'),
    
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority filter'),
    
  query('assignee_id')
    .optional()
    .isUUID()
    .withMessage('Assignee ID must be a valid UUID'),
    
  query('project_id')
    .optional()
    .isUUID()
    .withMessage('Project ID must be a valid UUID'),
    
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),
    
  query('sort')
    .optional()
    .isIn(['title', 'created_at', 'updated_at', 'due_date', 'priority'])
    .withMessage('Invalid sort field'),
    
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc')
];

/**
 * @route   GET /tasks
 * @desc    Get tasks with filtering, sorting, and pagination
 * @access  Private
 * @version v1, v2
 */
router.get('/',
  taskQueryValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      assignee_id,
      project_id,
      search,
      sort = 'created_at',
      order = 'desc'
    } = req.query;

    const userId = req.user.id;

    logger.info('Fetching tasks', {
      userId,
      filters: { status, priority, assignee_id, project_id, search },
      pagination: { page, limit },
      sort: { field: sort, order }
    });

    // Mock response - replace with actual service call
    const tasks = {
      data: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          title: 'Implement user authentication',
          description: 'Add JWT-based authentication to the API',
          status: 'in_progress',
          priority: 'high',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T14:30:00Z',
          due_date: '2024-01-25T23:59:59Z',
          creator: {
            id: userId,
            name: 'John Doe',
            email: 'john@example.com'
          },
          assignee: {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Jane Smith',
            email: 'jane@example.com'
          },
          project: {
            id: '550e8400-e29b-41d4-a716-446655440003',
            name: 'Task Management System'
          },
          tags: ['backend', 'security', 'authentication']
        }
      ],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false
      },
      filters: {
        status,
        priority,
        assignee_id,
        project_id,
        search
      },
      sort: {
        field: sort,
        order
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
 * @route   POST /tasks
 * @desc    Create a new task
 * @access  Private
 * @version v1, v2
 */
router.post('/',
  createTaskValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const taskData = req.body;
    const userId = req.user.id;

    logger.info('Creating new task', {
      userId,
      taskData: {
        title: taskData.title,
        priority: taskData.priority,
        assignee_id: taskData.assignee_id
      }
    });

    // Mock task creation - replace with actual service call
    const newTask = {
      id: '550e8400-e29b-41d4-a716-446655440004',
      ...taskData,
      status: taskData.status || 'todo',
      priority: taskData.priority || 'medium',
      creator_id: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      creator: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      }
    };

    res.status(201).json({
      success: true,
      data: newTask,
      message: 'Task created successfully'
    });
  })
);

/**
 * @route   GET /tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private
 * @version v1, v2
 */
router.get('/:id',
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info('Fetching task by ID', { taskId: id, userId });

    // Mock task data - replace with actual service call
    const task = {
      id,
      title: 'Sample Task',
      description: 'This is a detailed description of the task',
      status: 'todo',
      priority: 'medium',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
      due_date: '2024-01-30T23:59:59Z',
      creator: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      },
      assignee: null,
      project: null,
      tags: ['sample', 'demo'],
      comments: [
        {
          id: '550e8400-e29b-41d4-a716-446655440005',
          content: 'This task needs to be completed by end of month',
          author: {
            id: userId,
            name: 'John Doe'
          },
          created_at: '2024-01-15T11:00:00Z'
        }
      ],
      attachments: []
    };

    res.json({
      success: true,
      data: task,
      message: 'Task retrieved successfully'
    });
  })
);

/**
 * @route   PUT /tasks/:id
 * @desc    Update a task
 * @access  Private
 * @version v1, v2
 */
router.put('/:id',
  updateTaskValidation,
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user.id;

    logger.info('Updating task', {
      taskId: id,
      userId,
      updateData: Object.keys(updateData)
    });

    // Mock task update - replace with actual service call
    const updatedTask = {
      id,
      ...updateData,
      updated_at: new Date().toISOString(),
      updated_by: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      }
    };

    res.json({
      success: true,
      data: updatedTask,
      message: 'Task updated successfully'
    });
  })
);

/**
 * @route   DELETE /tasks/:id
 * @desc    Delete a task
 * @access  Private
 * @version v1, v2
 */
router.delete('/:id',
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const userId = req.user.id;

    logger.info('Deleting task', { taskId: id, userId });

    // Mock task deletion - replace with actual service call
    
    res.json({
      success: true,
      data: { id, deleted_at: new Date().toISOString() },
      message: 'Task deleted successfully'
    });
  })
);

/**
 * @route   POST /tasks/:id/comments
 * @desc    Add a comment to a task
 * @access  Private
 * @version v2
 */
router.post('/:id/comments',
  param('id').isUUID().withMessage('Task ID must be a valid UUID'),
  body('content')
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Comment content must be between 1 and 500 characters'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    logger.info('Adding comment to task', { taskId: id, userId });

    // Mock comment creation - replace with actual service call
    const newComment = {
      id: '550e8400-e29b-41d4-a716-446655440006',
      task_id: id,
      content,
      author: {
        id: userId,
        name: 'John Doe',
        email: 'john@example.com'
      },
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      success: true,
      data: newComment,
      message: 'Comment added successfully'
    });
  })
);

/**
 * @route   POST /tasks/bulk
 * @desc    Bulk operations on tasks
 * @access  Private
 * @version v2
 */
router.post('/bulk',
  body('operation')
    .isIn(['update', 'delete', 'assign'])
    .withMessage('Operation must be update, delete, or assign'),
  body('task_ids')
    .isArray({ min: 1, max: 50 })
    .withMessage('Task IDs must be an array of 1-50 items'),
  body('task_ids.*')
    .isUUID()
    .withMessage('Each task ID must be a valid UUID'),
  body('data')
    .optional()
    .isObject()
    .withMessage('Data must be an object'),
  validateRequest,
  asyncHandler(async (req: any, res: any) => {
    const { operation, task_ids, data } = req.body;
    const userId = req.user.id;

    logger.info('Bulk operation on tasks', {
      operation,
      taskCount: task_ids.length,
      userId
    });

    // Mock bulk operation - replace with actual service call
    const result = {
      operation,
      requested: task_ids.length,
      successful: task_ids.length,
      failed: 0,
      errors: [],
      processed_at: new Date().toISOString()
    };

    res.json({
      success: true,
      data: result,
      message: `Bulk ${operation} completed successfully`
    });
  })
);

export default router;
