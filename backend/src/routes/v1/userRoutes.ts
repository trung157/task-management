import { Router } from 'express';
import { UserController } from '../../controllers/userController';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import { requireOwnershipOrAdmin, requireAdmin } from '../../middleware/auth';
import {
  validateUpdateProfile,
  validateChangePassword,
  validateUpdateEmail,
  validateDeleteAccount,
  validateUserId,
  validateNotificationPreferences,
  validateExportData,
  validateCreateUser,
  validateListUsers,
  validateSearchUsers,
} from '../../validators/userValidator';

const router = Router();
const userController = new UserController();

// Public user routes (authenticated users)
router.get('/profile', asyncHandler(userController.getProfile));
router.put('/profile', validateUpdateProfile, validateRequest, asyncHandler(userController.updateProfile));
router.post('/change-password', validateChangePassword, validateRequest, asyncHandler(userController.changePassword));
router.put('/email', validateUpdateEmail, validateRequest, asyncHandler(userController.updateEmail));
router.delete('/account', validateDeleteAccount, validateRequest, asyncHandler(userController.deleteAccount));

// User preferences
router.get('/preferences', asyncHandler(userController.getPreferences));
router.put('/preferences/notifications', validateNotificationPreferences, validateRequest, asyncHandler(userController.updateNotificationPreferences));

// Data export
router.get('/export', validateExportData, validateRequest, asyncHandler(userController.exportUserData));

// Admin routes - User management
router.post('/', requireAdmin, validateCreateUser, validateRequest, asyncHandler(userController.createUser));
router.get('/', requireAdmin, validateListUsers, validateRequest, asyncHandler(userController.listUsers));
router.get('/search', requireAdmin, validateSearchUsers, validateRequest, asyncHandler(userController.searchUsers));
router.get('/stats', requireAdmin, asyncHandler(userController.getUserStats));

// Individual user management (admin or user themselves)
router.get('/:id', validateUserId, validateRequest, requireOwnershipOrAdmin(), asyncHandler(userController.getUserById));
router.put('/:id', validateUpdateProfile, validateRequest, requireOwnershipOrAdmin(), asyncHandler(userController.updateUser));
router.delete('/:id', validateUserId, validateRequest, requireOwnershipOrAdmin(), asyncHandler(userController.deleteUser));

export default router;
