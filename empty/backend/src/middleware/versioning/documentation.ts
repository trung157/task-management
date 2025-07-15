import { Request, Response, NextFunction } from 'express';
import { SUPPORTED_VERSIONS, DEFAULT_VERSION } from './apiVersion';
import { logger } from '../../utils/logger';

/**
 * API Documentation middleware
 * Provides OpenAPI/Swagger documentation for different API versions
 */

export interface ApiEndpoint {
  path: string;
  method: string;
  description: string;
  version: string;
  authenticated: boolean;
  deprecated?: boolean;
  parameters?: any[];
  responses?: any;
}

/**
 * API Documentation store
 */
class ApiDocumentationStore {
  private endpoints: Map<string, ApiEndpoint[]> = new Map();
  
  /**
   * Register an endpoint for documentation
   */
  registerEndpoint(endpoint: ApiEndpoint): void {
    const version = endpoint.version;
    if (!this.endpoints.has(version)) {
      this.endpoints.set(version, []);
    }
    this.endpoints.get(version)!.push(endpoint);
  }
  
  /**
   * Get all endpoints for a version
   */
  getEndpoints(version: string): ApiEndpoint[] {
    return this.endpoints.get(version) || [];
  }
  
  /**
   * Get all versions with endpoints
   */
  getVersions(): string[] {
    return Array.from(this.endpoints.keys());
  }
  
  /**
   * Generate OpenAPI specification for a version
   */
  generateOpenApiSpec(version: string): any {
    const endpoints = this.getEndpoints(version);
    const versionInfo = SUPPORTED_VERSIONS[version];
    
    const spec = {
      openapi: '3.0.0',
      info: {
        title: 'TaskFlow API',
        version: version,
        description: versionInfo?.description || 'TaskFlow API documentation',
        contact: {
          name: 'TaskFlow API Support',
          email: 'api@taskflow.com'
        }
      },
      servers: [
        {
          url: `/api/${version}`,
          description: `TaskFlow API ${version}`
        }
      ],
      paths: {} as Record<string, any>,
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      }
    };
    
    // Convert endpoints to OpenAPI paths
    endpoints.forEach(endpoint => {
      if (!spec.paths[endpoint.path]) {
        spec.paths[endpoint.path] = {};
      }
      
      spec.paths[endpoint.path][endpoint.method] = {
        summary: endpoint.description,
        description: endpoint.description,
        deprecated: endpoint.deprecated || false,
        security: endpoint.authenticated ? [{ bearerAuth: [] }] : [],
        parameters: endpoint.parameters || [],
        responses: endpoint.responses || {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'object' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Bad request'
          },
          '401': {
            description: 'Unauthorized'
          },
          '500': {
            description: 'Internal server error'
          }
        }
      };
    });
    
    return spec;
  }
}

// Global documentation store
export const apiDocs = new ApiDocumentationStore();

/**
 * Middleware to automatically document endpoints
 */
export const documentEndpoint = (description: string, options: Partial<ApiEndpoint> = {}) => {
  return (req: any, res: Response, next: NextFunction) => {
    const endpoint: ApiEndpoint = {
      path: req.route?.path || req.path,
      method: req.method.toLowerCase(),
      description,
      version: req.apiVersion || DEFAULT_VERSION,
      authenticated: !!req.user,
      ...options
    };
    
    apiDocs.registerEndpoint(endpoint);
    next();
  };
};

/**
 * Generate API documentation endpoint
 */
export const apiDocumentationMiddleware = (req: any, res: Response) => {
  const version = req.params.version || req.apiVersion || DEFAULT_VERSION;
  const format = req.query.format || 'json';
  
  try {
    if (format === 'openapi' || format === 'swagger') {
      const spec = apiDocs.generateOpenApiSpec(version);
      res.json(spec);
    } else {
      const endpoints = apiDocs.getEndpoints(version);
      const documentation = {
        version,
        versionInfo: SUPPORTED_VERSIONS[version],
        endpoints: endpoints.map(endpoint => ({
          method: endpoint.method.toUpperCase(),
          path: endpoint.path,
          description: endpoint.description,
          authenticated: endpoint.authenticated,
          deprecated: endpoint.deprecated || false
        })),
        totalEndpoints: endpoints.length,
        generatedAt: new Date().toISOString()
      };
      
      res.json({
        success: true,
        data: documentation,
        message: `API documentation for version ${version}`
      });
    }
  } catch (error) {
    logger.error('Documentation generation failed', {
      version,
      format,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to generate documentation',
        code: 'DOCUMENTATION_ERROR',
        statusCode: 500
      }
    });
  }
};

/**
 * API metrics middleware
 */
export interface ApiMetrics {
  version: string;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

class ApiMetricsStore {
  private metrics: ApiMetrics[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics
  
  /**
   * Record API call metrics
   */
  recordMetrics(metrics: ApiMetrics): void {
    this.metrics.push(metrics);
    
    // Keep only the most recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }
  
  /**
   * Get metrics for a specific version
   */
  getMetrics(version?: string, hours = 24): ApiMetrics[] {
    const cutoff = new Date(Date.now() - (hours * 60 * 60 * 1000));
    
    return this.metrics.filter(metric => {
      const matchesVersion = !version || metric.version === version;
      const withinTimeRange = metric.timestamp > cutoff;
      return matchesVersion && withinTimeRange;
    });
  }
  
  /**
   * Get aggregated statistics
   */
  getStats(version?: string, hours = 24): any {
    const metrics = this.getMetrics(version, hours);
    
    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        topEndpoints: [],
        statusCodeDistribution: {}
      };
    }
    
    const totalRequests = metrics.length;
    const averageResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / totalRequests;
    const errorCount = metrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorCount / totalRequests) * 100;
    
    // Top endpoints
    const endpointCounts = metrics.reduce((acc, m) => {
      const key = `${m.method} ${m.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topEndpoints = Object.entries(endpointCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
    
    // Status code distribution
    const statusCodeDistribution = metrics.reduce((acc, m) => {
      acc[m.statusCode] = (acc[m.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      topEndpoints,
      statusCodeDistribution,
      timeRange: `${hours} hours`,
      version: version || 'all versions'
    };
  }
}

// Global metrics store
export const apiMetrics = new ApiMetricsStore();

/**
 * Middleware to collect API metrics
 */
export const collectMetrics = (req: any, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    
    const metrics: ApiMetrics = {
      version: req.apiVersion || DEFAULT_VERSION,
      endpoint: req.route?.path || req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    apiMetrics.recordMetrics(metrics);
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * API metrics endpoint
 */
export const apiMetricsMiddleware = (req: any, res: Response) => {
  const version = req.params.version || req.query.version;
  const hours = parseInt(req.query.hours as string) || 24;
  
  try {
    const stats = apiMetrics.getStats(version, hours);
    
    res.json({
      success: true,
      data: stats,
      message: 'API metrics retrieved successfully'
    });
  } catch (error) {
    logger.error('Metrics retrieval failed', {
      version,
      hours,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Failed to retrieve metrics',
        code: 'METRICS_ERROR',
        statusCode: 500
      }
    });
  }
};
