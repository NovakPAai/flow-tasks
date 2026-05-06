import { test, expect } from '../fixtures/auth-test';
import { getAdminToken, createWorkspace, createBoard, uid } from '../helpers/data';

test.describe('Создание задач (Kanban)', () => {

  let wsSlug: string;
  let wsId: string;
  let boardId: string;
  let boardPrefix: string;
  let token: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `Tasks WS ${uid()}`, `tasks-ws-${uid()}`);
    wsId   = ws.id;
    wsSlug = ws.slug;
    const prefix = `T${uid().slice(0, 3).toUpperCase()}`;
    const board = await createBoard(token, wsId, `Tasks Board ${uid()}`, prefix);
    boardId = board.id;
    boardPrefix = board.prefix.toLowerCase();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${wsSlug}/boards/${boardPrefix}`);
    // Дождёмся появления хотя бы одной колонки
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible({ timeout: 10_000 });
  });

  test('быстрое добавление задачи через кнопку "+" в колонке', async ({ page }) => {
    const title = `Задача inline ${uid()}`;
    // Кнопка + в хедере первой колонки
    await page.locator('button[title="Добавить задачу"]').first().click();
    const input = page.getByPlaceholder('Название задачи...');
    await expect(input).toBeVisible();
    await input.fill(title);
    await input.press('Enter');
    // Задача должна появиться как карточка
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test('быстрое добавление через кнопку "Быстрое добавление..." внизу колонки', async ({ page }) => {
    const title = `Задача bottom ${uid()}`;
    await page.getByText('Быстрое добавление...').first().click();
    const input = page.getByPlaceholder('Название задачи...');
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test('Escape в поле добавления отменяет создание', async ({ page }) => {
    await page.locator('button[title="Добавить задачу"]').first().click();
    const input = page.getByPlaceholder('Название задачи...');
    await input.fill('Отменённая задача');
    await input.press('Escape');
    await expect(input).not.toBeVisible();
    await expect(page.getByText('Отменённая задача')).not.toBeVisible();
  });

  test('создание задачи через кнопку "Создать" в хедере доски', async ({ page }) => {
    const title = `Header Task ${uid()}`;
    await page.locator('[data-onboarding="create-task"]').click();
    const input = page.getByPlaceholder('Название задачи...');
    await expect(input).toBeVisible();
    await input.fill(title);
    await input.press('Enter');
    await expect(page.getByText(title)).toBeVisible({ timeout: 8000 });
  });

  test('пустое название задачи не создаётся', async ({ page }) => {
    const countBefore = await page.locator('[class*="task"], [class*="card"]').count();
    await page.locator('button[title="Добавить задачу"]').first().click();
    const input = page.getByPlaceholder('Название задачи...');
    await input.press('Enter');
    // Если blur с пустым — ничего не создаётся
    await expect(input).not.toBeVisible({ timeout: 3000 });
    const countAfter = await page.locator('[class*="task"], [class*="card"]').count();
    expect(countAfter).toBe(countBefore);
  });

  test('счётчик задач в хедере доски увеличивается', async ({ page }) => {
    // Найти текущий счётчик (X задач)
    const counterText = await page.getByText(/ задач/).textContent();
    const before = parseInt(counterText?.match(/\d+/)?.[0] ?? '0', 10);

    await page.locator('[data-onboarding="create-task"]').click();
    const input = page.getByPlaceholder('Название задачи...');
    await input.fill(`Counter Task ${uid()}`);
    await input.press('Enter');

    await expect(page.getByText(`${before + 1} задач`)).toBeVisible({ timeout: 8000 });
  });

  test('задача отображает issueKey (DEV-1, TSK-1 и т.д.)', async ({ page }) => {
    await page.locator('[data-onboarding="create-task"]').click();
    const input = page.getByPlaceholder('Название задачи...');
    await input.fill(`Key Task ${uid()}`);
    await input.press('Enter');
    // Ищем issueKey вида PREFIX-N; prefix может содержать цифры (base36 uid → toUpperCase)
    // Поэтому [A-Z0-9]+ вместо [A-Z]+
    await expect(page.locator('text=/[A-Z][A-Z0-9]*-\\d+/').first()).toBeVisible({ timeout: 8000 });
  });

  test('клик по карточке открывает TaskDrawer', async ({ page }) => {
    // Создаём задачу и кликаем по ней
    await page.locator('[data-onboarding="create-task"]').click();
    const taskTitle = `Drawer Task ${uid()}`;
    await page.getByPlaceholder('Название задачи...').fill(taskTitle);
    await page.getByPlaceholder('Название задачи...').press('Enter');
    await expect(page.getByText(taskTitle)).toBeVisible({ timeout: 8000 });

    // dispatchEvent на TaskCard inner div — не имеем task.id, фильтруем DnD wrapper по тексту
    await page.locator('[data-rfd-draggable-id]').filter({ hasText: taskTitle }).locator('> div').first().dispatchEvent('click');
    // Drawer открывается — ищем заголовок "Детали"
    await expect(page.getByText('Детали')).toBeVisible({ timeout: 5000 });
  });

});
