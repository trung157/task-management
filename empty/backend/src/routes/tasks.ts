/**
 * Task Routes
 * 
 * RESTful API routes for task management with:
 * - CRUD operations
 * - Search and filtering
 * - Analytics endpoints
 * - Authentication and validation middleware
 */

import { Router } from 'express';
import TaskController from '../controllers/taskController';
import { jwtAuth } from '../middleware/jwtAuth';

const router = Router();

// Apply JWT authentication to all routes
router.use(jwtAuth);

// =====================================================
// TASK ROUTES
// =====================================================

/**
 * @route   GET /api/tasks
 * @desc    Get user's tasks with pagination
 * @access  Private
 */
router.get('/', TaskController.getUserTasks);

/**
 * @route   GET /api/tasks/search
 * @desc    Search tasks with filters
 * @access  Private
 */
router.get('/search', TaskController.searchTasks);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics
 * @access  Private
 */
router.get('/stats', TaskController.getTaskStats);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 */
router.post(
  '/',
  TaskController.validateCreateTask,
  TaskController.createTask
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get task by ID
 * @access  Private
 */
router.get(
  '/:id',
  TaskController.validateTaskId,
  TaskController.getTask
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update task
 * @access  Private
 */
router.put(
  '/:id',
  TaskController.validateUpdateTask,
  TaskController.updateTask
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete task (soft delete)
 * @access  Private
 */
router.delete(
  '/:id',
  TaskController.validateTaskId,
  TaskController.deleteTask
);

export default router;
