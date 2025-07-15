/**
 * Express.js Route Organization System
 * Comprehensive routing setup with middleware and API versioning
 */

import { Router, Application } from 'express';
import { logger } from '../utils/logger';

// Core middleware imports
import { jwtAuth } from '../middleware/jwtAuth';
import { defaultLimiter, authLimiter } from '../middleware/rateLimiting';
import { validateRequest } from '../middleware/validation';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler';

/**
 * Route Organization Structure
 */
export interface RouteModule {
  path: string;
  router: Router;
  middleware?: any[];
  version?: string[];
  description: string;
}

/**
 * API Configuration
 */
export interface APIConfig {
  prefix: string;
  versions: string[];
  defaultVersion: string;
  security: {
    rateLimiting: boolean;
    authentication: boolean;
    validation: boolean;
  };
  documentation: {
    enabled: boolean;
    path: string;
  };
}

/**
 * Main Route Organizer Class
 */
export class ExpressRouteOrganizer {
  private app: Application;
  private config: APIConfig;
  private routes: Map<string, RouteModule> = new Map();

  constructor(app: Application, config?: Partial<APIConfig>) {
    this.app = app;
    this.config = {
      prefix: '/api',
      versions: ['v1', 'v2'],
      defaultVersion: 'v1',
      security: {
        rateLimiting: true,
        authentication: true,
        validation: true
      },
      documentation: {
        enabled: true,
        path: '/docs'
      },
      ...config
    };
  }

  /**
   * Register a route module
   */
  public registerRoute(module: RouteModule): void {
    this.routes.set(module.path, module);
    logger.info(`Registered route module: ${module.path} - ${module.description}`);
  }

  /**
   * Setup all routes with versioning and middleware
   */
  public setupRoutes(): void {
    logger.info('🚀 Setting up Express.js routing system...');

    // Apply global middleware
    this.applyGlobalMiddleware();

    // Setup API versioning
    this.setupVersioning();

    // Mount all registered routes
    this.mountRoutes();

    // Setup system endpoints
    this.setupSystemEndpoints();

    // Setup error handling
    this.setupErrorHandling();

    logger.info('✅ Express.js routing system configured successfully');
  }

  /**
   * Apply global middleware to all routes
   */
  private applyGlobalMiddleware(): void {
    logger.info('📝 Applying global middleware...');

    // Rate limiting
    if (this.config.security.rateLimiting) {
      this.app.use(this.config.prefix, defaultLimiter);
    }

    // Request validation
    if (this.config.security.validation) {
      this.app.use(this.config.prefix, validateRequest);
    }

    // API version detection middleware
    this.app.use(this.config.prefix, (req: any, res: any, next: any) => {
      // Extract version from URL or header
      const versionFromPath = req.path.match(/^\/v(\d+)\//);
      const versionFromHeader = req.headers['x-api-version'];
      
      req.apiVersion = versionFromHeader || 
                      (versionFromPath ? `v${versionFromPath[1]}` : this.config.defaultVersion);
      
      res.setHeader('X-API-Version', req.apiVersion);
      res.setHeader('X-Supported-Versions', this.config.versions.join(', '));
      
      next();
    });
  }

  /**
   * Setup API versioning structure
   */
  private setupVersioning(): void {
    logger.info('🔄 Setting up API versioning...');

    this.config.versions.forEach(version => {
      const versionRouter = Router();
      
      // Version-specific middleware can be added here
      versionRouter.use((req: any, res: any, next: any) => {
        req.currentVersion = version;
        next();
      });

      // Mount version router
      this.app.use(`${this.config.prefix}/${version}`, versionRouter);
      
      logger.info(`📌 Version ${version} router mounted at ${this.config.prefix}/${version}`);
    });
  }

  /**
   * Mount all registered route modules
   */
  private mountRoutes(): void {
    logger.info('🛣️ Mounting route modules...');

    this.routes.forEach((module, path) => {
      const middleware = module.middleware || [];
      
      // Determine which versions this module supports
      const supportedVersions = module.version || this.config.versions;
      
      supportedVersions.forEach(version => {
        this.app.use(`${this.config.prefix}/${version}${path}`, ...middleware, module.router);
        logger.info(`📍 Mounted ${module.description} at ${this.config.prefix}/${version}${path}`);
      });

      // Also mount without version for backward compatibility
      this.app.use(`${this.config.prefix}${path}`, ...middleware, module.router);
      logger.info(`📍 Mounted ${module.description} at ${this.config.prefix}${path} (legacy)`);
    });
  }

  /**
   * Setup system endpoints (health, docs, etc.)
   */
  private setupSystemEndpoints(): void {
    logger.info('🔧 Setting up system endpoints...');

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: this.config.defaultVersion,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        routes: Array.from(this.routes.keys())
      });
    });

    // API information endpoint
    this.app.get(`${this.config.prefix}/info`, (req, res) => {
      res.json({
        api: 'Task Management System',
        versions: this.config.versions,
        defaultVersion: this.config.defaultVersion,
        endpoints: Array.from(this.routes.entries()).map(([path, module]) => ({
          path,
          description: module.description,
          versions: module.version || this.config.versions
        })),
        documentation: this.config.documentation.enabled ? `${this.config.documentation.path}` : null
      });
    });

    // Version listing endpoint
    this.app.get(`${this.config.prefix}/versions`, (req, res) => {
      res.json({
        supported: this.config.versions,
        default: this.config.defaultVersion,
        current: req.headers['x-api-version'] || this.config.defaultVersion
      });
    });

    // Documentation endpoint
    if (this.config.documentation.enabled) {
      this.app.get(`${this.config.documentation.path}`, (req, res) => {
        res.json({
          title: 'Task Management API Documentation',
          description: 'Comprehensive API documentation for task management system',
          baseUrl: `${req.protocol}://${req.get('host')}${this.config.prefix}`,
          versions: this.config.versions,
          endpoints: this.generateEndpointDocs()
        });
      });
    }
  }

  /**
   * Setup error handling
   */
  private setupErrorHandling(): void {
    logger.info('🛡️ Setting up error handling...');

    // 404 handler for API routes
    this.app.use(`${this.config.prefix}/*`, notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  /**
   * Generate endpoint documentation
   */
  private generateEndpointDocs(): any[] {
    return Array.from(this.routes.entries()).map(([path, module]) => ({
      path: `${this.config.prefix}${path}`,
      description: module.description,
      versions: module.version || this.config.versions,
      middleware: module.middleware?.map(m => m.name || 'anonymous') || [],
      methods: ['GET', 'POST', 'PUT', 'DELETE'] // This would be extracted from actual routes
    }));
  }

  /**
   * Get routing statistics
   */
  public getStats(): any {
    return {
      totalRoutes: this.routes.size,
      versions: this.config.versions,
      routes: Array.from(this.routes.keys()),
      middleware: {
        rateLimiting: this.config.security.rateLimiting,
        authentication: this.config.security.authentication,
        validation: this.config.security.validation
      }
    };
  }
}

export default ExpressRouteOrganizer;
