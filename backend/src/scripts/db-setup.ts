#!/usr/bin/env npx tsx

/**
 * Database Setup and Management Script
 * 
 * This script provides utilities for database connection setup, testing,
 * and management operations for the TaskFlow API.
 * 
 * Usage:
 *   npm run db:setup          - Interactive database setup
 *   npm run db:test           - Test database connection
 *   npm run db:health         - Comprehensive health check
 *   npm run db:info           - Show database information
 *   npm run db:pool-stats     - Show connection pool statistics
 */

import {
  getDatabase,
  closeDatabase,
  testDatabaseConnection,
  getDatabaseHealth,
  getPoolStats,
  getDatabaseInfo,
  warmUpPool,
  checkDatabaseVersion,
  logPoolStatus,
  executeScript,
} from '../config/database';
import config from '../config/config';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

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
 * Test basic database connection
 */
async function testConnection(): Promise<void> {
  log.header('🔗 Database Connection Test');
  
  try {
    log.info('Testing database connection...');
    
    const start = Date.now();
    const isConnected = await testDatabaseConnection();
    const duration = Date.now() - start;
    
    if (isConnected) {
      log.success(`Database connection successful (${duration}ms)`);
      
      // Show database info
      const dbInfo = getDatabaseInfo();
      log.info(`Connected to: ${dbInfo.database}@${dbInfo.host}:${dbInfo.port}`);
      log.info(`User: ${dbInfo.user || 'N/A'}`);
      log.info(`SSL: ${dbInfo.ssl ? 'Enabled' : 'Disabled'}`);
      log.info(`Pool: ${dbInfo.poolMin}-${dbInfo.poolMax} connections`);
      
    } else {
      log.error('Database connection failed');
      process.exit(1);
    }
    
  } catch (error) {
    log.error(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

/**
 * Comprehensive database health check
 */
async function healthCheck(): Promise<void> {
  log.header('🏥 Database Health Check');
  
  try {
    const health = await getDatabaseHealth();
    
    log.info(`Connection Status: ${health.connected ? '✅ Connected' : '❌ Disconnected'}`);
    log.info(`Response Time: ${health.responseTime}ms`);
    
    if (health.version) {
      log.info(`PostgreSQL Version: ${health.version}`);
    }
    
    if (health.lastError) {
      log.error(`Last Error: ${health.lastError}`);
    }
    
    // Pool statistics
    log.info('\\nConnection Pool Statistics:');
    log.info(`  Total Connections: ${health.poolStats.totalConnections}`);
    log.info(`  Active Connections: ${health.poolStats.activeConnections}`);
    log.info(`  Idle Connections: ${health.poolStats.idleConnections}`);
    log.info(`  Waiting Clients: ${health.poolStats.waitingClients}`);
    log.info(`  Max Connections: ${health.poolStats.maxConnections}`);
    
    // Health assessment
    if (health.connected) {
      if (health.responseTime < 100) {
        log.success('Database performance: Excellent');
      } else if (health.responseTime < 500) {
        log.success('Database performance: Good');
      } else {
        log.warning('Database performance: Slow');
      }
      
      if (health.poolStats.waitingClients > 0) {
        log.warning(`${health.poolStats.waitingClients} clients waiting for connections`);
      }
      
      if (health.poolStats.activeConnections > health.poolStats.maxConnections * 0.8) {
        log.warning('Connection pool utilization is high (>80%)');
      }
    }
    
  } catch (error) {
    log.error(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Show database information
 */
async function showDatabaseInfo(): Promise<void> {
  log.header('📊 Database Information');
  
  try {
    const dbInfo = getDatabaseInfo();
    
    console.log('Database Configuration:');
    console.log('─'.repeat(50));
    Object.entries(dbInfo).forEach(([key, value]) => {
      console.log(`  ${key.padEnd(20)}: ${value}`);
    });
    
    // Check version compatibility
    try {
      const versionInfo = await checkDatabaseVersion();
      console.log('\\nVersion Information:');
      console.log('─'.repeat(50));
      console.log(`  PostgreSQL Version  : ${versionInfo.version}`);
      console.log(`  Major Version       : ${versionInfo.majorVersion}`);
      console.log(`  Compatible          : ${versionInfo.compatible ? '✅ Yes' : '❌ No'}`);
      
      if (!versionInfo.compatible) {
        log.warning('PostgreSQL 12+ is recommended for optimal performance');
      }
    } catch (error) {
      log.warning('Could not retrieve version information');
    }
    
  } catch (error) {
    log.error(`Failed to retrieve database info: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Show connection pool statistics
 */
async function showPoolStats(): Promise<void> {
  log.header('📈 Connection Pool Statistics');
  
  try {
    // Initialize pool if not already done
    getDatabase();
    
    // Show current stats
    logPoolStatus();
    
    // Monitor pool for a short period
    log.info('\\nMonitoring pool for 10 seconds...');
    
    let cycles = 0;
    const monitor = setInterval(() => {
      const stats = getPoolStats();
      const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
      
      console.log(`[${timestamp}] Total: ${stats.totalConnections}, Active: ${stats.activeConnections}, Idle: ${stats.idleConnections}, Waiting: ${stats.waitingClients}`);
      
      cycles++;
      if (cycles >= 10) {
        clearInterval(monitor);
        log.success('Pool monitoring completed');
      }
    }, 1000);
    
  } catch (error) {
    log.error(`Failed to show pool stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Warm up database connections
 */
async function warmUp(): Promise<void> {
  log.header('� Database Pool Warm-up');
  
  try {
    await warmUpPool();
    log.success('Database pool warmed up successfully');
    
    // Show final pool stats
    const stats = getPoolStats();
    log.info(`Pool now has ${stats.totalConnections} active connections`);
    
  } catch (error) {
    log.error(`Warm-up failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const command = process.argv[2];

  try {
    switch (command) {
      case 'test':
        await testConnection();
        break;
      
      case 'health':
        await healthCheck();
        break;
      
      case 'info':
        await showDatabaseInfo();
        break;
      
      case 'pool-stats':
        await showPoolStats();
        break;
      
      case 'warmup':
        await warmUp();
        break;
      
      default:
        console.log(`
${colors.bright}TaskFlow Database Management Tool${colors.reset}

Usage:
  npx tsx src/scripts/db-setup.ts <command>

Commands:
  test          Test database connection
  health        Comprehensive health check
  info          Show database information
  pool-stats    Show connection pool statistics
  warmup        Warm up connection pool

Examples:
  npx tsx src/scripts/db-setup.ts test
  npx tsx src/scripts/db-setup.ts health
  npx tsx src/scripts/db-setup.ts info
`);
        break;
    }
  } finally {
    // Always close the database connection
    await closeDatabase();
  }
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  log.error(`Unhandled error: ${error}`);
  closeDatabase().finally(() => process.exit(1));
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log.error(`Script failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    closeDatabase().finally(() => process.exit(1));
  });
}
