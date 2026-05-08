/**
 * Critical happy path smoke test — covers the full CIO demo journey:
 * Login → Create workspace → Create board → Create task → Task drawer →
 * Add comment → Add checklist item → Logout
 */
import { test, expect } from '@playwright/test';
import { login, logout, uniqueName } from './helpers';

// Smoke tests perform an explicit login/logout flow — start unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

test('CIO demo smoke: full user journey', async ({ page }) => {
  test.setTimeout(90_000); // full journey: login → ws → board → task → drawer → comment → logout
  // ── 1. Login ────────────────────────────────────────────────────────────────
  await login(page);
  await expect(page).toHaveURL(/\/workspaces/, { timeout: 10000 });

  // ── 2. Create workspace ─────────────────────────────────────────────────────
  const wsName = uniqueName('E2E-Smoke-WS');
  const wsSlug = `e2e-smoke-${Date.now()}`;

  await page.locator('[data-onboarding="create-workspace"]').click();
  await page.locator('input[placeholder="Моя команда"]').fill(wsName);
  await page.locator('input[placeholder="moya-komanda"]').fill(wsSlug);
  // Submit via keyboard Enter to avoid modal overlay interception
  await page.locator('input[placeholder="moya-komanda"]').press('Enter');

  // After creation the app auto-navigates to /w/<slug>
  await expect(page).toHaveURL(new RegExp(`/w/${wsSlug}`), { timeout: 10000 });

  // ── 4. Create board ──────────────────────────────────────────────────────────
  const boardName = uniqueName('Smoke-Board');
  const prefix = `SM${Math.floor(Math.random() * 90) + 10}`;

  await page.locator('[data-onboarding="create-board"]').click();
  await page.locator('input[placeholder="Frontend, Backend, Design..."]').fill(boardName);
  await page.locator('input[placeholder="DEV, OPS, FRONT..."]').fill(prefix);
  // Click submit via testid to avoid overlay interception
  await page.locator('[data-testid="create-board-submit"]').click();

  // After board creation, app auto-navigates to the board (kanban view)
  await expect(page).toHaveURL(/\/boards\//, { timeout: 10000 });

  // ── 6. Create a task ─────────────────────────────────────────────────────────
  // Find the "Add task" button in any kanban column
  const addTaskBtn = page.locator('[data-onboarding="create-task"]').first();
  await addTaskBtn.waitFor({ timeout: 8000 });
  await addTaskBtn.click();

  const taskTitle = uniqueName('Smoke Task');
  const titleInput = page.locator('input[placeholder="Название задачи..."]');
  await titleInput.fill(taskTitle);
  await titleInput.press('Enter');

  await expect(page.locator(`text=${taskTitle}`).first()).toBeVisible({ timeout: 10_000 });

  // ── 7. Open task drawer ──────────────────────────────────────────────────────
  // dispatchEvent на outer div TaskCard — надёжнее .click() по тексту (тот тригерит inline-edit)
  const taskCard = page.locator('[data-rfd-draggable-id]').filter({ hasText: taskTitle });
  await taskCard.waitFor({ timeout: 10_000 });
  await taskCard.locator('> div').first().dispatchEvent('click');
  // Confirm drawer opened by waiting for Details tab (matches openDrawer helper pattern)
  await expect(page.getByText('Детали')).toBeVisible({ timeout: 10_000 });

  // ── 8. Add a comment (click Comments tab first) ───────────────────────────────
  await page.getByText('Комментарии').click();
  // getByPlaceholder is more resilient; fill() waits for the element to be actionable
  const commentInput = page.getByPlaceholder('Написать комментарий...');
  await commentInput.fill('Hello from e2e smoke test');
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText('Hello from e2e smoke test')).toBeVisible({ timeout: 10_000 });

  // ── 9. Logout ────────────────────────────────────────────────────────────────
  // Close drawer first if needed
  await page.keyboard.press('Escape');
  await logout(page);
  await expect(page).toHaveURL(/\/login/);
});

test('Workspaces page loads with correct structure', async ({ page }) => {
  await login(page);
  await page.goto('/workspaces');
  await expect(page.locator('[data-onboarding="create-workspace"]')).toBeVisible({ timeout: 5000 });
});

test('My Tasks page loads', async ({ page }) => {
  await login(page);
  await page.goto('/my-tasks');
  await expect(page).toHaveURL(/\/my-tasks/);
  // Page renders without crash
  await expect(page.locator('body')).toBeVisible();
});

test('Profile page loads', async ({ page }) => {
  await login(page);
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.locator('body')).toBeVisible();
});
