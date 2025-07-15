import dotenv from 'dotenv';
import path from 'path';

// Load environment variables with explicit path
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  url?: string;
  ssl?: boolean;
  pool: {
    min: number;
    max: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
}

interface JWTConfig {
  secret: string;
  refreshSecret: string;
  expiresIn: string;
  refreshExpiresIn: string;
  algorithm: string;
}

interface EmailConfig {
  enabled: boolean;
  service: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  fromName: string;
  templateDir: string;
  mockInDev: boolean;
}

interface ServerConfig {
  port: number;
  host: string;
  env: string;
  apiVersion: string;
  apiPrefix: string;
  corsOrigin: string | string[];
  trustProxy: boolean;
  forceHttps: boolean;
  secureCookies: boolean;
}

interface SecurityConfig {
  bcryptRounds: number;
  minPasswordLength: number;
  sessionSecret: string;
  helmetCspEnabled: boolean;
  requireCaptchaForPasswordReset?: boolean;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  auth: {
    windowMs: number;
    max: number;
  };
}

interface UploadConfig {
  enabled: boolean;
  maxFileSize: number;
  uploadDir: string;
  allowedTypes: string[];
  maxFilesPerRequest: number;
}

interface LoggingConfig {
  level: string;
  format: string;
  file: string;
  maxSize: number;
  maxFiles: number;
}

interface HealthCheckConfig {
  enabled: boolean;
  database: boolean;
  email: boolean;
}

interface DevelopmentConfig {
  seedDatabase: boolean;
  resetDatabase: boolean;
  mockEmail: boolean;
}

interface FeaturesConfig {
  emailVerification?: boolean;
  twoFactorAuth?: boolean;
  advancedLogging?: boolean;
}

interface AppConfig {
  frontendUrl: string;
  name: string;
  version: string;
  description: string;
}

interface Config {
  app: AppConfig;
  server: ServerConfig;
  database: DatabaseConfig;
  jwt: JWTConfig;
  email: EmailConfig;
  security: SecurityConfig;
  rateLimiting: RateLimitConfig;
  upload: UploadConfig;
  logging: LoggingConfig;
  healthCheck: HealthCheckConfig;
  development: DevelopmentConfig;
  features: FeaturesConfig;
  nodeEnv: string;
}

// Helper function to parse boolean environment variables
const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

// Helper function to parse comma-separated values
const parseArray = (value: string | undefined, defaultValue: string[] = []): string[] => {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
};

// Generate secure JWT secret if not provided
const generateSecretWarning = (secretName: string, defaultSecret: string): string => {
  if (process.env[secretName]) {
    return process.env[secretName]!;
  }
  
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${secretName} environment variable is required in production`);
  }
  
  console.warn(`⚠️  WARNING: Using default ${secretName}. Set ${secretName} in production!`);
  return defaultSecret;
};

const config: Config = {
  app: {
    name: 'TaskFlow API',
    version: '1.0.0',
    description: 'Task Management System API',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  },

  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    host: process.env.HOST || 'localhost',
    env: process.env.NODE_ENV || 'development',
    apiVersion: process.env.API_VERSION || 'v1',
    apiPrefix: process.env.API_PREFIX || '/api',
    corsOrigin: parseArray(process.env.ALLOWED_ORIGINS, ['http://localhost:3000', 'http://localhost:5173']),
    trustProxy: parseBoolean(process.env.TRUST_PROXY),
    forceHttps: parseBoolean(process.env.FORCE_HTTPS),
    secureCookies: parseBoolean(process.env.SECURE_COOKIES),
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'task_management_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    url: process.env.DATABASE_URL,
    ssl: parseBoolean(process.env.DB_SSL),
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '60000', 10),
    },
  },

  jwt: {
    secret: generateSecretWarning('JWT_SECRET', 'default-jwt-secret-change-in-production'),
    refreshSecret: generateSecretWarning('JWT_REFRESH_SECRET', 'default-refresh-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256',
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    minPasswordLength: parseInt(process.env.MIN_PASSWORD_LENGTH || '8', 10),
    sessionSecret: generateSecretWarning('SESSION_SECRET', 'default-session-secret-change-in-production'),
    helmetCspEnabled: parseBoolean(process.env.HELMET_CSP_ENABLED, true),
    requireCaptchaForPasswordReset: parseBoolean(process.env.REQUIRE_CAPTCHA_FOR_PASSWORD_RESET),
  },

  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests from this IP, please try again later',
    auth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '300000', 10), // 5 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '5', 10),
    },
  },

  email: {
    enabled: parseBoolean(process.env.EMAIL_ENABLED),
    service: process.env.EMAIL_SERVICE || 'smtp',
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: parseBoolean(process.env.EMAIL_SECURE),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM_ADDRESS || 'noreply@taskflow.com',
    fromName: process.env.EMAIL_FROM_NAME || 'TaskFlow',
    templateDir: process.env.EMAIL_TEMPLATE_DIR || './templates/emails',
    mockInDev: parseBoolean(process.env.DEV_MOCK_EMAIL, true),
  },

  upload: {
    enabled: parseBoolean(process.env.UPLOAD_ENABLED, true),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'),
    allowedTypes: parseArray(process.env.ALLOWED_FILE_TYPES, [
      'image/jpeg',
      'image/png', 
      'image/gif',
      'image/webp'
    ]),
    maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST || '5', 10),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: process.env.LOG_FILE || './logs/app.log',
    maxSize: parseInt(process.env.LOG_MAX_SIZE || '10485760', 10), // 10MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '5', 10),
  },

  healthCheck: {
    enabled: parseBoolean(process.env.HEALTH_CHECK_ENABLED, true),
    database: parseBoolean(process.env.HEALTH_CHECK_DATABASE, true),
    email: parseBoolean(process.env.HEALTH_CHECK_EMAIL),
  },

  development: {
    seedDatabase: parseBoolean(process.env.DEV_SEED_DATABASE),
    resetDatabase: parseBoolean(process.env.DEV_RESET_DATABASE),
    mockEmail: parseBoolean(process.env.DEV_MOCK_EMAIL, true),
  },

  features: {
    emailVerification: parseBoolean(process.env.ENABLE_EMAIL_VERIFICATION, true),
    twoFactorAuth: parseBoolean(process.env.ENABLE_TWO_FACTOR_AUTH),
    advancedLogging: parseBoolean(process.env.ENABLE_ADVANCED_LOGGING),
  },

  nodeEnv: process.env.NODE_ENV || 'development',
};

// Validate required configuration
const validateConfig = () => {
  const errors: string[] = [];

  // Database validation
  if (!config.database.password && !config.database.url) {
    errors.push('Database password is required (DB_PASSWORD or DATABASE_URL)');
  }

  // JWT validation
  if (config.server.env === 'production') {
    if (config.jwt.secret.includes('default')) {
      errors.push('JWT_SECRET must be set in production');
    }
    if (config.jwt.refreshSecret.includes('default')) {
      errors.push('JWT_REFRESH_SECRET must be set in production');
    }
    if (config.security.sessionSecret.includes('default')) {
      errors.push('SESSION_SECRET must be set in production');
    }
  }

  // Email validation (if enabled)
  if (config.email.enabled && (!config.email.user || !config.email.password)) {
    errors.push('Email credentials are required when email is enabled (EMAIL_USER, EMAIL_PASSWORD)');
  }

  if (errors.length > 0) {
    console.error('❌ Configuration validation failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }
};

// Validate configuration on startup
validateConfig();

// Log configuration warnings
if (config.server.env === 'development') {
  if (!config.email.enabled) {
    console.warn('⚠️  WARNING: Email configuration not found. Email features will be disabled.');
  }
}

export default config;
