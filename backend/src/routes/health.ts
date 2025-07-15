/**
 * Health Check Routes
 * 
 * Routes for system health monitoring
 */

import { Router } from 'express';
import { 
  getHealth, 
  getDetailedHealth, 
  getReady, 
  getLive 
} from '../controllers/healthController';

const router = Router();

/**
 * @route GET /health
 * @desc Basic health check
 * @access Public
 */
router.get('/', getHealth);

/**
 * @route GET /health/detailed
 * @desc Detailed health check with service information
 * @access Public
 */
router.get('/detailed', getDetailedHealth);

/**
 * @route GET /health/ready
 * @desc Readiness probe for Kubernetes/Docker
 * @access Public
 */
router.get('/ready', getReady);

/**
 * @route GET /health/live
 * @desc Liveness probe for Kubernetes/Docker
 * @access Public
 */
router.get('/live', getLive);

export default router;
