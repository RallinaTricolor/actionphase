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
    // Apply E2E test fixtures (includes common data + E2E-specific games)
    const projectRoot = path.resolve(__dirname, '../..');
    execSync('env DB_NAME=actionphase ./backend/pkg/db/test_fixtures/apply_e2e.sh', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    console.log('✅ E2E test fixtures applied successfully!\n');
  } catch (error) {
    console.error('❌ Failed to apply E2E test fixtures:', error);
    throw error;
  }
}

export default globalSetup;
