#!/usr/bin/env ts-node

import { connectDatabase, testConnection, closeDatabase } from '../db';
import { logger } from '../utils/logger';
import config from '../config/config';

/**
 * Simple database connection test script
 */
async function testDatabaseConnection(): Promise<void> {
  logger.info('🔌 Testing PostgreSQL database connection...');
  
  // Display connection info
  if (config.database.url) {
    const url = new URL(config.database.url);
    logger.info(`📡 Connecting to: ${url.hostname}:${url.port}${url.pathname}`);
  } else {
    logger.info(`📡 Connecting to: ${config.database.host}:${config.database.port}/${config.database.database}`);
  }

  try {
    // Test basic connection
    await connectDatabase();
    logger.info('✅ Database connection established');

    // Test query execution
    const querySuccess = await testConnection();
    if (querySuccess) {
      logger.info('✅ Database query test passed');
    } else {
      logger.error('❌ Database query test failed');
      process.exit(1);
    }

    // Test pool status
    const pool = require('../db').default;
    logger.info(`📊 Connection pool status:`);
    logger.info(`   Total connections: ${pool.totalCount}`);
    logger.info(`   Idle connections: ${pool.idleCount}`);
    logger.info(`   Waiting clients: ${pool.waitingCount}`);

    logger.info('🎉 All database tests passed!');

  } catch (error) {
    logger.error('❌ Database connection test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        logger.error('💡 Suggestion: Make sure PostgreSQL is running and accessible');
      } else if (error.message.includes('authentication failed')) {
        logger.error('💡 Suggestion: Check your database credentials in .env file');
      } else if (error.message.includes('database') && error.message.includes('does not exist')) {
        logger.error('💡 Suggestion: Create the database or run: npm run db:setup');
      }
    }
    
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run the test
if (require.main === module) {
  testDatabaseConnection();
}

export { testDatabaseConnection };
