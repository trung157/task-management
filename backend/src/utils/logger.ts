import winston from 'winston'
import path from 'path'
import fs from 'fs'
import DailyRotateFile from 'winston-daily-rotate-file'

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Custom log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
}

// Custom colors for log levels
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
}

winston.addColors(logColors)

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...meta
    })
  })
)

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, requestId, ...meta } = info
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
    const reqId = requestId ? ` [${requestId}]` : ''
    return `${timestamp} ${level}${reqId}: ${message}${metaStr}`
  })
)

// Create transports
const transports: winston.transport[] = []

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: consoleFormat
    })
  )
}

// File transports
transports.push(
  // Combined logs (all levels)
  new DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'debug',
    format: logFormat
  }),

  // Error logs only
  new DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: logFormat
  }),

  // HTTP logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'http-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    level: 'http',
    format: logFormat
  }),

  // Performance logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'performance-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    level: 'info',
    format: logFormat,
    filter: (info: any) => info.type === 'performance'
  }),

  // Security audit logs
  new DailyRotateFile({
    filename: path.join(logsDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'info',
    format: logFormat,
    filter: (info: any) => info.type === 'security'
  })
)

// Create the logger
const winstonLogger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  transports,
  exitOnError: false
})

// Handle uncaught exceptions and unhandled rejections
winstonLogger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'exceptions-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
  })
)

winstonLogger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, 'rejections-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat
  })
)

// Enhanced logger with additional methods
class EnhancedLogger {
  private winston: winston.Logger

  constructor(winstonLogger: winston.Logger) {
    this.winston = winstonLogger
  }

  // Standard logging methods
  error(message: string, meta?: any): void {
    this.winston.error(message, meta)
  }

  warn(message: string, meta?: any): void {
    this.winston.warn(message, meta)
  }

  info(message: string, meta?: any): void {
    this.winston.info(message, meta)
  }

  http(message: string, meta?: any): void {
    this.winston.http(message, meta)
  }

  debug(message: string, meta?: any): void {
    this.winston.debug(message, meta)
  }

  // Specialized logging methods
  performance(message: string, meta?: any): void {
    this.winston.info(message, { ...meta, type: 'performance' })
  }

  security(message: string, meta?: any): void {
    this.winston.info(message, { ...meta, type: 'security' })
  }

  database(message: string, meta?: any): void {
    this.winston.debug(message, { ...meta, type: 'database' })
  }

  api(message: string, meta?: any): void {
    this.winston.http(message, { ...meta, type: 'api' })
  }

  auth(message: string, meta?: any): void {
    this.winston.info(message, { ...meta, type: 'auth' })
  }

  // Structured logging for different event types
  logUserAction(action: string, userId: string, details?: any): void {
    this.security(`User action: ${action}`, {
      userId,
      action,
      details,
      timestamp: new Date().toISOString()
    })
  }

  logApiCall(method: string, endpoint: string, duration: number, statusCode: number, userId?: string): void {
    this.api(`${method} ${endpoint}`, {
      method,
      endpoint,
      duration,
      statusCode,
      userId,
      timestamp: new Date().toISOString()
    })
  }

  logDatabaseQuery(query: string, duration: number, rowCount?: number): void {
    this.database('Database query executed', {
      query: query.replace(/\s+/g, ' ').trim(),
      duration,
      rowCount,
      timestamp: new Date().toISOString()
    })
  }

  logError(error: Error, context?: any): void {
    this.error(`Error: ${error.message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    })
  }

  // Metrics logging
  logMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    this.performance(`Metric: ${name}`, {
      metric: name,
      value,
      unit,
      tags,
      timestamp: new Date().toISOString()
    })
  }

  // Health check logging
  logHealthCheck(service: string, status: 'healthy' | 'unhealthy', details?: any): void {
    const level = status === 'healthy' ? 'info' : 'error'
    this[level](`Health check: ${service} is ${status}`, {
      service,
      status,
      details,
      timestamp: new Date().toISOString()
    })
  }
}

// Create enhanced logger instance
const logger = new EnhancedLogger(winstonLogger)

// Stream for Morgan
const stream = {
  write: (message: string) => {
    logger.info(message.trim())
  }
}

export { logger, stream }
