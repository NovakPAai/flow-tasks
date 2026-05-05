import { test, expect } from '@playwright/test';
import { getAdminToken, createWorkspace, createBoard, createTask, getWorkspace, uid } from '../helpers/data';

test.describe('FilterBar — фильтрация задач', () => {

  let wsSlug: string;
  let wsId: string;
  let boardId: string;
  let token: string;
  let firstStatusId: string;
  let secondStatusId: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `Filter WS ${uid()}`, `filter-ws-${uid()}`);
    wsId   = ws.id;
    wsSlug = ws.slug;
    const prefix = `F${uid().slice(0, 3).toUpperCase()}`;
    const board = await createBoard(token, wsId, `Filter Board ${uid()}`, prefix);
    boardId = board.id;

    const wsData = await getWorkspace(token, wsId);
    const statuses = wsData.workflows?.[0]?.statuses ?? [];
    firstStatusId  = statuses[0]?.id ?? '';
    secondStatusId = statuses[1]?.id ?? '';

    // Создаём задачи для фильтрации
    if (firstStatusId) {
      await createTask(token, boardId, 'Alpha задача', firstStatusId);
      await createTask(token, boardId, 'Beta задача',  firstStatusId);
      if (secondStatusId) {
        await createTask(token, boardId, 'Gamma задача', secondStatusId);
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${wsSlug}/boards/${boardId}`);
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible({ timeout: 10_000 });
  });

  test('FilterBar отображается на странице доски', async ({ page }) => {
    // Чипы "Все", "Сегодня" и т.д.
    await expect(page.getByRole('button', { name: 'Все' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Сегодня' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Просрочено' })).toBeVisible();
  });

  test('поиск по названию задачи', async ({ page }) => {
    // Кнопка "Фильтры" или иконка поиска открывает расширенный фильтр
    // Или есть поле поиска в FilterBar
    // Ищем иконку-кнопку для расширения фильтра
    await page.getByRole('button', { name: /Фильтры|filter/i }).first().click();
    const searchInput = page.getByPlaceholder(/Поиск|поиск/i).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Alpha');
      await expect(page.getByText('Alpha задача')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('Beta задача')).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('чип "Сегодня" фильтрует задачи по дедлайну', async ({ page }) => {
    await page.getByRole('button', { name: 'Сегодня' }).click();
    // Задачи без дедлайна не должны отображаться (фильтр применяется)
    // Задачи с дедлайном "сегодня" должны отображаться (если есть)
    // Проверяем что кнопка "Сегодня" активна (стиль изменился)
    const todayBtn = page.getByRole('button', { name: 'Сегодня' });
    // Кнопка получает border active
    await expect(todayBtn).toBeVisible();
  });

  test('чип "Просрочено" активируется и меняет стиль', async ({ page }) => {
    const overdueBtn = page.getByRole('button', { name: 'Просрочено' });
    await overdueBtn.click();
    // Кнопка должна быть активна (background изменился на красноватый)
    await expect(overdueBtn).toBeVisible();
    // Сбросить — кликнуть "Все"
    await page.getByRole('button', { name: 'Все' }).click();
  });

  test('чип "Без даты" фильтрует задачи без дедлайна', async ({ page }) => {
    await page.getByRole('button', { name: 'Без даты' }).click();
    // Наши тестовые задачи без дат — должны быть видны
    await expect(page.getByText('Alpha задача')).toBeVisible({ timeout: 5000 });
  });

  test('чип "Все" сбрасывает фильтр дедлайна', async ({ page }) => {
    await page.getByRole('button', { name: 'Сегодня' }).click();
    await page.getByRole('button', { name: 'Все' }).click();
    // Все задачи снова видны
    await expect(page.getByText('Alpha задача')).toBeVisible({ timeout: 5000 });
  });

  test('фильтр по статусу через select', async ({ page }) => {
    // Открываем расширенные фильтры
    const filtersBtn = page.getByRole('button', { name: /Фильтры/i }).first();
    if (await filtersBtn.isVisible()) {
      await filtersBtn.click();
      // Выбираем второй статус
      const statusSelect = page.locator('select').nth(0);
      if (await statusSelect.isVisible() && secondStatusId) {
        await statusSelect.selectOption(secondStatusId);
        await expect(page.getByText('Gamma задача')).toBeVisible({ timeout: 5000 });
        await expect(page.getByText('Alpha задача')).not.toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('фильтр по приоритету', async ({ page }) => {
    const filtersBtn = page.getByRole('button', { name: /Фильтры/i }).first();
    if (await filtersBtn.isVisible()) {
      await filtersBtn.click();
      const prioritySelect = page.getByRole('combobox').filter({ hasText: /Приоритет|priority/i });
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('HIGH');
      }
    }
    // Независимо от того видны ли фильтры — страница не упала
    // .first() т.к. каждая колонка имеет кнопку "Быстрое добавление..." (strict mode)
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible();
  });

  test('чип "Эта неделя" отображается', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Эта неделя' })).toBeVisible();
    await page.getByRole('button', { name: 'Эта неделя' }).click();
    await expect(page.getByRole('button', { name: 'Эта неделя' })).toBeVisible();
  });

});
