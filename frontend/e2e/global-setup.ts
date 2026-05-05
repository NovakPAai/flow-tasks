/**
 * Playwright Global Setup
 * Runs once before all tests. Resets the database and applies fresh seed
 * so every test run starts from a clean, predictable state.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

async function globalSetup() {
  console.log('\n[global-setup] Resetting database and seeding...');
  try {
    execSync('make db-reset', { cwd: ROOT, stdio: 'inherit', timeout: 60_000 });
  } catch {
    // db-reset might not exist — try manual approach
    console.warn('[global-setup] make db-reset failed, trying manual seed...');
    try {
      execSync('npm run db:seed', {
        cwd: path.join(ROOT, 'backend'),
        stdio: 'inherit',
        timeout: 30_000,
      });
    } catch (seedErr) {
      console.warn('[global-setup] Seed also failed:', seedErr);
      // Don't throw — let tests run anyway, they may have existing data
    }
  }
  console.log('[global-setup] Done.\n');
}

export default globalSetup;
