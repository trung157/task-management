import { Router } from 'express';
import { AuthController } from '../../controllers/authController';
import { validateRequest } from '../../middleware/validation';
import { asyncHandler } from '../../middleware/errorHandler';
import {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateRefreshToken,
  validateVerifyEmail,
  validateResendVerification,
} from '../../validators/authValidator';
import {
  authLimiter,
  loginAttemptLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  registrationLimiter,
  checkTemporaryBlock,
} from '../../middleware/rateLimiting';

const router = Router();
const authController = new AuthController();

// Apply temporary block check to all auth routes
router.use(checkTemporaryBlock);

// Routes with rate limiting
router.post('/register', registrationLimiter, validateRegister, validateRequest, asyncHandler(authController.register));
router.post('/login', authLimiter, validateLogin, validateRequest, asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/refresh-token', authLimiter, validateRefreshToken, validateRequest, asyncHandler(authController.refreshToken));
router.post('/forgot-password', passwordResetLimiter, validateForgotPassword, validateRequest, asyncHandler(authController.forgotPassword));
router.post('/reset-password', authLimiter, validateResetPassword, validateRequest, asyncHandler(authController.resetPassword));
router.get('/verify-email/:token', validateVerifyEmail, validateRequest, asyncHandler(authController.verifyEmail));
router.post('/resend-verification', emailVerificationLimiter, validateResendVerification, validateRequest, asyncHandler(authController.resendVerification));

// Utility endpoints
router.post('/check-password-strength', authLimiter, asyncHandler(authController.checkPasswordStrength));

export default router;
