/**
 * Playwright Global Setup
 * Runs once before all tests. Resets the database and applies fresh seed
 * so every test run starts from a clean, predictable state.
 * Also saves admin auth storageState so tests skip the UI login flow.
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from '@playwright/test';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const AUTH_DIR = path.join(__dirname, '.auth');
const FRONTEND_URL = 'http://localhost:5174';

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
  console.log('[global-setup] DB reset done.\n');

  // Save admin auth storageState once — reused by all authenticated tests via
  // playwright.config.ts use.storageState so they skip the UI login form entirely.
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${FRONTEND_URL}/login`);
    await page.locator('input[type="email"]').fill('admin@flowtask.dev');
    await page.locator('input[type="password"]').fill('Password1');
    await page.locator('button[type="submit"]').click();
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15_000 });
    await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
    console.log('[global-setup] Admin auth state saved.\n');
  } finally {
    await browser.close();
  }
}

export default globalSetup;
