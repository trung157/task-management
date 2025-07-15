/**
 * Environment Configuration Validator
 * 
 * Validates and provides utilities for environment configuration management.
 * Ensures all required environment variables are properly set.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from './config';

// Create a simple logger for this module to avoid circular dependencies
const logger = {
  info: (message: string, meta?: any) => console.log(`[INFO] ${message}`, meta || ''),
  warn: (message: string, meta?: any) => console.warn(`[WARN] ${message}`, meta || ''),
  error: (message: string, meta?: any) => console.error(`[ERROR] ${message}`, meta || ''),
  debug: (message: string, meta?: any) => console.debug(`[DEBUG] ${message}`, meta || ''),
};

export interface EnvironmentInfo {
  nodeEnv: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  uptime: number;
  pid: number;
  configValid: boolean;
  missingVars: string[];
  warnings: string[];
}

/**
 * Required environment variables by environment
 */
const REQUIRED_VARS = {
  development: [
    'DB_HOST',
    'DB_PORT', 
    'DB_NAME',
    'DB_USER',
  ],
  production: [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME', 
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'SESSION_SECRET',
  ],
  test: [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
  ]
};

/**
 * Sensitive environment variables (should not be logged)
 */
const SENSITIVE_VARS = [
  'DB_PASSWORD',
  'JWT_SECRET', 
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'EMAIL_PASSWORD',
  'REDIS_PASSWORD',
  'DATABASE_URL',
];

/**
 * Check if .env file exists
 */
export const checkEnvFile = (): boolean => {
  const envPath = path.resolve(process.cwd(), '.env');
  return fs.existsSync(envPath);
};

/**
 * Get missing required environment variables
 */
export const getMissingRequiredVars = (): string[] => {
  const env = process.env.NODE_ENV || 'development';
  const required = REQUIRED_VARS[env as keyof typeof REQUIRED_VARS] || [];
  
  return required.filter(varName => !process.env[varName]);
};

/**
 * Get environment configuration warnings
 */
export const getConfigWarnings = (): string[] => {
  const warnings: string[] = [];
  const env = process.env.NODE_ENV || 'development';

  // Check for default/weak secrets in production
  if (env === 'production') {
    if (config.jwt.secret.includes('default') || config.jwt.secret.length < 32) {
      warnings.push('JWT_SECRET appears to be weak or default');
    }
    
    if (config.jwt.refreshSecret.includes('default') || config.jwt.refreshSecret.length < 32) {
      warnings.push('JWT_REFRESH_SECRET appears to be weak or default');
    }
    
    if (config.security.sessionSecret.includes('default') || config.security.sessionSecret.length < 32) {
      warnings.push('SESSION_SECRET appears to be weak or default');
    }

    if (!config.server.trustProxy) {
      warnings.push('TRUST_PROXY should be enabled in production');
    }

    if (!config.server.forceHttps) {
      warnings.push('FORCE_HTTPS should be enabled in production');
    }

    if (!config.server.secureCookies) {
      warnings.push('SECURE_COOKIES should be enabled in production');
    }
  }

  // Check for missing optional but recommended vars
  if (!process.env.EMAIL_USER && config.email.enabled) {
    warnings.push('Email is enabled but EMAIL_USER is not set');
  }

  if (!process.env.LOG_LEVEL) {
    warnings.push('LOG_LEVEL not specified, using default');
  }

  return warnings;
};

/**
 * Validate environment configuration
 */
export const validateEnvironment = (): { valid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = [];
  const warnings = getConfigWarnings();
  const missingVars = getMissingRequiredVars();

  // Add missing required variables to errors
  if (missingVars.length > 0) {
    errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Validate database configuration
  if (!config.database.password && !config.database.url && process.env.NODE_ENV !== 'test') {
    errors.push('Database password is required (DB_PASSWORD or DATABASE_URL)');
  }

  // Validate port number
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT must be a valid port number (1-65535)');
  }

  // Validate JWT expiration formats
  if (!isValidTimeFormat(config.jwt.expiresIn)) {
    errors.push('JWT_EXPIRES_IN must be a valid time format (e.g., 15m, 1h, 7d)');
  }

  if (!isValidTimeFormat(config.jwt.refreshExpiresIn)) {
    errors.push('JWT_REFRESH_EXPIRES_IN must be a valid time format (e.g., 15m, 1h, 7d)');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Validate time format (e.g., 15m, 1h, 7d)
 */
const isValidTimeFormat = (timeStr: string): boolean => {
  const timeRegex = /^(\d+)([smhd])$/;
  return timeRegex.test(timeStr);
};

/**
 * Generate secure random string for secrets
 */
export const generateSecureSecret = (length: number = 64): string => {
  return crypto.randomBytes(length).toString('base64');
};

/**
 * Get environment information (safe for logging)
 */
export const getEnvironmentInfo = (): EnvironmentInfo => {
  const validation = validateEnvironment();
  
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime: process.uptime(),
    pid: process.pid,
    configValid: validation.valid,
    missingVars: getMissingRequiredVars(),
    warnings: validation.warnings,
  };
};

/**
 * Get safe environment variables (excludes sensitive data)
 */
export const getSafeEnvironmentVars = (): Record<string, string> => {
  const safeVars: Record<string, string> = {};
  
  Object.keys(process.env).forEach(key => {
    if (!SENSITIVE_VARS.includes(key) && process.env[key]) {
      safeVars[key] = process.env[key]!;
    }
  });
  
  return safeVars;
};

/**
 * Create .env file from template
 */
export const createEnvFromTemplate = (): void => {
  const envPath = path.resolve(process.cwd(), '.env');
  const examplePath = path.resolve(process.cwd(), '.env.example');
  
  if (fs.existsSync(envPath)) {
    logger.warn('.env file already exists, skipping creation');
    return;
  }
  
  if (!fs.existsSync(examplePath)) {
    logger.error('.env.example file not found');
    return;
  }
  
  // Read example file and generate secrets
  let envContent = fs.readFileSync(examplePath, 'utf8');
  
  // Replace placeholder secrets with generated ones
  envContent = envContent.replace(
    /JWT_SECRET=.*/,
    `JWT_SECRET=${generateSecureSecret()}`
  );
  
  envContent = envContent.replace(
    /JWT_REFRESH_SECRET=.*/,
    `JWT_REFRESH_SECRET=${generateSecureSecret()}`
  );
  
  envContent = envContent.replace(
    /SESSION_SECRET=.*/,
    `SESSION_SECRET=${generateSecureSecret()}`
  );
  
  fs.writeFileSync(envPath, envContent);
  logger.info('.env file created from template with generated secrets');
};

/**
 * Log environment configuration status
 */
export const logEnvironmentStatus = (): void => {
  const info = getEnvironmentInfo();
  const validation = validateEnvironment();
  
  logger.info('Environment Configuration Status', {
    environment: info.nodeEnv,
    nodeVersion: info.nodeVersion,
    platform: `${info.platform}-${info.arch}`,
    configValid: info.configValid,
  });
  
  if (validation.errors.length > 0) {
    logger.error('Configuration Errors:', validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    logger.warn('Configuration Warnings:', validation.warnings);
  }
  
  // Log key configuration values (safe ones only)
  logger.info('Active Configuration:', {
    server: {
      port: config.server.port,
      host: config.server.host,
      apiVersion: config.server.apiVersion,
    },
    database: {
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      ssl: config.database.ssl,
    },
    features: {
      emailEnabled: config.email.enabled,
      uploadEnabled: config.upload.enabled,
      healthCheckEnabled: config.healthCheck.enabled,
    },
  });
};
