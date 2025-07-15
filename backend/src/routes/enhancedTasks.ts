/**
 * Enhanced Task Routes
 * 
 * Comprehensive RESTful API routes for advanced task management with:
 * - Full CRUD operations with validation
 * - Bulk operations for multiple tasks
 * - Advanced search, filtering, and sorting
 * - Task analytics and statistics
 * - File attachment handling
 * - Activity logging and audit trails
 * - Rate limiting and security
 */

import { Router } from 'express';
import { EnhancedTaskController } from '../controllers/enhancedTaskController';
import { jwtAuth } from '../middleware/jwtAuth';
import { authLimiter } from '../middleware/rateLimiting';

const router = Router();

// Apply JWT authentication to all routes
router.use(jwtAuth);

// Apply rate limiting
router.use(authLimiter);

// =====================================================
// BASIC CRUD OPERATIONS
// =====================================================

/**
 * @route   GET /api/v1/tasks
 * @desc    Get user's tasks with advanced filtering and pagination
 * @access  Private
 * @query   {string} search - Search term for title/description
 * @query   {string} status - Task status filter
 * @query   {string} priority - Task priority filter
 * @query   {string} category_id - Category filter
 * @query   {string} tags - Comma-separated tags
 * @query   {string} due_date_from - Due date range start
 * @query   {string} due_date_to - Due date range end
 * @query   {string} sort_by - Sort field
 * @query   {string} sort_order - Sort direction (ASC/DESC)
 * @query   {number} page - Page number
 * @query   {number} limit - Items per page
 */
router.get('/', EnhancedTaskController.getTasks);

/**
 * @route   GET /api/v1/tasks/search
 * @desc    Advanced task search with complex filters
 * @access  Private
 */
router.get('/search', EnhancedTaskController.searchTasks);

/**
 * @route   GET /api/v1/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private
 */
router.get('/:id', EnhancedTaskController.getTask);

/**
 * @route   POST /api/v1/tasks
 * @desc    Create a new task with validation
 * @access  Private
 * @body    {CreateTaskData} Task data
 */
router.post('/', EnhancedTaskController.createTask);

/**
 * @route   PUT /api/v1/tasks/:id
 * @desc    Update a task completely
 * @access  Private
 * @body    {UpdateTaskData} Task data
 */
router.put('/:id', EnhancedTaskController.updateTask);

/**
 * @route   PATCH /api/v1/tasks/:id
 * @desc    Partially update a task
 * @access  Private
 * @body    {Partial<UpdateTaskData>} Task data
 */
router.patch('/:id', EnhancedTaskController.updateTask);

/**
 * @route   DELETE /api/v1/tasks/:id
 * @desc    Delete a task (soft delete)
 * @access  Private
 */
router.delete('/:id', EnhancedTaskController.deleteTask);

// =====================================================
// BULK OPERATIONS
// =====================================================

/**
 * @route   PATCH /api/v1/tasks/bulk/update
 * @desc    Bulk update multiple tasks
 * @access  Private
 * @body    {object} { task_ids: string[], data: UpdateTaskData }
 */
router.patch('/bulk/update', EnhancedTaskController.bulkUpdateTasks);

// =====================================================
// ANALYTICS AND STATISTICS
// =====================================================

/**
 * @route   GET /api/v1/tasks/analytics
 * @desc    Get task analytics and insights
 * @access  Private
 * @query   {string} period - Time period (day/week/month/year)
 * @query   {string} group_by - Group by field
 * @query   {string} start_date - Analysis start date
 * @query   {string} end_date - Analysis end date
 */
router.get('/analytics', EnhancedTaskController.getTaskAnalytics);

/**
 * @route   GET /api/v1/tasks/stats
 * @desc    Get comprehensive task statistics
 * @access  Private
 */
router.get('/stats', EnhancedTaskController.getTaskStats);

/**
 * @route   GET /api/v1/tasks/overdue
 * @desc    Get overdue tasks
 * @access  Private
 */
router.get('/overdue', EnhancedTaskController.getOverdueTasks);

/**
 * @route   GET /api/v1/tasks/upcoming
 * @desc    Get upcoming tasks
 * @access  Private
 */
router.get('/upcoming', EnhancedTaskController.getUpcomingTasks);

/**
 * @route   GET /api/v1/tasks/status/:status
 * @desc    Get tasks by status
 * @access  Private
 */
router.get('/status/:status', EnhancedTaskController.getTasksByStatus);

// =====================================================
// TASK EXPORT
// =====================================================

/**
 * @route   GET /api/v1/tasks/export
 * @desc    Export tasks to various formats
 * @access  Private
 * @query   {string} format - Export format (json/csv/pdf)
 */
router.get('/export', EnhancedTaskController.exportTasks);

export default router;
