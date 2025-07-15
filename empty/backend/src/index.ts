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
import { 
  SecurityHeaders, 
  requestLogger,
  sanitizeRequest,
  preventParameterPollution 
} from './middleware/security';
import { defaultLimiter } from './middleware/rateLimiting';
import { NotificationService } from './services/notificationService';
import { AdvancedTaskNotificationService } from './services/advancedTaskNotificationService';
import { 
  apiVersionMiddleware, 
  versionInfoMiddleware 
} from './middleware/versioning/apiVersion';
import { 
  collectMetrics, 
  apiDocumentationMiddleware, 
  apiMetricsMiddleware 
} from './middleware/versioning/documentation';

// Import versioned routing
import { createApiRouter, createLegacyRouter } from './routes';

const app = express();

// Trust proxy for accurate client IP detection
app.set('trust proxy', 1);

// Enhanced security middleware
app.use(SecurityHeaders.getHelmetConfig());
app.use(SecurityHeaders.customSecurityHeaders());
app.use(SecurityHeaders.requestValidation());
app.use(SecurityHeaders.responseSanitization());

// Request sanitization and parameter pollution prevention
app.use(sanitizeRequest);
app.use(preventParameterPollution);

// Compression
app.use(compression());

// CORS
app.use(cors({
  origin: config.server.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version'],
}));

// Enhanced rate limiting
app.use('/api', defaultLimiter);

// API metrics collection
app.use('/api', collectMetrics);

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

// Global health check (no auth required, no versioning)
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
  });
});

// API version information endpoint
app.get('/api/versions', versionInfoMiddleware);

// API documentation endpoints
app.get('/api/docs/:version?', apiDocumentationMiddleware);
app.get('/api/metrics/:version?', apiMetricsMiddleware);

// Apply API versioning middleware to all /api routes
app.use('/api', apiVersionMiddleware);

// Versioned API routes
const versionedRouter = createApiRouter();
app.use('/api', versionedRouter);

// Legacy API routes (backwards compatibility)
// These routes work without version prefix and default to v1
const legacyRouter = createLegacyRouter();
app.use('/api', legacyRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    logger.info('Database connected successfully');

    // Initialize notification service
    const notificationService = new NotificationService();
    await notificationService.initialize();
    logger.info('NotificationService initialized and scheduled jobs started');

    // Initialize advanced task notification service
    const advancedNotificationService = AdvancedTaskNotificationService.getInstance();
    await advancedNotificationService.initialize();
    logger.info('AdvancedTaskNotificationService initialized with cron jobs and queue processing');

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info(`🚀 Server running on port ${config.server.port}`);
      logger.info(`📝 Environment: ${config.server.env}`);
      logger.info(`🔗 API Base URL: http://localhost:${config.server.port}/api`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal: string) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export { app };
export default app;
