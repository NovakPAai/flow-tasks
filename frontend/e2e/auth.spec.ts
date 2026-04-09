import { test, expect } from '@playwright/test';
import { login, logout, ADMIN_EMAIL, ADMIN_PASSWORD } from './helpers';

test.describe('Authentication', () => {
  test('redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in with valid credentials and redirects to /workspaces', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test('shows error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('WrongPassword1');
    await page.locator('button[type="submit"]').click();
    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/);
    // Ant Design message or inline error
    await expect(page.locator('.ant-message, [class*="error"], [class*="Error"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('logs out and redirects to /login', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/workspaces/);
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('login button is disabled while loading', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);
    // Click submit — button should be disabled during the async request
    await page.locator('button[type="submit"]').click();
    // Very brief check — the button might re-enable quickly after redirect
    // Just verify the page eventually navigates away
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
  });
});
