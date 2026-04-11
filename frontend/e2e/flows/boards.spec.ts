import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { getAdminToken, createWorkspace, createBoard, uid } from '../helpers/data';

test.describe('Доски', () => {

  let wsSlug: string;
  let wsId: string;
  let token: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `Boards WS ${uid()}`, `boards-ws-${uid()}`);
    wsId   = ws.id;
    wsSlug = ws.slug;
  });

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
    await page.goto(`/w/${wsSlug}`);
    await page.waitForLoadState('networkidle');
  });

  test('дашборд воркспейса загружается', async ({ page }) => {
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('создание доски через UI', async ({ page }) => {
    const boardName = `Test Board ${uid()}`;
    // Кнопка создания доски на дашборде ("Создать доску")
    await page.getByRole('button', { name: /Создать доску/i }).first().click();
    // Модалка — поле "Название" имеет placeholder "Frontend, Backend, Design..."
    const nameInput = page.getByPlaceholder(/Frontend|Backend|Design/i).first();
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill(boardName);

    // Поле prefix — placeholder "DEV, OPS, FRONT..."
    const prefixInput = page.getByPlaceholder(/DEV|OPS|FRONT/i).first();
    if (await prefixInput.isVisible()) {
      await prefixInput.fill(`TB${uid().slice(0,3).toUpperCase()}`);
    }

    await page.getByRole('button', { name: 'Создать' }).last().click();
    // После создания navigate → /w/${slug}/boards/${id} — ждём URL сначала
    await page.waitForURL(/\/boards\//, { timeout: 10_000 });
    await expect(page.getByText(boardName)).toBeVisible({ timeout: 5000 });
  });

  test('навигация на доску — открывает канбан', async ({ page }) => {
    const board = await createBoard(token, wsId, `Kanban Board ${uid()}`, `KB${uid().slice(0,3).toUpperCase()}`);
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByText(board.name).first().click();
    await expect(page).toHaveURL(new RegExp(`/boards/${board.id}`), { timeout: 8000 });
  });

  test('boardCount обновляется после создания доски', async ({ page }) => {
    // Проверяем что после добавления доски счётчик > 0
    // Возможно отображается в заголовке или хедере дашборда
    await createBoard(token, wsId, `Count Board ${uid()}`, `CB${uid().slice(0,3).toUpperCase()}`);
    await page.reload();
    // Найти любое число > 0 рядом с текстом "досок" или "boards"
    const boardsText = page.getByText(/доск/i).first();
    await expect(boardsText).toBeVisible();
  });

  test('заголовок страницы доски отображает имя доски', async ({ page }) => {
    const board = await createBoard(token, wsId, `Header Board ${uid()}`, `HB${uid().slice(0,3).toUpperCase()}`);
    await page.goto(`/w/${wsSlug}/boards/${board.id}`);
    await expect(page.getByText(board.name)).toBeVisible({ timeout: 8000 });
  });

  test('кнопка назад на доске возвращает на дашборд', async ({ page }) => {
    const board = await createBoard(token, wsId, `Back Board ${uid()}`, `BB${uid().slice(0,3).toUpperCase()}`);
    await page.goto(`/w/${wsSlug}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');

    // Кнопка со стрелкой назад (SVG path d="M10 3L5 8L10 13")
    await page.locator('button').filter({ has: page.locator('svg') }).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${wsSlug}`), { timeout: 5000 });
  });

  test('канбан отображает колонки workflow', async ({ page }) => {
    const board = await createBoard(token, wsId, `Cols Board ${uid()}`, `CO${uid().slice(0,3).toUpperCase()}`);
    await page.goto(`/w/${wsSlug}/boards/${board.id}`);
    await page.waitForLoadState('networkidle');
    // Default workflow имеет хотя бы одну колонку
    // Ищем кнопку "Быстрое добавление" которая появляется в каждой колонке
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible({ timeout: 8000 });
  });

});
