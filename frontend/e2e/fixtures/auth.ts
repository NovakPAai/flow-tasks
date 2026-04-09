import type { Page } from '@playwright/test';

export const ADMIN_EMAIL = 'admin@flowtask.dev';
export const USER_EMAIL  = 'user@flowtask.dev';
export const PASSWORD    = 'Password1';

/** Fills email/password and submits the login form. */
export async function loginAs(page: Page, email = ADMIN_EMAIL, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  // The inputs are custom InputField components — target the actual <input> inside
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  // Wait until redirected away from /login
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 10_000 });
}
