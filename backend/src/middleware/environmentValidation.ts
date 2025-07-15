/**
 * Environment Configuration Middleware
 * 
 * This middleware validates the environment configuration and provides
 * helpful feedback during application startup.
 */

import { Request, Response, NextFunction } from 'express';
import config from '../config/config';
import { getEnvironmentInfo, validateEnvironment } from '../config/environment';
import { testDatabaseConnection } from '../config/database';
import { validateJWTConfig } from '../config/jwt';

interface EnvironmentStatus {
  valid: boolean;
  errors: string[];
  warnings: string[];
  info: {
    nodeEnv: string;
    nodeVersion: string;
    apiVersion: string;
    databaseConnected: boolean;
    jwtConfigValid: boolean;
  };
}

/**
 * Comprehensive environment validation
 */
export const validateFullEnvironment = async (): Promise<EnvironmentStatus> => {
  const validation = validateEnvironment();
  const envInfo = getEnvironmentInfo();
  
  let databaseConnected = false;
  let jwtConfigValid = false;

  // Test database connection
  try {
    databaseConnected = await testDatabaseConnection();
  } catch (error) {
    validation.errors.push(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate JWT configuration
  try {
    validateJWTConfig();
    jwtConfigValid = true;
  } catch (error) {
    validation.errors.push(`JWT configuration invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: validation.valid && databaseConnected && jwtConfigValid,
    errors: validation.errors,
    warnings: validation.warnings,
    info: {
      nodeEnv: envInfo.nodeEnv,
      nodeVersion: envInfo.nodeVersion,
      apiVersion: config.server.apiVersion,
      databaseConnected,
      jwtConfigValid,
    },
  };
};

/**
 * Environment validation middleware for Express
 */
export const environmentValidationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = await validateFullEnvironment();
    
    // Add environment status to response locals for health check endpoints
    res.locals.environmentStatus = status;
    
    if (!status.valid) {
      console.error('❌ Environment validation failed:');
      status.errors.forEach(error => console.error(`   - ${error}`));
    }
    
    if (status.warnings.length > 0) {
      console.warn('⚠️ Environment warnings:');
      status.warnings.forEach(warning => console.warn(`   - ${warning}`));
    }
    
    next();
  } catch (error) {
    console.error('Environment validation middleware error:', error);
    next(); // Continue anyway to avoid blocking the application
  }
};

/**
 * Startup environment check
 */
export const performStartupEnvironmentCheck = async (): Promise<void> => {
  console.log('\n🔍 Performing environment validation...\n');
  
  try {
    const status = await validateFullEnvironment();
    
    // Log environment info
    console.log(`📊 Environment Info:`);
    console.log(`   Node.js: ${status.info.nodeVersion}`);
    console.log(`   Environment: ${status.info.nodeEnv}`);
    console.log(`   API Version: ${status.info.apiVersion}`);
    console.log(`   Database: ${status.info.databaseConnected ? '✅ Connected' : '❌ Failed'}`);
    console.log(`   JWT Config: ${status.info.jwtConfigValid ? '✅ Valid' : '❌ Invalid'}`);
    
    // Log errors
    if (status.errors.length > 0) {
      console.log('\n❌ Configuration Errors:');
      status.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    // Log warnings
    if (status.warnings.length > 0) {
      console.log('\n⚠️  Configuration Warnings:');
      status.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    // Overall status
    if (status.valid) {
      console.log('\n✅ Environment validation passed!\n');
    } else {
      console.log('\n❌ Environment validation failed! Please check the errors above.\n');
      
      if (config.server.env === 'production') {
        console.log('🚨 Critical: Application cannot start in production with invalid configuration.\n');
        process.exit(1);
      } else {
        console.log('⚠️  Warning: Application starting with configuration issues in development mode.\n');
      }
    }
    
  } catch (error) {
    console.error('❌ Environment validation failed with error:', error);
    
    if (config.server.env === 'production') {
      process.exit(1);
    }
  }
};

/**
 * Express endpoint for environment status
 */
export const getEnvironmentStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await validateFullEnvironment();
    
    // Don't expose sensitive information in the response
    const publicStatus = {
      valid: status.valid,
      environment: status.info.nodeEnv,
      nodeVersion: status.info.nodeVersion,
      apiVersion: status.info.apiVersion,
      services: {
        database: status.info.databaseConnected,
        jwt: status.info.jwtConfigValid,
      },
      // Only show error count, not details for security
      issueCount: {
        errors: status.errors.length,
        warnings: status.warnings.length,
      },
    };
    
    const statusCode = status.valid ? 200 : 503;
    res.status(statusCode).json(publicStatus);
    
  } catch (error) {
    res.status(500).json({
      valid: false,
      error: 'Environment status check failed',
    });
  }
};

/**
 * Get configuration summary (safe for logging)
 */
export const getConfigurationSummary = (): Record<string, any> => {
  return {
    environment: config.server.env,
    server: {
      port: config.server.port,
      host: config.server.host,
      apiVersion: config.server.apiVersion,
      apiPrefix: config.server.apiPrefix,
    },
    database: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      // Never log password
      hasPassword: !!config.database.password,
      ssl: config.database.ssl,
      poolMin: config.database.pool.min,
      poolMax: config.database.pool.max,
    },
    features: {
      emailEnabled: config.email.enabled,
      uploadEnabled: config.upload.enabled,
      healthCheckEnabled: config.healthCheck.enabled,
    },
    security: {
      bcryptRounds: config.security.bcryptRounds,
      minPasswordLength: config.security.minPasswordLength,
      // Never log actual secrets
      hasJwtSecret: !!config.jwt.secret,
      hasRefreshSecret: !!config.jwt.refreshSecret,
      hasSessionSecret: !!config.security.sessionSecret,
      jwtExpiresIn: config.jwt.expiresIn,
      jwtRefreshExpiresIn: config.jwt.refreshExpiresIn,
    },
    cors: {
      allowedOrigins: Array.isArray(config.server.corsOrigin) 
        ? config.server.corsOrigin 
        : [config.server.corsOrigin],
    },
  };
};

export default {
  validateFullEnvironment,
  environmentValidationMiddleware,
  performStartupEnvironmentCheck,
  getEnvironmentStatus,
  getConfigurationSummary,
};
