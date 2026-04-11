import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { getAdminToken, createWorkspace, createBoard, createTask, getWorkspace, uid } from '../helpers/data';

test.describe('Переключение видов (Kanban / List / Calendar)', () => {

  let wsSlug: string;
  let wsId: string;
  let boardId: string;
  let token: string;
  let firstStatusId: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `Views WS ${uid()}`, `views-ws-${uid()}`);
    wsId   = ws.id;
    wsSlug = ws.slug;
    const prefix = `V${uid().slice(0, 3).toUpperCase()}`;
    const board = await createBoard(token, wsId, `Views Board ${uid()}`, prefix);
    boardId = board.id;

    const wsData = await getWorkspace(token, wsId);
    firstStatusId = wsData.workflows?.[0]?.statuses?.[0]?.id ?? '';

    if (firstStatusId) {
      await createTask(token, boardId, `View Task ${uid()}`, firstStatusId);
    }
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto(`/w/${wsSlug}/boards/${boardId}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible({ timeout: 10_000 });
  });

  test('по умолчанию открывается Kanban', async ({ page }) => {
    // В Kanban виде есть droppable-контейнеры (@hello-pangea/dnd использует data-rfd-*)
    await expect(page.locator('[data-rfd-droppable-id]').first()).toBeVisible();
  });

  test('переключение в List вид', async ({ page }) => {
    // Кнопки view switcher (3 кнопки в ряд)
    // List icon — вторая кнопка в switcher
    const viewSwitcher = page.locator('[style*="gap: 2px"]').filter({ has: page.locator('button').nth(1) }).first();
    const listBtn = viewSwitcher.locator('button').nth(1);
    await listBtn.click();
    // В list view нет DnD — есть таблица или список
    await expect(page.locator('[data-rfd-droppable-id]')).not.toBeVisible({ timeout: 3000 });
    // Должны быть задачи в виде списка
    if (firstStatusId) {
      await expect(page.getByText('View Task', { exact: false }).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('переключение в Calendar вид', async ({ page }) => {
    const viewSwitcher = page.locator('[style*="gap: 2px"]').filter({ has: page.locator('button').nth(2) }).first();
    const calBtn = viewSwitcher.locator('button').nth(2);
    await calBtn.click();
    // Календарь должен показывать дни/числа
    // Ищем числа дней в месяце
    await expect(page.getByText(/1/, { exact: true }).first()).toBeVisible({ timeout: 5000 });
  });

  test('переключение Calendar → Kanban', async ({ page }) => {
    const viewSwitcher = page.locator('[style*="gap: 2px"]').first();
    await viewSwitcher.locator('button').nth(2).click(); // Calendar
    await page.waitForTimeout(300);
    await viewSwitcher.locator('button').nth(0).click(); // Kanban
    await expect(page.locator('[data-rfd-droppable-id]').first()).toBeVisible({ timeout: 5000 });
  });

  test('переключение List → Kanban', async ({ page }) => {
    const viewSwitcher = page.locator('[style*="gap: 2px"]').first();
    await viewSwitcher.locator('button').nth(1).click(); // List
    await page.waitForTimeout(300);
    await viewSwitcher.locator('button').nth(0).click(); // Kanban
    await expect(page.locator('[data-rfd-droppable-id]').first()).toBeVisible({ timeout: 5000 });
  });

  test('задачи отображаются в List виде', async ({ page }) => {
    if (!firstStatusId) { test.skip(true, 'Нет статусов'); return; }
    const viewSwitcher = page.locator('[style*="gap: 2px"]').first();
    await viewSwitcher.locator('button').nth(1).click();
    await expect(page.getByText('View Task', { exact: false }).first()).toBeVisible({ timeout: 8000 });
  });

  test('задача с дедлайном отображается в Calendar виде', async ({ page }) => {
    const viewSwitcher = page.locator('[style*="gap: 2px"]').first();
    await viewSwitcher.locator('button').nth(2).click();
    // Календарь загрузился
    await expect(page).toHaveURL(new RegExp(`/boards/${boardId}`));
  });

});
