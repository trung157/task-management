import { Router } from 'express';
import { TaskController } from '../controllers/taskController.modern';
import { validateRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import {
  validateCreateTask,
  validateUpdateTask,
  validateTaskId,
  validateTaskSearch,
  validateBulkStatusUpdateModern,
  validateBulkTaskOperationModern,
  validateTaskStats,
  validateTasksDueSoon,
  validateMarkCompleted,
  validateDuplicateTask,
  validateSendReminder,
  validateAdvancedSearch,
} from '../validators/taskValidator';

/**
 * Modern Task Routes with comprehensive CRUD operations
 * All routes are protected by authentication middleware (applied at router level)
 */
const router = Router();
const taskController = new TaskController();

// Core CRUD operations
router.get('/', validateTaskSearch, validateRequest, asyncHandler(taskController.getTasks));
router.post('/', validateCreateTask, validateRequest, asyncHandler(taskController.createTask));
router.get('/stats', validateTaskStats, validateRequest, asyncHandler(taskController.getTaskStats));
router.get('/search', validateAdvancedSearch, validateRequest, asyncHandler(taskController.searchTasks));
router.get('/due-soon', validateTasksDueSoon, validateRequest, asyncHandler(taskController.getTasksDueSoon));
router.get('/overdue', validateRequest, asyncHandler(taskController.getOverdueTasks));

// Task-specific operations (must come after other GET routes to avoid conflicts)
router.get('/:id', validateTaskId, validateRequest, asyncHandler(taskController.getTask));
router.put('/:id', validateUpdateTask, validateRequest, asyncHandler(taskController.updateTask));
router.delete('/:id', validateTaskId, validateRequest, asyncHandler(taskController.deleteTask));

// Task status management
router.patch('/:id/complete', validateMarkCompleted, validateRequest, asyncHandler(taskController.markCompleted));
router.patch('/:id/start', validateTaskId, validateRequest, asyncHandler(taskController.markInProgress));

// Task operations
router.post('/:id/duplicate', validateDuplicateTask, validateRequest, asyncHandler(taskController.duplicateTask));
router.post('/:id/reminder', validateSendReminder, validateRequest, asyncHandler(taskController.sendReminder));

// Bulk operations
router.patch('/bulk/status', validateBulkStatusUpdateModern, validateRequest, asyncHandler(taskController.bulkUpdateStatus));
router.delete('/bulk', validateBulkTaskOperationModern, validateRequest, asyncHandler(taskController.bulkDelete));

export default router;
