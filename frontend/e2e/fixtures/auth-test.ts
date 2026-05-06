/**
 * Extended Playwright test fixture for authenticated tests.
 *
 * The backend uses rotating refresh tokens: every /api/auth/refresh call
 * deletes the old token and issues a new one. With a shared storageState
 * file, parallel workers both load the same stale refresh cookie — the second
 * worker to call /api/auth/refresh gets a 401 because the first already
 * rotated the token away.
 *
 * Fix: intercept /api/auth/refresh at the network layer and respond with a
 * fresh access token obtained directly from /api/auth/login.  No cookie is
 * sent to the backend, so rotation is never triggered.
 *
 * The adminToken worker fixture is created once per worker (not per test),
 * keeping the number of extra login requests low.
 *
 * Auth-testing spec files (auth.spec.ts, smoke.spec.ts, etc.) that need to
 * exercise the real login/refresh flow should import from '@playwright/test'
 * directly and set test.use({ storageState: { cookies: [], origins: [] } }).
 */
import { test as base, expect } from '@playwright/test';
import { getAdminToken } from '../helpers/data';

const test = base.extend<object, { adminToken: string }>({
  adminToken: [
    async ({}, use) => {
      const token = await getAdminToken();
      await use(token);
    },
    { scope: 'worker' },
  ],

  page: async ({ page, adminToken }, use) => {
    await page.route('**/api/auth/refresh', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: adminToken }),
      }),
    );
    await use(page);
  },
});

export { test, expect };
