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
    // Apply all test fixtures (this resets existing data first)
    const projectRoot = path.resolve(__dirname, '../..');
    execSync('./backend/pkg/db/test_fixtures/apply_all.sh', {
      stdio: 'inherit',
      cwd: projectRoot,
    });

    console.log('✅ Test fixtures applied successfully!\n');
  } catch (error) {
    console.error('❌ Failed to apply test fixtures:', error);
    throw error;
  }
}

export default globalSetup;
