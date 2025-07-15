#!/usr/bin/env npx tsx

/**
 * Environment Configuration Setup Script
 * 
 * This script helps set up and validate environment configuration for the TaskFlow API.
 * It can generate secure secrets, validate configuration, and create .env files.
 * 
 * Usage:
 *   npm run env:setup          - Interactive setup
 *   npm run env:validate       - Validate current configuration
 *   npm run env:generate       - Generate secure secrets
 *   npm run env:check          - Check environment health
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';
import { testDatabaseConnection, getDatabaseInfo } from '../config/database';
import { validateJWTConfig, getJWTInfo } from '../config/jwt';
import { getEnvironmentInfo } from '../config/environment';
import config from '../config/config';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg: string) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg: string) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg: string) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`),
};

/**
 * Generate a cryptographically secure random string
 */
function generateSecureSecret(length: number = 64): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate environment file content
 */
function generateEnvContent(answers: Record<string, string>): string {
  return `# TaskFlow Backend Environment Configuration
# Generated on ${new Date().toISOString()}

# ====================
# DATABASE CONFIGURATION
# ====================
DB_HOST=${answers.dbHost || 'localhost'}
DB_PORT=${answers.dbPort || '5432'}
DB_NAME=${answers.dbName || 'task_management_db'}
DB_USER=${answers.dbUser || 'postgres'}
DB_PASSWORD=${answers.dbPassword || ''}

# Database Pool Settings
DB_POOL_MIN=2
DB_POOL_MAX=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000

# ====================
# SERVER CONFIGURATION
# ====================
NODE_ENV=${answers.nodeEnv || 'development'}
PORT=${answers.port || '5000'}
HOST=localhost

# API Configuration
API_VERSION=v1
API_PREFIX=/api

# ====================
# SECURITY CONFIGURATION
# ====================
# JWT Configuration
JWT_SECRET=${answers.jwtSecret}
JWT_REFRESH_SECRET=${answers.jwtRefreshSecret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Password Security
BCRYPT_ROUNDS=12
MIN_PASSWORD_LENGTH=8

# Session Configuration
SESSION_SECRET=${answers.sessionSecret}

# ====================
# CORS & CLIENT CONFIGURATION
# ====================
FRONTEND_URL=${answers.frontendUrl || 'http://localhost:3000'}
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000

# ====================
# RATE LIMITING
# ====================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MESSAGE=Too many requests from this IP, please try again later

AUTH_RATE_LIMIT_WINDOW_MS=300000
AUTH_RATE_LIMIT_MAX_REQUESTS=5

# ====================
# EMAIL CONFIGURATION
# ====================
EMAIL_ENABLED=${answers.emailEnabled || 'false'}
EMAIL_SERVICE=smtp
EMAIL_HOST=${answers.emailHost || 'smtp.gmail.com'}
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=${answers.emailUser || ''}
EMAIL_PASSWORD=${answers.emailPassword || ''}
EMAIL_FROM_NAME=TaskFlow
EMAIL_FROM_ADDRESS=noreply@taskflow.com

# ====================
# FILE UPLOAD CONFIGURATION
# ====================
UPLOAD_ENABLED=true
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
MAX_FILES_PER_REQUEST=5

# ====================
# LOGGING CONFIGURATION
# ====================
LOG_LEVEL=info
LOG_FORMAT=combined
LOG_FILE=./logs/app.log
LOG_MAX_SIZE=10485760
LOG_MAX_FILES=5

# ====================
# DEVELOPMENT SETTINGS
# ====================
DEV_SEED_DATABASE=false
DEV_RESET_DATABASE=false
DEV_MOCK_EMAIL=true

# ====================
# HEALTH CHECK CONFIGURATION
# ====================
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_DATABASE=true
HEALTH_CHECK_EMAIL=false
`;
}

/**
 * Interactive setup
 */
async function interactiveSetup(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => resolve(answer.trim()));
    });
  };

  log.header('🚀 TaskFlow Environment Setup');
  log.info('This will help you set up your environment configuration.');
  log.info('Press Enter to use default values in brackets.');

  const answers: Record<string, string> = {};

  // Environment
  answers.nodeEnv = await ask('Environment (development/production) [development]: ') || 'development';
  
  // Server
  answers.port = await ask('Server port [5000]: ') || '5000';
  answers.frontendUrl = await ask('Frontend URL [http://localhost:3000]: ') || 'http://localhost:3000';

  // Database
  log.info('\nDatabase Configuration:');
  answers.dbHost = await ask('Database host [localhost]: ') || 'localhost';
  answers.dbPort = await ask('Database port [5432]: ') || '5432';
  answers.dbName = await ask('Database name [task_management_db]: ') || 'task_management_db';
  answers.dbUser = await ask('Database user [postgres]: ') || 'postgres';
  answers.dbPassword = await ask('Database password (required): ');

  if (!answers.dbPassword) {
    log.error('Database password is required!');
    rl.close();
    return;
  }

  // Security
  log.info('\nSecurity Configuration:');
  const generateSecrets = await ask('Generate secure JWT and session secrets? (y/n) [y]: ') || 'y';
  
  if (generateSecrets.toLowerCase() === 'y' || generateSecrets.toLowerCase() === 'yes') {
    answers.jwtSecret = generateSecureSecret(64);
    answers.jwtRefreshSecret = generateSecureSecret(64);
    answers.sessionSecret = generateSecureSecret(32);
    log.success('Generated secure secrets');
  } else {
    answers.jwtSecret = await ask('JWT Secret (leave empty to generate): ') || generateSecureSecret(64);
    answers.jwtRefreshSecret = await ask('JWT Refresh Secret (leave empty to generate): ') || generateSecureSecret(64);
    answers.sessionSecret = await ask('Session Secret (leave empty to generate): ') || generateSecureSecret(32);
  }

  // Email (optional)
  log.info('\nEmail Configuration (optional):');
  const setupEmail = await ask('Set up email configuration? (y/n) [n]: ') || 'n';
  
  if (setupEmail.toLowerCase() === 'y' || setupEmail.toLowerCase() === 'yes') {
    answers.emailEnabled = 'true';
    answers.emailHost = await ask('SMTP host [smtp.gmail.com]: ') || 'smtp.gmail.com';
    answers.emailUser = await ask('Email user: ');
    answers.emailPassword = await ask('Email password: ');
  } else {
    answers.emailEnabled = 'false';
  }

  // Write .env file
  const envPath = path.resolve(process.cwd(), '.env');
  const envContent = generateEnvContent(answers);
  
  if (fs.existsSync(envPath)) {
    const overwrite = await ask('\n.env file already exists. Overwrite? (y/n) [n]: ') || 'n';
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      log.info('Setup cancelled. Your existing .env file was not modified.');
      rl.close();
      return;
    }
  }

  fs.writeFileSync(envPath, envContent);
  log.success(`Environment configuration written to ${envPath}`);

  rl.close();

  // Validate the new configuration
  log.info('\nValidating configuration...');
  await validateConfiguration();
}

/**
 * Validate current configuration
 */
async function validateConfiguration(): Promise<void> {
  log.header('🔍 Configuration Validation');

  let hasErrors = false;

  try {
    // Check if .env file exists
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      log.warning('.env file not found. Using environment variables or defaults.');
    } else {
      log.success('.env file found');
    }

    // Test database connection
    log.info('Testing database connection...');
    const dbConnected = await testDatabaseConnection();
    if (dbConnected) {
      log.success('Database connection successful');
      const dbInfo = getDatabaseInfo();
      log.info(`Database: ${dbInfo.database}@${dbInfo.host}:${dbInfo.port}`);
    } else {
      log.error('Database connection failed');
      hasErrors = true;
    }

    // Validate JWT configuration
    log.info('Validating JWT configuration...');
    try {
      validateJWTConfig();
      log.success('JWT configuration valid');
      const jwtInfo = getJWTInfo();
      log.info(`JWT: ${jwtInfo.algorithm}, access: ${jwtInfo.accessTokenExpiry}, refresh: ${jwtInfo.refreshTokenExpiry}`);
    } catch (error) {
      log.error(`JWT configuration invalid: ${error instanceof Error ? error.message : 'Unknown error'}`);
      hasErrors = true;
    }

    // Check environment info
    log.info('Checking environment...');
    const envInfo = await getEnvironmentInfo();
    log.info(`Environment: ${envInfo.nodeEnv} (Node.js ${envInfo.nodeVersion})`);
    
    if (envInfo.missingVars.length > 0) {
      log.warning(`Missing variables: ${envInfo.missingVars.join(', ')}`);
    }

    if (envInfo.warnings.length > 0) {
      envInfo.warnings.forEach(warning => log.warning(warning));
    }

    if (!hasErrors && envInfo.missingVars.length === 0) {
      log.success('Configuration validation passed!');
    } else {
      log.error('Configuration validation failed. Please check the errors above.');
    }

  } catch (error) {
    log.error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    hasErrors = true;
  }
}

/**
 * Generate secure secrets
 */
function generateSecrets(): void {
  log.header('🔐 Generate Secure Secrets');
  
  console.log('Add these to your .env file:\n');
  console.log(`JWT_SECRET=${generateSecureSecret(64)}`);
  console.log(`JWT_REFRESH_SECRET=${generateSecureSecret(64)}`);
  console.log(`SESSION_SECRET=${generateSecureSecret(32)}`);
  console.log('');
  
  log.info('Copy these values to your .env file and restart the application.');
}

/**
 * Environment health check
 */
async function healthCheck(): Promise<void> {
  log.header('🏥 Environment Health Check');

  // Basic checks
  log.info(`Node.js version: ${process.version}`);
  log.info(`Platform: ${process.platform} ${process.arch}`);
  log.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  log.info(`PID: ${process.pid}`);
  log.info(`Uptime: ${Math.floor(process.uptime())}s`);

  // Memory usage
  const memUsage = process.memoryUsage();
  log.info(`Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used, ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB total`);

  // Check critical environment variables
  const criticalVars = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  let allPresent = true;

  criticalVars.forEach(varName => {
    if (process.env[varName]) {
      log.success(`${varName} is set`);
    } else {
      log.error(`${varName} is missing`);
      allPresent = false;
    }
  });

  if (allPresent) {
    log.success('All critical environment variables are present');
  } else {
    log.error('Some critical environment variables are missing');
  }

  // Test connections
  await validateConfiguration();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'setup':
    case 'interactive':
      await interactiveSetup();
      break;
    
    case 'validate':
    case 'check':
      await validateConfiguration();
      break;
    
    case 'generate':
    case 'secrets':
      generateSecrets();
      break;
    
    case 'health':
      await healthCheck();
      break;
    
    default:
      console.log(`
${colors.bright}TaskFlow Environment Setup Tool${colors.reset}

Usage:
  npx tsx src/scripts/env-setup.ts <command>

Commands:
  setup      Interactive environment setup
  validate   Validate current configuration
  generate   Generate secure secrets
  health     Check environment health

Examples:
  npx tsx src/scripts/env-setup.ts setup
  npx tsx src/scripts/env-setup.ts validate
  npx tsx src/scripts/env-setup.ts generate
  npx tsx src/scripts/env-setup.ts health
`);
      break;
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  log.error(`Unhandled error: ${error}`);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log.error(`Script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}
