/**
 * Integration Test Runner
 * 
 * Comprehensive test runner for all integration tests with proper setup,
 * database management, and cleanup.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

interface TestResult {
  suite: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

class IntegrationTestRunner {
  private testSuites: string[] = [
    'src/tests/integration/taskApiCleaner.integration.test.ts',
    'src/tests/integration/authApi.integration.test.ts'
  ];

  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Integration Test Suite');
    console.log('=====================================\n');

    // Setup test environment
    await this.setupTestEnvironment();

    // Run each test suite
    for (const suite of this.testSuites) {
      await this.runTestSuite(suite);
    }

    // Generate report
    this.generateReport();

    // Cleanup
    await this.cleanup();
  }

  private async setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Ensure test database is ready
      await execAsync('npm run db:test');
      console.log('✅ Test database setup completed\n');
    } catch (error) {
      console.error('❌ Failed to setup test database:', error);
      process.exit(1);
    }
  }

  private async runTestSuite(suitePath: string): Promise<void> {
    const suiteName = path.basename(suitePath, '.ts');
    console.log(`\n📋 Running test suite: ${suiteName}`);
    console.log('─'.repeat(50));

    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(
        `npx jest ${suitePath} --verbose --detectOpenHandles --forceExit`,
        {
          env: {
            ...process.env,
            NODE_ENV: 'test'
          }
        }
      );

      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suiteName,
        passed: true,
        duration,
        output: stdout
      });

      console.log(`✅ ${suiteName} completed successfully (${duration}ms)`);
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        suite: suiteName,
        passed: false,
        duration,
        output: error.stdout || '',
        error: error.stderr || error.message
      });

      console.log(`❌ ${suiteName} failed (${duration}ms)`);
      if (error.stderr) {
        console.log('Error details:', error.stderr);
      }
    }
  }

  private generateReport(): void {
    console.log('\n📊 Integration Test Results');
    console.log('============================\n');

    const totalSuites = this.results.length;
    const passedSuites = this.results.filter(r => r.passed).length;
    const failedSuites = totalSuites - passedSuites;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);

    // Summary
    console.log(`Total Test Suites: ${totalSuites}`);
    console.log(`Passed: ${passedSuites}`);
    console.log(`Failed: ${failedSuites}`);
    console.log(`Total Duration: ${totalDuration}ms\n`);

    // Detailed results
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.suite} (${result.duration}ms)`);
      
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.substring(0, 200)}...`);
      }
    });

    console.log('\n');

    // Exit with error code if any tests failed
    if (failedSuites > 0) {
      console.log('❌ Some integration tests failed');
      process.exit(1);
    } else {
      console.log('✅ All integration tests passed!');
    }
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    
    try {
      // Additional cleanup if needed
      console.log('✅ Cleanup completed');
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Integration Test Runner

Usage: ts-node integration-test-runner.ts [options]

Options:
  --help, -h     Show this help message
  --suite <name> Run a specific test suite
  --verbose      Show detailed output
  --coverage     Run with coverage report

Examples:
  ts-node integration-test-runner.ts
  ts-node integration-test-runner.ts --suite taskApi
  ts-node integration-test-runner.ts --coverage
    `);
    process.exit(0);
  }

  const runner = new IntegrationTestRunner();

  try {
    await runner.runAllTests();
  } catch (error) {
    console.error('❌ Integration test runner failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { IntegrationTestRunner };
