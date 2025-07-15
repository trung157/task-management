/**
 * Modern Task Routes
 * 
 * Comprehensive RESTful API routes for task management with:
 * - Full CRUD operations with validation
 * - Input validation middleware
 * - Error handling and response formatting
 * - Security and rate limiting
 * - Detailed documentation
 */

import { Router } from 'express';
import {
  TaskController,
  createTaskValidation,
  updateTaskValidation,
  taskIdValidation,
  searchTasksValidation
} from '../controllers/modernTaskController';
import { jwtAuth } from '../middleware/jwtAuth';
import { authLimiter } from '../middleware/rateLimiting';

const router = Router();

// Apply authentication and rate limiting to all routes
router.use(jwtAuth);
router.use(authLimiter);

// =====================================================
// BASIC CRUD OPERATIONS
// =====================================================

/**
 * @route   GET /api/v1/tasks
 * @desc    Get user's tasks with pagination and basic filtering
 * @access  Private
 * @query   {string} search - Search term for title/description
 * @query   {string} status - Task status filter
 * @query   {string} priority - Task priority filter
 * @query   {string} category_id - Category filter
 * @query   {string} tags - Comma-separated tags
 * @query   {string} sort_by - Sort field
 * @query   {string} sort_order - Sort direction (ASC/DESC)
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 */
router.get('/', TaskController.getTasks);

/**
 * @route   GET /api/v1/tasks/search
 * @desc    Advanced task search with complex filters
 * @access  Private
 * @query   {string} search - Search term
 * @query   {string} status - Status filter
 * @query   {string} priority - Priority filter
 * @query   {string} category_id - Category filter
 * @query   {string} tags - Tags filter
 * @query   {string} due_date_from - Due date range start
 * @query   {string} due_date_to - Due date range end
 * @query   {string} created_after - Created after date
 * @query   {string} created_before - Created before date
 * @query   {boolean} is_overdue - Filter overdue tasks
 * @query   {boolean} include_archived - Include archived tasks
 * @query   {boolean} include_deleted - Include deleted tasks
 * @query   {string} sort_by - Sort field
 * @query   {string} sort_order - Sort direction
 * @query   {number} page - Page number
 * @query   {number} limit - Items per page
 */
router.get('/search', searchTasksValidation, TaskController.searchTasks);

/**
 * @route   GET /api/v1/tasks/stats
 * @desc    Get comprehensive task statistics
 * @access  Private
 */
router.get('/stats', TaskController.getTaskStats);

/**
 * @route   GET /api/v1/tasks/export
 * @desc    Export tasks to various formats
 * @access  Private
 * @query   {string} format - Export format (json/csv)
 */
router.get('/export', TaskController.exportTasks);

/**
 * @route   GET /api/v1/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private
 * @param   {string} id - Task UUID
 */
router.get('/:id', taskIdValidation, TaskController.getTask);

/**
 * @route   POST /api/v1/tasks
 * @desc    Create a new task with validation
 * @access  Private
 * @body    {CreateTaskData} Task data
 * @body    {string} title - Task title (required, 1-500 chars)
 * @body    {string} [description] - Task description (max 2000 chars)
 * @body    {string} [priority] - Priority: high, medium, low, none
 * @body    {string} [status] - Status: pending, in_progress, completed, archived
 * @body    {string} [due_date] - Due date (ISO 8601 format)
 * @body    {string} [start_date] - Start date (ISO 8601 format)
 * @body    {number} [estimated_minutes] - Estimated time (0-43200)
 * @body    {string} [category_id] - Category UUID
 * @body    {string[]} [tags] - Array of tags (max 20 items, 50 chars each)
 * @body    {object} [metadata] - Additional metadata
 */
router.post('/', createTaskValidation, TaskController.createTask);

/**
 * @route   PUT /api/v1/tasks/:id
 * @desc    Update a task completely
 * @access  Private
 * @param   {string} id - Task UUID
 * @body    {UpdateTaskData} Task data (same fields as create)
 */
router.put('/:id', updateTaskValidation, TaskController.updateTask);

/**
 * @route   PATCH /api/v1/tasks/:id
 * @desc    Partially update a task
 * @access  Private
 * @param   {string} id - Task UUID
 * @body    {Partial<UpdateTaskData>} Task data (any subset of fields)
 */
router.patch('/:id', updateTaskValidation, TaskController.updateTask);

/**
 * @route   DELETE /api/v1/tasks/:id
 * @desc    Delete a task (soft delete)
 * @access  Private
 * @param   {string} id - Task UUID
 */
router.delete('/:id', taskIdValidation, TaskController.deleteTask);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * @route   PATCH /api/v1/tasks/bulk
 * @desc    Bulk update multiple tasks
 * @access  Private
 * @body    {object} Request body
 * @body    {string[]} task_ids - Array of task UUIDs
 * @body    {UpdateTaskData} updates - Update data to apply to all tasks
 */
router.patch('/bulk', TaskController.bulkUpdateTasks);

export default router;
