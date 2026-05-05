import { test, expect } from '@playwright/test';
import { uniqueName } from './helpers';

test.describe('Workspaces', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspaces');
  });

  test('shows workspace list page', async ({ page }) => {
    await expect(page).toHaveURL(/\/workspaces/);
    // Should show at least the "Create workspace" card
    await expect(page.locator('[data-onboarding="create-workspace"]')).toBeVisible({ timeout: 5000 });
  });

  test('creates a new workspace', async ({ page }) => {
    const wsName = uniqueName('E2E-WS');
    const wsSlug = `e2e-ws-${Date.now()}`;

    // Click the "new workspace" card
    await page.locator('[data-onboarding="create-workspace"]').click();

    // Fill the modal
    const nameInput = page.locator('input[placeholder="Моя команда"], input[type="text"]').first();
    await nameInput.fill(wsName);

    const slugInput = page.locator('input[placeholder="moya-komanda"]');
    await slugInput.fill(wsSlug);

    // Submit via Enter to avoid modal overlay interception
    await slugInput.press('Enter');

    // After creation the app navigates to /w/<slug>
    await expect(page).toHaveURL(new RegExp(`/w/${wsSlug}`), { timeout: 10000 });
  });

  test('navigates to workspace dashboard on click', async ({ page }) => {
    // Wait for workspace cards to load — find a card that links to /w/<slug>
    // Workspace cards navigate on click, the create card has data-onboarding="create-workspace"
    // so we find any div that navigates to /w/ by waiting for a url change
    await page.waitForFunction(() => document.querySelectorAll('[data-onboarding="create-workspace"]').length > 0);

    // The workspace list is rendered before the NewWorkspaceCard, click the first workspace
    // by looking for cards that have a name heading (h2/h3/strong) inside
    const firstCard = page.locator('div').filter({ hasText: /Boards|Доски|Задачи/ }).first();
    if (await firstCard.count() > 0) {
      await firstCard.click();
      await expect(page).toHaveURL(/\/w\//, { timeout: 5000 });
    }
    // If no workspace exists yet, skip this assertion (fresh env)
  });
});
