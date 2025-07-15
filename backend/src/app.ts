/**
 * Enhanced Express.js Application Entry Point
 * Modern task management system with organized routing, middleware, and API versioning
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import 'express-async-errors';

import config from './config/config';
import { connectDatabase } from './db';
import { logger } from './utils/logger';
import { checkDatabaseHealth } from './utils/database-health';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { userFriendlyErrorHandler } from './middleware/enhancedErrorHandler';
import { enhancedErrorHandler, errorMonitoringMiddleware } from './middleware/errorRecoveryHandler';
import { 
  SecurityHeaders, 
  requestLogger,
  sanitizeRequest,
  preventParameterPollution 
} from './middleware/security';

// Import the new routing setup
import { setupRoutes, getRouteInfo } from './routes/routeSetup';

const app = express();

// Trust proxy for accurate client IP detection
app.set('trust proxy', 1);

// =====================================================
// SECURITY MIDDLEWARE
// =====================================================
app.use(SecurityHeaders.getHelmetConfig());
app.use(SecurityHeaders.customSecurityHeaders());
app.use(SecurityHeaders.requestValidation());
app.use(SecurityHeaders.responseSanitization());

// Request sanitization and parameter pollution prevention
app.use(sanitizeRequest);
app.use(preventParameterPollution);

// =====================================================
// GENERAL MIDDLEWARE
// =====================================================

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
}));

// Enhanced request logging
if (config.server.env !== 'test') {
  app.use(requestLogger);
  app.use(morgan('combined', {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// =====================================================
// ERROR MONITORING
// =====================================================
app.use(errorMonitoringMiddleware);

// =====================================================
// GLOBAL HEALTH CHECK
// =====================================================
app.get('/health', async (req, res) => {
  const dbHealth = config.healthCheck.database ? await checkDatabaseHealth() : null;
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: config.server.apiVersion,
    environment: config.server.env,
    database: dbHealth ? {
      status: dbHealth.status,
      latency: dbHealth.details.latency,
      pool: dbHealth.details.poolStatus,
    } : 'disabled',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    routes: 'configured'
  });
});

// =====================================================
// API INFORMATION ENDPOINT
// =====================================================
app.get('/info', (req, res) => {
  const routeInfo = getRouteInfo();
  res.json({
    api: 'TaskFlow Management System',
    version: config.server.apiVersion,
    environment: config.server.env,
    timestamp: new Date().toISOString(),
    documentation: {
      openapi: '/docs',
      routes: '/api/info',
      health: '/health'
    },
    ...routeInfo
  });
});

// =====================================================
// SETUP APPLICATION ROUTES
// =====================================================
setupRoutes(app);

// =====================================================
// ERROR HANDLING
// =====================================================

// 404 handler for unmatched routes
app.use('*', notFoundHandler);

// Enhanced error handlers with recovery mechanisms
app.use(enhancedErrorHandler);
app.use(userFriendlyErrorHandler);

// =====================================================
// SERVER STARTUP
// =====================================================
async function startServer(): Promise<void> {
  try {
    // Connect to database
    if (config.database.host) {
      logger.info('🔌 Connecting to database...');
      await connectDatabase();
      logger.info('✅ Database connected successfully');
    } else {
      logger.warn('⚠️ Database connection skipped (no host configured)');
    }

    // Start the server
    const server = app.listen(config.server.port, () => {
      logger.info('🚀 Server started successfully', {
        port: config.server.port,
        environment: config.server.env,
        version: config.server.apiVersion,
        pid: process.pid,
        routes: {
          api: '/api',
          health: '/health',
          info: '/info',
          docs: '/docs'
        }
      });
    });

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('🛑 SIGTERM received, shutting down gracefully...');
      server.close(() => {
        logger.info('✅ Server closed successfully');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('🛑 SIGINT received, shutting down gracefully...');
      server.close(() => {
        logger.info('✅ Server closed successfully');
        process.exit(0);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', { promise, reason });
      process.exit(1);
    });

  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export default app;
export { startServer };
