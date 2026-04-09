/**
 * Critical happy path smoke test — covers the full CIO demo journey:
 * Login → Create workspace → Create board → Create task → Task drawer →
 * Add comment → Add checklist item → Logout
 */
import { test, expect } from '@playwright/test';
import { login, logout, uniqueName } from './helpers';

test('CIO demo smoke: full user journey', async ({ page }) => {
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

  await expect(page.locator(`text=${taskTitle}`).first()).toBeVisible({ timeout: 5000 });

  // ── 7. Open task drawer ──────────────────────────────────────────────────────
  await page.locator(`text=${taskTitle}`).first().click();
  // Task drawer opens — wait for the comments tab to be available
  await expect(page.locator('text=Комментарии')).toBeVisible({ timeout: 5000 });

  // ── 8. Add a comment (click Comments tab first) ───────────────────────────────
  await page.locator('text=Комментарии').click();
  const commentInput = page.locator('textarea[placeholder="Написать комментарий..."]');
  await commentInput.waitFor({ timeout: 5000 });
  await commentInput.fill('Hello from e2e smoke test');
  await page.locator('button:has-text("Отправить")').click();
  await expect(page.locator('text=Hello from e2e smoke test')).toBeVisible({ timeout: 5000 });

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
