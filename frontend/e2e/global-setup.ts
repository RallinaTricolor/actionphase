import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Global Setup for E2E Tests
 *
 * This script runs once before all E2E tests to ensure a clean, consistent database state.
 * It resets and reapplies all test fixtures.
 */
async function globalSetup() {
  console.log('\n🧹 Resetting E2E test fixtures...');

  try {
    const projectRoot = path.resolve(__dirname, '../..');

    // Apply common fixtures first
    console.log('📦 Applying common fixtures...');
    execSync('env DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_common.sh', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    // Apply worker-specific fixtures for all 6 workers (matches Playwright workers config)
    console.log('🔧 Applying worker-specific E2E fixtures for 6 parallel workers...');
    for (let workerIndex = 0; workerIndex <= 5; workerIndex++) {
      console.log(`  Worker ${workerIndex}...`);
      execSync(`env DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_e2e_worker.sh ${workerIndex}`, {
        stdio: workerIndex === 0 ? 'inherit' : 'ignore', // Show output for Worker 0, hide for others
        cwd: projectRoot,
      });
    }

    console.log('✅ E2E test fixtures applied successfully for all workers!\n');
  } catch (error) {
    console.error('❌ Failed to apply E2E test fixtures:', error);
    throw error;
  }
}

export default globalSetup;
