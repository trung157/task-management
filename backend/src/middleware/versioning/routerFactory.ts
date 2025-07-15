import { Router } from 'express';
import { authMiddleware } from '../auth';
import { validateRequest } from '../validation';
import { 
  apiVersionMiddleware, 
  versionCompatibility, 
  VersionedRequest,
  forVersion,
  requireMinVersion 
} from './apiVersion';
import { logger } from '../../utils/logger';

/**
 * Route configuration for versioned endpoints
 */
export interface VersionedRouteConfig {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  handler: any;
  middleware?: any[];
  auth?: boolean;
  validation?: any[];
  minVersion?: string;
  versions?: string[];
  description?: string;
}

/**
 * Router factory for creating versioned API routes
 */
export class VersionedRouter {
  private router: Router;
  private version: string;

  constructor(version: string) {
    this.router = Router();
    this.version = version;
    
    // Apply version-specific middleware
    this.router.use(apiVersionMiddleware);
    this.router.use(versionCompatibility);
  }

  /**
   * Add a route with version-specific configuration
   */
  public addRoute(config: VersionedRouteConfig): this {
    const middlewares: any[] = [];

    // Add minimum version requirement if specified
    if (config.minVersion) {
      middlewares.push(requireMinVersion(config.minVersion));
    }

    // Add version-specific middleware if specified
    if (config.versions) {
      const versionMiddleware = (req: VersionedRequest, res: any, next: any) => {
        if (config.versions!.includes(req.apiVersion || 'v1')) {
          next();
        } else {
          res.status(404).json({
            success: false,
            error: {
              message: `Endpoint not available in API version ${req.apiVersion}`,
              code: 'ENDPOINT_NOT_AVAILABLE',
              statusCode: 404
            }
          });
        }
      };
      middlewares.push(versionMiddleware);
    }

    // Add authentication if required
    if (config.auth !== false) {
      middlewares.push(authMiddleware);
    }

    // Add custom middleware
    if (config.middleware) {
      middlewares.push(...config.middleware);
    }

    // Add validation middleware
    if (config.validation) {
      middlewares.push(...config.validation, validateRequest);
    }

    // Add the route
    this.router[config.method](config.path, ...middlewares, config.handler);

    logger.debug('Versioned route added', {
      version: this.version,
      method: config.method.toUpperCase(),
      path: config.path,
      auth: config.auth !== false,
      middleware: config.middleware?.length || 0,
      validation: config.validation?.length || 0
    });

    return this;
  }

  /**
   * Get the configured router
   */
  public getRouter(): Router {
    return this.router;
  }

  /**
   * Add multiple routes from configuration
   */
  public addRoutes(routes: VersionedRouteConfig[]): this {
    routes.forEach(route => this.addRoute(route));
    return this;
  }
}

/**
 * Main versioned router factory
 */
export class ApiVersionRouter {
  private app: Router;
  private versionRouters: Map<string, VersionedRouter>;

  constructor() {
    this.app = Router();
    this.versionRouters = new Map();
  }

  /**
   * Create or get a version-specific router
   */
  public version(version: string): VersionedRouter {
    if (!this.versionRouters.has(version)) {
      const versionedRouter = new VersionedRouter(version);
      this.versionRouters.set(version, versionedRouter);
      
      // Mount the versioned router
      this.app.use(`/${version}`, versionedRouter.getRouter());
      
      logger.info('API version router created', { version });
    }

    return this.versionRouters.get(version)!;
  }

  /**
   * Get the main app router
   */
  public getRouter(): Router {
    return this.app;
  }

  /**
   * Add routes that work across all versions
   */
  public addGlobalRoute(config: VersionedRouteConfig): this {
    const middlewares: any[] = [];

    // Add authentication if required
    if (config.auth !== false) {
      middlewares.push(authMiddleware);
    }

    // Add custom middleware
    if (config.middleware) {
      middlewares.push(...config.middleware);
    }

    // Add validation middleware
    if (config.validation) {
      middlewares.push(...config.validation, validateRequest);
    }

    // Add the route to all versions
    this.versionRouters.forEach((router, version) => {
      router.addRoute(config);
    });

    return this;
  }
}

/**
 * Create a new versioned router instance
 */
export function createVersionedRouter(): ApiVersionRouter {
  return new ApiVersionRouter();
}

/**
 * Middleware to handle version-specific route deprecation
 */
export const deprecatedRoute = (message?: string, sunsetDate?: Date) => {
  return (req: VersionedRequest, res: any, next: any) => {
    res.setHeader('X-Route-Deprecated', 'true');
    if (sunsetDate) {
      res.setHeader('X-Route-Sunset-Date', sunsetDate.toISOString());
    }

    const deprecationMessage = message || 'This endpoint is deprecated';
    
    logger.warn('Deprecated route accessed', {
      version: req.apiVersion,
      path: req.path,
      method: req.method,
      message: deprecationMessage,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    next();
  };
};
