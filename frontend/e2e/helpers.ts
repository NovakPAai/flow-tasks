import type { Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@flowtask.dev';
export const ADMIN_PASSWORD = 'Password1';

export async function login(page: Page, email = ADMIN_EMAIL, password = ADMIN_PASSWORD) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
}

export async function logout(page: Page) {
  // Click user avatar in the top bar
  await page.locator('[data-testid="user-avatar"]').click();
  await page.getByText('Выйти').click();
  await page.waitForURL('**/login', { timeout: 5000 });
}

export function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}`;
}
