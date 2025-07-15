/**
 * Versioning Middleware Exports
 * Central export point for all API versioning middleware
 */

// Core versioning functionality
export {
  apiVersionMiddleware,
  versionCompatibility,
  versionInfoMiddleware,
  forVersion,
  requireMinVersion,
  SUPPORTED_VERSIONS,
  DEFAULT_VERSION,
  type VersionedRequest,
  type ApiVersion
} from './apiVersion';

// Router factory and configuration
export {
  VersionedRouter,
  ApiVersionRouter,
  createVersionedRouter,
  deprecatedRoute,
  type VersionedRouteConfig
} from './routerFactory';

// Documentation and metrics
export {
  documentEndpoint,
  apiDocumentationMiddleware,
  apiMetricsMiddleware,
  collectMetrics,
  apiDocs,
  apiMetrics,
  type ApiEndpoint,
  type ApiMetrics
} from './documentation';
