/**
 * Modern Express.js Routing Setup
 * Complete routing integration with organization, middleware, and API versioning
 */

import { Application } from 'express';
import { ExpressRouteOrganizer } from './RouteOrganizer';
import { logger } from '../utils/logger';

// Import route modules
import taskRoutes from './modules/taskRoutes';
import projectRoutes from './modules/projectRoutes';
import authRoutes from './modules/authRoutes';
import userRoutes from './modules/userRoutes';
import teamRoutes from './modules/teamRoutes';
import notificationRoutes from './modules/notificationRoutes';

// Import middleware
import { jwtAuth } from '../middleware/jwtAuth';
import { defaultLimiter, authLimiter } from '../middleware/rateLimiting';

/**
 * Configure and setup all application routes
 */
export function setupRoutes(app: Application): void {
  logger.info('🚀 Initializing Express.js routing system...');

  // Initialize the route organizer
  const routeOrganizer = new ExpressRouteOrganizer(app, {
    prefix: '/api',
    versions: ['v1', 'v2', 'v3'],
    defaultVersion: 'v1',
    security: {
      rateLimiting: true,
      authentication: true,
      validation: true
    },
    documentation: {
      enabled: true,
      path: '/docs'
    }
  });

  // =====================================================
  // AUTHENTICATION ROUTES (Public)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/auth',
    router: authRoutes,
    middleware: [authLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'Authentication and authorization endpoints'
  });

  // =====================================================
  // USER MANAGEMENT ROUTES (Private)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/users',
    router: userRoutes,
    middleware: [jwtAuth, defaultLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'User profile and management endpoints'
  });

  // =====================================================
  // TASK MANAGEMENT ROUTES (Private)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/tasks',
    router: taskRoutes,
    middleware: [jwtAuth, defaultLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'Task management and CRUD operations'
  });

  // =====================================================
  // PROJECT MANAGEMENT ROUTES (Private)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/projects',
    router: projectRoutes,
    middleware: [jwtAuth, defaultLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'Project management and collaboration'
  });

  // =====================================================
  // TEAM MANAGEMENT ROUTES (Private)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/teams',
    router: teamRoutes,
    middleware: [jwtAuth, defaultLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'Team management and collaboration'
  });

  // =====================================================
  // NOTIFICATION ROUTES (Private)
  // =====================================================
  routeOrganizer.registerRoute({
    path: '/notifications',
    router: notificationRoutes,
    middleware: [jwtAuth, defaultLimiter],
    version: ['v1', 'v2', 'v3'],
    description: 'Notification management and preferences'
  });

  // Setup all routes with the organizer
  routeOrganizer.setupRoutes();

  // Log routing statistics
  const stats = routeOrganizer.getStats();
  logger.info('✅ Routing setup complete', {
    totalRoutes: stats.totalRoutes,
    versions: stats.versions,
    features: stats.routes,
    middleware: stats.middleware
  });
}

/**
 * Get route information for documentation
 */
export function getRouteInfo(): any {
  return {
    apiPrefix: '/api',
    supportedVersions: ['v1', 'v2', 'v3'],
    defaultVersion: 'v1',
    features: [
      {
        name: 'Authentication',
        path: '/auth',
        description: 'User authentication and authorization',
        endpoints: [
          'POST /auth/register',
          'POST /auth/login',
          'POST /auth/logout',
          'POST /auth/refresh',
          'POST /auth/forgot-password',
          'POST /auth/reset-password',
          'GET /auth/me',
          'GET /auth/sessions'
        ]
      },
      {
        name: 'User Management',
        path: '/users',
        description: 'User profile and account management',
        endpoints: [
          'GET /users/profile',
          'PUT /users/profile',
          'PUT /users/preferences',
          'POST /users/avatar',
          'GET /users',
          'GET /users/:userId',
          'PUT /users/:userId/role'
        ]
      },
      {
        name: 'Task Management',
        path: '/tasks',
        description: 'Task creation, management, and tracking',
        endpoints: [
          'GET /tasks',
          'POST /tasks',
          'GET /tasks/:id',
          'PUT /tasks/:id',
          'DELETE /tasks/:id',
          'POST /tasks/bulk',
          'GET /tasks/:id/comments',
          'POST /tasks/:id/comments'
        ]
      },
      {
        name: 'Project Management',
        path: '/projects',
        description: 'Project organization and collaboration',
        endpoints: [
          'GET /projects',
          'POST /projects',
          'GET /projects/:id',
          'PUT /projects/:id',
          'DELETE /projects/:id',
          'GET /projects/:id/tasks',
          'POST /projects/:id/members',
          'GET /projects/:id/analytics'
        ]
      },
      {
        name: 'Team Management',
        path: '/teams',
        description: 'Team creation and collaboration',
        endpoints: [
          'GET /teams',
          'POST /teams',
          'GET /teams/:teamId',
          'PUT /teams/:teamId',
          'DELETE /teams/:teamId',
          'POST /teams/:teamId/members',
          'GET /teams/:teamId/projects'
        ]
      },
      {
        name: 'Notifications',
        path: '/notifications',
        description: 'Notification management and preferences',
        endpoints: [
          'GET /notifications',
          'GET /notifications/unread/count',
          'PUT /notifications/:notificationId',
          'PUT /notifications/bulk',
          'GET /notifications/preferences',
          'PUT /notifications/preferences'
        ]
      }
    ],
    systemEndpoints: [
      'GET /health',
      'GET /api/info',
      'GET /api/versions',
      'GET /docs'
    ],
    middleware: {
      global: ['compression', 'cors', 'helmet', 'morgan', 'rate-limiting'],
      authentication: ['jwt-auth', 'role-based-auth'],
      validation: ['express-validator', 'request-sanitization'],
      security: ['helmet', 'rate-limiting', 'parameter-pollution-prevention']
    }
  };
}

export default setupRoutes;
