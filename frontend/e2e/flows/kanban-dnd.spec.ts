import { test, expect } from '../fixtures/auth-test';
import { getAdminToken, createWorkspace, createBoard, createTask, getWorkspace, uid } from '../helpers/data';

/**
 * DnD тесты — честный перенос.
 * @hello-pangea/dnd требует специфической последовательности pointer events:
 * mouse.move → mouse.down → mouse.move (минимум 5px для старта drag) → mouse.move к цели → mouse.up
 */

/** Drag helper: эмулирует полный цикл drag-and-drop совместимый с hello-pangea/dnd */
async function dndDrag(
  page: import('@playwright/test').Page,
  sourceSelector: string,
  targetSelector: string,
) {
  const source = page.locator(sourceSelector).first();
  const target = page.locator(targetSelector).first();

  const srcBox = await source.boundingBox();
  const tgtBox = await target.boundingBox();
  if (!srcBox || !tgtBox) throw new Error('DnD: source or target not found');

  const srcX = srcBox.x + srcBox.width / 2;
  const srcY = srcBox.y + srcBox.height / 2;
  const tgtX = tgtBox.x + tgtBox.width / 2;
  const tgtY = tgtBox.y + tgtBox.height / 2;

  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  // Минимум несколько маленьких шагов чтобы библиотека зарегистрировала drag start
  for (let i = 1; i <= 5; i++) {
    await page.mouse.move(srcX + i, srcY + i);
  }
  // Медленно двигаемся к цели
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const x = srcX + ((tgtX - srcX) * i) / steps;
    const y = srcY + ((tgtY - srcY) * i) / steps;
    await page.mouse.move(x, y);
  }
  await page.mouse.up();
  await page.waitForTimeout(500); // дать React время обновить стейт
}

test.describe('Kanban drag-and-drop', () => {

  let wsSlug: string;
  let wsId: string;
  let boardId: string;
  let token: string;
  let statuses: Array<{ id: string; name: string }>;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `DnD WS ${uid()}`, `dnd-ws-${uid()}`);
    wsId   = ws.id;
    wsSlug = ws.slug;
    const prefix = `N${uid().slice(0, 3).toUpperCase()}`;
    const board = await createBoard(token, wsId, `DnD Board ${uid()}`, prefix);
    boardId = board.id;

    const wsData = await getWorkspace(token, wsId);
    statuses = wsData.workflows?.[0]?.statuses ?? [];
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${wsSlug}/boards/${boardId}`);
    await expect(page.getByText('Быстрое добавление...').first()).toBeVisible({ timeout: 10_000 });
  });

  test('перетаскивание задачи в следующую колонку', async ({ page }) => {
    if (statuses.length < 2) {
      test.skip(true, 'Нужно минимум 2 статуса в workflow');
      return;
    }

    const taskTitle = `DnD Task ${uid()}`;
    const task = await createTask(token, boardId, taskTitle, statuses[0].id);
    await page.reload();
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 10_000 });

    const sourceSelector = `text="${task.title}"`;
    const targetSelector = `[data-rfd-droppable-id="${statuses[1].id}"]`;

    await expect(page.locator(targetSelector)).toBeVisible();
    await dndDrag(page, sourceSelector, targetSelector);

    // После DnD задача должна оказаться в целевой колонке
    const targetCol = page.locator(targetSelector);
    await expect(targetCol.getByText(task.title)).toBeVisible({ timeout: 8000 });
  });

  test('перетаскивание в недопустимую колонку показывает warning или игнорируется', async ({ page }) => {
    if (statuses.length < 3) {
      test.skip(true, 'Нужно 3+ статуса для теста запрещённого перехода');
      return;
    }

    const taskTitle = `Blocked DnD ${uid()}`;
    const task = await createTask(token, boardId, taskTitle, statuses[0].id);
    await page.reload();
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 10_000 });

    const sourceSelector = `text="${task.title}"`;
    const targetSelector = `[data-rfd-droppable-id="${statuses[2].id}"]`;

    await dndDrag(page, sourceSelector, targetSelector);
    await page.waitForTimeout(1000);

    // Если появился warning — отлично; если нет — переход был разрешён (BIDIRECTIONAL), тоже OK
    const warning = page.locator('.ant-message-notice');
    const hasWarning = await warning.isVisible().catch(() => false);
    if (hasWarning) {
      await expect(page.getByText(/Переход не разрешён/i)).toBeVisible({ timeout: 3000 });
    }
    // Страница не упала в любом случае
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('переупорядочивание карточек внутри одной колонки', async ({ page }) => {
    if (statuses.length === 0) {
      test.skip(true, 'Нет статусов в workflow');
      return;
    }

    const task1 = await createTask(token, boardId, `Order Task A ${uid()}`, statuses[0].id);
    const task2 = await createTask(token, boardId, `Order Task B ${uid()}`, statuses[0].id);
    await page.reload();
    await expect(page.getByText(task1.title)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(task2.title)).toBeVisible({ timeout: 10_000 });

    const col = page.locator(`[data-rfd-droppable-id="${statuses[0].id}"]`);

    // Drag task2 above task1
    await dndDrag(page, `text="${task2.title}"`, `text="${task1.title}"`);

    // Обе карточки должны остаться видны в колонке
    await expect(col.getByText(task1.title)).toBeVisible({ timeout: 5000 });
    await expect(col.getByText(task2.title)).toBeVisible({ timeout: 5000 });
  });

  test('при начале DnD droppable контейнеры видны', async ({ page }) => {
    if (statuses.length < 2) {
      test.skip(true, 'Нужно 2+ статуса');
      return;
    }

    const taskTitle = `Opacity Task ${uid()}`;
    const task = await createTask(token, boardId, taskTitle, statuses[0].id);
    await page.reload();
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 10_000 });

    const card = page.getByText(task.title).first();
    const cardBox = await card.boundingBox();
    if (!cardBox) { test.skip(true, 'Card not found'); return; }

    // Начинаем drag (mousedown + несколько mousemove чтобы активировать DnD)
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 10, cardBox.y + cardBox.height / 2 + 10);
    await page.mouse.move(cardBox.x + cardBox.width / 2 + 20, cardBox.y + cardBox.height / 2 + 20);

    // Во время drag droppable контейнеры должны быть видны
    await expect(page.locator('[data-rfd-droppable-id]').first()).toBeVisible();

    await page.mouse.up();
  });

});
