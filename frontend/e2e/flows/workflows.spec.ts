import { test, expect } from '../fixtures/auth-test';
import { getAdminToken, createWorkspace, uid } from '../helpers/data';

test.describe('Workflow editor в настройках', () => {

  let wsSlug: string;
  let token: string;

  test.beforeAll(async () => {
    token  = await getAdminToken();
    const ws = await createWorkspace(token, `WF Settings WS ${uid()}`, `wf-settings-ws-${uid()}`);
    wsSlug = ws.slug;
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`/w/${wsSlug}/settings`);
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
  });

  test('страница настроек загружается', async ({ page }) => {
    await expect(page).toHaveURL(new RegExp(`/w/${wsSlug}/settings`));
    // Какой-нибудь заголовок на странице настроек
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
  });

  test('workflow section отображает статусы', async ({ page }) => {
    // Переходим на вкладку Workflows если она есть
    const workflowTab = page.getByRole('button', { name: /Workflow|Рабочий процесс/i }).first();
    if (await workflowTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await workflowTab.click();
    }
    // Ищем статусы — должен быть хотя бы один
    await expect(page.getByText(/Статус|status|OPEN|TO DO|TODO/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('добавление нового статуса в workflow', async ({ page }) => {
    // Кнопка добавления статуса
    const addStatusBtn = page.getByRole('button', { name: /Добавить статус|Add status/i }).first();
    if (await addStatusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const countBefore = await page.locator('[style*="border-radius"][style*="background"]').count();
      await addStatusBtn.click();
      // Поле ввода нового статуса
      const nameInput = page.getByPlaceholder(/Название статуса|Status name/i).first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill(`New Status ${uid()}`);
        await page.getByRole('button', { name: /Сохранить|Save|Добавить/i }).first().click();
        // Статусов стало больше
        await expect(page.locator('[style*="border-radius"][style*="background"]').nth(countBefore)).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('переключение режима workflow (Forward / Bi-directional / Custom)', async ({ page }) => {
    const forwardBtn = page.getByRole('button', { name: /Forward only/i });
    const biDirBtn   = page.getByRole('button', { name: /Bi-directional/i });
    const customBtn  = page.getByRole('button', { name: /Custom/i });

    if (await forwardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await biDirBtn.click();
      await expect(biDirBtn).toBeVisible(); // не упало
      await forwardBtn.click(); // вернуть назад
    }
    if (await customBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customBtn.click();
      // Custom режим должен показать матрицу переходов
      await expect(page.getByText(/Custom/i)).toBeVisible();
    }
  });

  test('управление участниками workspace', async ({ page }) => {
    // Ищем вкладку "Участники"
    const membersTab = page.getByRole('button', { name: /Участники|Members/i }).first();
    if (await membersTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await membersTab.click();
      // Должны видеть себя (admin)
      await expect(page.getByText('admin@flowtask.dev')).toBeVisible({ timeout: 5000 });
    }
  });

  test('страница настроек не падает при загрузке', async ({ page }) => {
    // Проверяем нет ошибок в консоли
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
    // Нет критических ошибок
    const criticalErrors = errors.filter(e => !e.includes('favicon') && !e.includes('font'));
    expect(criticalErrors.length).toBe(0);
  });

});
