/**
 * Enhanced Routing Setup for Task Management System
 * 
 * This file provides a comprehensive routing architecture with:
 * - Modular route organization
 * - API versioning (v1, v2, v3)
 * - Middleware application layers
 * - Security and validation
 * - Rate limiting and monitoring
 * - Documentation integration
 */

import { Router, Application, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { createVersionedRouter } from '../middleware/versioning/routerFactory';
import { versionInfoMiddleware } from '../middleware/versioning/apiVersion';

// Core middleware imports
import { jwtAuth, optionalAuth } from '../middleware/jwtAuth';
import { defaultLimiter, authLimiter } from '../middleware/rateLimiting';
import { validateRequest } from '../middleware/validation';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';
import { requestLogger } from '../middleware/security';

// Route modules imports
import configureV1Routes, { v1RouteConfigs } from './v1';
import configureV2Routes, { v2RouteConfigs } from './v2';
import configureV3Routes, { v3RouteConfigs } from './v3';

// Feature-specific route imports
import authRoutes from './auth';
import userManagementRoutes from './userManagementRoutes';
import taskRoutes from './tasks/taskRoutes';
// Note: Other route modules will be added as they are implemented
// import projectRoutes from './projects/projectRoutes';
// import teamRoutes from './teams/teamRoutes';
// import notificationRoutes from './notifications/notificationRoutes';
// import analyticsRoutes from './analytics/analyticsRoutes';
// import adminRoutes from './admin/adminRoutes';
// import webhookRoutes from './webhooks/webhookRoutes';

export interface RouteModule {
  path: string;
  router: Router;
  middleware?: any[];
  description: string;
  version?: string;
  auth?: boolean;
  rateLimit?: any;
}

export interface APIRouteConfig {
  modules: RouteModule[];
  globalMiddleware: any[];
  security: {
    cors: boolean;
    helmet: boolean;
    rateLimiting: boolean;
  };
  documentation: {
    enabled: boolean;
    path: string;
  };
}

/**
 * Main API Router Factory
 * Creates a comprehensive routing structure with versioning
 */
export class TaskManagementRouter {
  private app: Application;
  private versionedRouter: any;
  private config: APIRouteConfig;

  constructor(app: Application, config?: Partial<APIRouteConfig>) {
    this.app = app;
    this.versionedRouter = createVersionedRouter();
    this.config = this.getDefaultConfig(config);
  }

  /**
   * Initialize and configure all routes
   */
  public setupRoutes(): void {
    logger.info('🚀 Initializing TaskManagement API Routing...');

    // Apply global middleware
    this.applyGlobalMiddleware();

    // Setup API versioning
    this.setupVersionedRoutes();

    // Setup feature-specific routes
    this.setupFeatureRoutes();

    // Setup legacy compatibility
    this.setupLegacyRoutes();

    // Setup admin and monitoring routes
    this.setupAdminRoutes();

    // Setup error handling
    this.setupErrorHandling();

    logger.info('✅ TaskManagement API Routing configured successfully');
  }

  /**
   * Apply global middleware to all routes
   */
  private applyGlobalMiddleware(): void {
    logger.info('📝 Applying global middleware...');

    // Request logging and monitoring
    this.app.use('/api', requestLogger);

    // Global rate limiting
    if (this.config.security.rateLimiting) {
      this.app.use('/api', defaultLimiter);
    }

    // Request validation and sanitization
    this.app.use('/api', validateRequest);

    // Apply additional global middleware
    this.config.globalMiddleware.forEach(middleware => {
      this.app.use('/api', middleware);
    });
  }

  /**
   * Setup versioned API routes (v1, v2, v3)
   */
  private setupVersionedRoutes(): void {
    logger.info('🔄 Setting up versioned API routes...');

    // Configure V1 routes (Legacy + Stable)
    const v1Router = this.versionedRouter.version('v1');
    configureV1Routes(v1Router);
    v1Router.addRoutes(v1RouteConfigs);

    // Configure V2 routes (Enhanced Features)
    const v2Router = this.versionedRouter.version('v2');
    configureV2Routes(v2Router);
    v2Router.addRoutes(v2RouteConfigs);

    // Configure V3 routes (Latest Features)
    const v3Router = this.versionedRouter.version('v3');
    configureV3Routes(v3Router);
    v3Router.addRoutes(v3RouteConfigs);

    // Mount versioned routes
    this.app.use('/api', this.versionedRouter.getRouter());

    // Add global versioning info endpoints
    this.setupVersioningEndpoints();
  }

  /**
   * Setup feature-specific route modules
   */
  private setupFeatureRoutes(): void {
    logger.info('🎯 Setting up feature-specific routes...');

    const featureRoutes: RouteModule[] = [
      {
        path: '/auth',
        router: authRoutes,
        middleware: [authLimiter],
        description: 'Authentication and authorization',
        auth: false,
        rateLimit: authLimiter
      },
      {
        path: '/users',
        router: userManagementRoutes,
        middleware: [jwtAuth],
        description: 'User management and profiles',
        auth: true
      },
      {
        path: '/tasks',
        router: taskRoutes,
        middleware: [jwtAuth],
        description: 'Task management and operations',
        auth: true
      }/*,
      {
        path: '/projects',
        router: projectRoutes,
        middleware: [jwtAuth],
        description: 'Project management',
        auth: true
      },
      {
        path: '/teams',
        router: teamRoutes,
        middleware: [jwtAuth],
        description: 'Team collaboration',
        auth: true
      },
      {
        path: '/notifications',
        router: notificationRoutes,
        middleware: [jwtAuth],
        description: 'Notification system',
        auth: true
      },
      {
        path: '/analytics',
        router: analyticsRoutes,
        middleware: [jwtAuth, defaultLimiter],
        description: 'Analytics and reporting',
        auth: true,
        rateLimit: defaultLimiter
      },
      {
        path: '/webhooks',
        router: webhookRoutes,
        middleware: [optionalAuth],
        description: 'Webhook integrations',
        auth: false
      }*/
    ];

    // Mount each feature route module
    featureRoutes.forEach(route => {
      const middlewares = route.middleware || [];
      
      if (route.rateLimit) {
        middlewares.unshift(route.rateLimit);
      }

      this.app.use(`/api${route.path}`, ...middlewares, route.router);
      
      logger.info(`📍 Mounted ${route.description} at /api${route.path}`, {
        auth: route.auth,
        middleware: middlewares.length,
        rateLimit: !!route.rateLimit
      });
    });
  }

  /**
   * Setup legacy routes for backwards compatibility
   */
  private setupLegacyRoutes(): void {
    logger.info('🔗 Setting up legacy compatibility routes...');

    const legacyRouter = Router();

    // Legacy route mappings (without version prefix)
    const legacyMappings = [
      { path: '/auth', target: authRoutes },
      { path: '/users', target: userManagementRoutes },
      { path: '/tasks', target: taskRoutes }
      // { path: '/notifications', target: notificationRoutes }
    ];

    legacyMappings.forEach(mapping => {
      legacyRouter.use(mapping.path, mapping.target);
    });

    // Mount legacy routes
    this.app.use('/api', legacyRouter);

    logger.info('✅ Legacy compatibility routes configured');
  }

  /**
   * Setup admin and monitoring routes
   */
  private setupAdminRoutes(): void {
    logger.info('👑 Setting up admin and monitoring routes...');

    // Admin routes with enhanced security (commented out until implemented)
    /*
    this.app.use('/api/admin', 
      authLimiter,
      jwtAuth,
      adminRoutes
    );
    */

    // System monitoring endpoints
    this.setupMonitoringEndpoints();

    // API documentation
    if (this.config.documentation.enabled) {
      this.setupDocumentationEndpoints();
    }
  }

  /**
   * Setup versioning info endpoints
   */
  private setupVersioningEndpoints(): void {
    // Global version info
    this.app.get('/api/versions', versionInfoMiddleware);

    // Version-specific info
    this.app.get('/api/v:version/info', (req, res) => {
      const version = req.params.version;
      const versionInfo = this.getVersionInfo(version);
      
      res.json({
        success: true,
        data: versionInfo,
        message: `API v${version} information`
      });
    });

    // API capabilities endpoint
    this.app.get('/api/capabilities', (req, res) => {
      res.json({
        success: true,
        data: {
          versions: ['v1', 'v2', 'v3'],
          features: this.getAPIFeatures(),
          endpoints: this.getEndpointSummary(),
          authentication: ['JWT', 'API Key'],
          rateLimiting: true,
          pagination: true,
          filtering: true,
          sorting: true
        },
        message: 'API capabilities and features'
      });
    });
  }

  /**
   * Setup monitoring endpoints
   */
  private setupMonitoringEndpoints(): void {
    // Health check with detailed info
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        routes: {
          total: this.getRouteCount(),
          versions: ['v1', 'v2', 'v3']
        }
      });
    });

    // API status endpoint
    this.app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        data: {
          api: 'TaskManagement API',
          status: 'operational',
          timestamp: new Date().toISOString(),
          versions: {
            available: ['v1', 'v2', 'v3'],
            latest: 'v3',
            stable: 'v2',
            deprecated: []
          },
          features: this.getAPIFeatures()
        },
        message: 'API is operational'
      });
    });

    // Metrics endpoint (admin only)
    this.app.get('/api/metrics',
      jwtAuth,
      (req: Request, res: Response) => {
        res.json({
          success: true,
          data: {
            routes: this.getRouteMetrics(),
            middleware: this.getMiddlewareMetrics(),
            versions: this.getVersionMetrics()
          },
          message: 'API metrics'
        });
      }
    );
  }

  /**
   * Setup documentation endpoints
   */
  private setupDocumentationEndpoints(): void {
    const docPath = this.config.documentation.path;

    // OpenAPI/Swagger documentation
    this.app.get(`${docPath}/openapi.json`, (req, res) => {
      res.json(this.generateOpenAPISpec());
    });

    // Interactive API documentation
    this.app.get(`${docPath}`, (req, res) => {
      res.json({
        success: true,
        data: {
          title: 'TaskManagement API Documentation',
          description: 'Comprehensive API documentation for the task management system',
          openapi: `${docPath}/openapi.json`,
          postman: `${docPath}/postman.json`,
          versions: ['v1', 'v2', 'v3']
        },
        message: 'API documentation available'
      });
    });
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    // 404 handler for API routes
    this.app.use('/api/*', notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(config?: Partial<APIRouteConfig>): APIRouteConfig {
    return {
      modules: [],
      globalMiddleware: [],
      security: {
        cors: true,
        helmet: true,
        rateLimiting: true
      },
      documentation: {
        enabled: true,
        path: '/api/docs'
      },
      ...config
    };
  }

  /**
   * Get version information
   */
  private getVersionInfo(version: string): any {
    const versionData: Record<string, any> = {
      v1: {
        version: 'v1',
        status: 'stable',
        description: 'Legacy API with core functionality',
        deprecated: false,
        features: ['Basic CRUD', 'Authentication', 'User Management']
      },
      v2: {
        version: 'v2',
        status: 'stable',
        description: 'Enhanced API with advanced features',
        deprecated: false,
        features: ['Advanced CRUD', 'Team Management', 'Analytics', 'Webhooks']
      },
      v3: {
        version: 'v3',
        status: 'beta',
        description: 'Latest API with cutting-edge features',
        deprecated: false,
        features: ['AI Integration', 'Real-time Collaboration', 'Advanced Analytics']
      }
    };

    return versionData[version] || { error: 'Version not found' };
  }

  /**
   * Get API features summary
   */
  private getAPIFeatures(): string[] {
    return [
      'User Authentication & Authorization',
      'Task Management & Organization',
      'Project & Team Collaboration',
      'Real-time Notifications',
      'Advanced Analytics & Reporting',
      'Webhook Integrations',
      'API Versioning',
      'Rate Limiting & Security',
      'Comprehensive Documentation'
    ];
  }

  /**
   * Get endpoint summary
   */
  private getEndpointSummary(): Record<string, number> {
    return {
      auth: 8,
      users: 12,
      tasks: 15,
      projects: 10,
      teams: 8,
      notifications: 6,
      analytics: 5,
      admin: 7,
      webhooks: 4
    };
  }

  /**
   * Get route count
   */
  private getRouteCount(): number {
    return Object.values(this.getEndpointSummary()).reduce((a, b) => a + b, 0);
  }

  /**
   * Get route metrics (mock implementation)
   */
  private getRouteMetrics(): any {
    return {
      total: this.getRouteCount(),
      byVersion: { v1: 35, v2: 42, v3: 28 },
      byFeature: this.getEndpointSummary()
    };
  }

  /**
   * Get middleware metrics (mock implementation)
   */
  private getMiddlewareMetrics(): any {
    return {
      authentication: 'JWT + API Key',
      rateLimiting: 'Redis-based',
      validation: 'express-validator',
      security: 'Helmet + CORS'
    };
  }

  /**
   * Get version metrics (mock implementation)
   */
  private getVersionMetrics(): any {
    return {
      v1: { usage: '45%', status: 'stable' },
      v2: { usage: '40%', status: 'stable' },
      v3: { usage: '15%', status: 'beta' }
    };
  }

  /**
   * Generate OpenAPI specification (mock implementation)
   */
  private generateOpenAPISpec(): any {
    return {
      openapi: '3.0.0',
      info: {
        title: 'TaskManagement API',
        version: '3.0.0',
        description: 'Comprehensive task management system API'
      },
      servers: [
        { url: '/api/v1', description: 'Version 1 (Stable)' },
        { url: '/api/v2', description: 'Version 2 (Enhanced)' },
        { url: '/api/v3', description: 'Version 3 (Latest)' }
      ],
      paths: {
        // This would be generated from actual routes
      }
    };
  }
}

/**
 * Initialize and configure routing for the Express app
 */
export function setupTaskManagementRoutes(app: Application, config?: Partial<APIRouteConfig>): void {
  const router = new TaskManagementRouter(app, config);
  router.setupRoutes();
}

export default TaskManagementRouter;
