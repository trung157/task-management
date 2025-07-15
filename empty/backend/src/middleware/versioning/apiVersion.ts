import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errorHandler';
import { logger } from '../../utils/logger';

/**
 * API Version information
 */
export interface ApiVersion {
  version: string;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportedUntil?: Date;
  description?: string;
  changes?: string[];
}

/**
 * Supported API versions configuration
 */
export const SUPPORTED_VERSIONS: Record<string, ApiVersion> = {
  'v1': {
    version: 'v1',
    description: 'Initial API version with core functionality',
    changes: [
      'User management',
      'Task management', 
      'Notification system',
      'Authentication and authorization'
    ]
  },
  'v2': {
    version: 'v2',
    description: 'Enhanced API with improved performance and new features',
    deprecated: false,
    changes: [
      'Enhanced task filtering',
      'Bulk operations',
      'Advanced analytics',
      'WebSocket support'
    ]
  }
};

/**
 * Default API version
 */
export const DEFAULT_VERSION = 'v1';

/**
 * Extended Request interface with version information
 */
export interface VersionedRequest extends Request {
  apiVersion?: string;
  versionInfo?: ApiVersion;
}

/**
 * API Version detection middleware
 * Supports version detection from:
 * 1. URL path (/api/v1/...)
 * 2. Accept header (application/vnd.taskflow.v1+json)
 * 3. Custom header (X-API-Version)
 * 4. Query parameter (?version=v1)
 */
export const apiVersionMiddleware = (req: VersionedRequest, res: Response, next: NextFunction): void => {
  let version = DEFAULT_VERSION;

  try {
    // 1. Extract version from URL path
    const pathMatch = req.path.match(/^\/api\/v(\d+)/);
    if (pathMatch) {
      version = `v${pathMatch[1]}`;
    }
    // 2. Extract version from Accept header
    else {
      const acceptHeader = req.headers.accept;
      if (acceptHeader) {
        const acceptMatch = acceptHeader.match(/application\/vnd\.taskflow\.v(\d+)\+json/);
        if (acceptMatch) {
          version = `v${acceptMatch[1]}`;
        }
      }
    }

    // 3. Extract version from custom header (overrides URL)
    const headerVersion = req.headers['x-api-version'] as string;
    if (headerVersion) {
      version = headerVersion.startsWith('v') ? headerVersion : `v${headerVersion}`;
    }

    // 4. Extract version from query parameter (lowest priority)
    const queryVersion = req.query.version as string;
    if (queryVersion && !headerVersion && !pathMatch) {
      version = queryVersion.startsWith('v') ? queryVersion : `v${queryVersion}`;
    }

    // Validate version
    if (!SUPPORTED_VERSIONS[version]) {
      throw new AppError(
        `Unsupported API version: ${version}. Supported versions: ${Object.keys(SUPPORTED_VERSIONS).join(', ')}`,
        400,
        'UNSUPPORTED_API_VERSION'
      );
    }

    // Add version information to request
    req.apiVersion = version;
    req.versionInfo = SUPPORTED_VERSIONS[version];

    // Add version headers to response
    res.setHeader('X-API-Version', version);
    res.setHeader('X-Supported-Versions', Object.keys(SUPPORTED_VERSIONS).join(', '));

    // Add deprecation warnings if applicable
    if (req.versionInfo.deprecated) {
      res.setHeader('X-API-Deprecated', 'true');
      if (req.versionInfo.deprecationDate) {
        res.setHeader('X-API-Deprecation-Date', req.versionInfo.deprecationDate.toISOString());
      }
      if (req.versionInfo.sunsetDate) {
        res.setHeader('X-API-Sunset-Date', req.versionInfo.sunsetDate.toISOString());
      }
      
      logger.warn('Deprecated API version accessed', {
        version,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        path: req.path
      });
    }

    logger.debug('API version detected', {
      version,
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent']
    });

    next();
  } catch (error) {
    logger.error('API version detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path,
      headers: req.headers
    });
    next(error);
  }
};

/**
 * Version-specific middleware factory
 * Creates middleware that only executes for specific API versions
 */
export const forVersion = (targetVersion: string, middleware: any) => {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    if (req.apiVersion === targetVersion) {
      return middleware(req, res, next);
    }
    next();
  };
};

/**
 * Minimum version requirement middleware
 * Ensures the API version meets minimum requirements
 */
export const requireMinVersion = (minVersion: string) => {
  return (req: VersionedRequest, res: Response, next: NextFunction) => {
    const currentVersion = req.apiVersion || DEFAULT_VERSION;
    const currentVersionNumber = parseInt(currentVersion.replace('v', ''));
    const minVersionNumber = parseInt(minVersion.replace('v', ''));

    if (currentVersionNumber < minVersionNumber) {
      throw new AppError(
        `API version ${currentVersion} is too old. Minimum required version: ${minVersion}`,
        400,
        'VERSION_TOO_OLD'
      );
    }

    next();
  };
};

/**
 * Version compatibility middleware
 * Handles backwards compatibility transformations
 */
export const versionCompatibility = (req: VersionedRequest, res: Response, next: NextFunction): void => {
  const version = req.apiVersion || DEFAULT_VERSION;

  // Store original res.json for transformation
  const originalJson = res.json;

  res.json = function(data: any) {
    try {
      // Apply version-specific transformations
      const transformedData = transformResponseForVersion(data, version);
      return originalJson.call(this, transformedData);
    } catch (error) {
      logger.error('Response transformation failed', {
        version,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return originalJson.call(this, data);
    }
  };

  next();
};

/**
 * Transform response data based on API version
 */
function transformResponseForVersion(data: any, version: string): any {
  switch (version) {
    case 'v1':
      return transformForV1(data);
    case 'v2':
      return transformForV2(data);
    default:
      return data;
  }
}

/**
 * V1 response transformations
 */
function transformForV1(data: any): any {
  if (!data || typeof data !== 'object') return data;

  // Handle array responses
  if (Array.isArray(data)) {
    return data.map(item => transformForV1(item));
  }

  // Handle nested data objects
  if (data.data) {
    data.data = transformForV1(data.data);
  }

  // V1 specific transformations
  if (data.created_at) {
    data.createdAt = data.created_at;
    delete data.created_at;
  }
  if (data.updated_at) {
    data.updatedAt = data.updated_at;
    delete data.updated_at;
  }

  return data;
}

/**
 * V2 response transformations
 */
function transformForV2(data: any): any {
  // V2 keeps the modern naming conventions
  return data;
}

/**
 * API version information endpoint middleware
 */
export const versionInfoMiddleware = (req: Request, res: Response): void => {
  const versions = Object.values(SUPPORTED_VERSIONS).map(version => ({
    version: version.version,
    description: version.description,
    deprecated: version.deprecated || false,
    deprecationDate: version.deprecationDate,
    sunsetDate: version.sunsetDate,
    changes: version.changes
  }));

  res.json({
    success: true,
    data: {
      current: DEFAULT_VERSION,
      supported: versions,
      latest: Object.keys(SUPPORTED_VERSIONS).sort().reverse()[0]
    },
    message: 'API version information'
  });
};
