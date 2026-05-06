/**
 * Playwright Global Setup
 * Runs once before all tests. Resets the database and applies fresh seed
 * so every test run starts from a clean, predictable state.
 *
 * Auth is no longer handled here.  Previously we saved a storageState file
 * with the admin refresh cookie, but the backend uses rotating refresh tokens —
 * the second worker to call /api/auth/refresh would get a 401 because the
 * first already rotated the shared token away.
 *
 * Authenticated tests now use the auth-test.ts fixture which intercepts
 * /api/auth/refresh and serves a fresh access token obtained via the API.
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
    console.warn('[global-setup] make db-reset failed, trying manual seed...');
    try {
      execSync('npm run db:seed', {
        cwd: path.join(ROOT, 'backend'),
        stdio: 'inherit',
        timeout: 30_000,
      });
    } catch (seedErr) {
      console.warn('[global-setup] Seed also failed:', seedErr);
    }
  }
  console.log('[global-setup] DB ready.\n');
}

export default globalSetup;
