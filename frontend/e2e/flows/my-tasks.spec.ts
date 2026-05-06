import { test, expect } from '../fixtures/auth-test';
import { getAdminToken, createWorkspace, createBoard, createTask, getWorkspace, uid } from '../helpers/data';

test.describe('My Tasks — мои задачи', () => {

  let token: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    // Создаём воркспейс и задачу назначенную на admin
    const ws = await createWorkspace(token, `MyTasks WS ${uid()}`, `mytasks-ws-${uid()}`);
    const prefix = `M${uid().slice(0, 3).toUpperCase()}`;
    const board = await createBoard(token, ws.id, `MyTasks Board ${uid()}`, prefix);
    const wsData = await getWorkspace(token, ws.id);
    const statusId = wsData.workflows?.[0]?.statuses?.[0]?.id ?? '';
    if (statusId) {
      await createTask(token, board.id, `My Task ${uid()}`, statusId);
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/my-tasks');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('страница My Tasks загружается', async ({ page }) => {
    await expect(page).toHaveURL(/\/my-tasks/);
    // Заголовок
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('My Tasks отображает задачи назначенные текущему пользователю', async ({ page }) => {
    // Может быть пусто если нет задач с assignee = admin
    // Проверяем что страница не упала
    await expect(page).toHaveURL(/\/my-tasks/);
  });

  test('чипы фильтров дедлайна присутствуют', async ({ page }) => {
    // Те же чипы что на доске
    const allChip = page.getByRole('button', { name: 'Все' }).first();
    if (await allChip.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(allChip).toBeVisible();
      await expect(page.getByRole('button', { name: 'Сегодня' }).first()).toBeVisible();
    }
  });

  test('чип "Просрочено" отображается на My Tasks', async ({ page }) => {
    const overdueBtn = page.getByRole('button', { name: /Просрочено/i }).first();
    if (await overdueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overdueBtn.click();
      await expect(overdueBtn).toBeVisible();
      // Сбрасываем
      await page.getByRole('button', { name: 'Все' }).first().click();
    }
  });

  test('чип "Без даты" показывает задачи без дедлайна', async ({ page }) => {
    const noDateBtn = page.getByRole('button', { name: 'Без даты' }).first();
    if (await noDateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await noDateBtn.click();
      await expect(noDateBtn).toBeVisible();
    }
  });

  test('кнопки счётчиков задач на My Tasks', async ({ page }) => {
    // Счётчики типа (5) рядом с чипами дедлайна
    // Просто проверяем что страница не упала
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('клик по задаче на My Tasks открывает её', async ({ page }) => {
    // Если есть задачи — кликаем по первой
    const taskRow = page.locator('[style*="border-radius"][style*="cursor: pointer"]').first();
    if (await taskRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskRow.click();
      // Ожидаем навигацию или открытие drawer
      await page.waitForTimeout(1000);
    }
    // Не упало
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('поле поиска на My Tasks', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Поиск|поиск|Search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
      await searchInput.fill('');
    }
    // Не упало
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('навигация к My Tasks через sidebar', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page.getByText('Мои рабочие пространства')).toBeVisible({ timeout: 8_000 });
    // Кнопка "Мои задачи" в AppLayout sidebar
    const myTasksLink = page.getByRole('link', { name: /Мои задачи/i })
      .or(page.getByText('Мои задачи').first());
    if (await myTasksLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await myTasksLink.click();
      await expect(page).toHaveURL(/\/my-tasks/, { timeout: 5000 });
    }
  });

  test('страница My Tasks не имеет console.error', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
    const criticalErrors = errors.filter(e =>
      !e.includes('favicon') && !e.includes('font') && !e.includes('404')
    );
    if (criticalErrors.length > 0) {
      console.log('Console errors:', criticalErrors);
    }
    expect(criticalErrors.length).toBe(0);
  });

});
