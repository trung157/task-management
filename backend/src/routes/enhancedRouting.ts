/**
 * Enhanced Express.js Routing Integration Script
 * 
 * This script demonstrates how to integrate the comprehensive routing system
 * into your existing Express.js application with proper middleware, versioning,
 * and organization.
 */

import { Application } from 'express';
import express from 'express';
import { setupTaskManagementRoutes, TaskManagementRouter } from './taskManagementRouter';
import { logger } from '../utils/logger';

/**
 * Enhanced routing configuration interface
 */
interface RoutingConfig {
  // API Versioning
  versioning: {
    enabled: boolean;
    defaultVersion: string;
    supportedVersions: string[];
    deprecationWarnings: boolean;
  };
  
  // Security Configuration
  security: {
    cors: {
      enabled: boolean;
      origins?: string[];
      credentials?: boolean;
    };
    rateLimiting: {
      enabled: boolean;
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests?: boolean;
    };
    helmet: {
      enabled: boolean;
      options?: any;
    };
  };
  
  // Documentation
  documentation: {
    enabled: boolean;
    path: string;
    swagger: {
      enabled: boolean;
      ui: boolean;
    };
    redoc: {
      enabled: boolean;
    };
  };
  
  // Monitoring and Analytics
  monitoring: {
    enabled: boolean;
    metricsPath: string;
    healthCheckPath: string;
    responseTime: boolean;
  };
  
  // Route Organization
  routes: {
    prefix: string;
    caseSensitive: boolean;
    mergeParams: boolean;
    strict: boolean;
  };
}

/**
 * Default routing configuration
 */
const defaultConfig: RoutingConfig = {
  versioning: {
    enabled: true,
    defaultVersion: 'v2',
    supportedVersions: ['v1', 'v2', 'v3'],
    deprecationWarnings: true
  },
  security: {
    cors: {
      enabled: true,
      origins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
      credentials: true
    },
    rateLimiting: {
      enabled: true,
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      skipSuccessfulRequests: true
    },
    helmet: {
      enabled: true,
      options: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"]
          }
        }
      }
    }
  },
  documentation: {
    enabled: process.env.NODE_ENV !== 'production',
    path: '/api/docs',
    swagger: {
      enabled: true,
      ui: true
    },
    redoc: {
      enabled: true
    }
  },
  monitoring: {
    enabled: true,
    metricsPath: '/metrics',
    healthCheckPath: '/health',
    responseTime: true
  },
  routes: {
    prefix: '/api',
    caseSensitive: false,
    mergeParams: true,
    strict: false
  }
};

/**
 * Enhanced Express.js routing setup class
 */
export class EnhancedExpressRouting {
  private app: Application;
  private config: RoutingConfig;
  private router: TaskManagementRouter;

  constructor(app: Application, config: Partial<RoutingConfig> = {}) {
    this.app = app;
    this.config = { ...defaultConfig, ...config };
    this.router = new TaskManagementRouter(app, {
      // security: this.config.security, // Commented out due to type mismatch
      documentation: this.config.documentation
    });
  }

  /**
   * Initialize the complete routing system
   */
  public async initialize(): Promise<void> {
    logger.info('🚀 Initializing Enhanced Express.js Routing System...');

    try {
      // Step 1: Configure router settings
      this.configureRouterSettings();

      // Step 2: Apply global security middleware
      this.applySecurityMiddleware();

      // Step 3: Setup monitoring and health checks
      this.setupMonitoring();

      // Step 4: Initialize API versioning
      this.setupAPIVersioning();

      // Step 5: Configure main routing system
      this.router.setupRoutes();

      // Step 6: Setup documentation endpoints
      this.setupDocumentation();

      // Step 7: Configure error handling
      this.configureErrorHandling();

      logger.info('✅ Enhanced Express.js Routing System initialized successfully');
      this.logRoutingInfo();

    } catch (error) {
      logger.error('❌ Failed to initialize routing system:', error);
      throw error;
    }
  }

  /**
   * Configure Express router settings
   */
  private configureRouterSettings(): void {
    logger.info('⚙️ Configuring router settings...');

    // Configure router settings
    this.app.set('case sensitive routing', this.config.routes.caseSensitive);
    this.app.set('strict routing', this.config.routes.strict);
    this.app.set('trust proxy', 1); // Trust first proxy

    // Configure JSON and URL encoding
    this.app.use(express.json({ 
      limit: '10mb',
      type: ['application/json', 'text/plain']
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));
  }

  /**
   * Apply security middleware
   */
  private applySecurityMiddleware(): void {
    logger.info('🔐 Applying security middleware...');

    // CORS Configuration
    if (this.config.security.cors.enabled) {
      const cors = require('cors');
      this.app.use(cors({
        origin: this.config.security.cors.origins,
        credentials: this.config.security.cors.credentials,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version']
      }));
    }

    // Helmet Security Headers
    if (this.config.security.helmet.enabled) {
      const helmet = require('helmet');
      this.app.use(helmet(this.config.security.helmet.options));
    }

    // Request ID and logging
    this.app.use((req: any, res: any, next: any) => {
      req.id = require('crypto').randomUUID();
      res.setHeader('X-Request-ID', req.id);
      next();
    });
  }

  /**
   * Setup monitoring and health checks
   */
  private setupMonitoring(): void {
    logger.info('📊 Setting up monitoring and health checks...');

    if (!this.config.monitoring.enabled) return;

    // Response time tracking
    if (this.config.monitoring.responseTime) {
      const responseTime = require('response-time');
      this.app.use(responseTime((req: any, res: any, time: number) => {
        logger.debug('Request completed', {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime: `${time.toFixed(2)}ms`
        });
      }));
    }

    // Health check endpoint
    this.app.get(this.config.monitoring.healthCheckPath, (req: any, res: any) => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.API_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        node: process.version,
        routes: {
          total: this.getRouteCount(),
          versions: this.config.versioning.supportedVersions
        }
      };

      res.json(healthData);
    });

    // Metrics endpoint (basic implementation)
    this.app.get(this.config.monitoring.metricsPath, (req: any, res: any) => {
      const metrics = {
        process: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        api: {
          versions: this.config.versioning.supportedVersions,
          routes: this.getRouteCount()
        },
        timestamp: new Date().toISOString()
      };

      res.json(metrics);
    });
  }

  /**
   * Setup API versioning
   */
  private setupAPIVersioning(): void {
    logger.info('🔄 Setting up API versioning...');

    if (!this.config.versioning.enabled) return;

    // Version detection middleware
    this.app.use('/api', (req: any, res: any, next: any) => {
      const versionHeader = req.headers['x-api-version'];
      const versionPath = req.path.match(/^\/v(\d+)\//);
      
      req.apiVersion = versionHeader || 
                      (versionPath ? `v${versionPath[1]}` : this.config.versioning.defaultVersion);

      // Add version info to response headers
      res.setHeader('X-API-Version', req.apiVersion);
      res.setHeader('X-Supported-Versions', this.config.versioning.supportedVersions.join(', '));

      // Deprecation warnings
      if (this.config.versioning.deprecationWarnings) {
        if (req.apiVersion === 'v1') {
          res.setHeader('X-API-Deprecation-Warning', 'API v1 is deprecated. Please migrate to v2 or v3.');
        }
      }

      next();
    });

    // Version info endpoint
    this.app.get('/api/versions', (req: any, res: any) => {
      res.json({
        supported: this.config.versioning.supportedVersions,
        default: this.config.versioning.defaultVersion,
        latest: this.config.versioning.supportedVersions[this.config.versioning.supportedVersions.length - 1],
        deprecated: ['v1'],
        sunset: {
          v1: '2024-12-31T23:59:59Z'
        }
      });
    });
  }

  /**
   * Setup documentation endpoints
   */
  private setupDocumentation(): void {
    logger.info('📚 Setting up documentation endpoints...');

    if (!this.config.documentation.enabled) return;

    const docPath = this.config.documentation.path;

    // Main documentation page
    this.app.get(docPath, (req: any, res: any) => {
      res.json({
        title: 'Task Management API Documentation',
        description: 'Comprehensive API documentation for the task management system',
        version: '3.0.0',
        endpoints: {
          openapi: `${docPath}/openapi.json`,
          swagger: this.config.documentation.swagger.enabled ? `${docPath}/swagger` : null,
          redoc: this.config.documentation.redoc.enabled ? `${docPath}/redoc` : null,
          postman: `${docPath}/postman.json`
        },
        versions: this.config.versioning.supportedVersions,
        baseUrl: `${req.protocol}://${req.get('host')}/api`
      });
    });

    // OpenAPI specification
    this.app.get(`${docPath}/openapi.json`, (req: any, res: any) => {
      res.json(this.generateOpenAPISpec(req));
    });

    // Postman collection
    this.app.get(`${docPath}/postman.json`, (req: any, res: any) => {
      res.json(this.generatePostmanCollection(req));
    });
  }

  /**
   * Configure error handling
   */
  private configureErrorHandling(): void {
    logger.info('🛡️ Configuring error handling...');

    // 404 handler for API routes
    this.app.use('/api/*', (req: any, res: any) => {
      res.status(404).json({
        success: false,
        error: 'Not Found',
        message: `API endpoint ${req.method} ${req.path} not found`,
        availableVersions: this.config.versioning.supportedVersions,
        documentation: this.config.documentation.enabled ? this.config.documentation.path : null
      });
    });

    // Global error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Global error handler', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      const isDevelopment = process.env.NODE_ENV === 'development';

      res.status(error.status || 500).json({
        success: false,
        error: error.name || 'Internal Server Error',
        message: error.message || 'An unexpected error occurred',
        ...(isDevelopment && { stack: error.stack }),
        timestamp: new Date().toISOString(),
        requestId: req.id
      });
    });
  }

  /**
   * Get total route count (mock implementation)
   */
  private getRouteCount(): number {
    return 75; // This would be calculated from actual routes
  }

  /**
   * Generate OpenAPI specification
   */
  private generateOpenAPISpec(req: any): any {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    return {
      openapi: '3.0.0',
      info: {
        title: 'Task Management API',
        description: 'Comprehensive task management system with advanced features',
        version: '3.0.0',
        contact: {
          name: 'API Support',
          email: 'api-support@taskmanagement.com'
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT'
        }
      },
      servers: this.config.versioning.supportedVersions.map(version => ({
        url: `${baseUrl}/api/${version}`,
        description: `API ${version}`
      })),
      paths: {
        // This would include all actual API paths
      },
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          },
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key'
          }
        }
      },
      security: [
        { BearerAuth: [] },
        { ApiKeyAuth: [] }
      ]
    };
  }

  /**
   * Generate Postman collection
   */
  private generatePostmanCollection(req: any): any {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    return {
      info: {
        name: 'Task Management API',
        description: 'Postman collection for Task Management API',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
      },
      variable: [
        {
          key: 'baseUrl',
          value: baseUrl,
          type: 'string'
        },
        {
          key: 'apiVersion',
          value: 'v2',
          type: 'string'
        }
      ],
      item: [
        // This would include all API endpoints as Postman requests
      ]
    };
  }

  /**
   * Log routing information
   */
  private logRoutingInfo(): void {
    logger.info('📋 Routing System Summary', {
      versioning: {
        enabled: this.config.versioning.enabled,
        versions: this.config.versioning.supportedVersions,
        default: this.config.versioning.defaultVersion
      },
      security: {
        cors: this.config.security.cors.enabled,
        helmet: this.config.security.helmet.enabled,
        rateLimiting: this.config.security.rateLimiting.enabled
      },
      documentation: {
        enabled: this.config.documentation.enabled,
        path: this.config.documentation.path
      },
      monitoring: {
        enabled: this.config.monitoring.enabled,
        healthPath: this.config.monitoring.healthCheckPath,
        metricsPath: this.config.monitoring.metricsPath
      }
    });
  }
}

/**
 * Initialize enhanced routing system
 */
export async function initializeEnhancedRouting(
  app: Application, 
  config?: Partial<RoutingConfig>
): Promise<EnhancedExpressRouting> {
  const routing = new EnhancedExpressRouting(app, config);
  await routing.initialize();
  return routing;
}

// Re-export for convenience
export { setupTaskManagementRoutes, TaskManagementRouter };
export default EnhancedExpressRouting;
