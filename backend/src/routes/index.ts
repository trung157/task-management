import { Router } from 'express';
import { createVersionedRouter } from '../middleware/versioning/routerFactory';
import { versionInfoMiddleware } from '../middleware/versioning/apiVersion';
import configureV1Routes, { v1RouteConfigs } from './v1';
import { logger } from '../utils/logger';

/**
 * Main API Router with versioning support
 * Configures all API versions and provides version management
 */

export function createApiRouter(): Router {
  // Create the main versioned router
  const apiRouter = createVersionedRouter();
  
  // Configure V1 routes (legacy routes)
  logger.info('Configuring API v1 routes...');
  const v1Router = apiRouter.version('v1');
  configureV1Routes(v1Router);
  v1Router.addRoutes(v1RouteConfigs);
  
  // Add global routes that work across all versions
  logger.info('Configuring global API routes...');
  apiRouter.addGlobalRoute({
    path: '/versions',
    method: 'get',
    handler: versionInfoMiddleware,
    auth: false,
    description: 'Get API version information'
  });
  
  // Global API status endpoint
  apiRouter.addGlobalRoute({
    path: '/status',
    method: 'get',
    handler: (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          api: 'TaskFlow API',
          status: 'operational',
          timestamp: new Date().toISOString(),
          requestedVersion: req.apiVersion || 'v1',
          availableVersions: ['v1']
        },
        message: 'API is operational'
      });
    },
    auth: false,
    description: 'Global API status endpoint'
  });
  
  logger.info('API routing configuration completed', {
    versions: ['v1'],
    features: {
      v1: 'Core features, task management, user authentication'
    }
  });
  
  return apiRouter.getRouter();
}

/**
 * Legacy router for backwards compatibility
 * Routes without version prefix default to v1
 */
export function createLegacyRouter(): Router {
  const router = Router();
  
  // Import legacy routes directly  
  const authRoutes = require('./authRoutes').default;
  const userRoutes = require('./userRoutes').default;
  const taskRoutes = require('./tasks').default; // Use new repository-based routes
  const tagRoutes = require('./tagRoutes').default;
  const notificationRoutes = require('./notificationRoutes').default;
  
  // Mount legacy routes without version prefix
  router.use('/auth', authRoutes);
  router.use('/users', userRoutes);
  router.use('/tasks', taskRoutes);
  router.use('/tags', tagRoutes);
  router.use('/notifications', notificationRoutes);
  
  logger.info('Legacy router configured for backwards compatibility');
  
  return router;
}

export default createApiRouter;
