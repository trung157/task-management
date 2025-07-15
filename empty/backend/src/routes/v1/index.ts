import { Router } from 'express';
import { VersionedRouter, VersionedRouteConfig } from '../../middleware/versioning/routerFactory';

// Import V1 route handlers
import authRoutes from './authRoutes';
import userRoutes from './userRoutes';
import modernUserRoutes from '../modernUsers'; // Modern user service routes
import taskRoutes from '../tasks'; // Using new repository-based task routes
import modernTaskRoutes from '../modernTasks'; // Modern task controller with validation
import enhancedTaskRoutes from '../enhancedTasks'; // Enhanced task controller with advanced features
import tagRoutes from './tagRoutes';
import notificationRoutes from './notificationRoutes';
import advancedNotificationRoutes from '../advancedTaskNotifications'; // Advanced notification routes

/**
 * V1 API Routes Configuration
 * Maintains backwards compatibility and legacy endpoint structure
 */

export function configureV1Routes(versionedRouter: VersionedRouter): VersionedRouter {
  // Mount existing route modules for V1
  const router = versionedRouter.getRouter();
  
  // V1 Authentication routes (no auth required)
  router.use('/auth', authRoutes);
  
  // V1 User management routes (auth required)
  router.use('/users', userRoutes);
  
  // V1 Modern User management routes with advanced features (auth required)
  router.use('/users-v2', modernUserRoutes);
  
  // V1 Task management routes (auth required)
  // Using new repository pattern for better performance and maintainability
  router.use('/tasks', taskRoutes);
  
  // V1 Modern Task management routes with comprehensive validation and error handling
  router.use('/tasks-v2', modernTaskRoutes);
  
  // V1 Enhanced Task management routes with advanced features and analytics
  router.use('/tasks-enhanced', enhancedTaskRoutes);
  
  // V1 Tag management routes (auth required)
  router.use('/tags', tagRoutes);
  
  // V1 Notification routes (auth required)
  router.use('/notifications', notificationRoutes);

  // V1 Advanced Task Notification routes (auth required)
  router.use('/task-notifications', advancedNotificationRoutes);

  return versionedRouter;
}

/**
 * V1 specific route configurations using the new versioned system
 * This demonstrates how to migrate to the new versioned routing system
 */
export const v1RouteConfigs: VersionedRouteConfig[] = [
  // Health check endpoint
  {
    path: '/health',
    method: 'get',
    handler: (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          version: 'v1',
          status: 'healthy',
          timestamp: new Date().toISOString()
        },
        message: 'API v1 is operational'
      });
    },
    auth: false,
    description: 'V1 health check endpoint'
  },
  
  // V1 API Information
  {
    path: '/info',
    method: 'get',
    handler: (req: any, res: any) => {
      res.json({
        success: true,
        data: {
          version: 'v1',
          name: 'TaskFlow API v1',
          description: 'Legacy API version with core functionality',
          features: [
            'User authentication and management',
            'Task CRUD operations',
            'Tag management',
            'Basic notifications',
            'Advanced task notifications and reminders',
            'Profile management'
          ],
          deprecated: false,
          endpoints: {
            auth: '/api/v1/auth',
            users: '/api/v1/users',
            tasks: '/api/v1/tasks',
            tags: '/api/v1/tags',
            notifications: '/api/v1/notifications',
            taskNotifications: '/api/v1/task-notifications'
          }
        },
        message: 'TaskFlow API v1 information'
      });
    },
    auth: false,
    description: 'V1 API information endpoint'
  }
];

export default configureV1Routes;
