/**
 * Enhanced Express.js Application with Comprehensive Routing
 * 
 * This is an example of how to integrate the enhanced routing system
 * into your existing Express.js application.
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

// Import the enhanced routing system
import { initializeEnhancedRouting } from './routes/enhancedRouting';

const app = express();

// Trust proxy for accurate client IP detection
app.set('trust proxy', 1);

/**
 * Initialize the complete application with enhanced routing
 */
async function initializeApplication(): Promise<void> {
  try {
    logger.info('🚀 Starting Task Management API...');

    // Step 1: Connect to database
    await connectDatabase();
    logger.info('✅ Database connected successfully');

    // Step 2: Configure basic middleware
    setupBasicMiddleware();

    // Step 3: Initialize enhanced routing system
    await initializeEnhancedRouting(app, {
      versioning: {
        enabled: true,
        defaultVersion: 'v2',
        supportedVersions: ['v1', 'v2', 'v3'],
        deprecationWarnings: true
      },
      security: {
        cors: {
          enabled: true,
          origins: config.cors?.origins || ['http://localhost:3000'],
          credentials: true
        },
        rateLimiting: {
          enabled: true,
          windowMs: 15 * 60 * 1000, // 15 minutes
          maxRequests: config.rateLimiting?.maxRequests || 1000
        },
        helmet: {
          enabled: true
        }
      },
      documentation: {
        enabled: config.server.env !== 'production',
        path: '/api/docs',
        swagger: { enabled: true, ui: true },
        redoc: { enabled: true }
      },
      monitoring: {
        enabled: true,
        metricsPath: '/metrics',
        healthCheckPath: '/health',
        responseTime: true
      }
    });

    logger.info('✅ Enhanced routing system initialized');

    // Step 4: Setup additional services (if needed)
    await initializeServices();

    logger.info('🎉 Application initialized successfully');

  } catch (error) {
    logger.error('❌ Failed to initialize application:', error);
    throw error;
  }
}

/**
 * Setup basic Express middleware
 */
function setupBasicMiddleware(): void {
  // Compression middleware
  app.use(compression());

  // Request logging (Morgan)
  app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
  }));

  // Basic JSON and URL encoding
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}

/**
 * Initialize additional services
 */
async function initializeServices(): Promise<void> {
  try {
    // Initialize notification service (if exists)
    // const NotificationService = require('./services/notificationService');
    // await NotificationService.initialize();

    // Initialize any other services
    logger.info('✅ Additional services initialized');
  } catch (error) {
    logger.warn('⚠️ Some services failed to initialize:', error);
  }
}

/**
 * Start the HTTP server
 */
async function startServer(): Promise<void> {
  try {
    const server = app.listen(config.server.port, () => {
      logger.info('🚀 Server Information', {
        port: config.server.port,
        environment: config.server.env,
        nodeVersion: process.version,
        apiVersion: config.server.apiVersion
      });

      logger.info('📚 Available Endpoints', {
        api: `http://localhost:${config.server.port}/api`,
        docs: `http://localhost:${config.server.port}/api/docs`,
        health: `http://localhost:${config.server.port}/health`,
        metrics: `http://localhost:${config.server.port}/metrics`,
        versions: `http://localhost:${config.server.port}/api/versions`
      });

      logger.info('🔧 API Features', {
        versioning: 'v1, v2, v3',
        authentication: 'JWT + Refresh Tokens',
        rateLimiting: 'Redis-based',
        documentation: 'OpenAPI + Swagger',
        monitoring: 'Health checks + Metrics'
      });
    });

    // Graceful shutdown handling
    setupGracefulShutdown(server);

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Setup graceful shutdown
 */
function setupGracefulShutdown(server: any): void {
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    
    server.close(() => {
      logger.info('✅ HTTP server closed');
      
      // Close database connections
      // closeDatabase();
      
      logger.info('✅ Graceful shutdown completed');
      process.exit(0);
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('❌ Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

/**
 * Main application startup
 */
async function main(): Promise<void> {
  try {
    await initializeApplication();
    await startServer();
  } catch (error) {
    logger.error('💥 Fatal error during startup:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  main();
}

export { app };
export default app;

/*
 * INTEGRATION NOTES:
 * 
 * 1. Replace your existing index.ts with this file
 * 2. Ensure all required dependencies are installed
 * 3. Update config file paths if necessary
 * 4. Test the new routing system
 * 
 * NEW ENDPOINTS AVAILABLE:
 * - GET  /health                    # System health check
 * - GET  /metrics                   # System metrics
 * - GET  /api/versions             # API version information
 * - GET  /api/docs                 # API documentation
 * - GET  /api/status               # API status
 * - All existing endpoints with enhanced security
 * 
 * ENHANCED FEATURES:
 * - API versioning (v1, v2, v3)
 * - Comprehensive rate limiting
 * - Advanced security headers
 * - Input validation and sanitization
 * - Request/response logging
 * - Performance monitoring
 * - Interactive API documentation
 * - Graceful shutdown handling
 */
