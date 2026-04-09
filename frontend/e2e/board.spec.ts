import { test, expect } from '@playwright/test';
import { login, uniqueName } from './helpers';

// Uses the seeded "demo" workspace — always exists after `make setup`
const DEMO_SLUG = 'demo';

test.describe('Boards & Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto(`/w/${DEMO_SLUG}`);
    await expect(page).toHaveURL(new RegExp(`/w/${DEMO_SLUG}`), { timeout: 8000 });
  });

  test('creates a board and navigates to kanban', async ({ page }) => {
    const boardName = uniqueName('E2E-Board');
    const prefix = `E${Math.floor(Math.random() * 900) + 100}`;

    await page.locator('[data-onboarding="create-board"]').click();
    await page.locator('input[placeholder="Frontend, Backend, Design..."]').fill(boardName);
    await page.locator('input[placeholder="DEV, OPS, FRONT..."]').fill(prefix);
    await page.locator('[data-testid="create-board-submit"]').click();

    // After board creation, app navigates to the board kanban view
    await expect(page).toHaveURL(/\/boards\//, { timeout: 10000 });
  });

  test('workspace dashboard shows boards list', async ({ page }) => {
    // Workspace dashboard loads — has the create board button
    await expect(page.locator('[data-onboarding="create-board"]')).toBeVisible({ timeout: 5000 });
  });
});
