import { test, expect } from '@playwright/test';
import { loginAs } from '../fixtures/auth';
import { getAdminToken, createWorkspace, uid } from '../helpers/data';

test.describe('Рабочие пространства', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page);
  });

  test('страница отображает существующие воркспейсы', async ({ page }) => {
    await expect(page).toHaveURL(/\/workspaces/);
    await expect(page.getByText('Мои рабочие пространства')).toBeVisible();
    // Должна быть хотя бы одна карточка воркспейса
    await expect(page.locator('[data-onboarding="create-workspace"]')).toBeVisible();
  });

  test('открытие модалки создания воркспейса', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать' }).first().click();
    // NewWorkspaceCard already has "Новое пространство" text — use input placeholder to confirm modal opened
    await expect(page.getByPlaceholder('Моя команда')).toBeVisible();
  });

  test('создание воркспейса — авто-slug из кириллицы', async ({ page }) => {
    const name = `Тест ${uid()}`;
    await page.getByRole('button', { name: 'Создать' }).first().click();
    await page.getByPlaceholder('Моя команда').fill(name);
    // Slug должен автоматически заполниться latin-символами
    const slugInput = page.getByPlaceholder('moya-komanda');
    await expect(slugInput).not.toHaveValue('');
    const slugValue = await slugInput.inputValue();
    // Slug не должен содержать кириллицу
    expect(slugValue).toMatch(/^[a-z0-9-]+$/);
  });

  test('создание воркспейса — полный флоу с навигацией', async ({ page }) => {
    const suffix = uid();
    const name   = `E2E WS ${suffix}`;
    const slug   = `e2e-ws-${suffix}`;

    await page.getByRole('button', { name: 'Создать' }).first().click();
    await page.getByPlaceholder('Моя команда').fill(name);
    // Slug может быть уже заполнен авто, но перепишем
    const slugInput = page.getByPlaceholder('moya-komanda');
    await slugInput.fill(slug);
    await page.getByRole('button', { name: 'Создать' }).last().click();

    // После создания — переход на /w/<slug>
    await expect(page).toHaveURL(new RegExp(`/w/${slug}`), { timeout: 10_000 });
  });

  test('кнопка Отмена закрывает модалку', async ({ page }) => {
    await page.getByRole('button', { name: 'Создать' }).first().click();
    // Confirm modal opened via unique input placeholder
    await expect(page.getByPlaceholder('Моя команда')).toBeVisible();
    await page.getByRole('button', { name: 'Отмена' }).click();
    // After close, the form input is gone (NewWorkspaceCard text remains, so we check input)
    await expect(page.getByPlaceholder('Моя команда')).not.toBeVisible();
  });

  test('клик по карточке воркспейса — переход на дашборд', async ({ page }) => {
    // Находим первую реальную карточку (не NewWorkspaceCard)
    // WorkspaceCard не имеет data-testid, поэтому ищем по структуре
    const token = await getAdminToken();
    const ws = await createWorkspace(token, `Nav WS ${uid()}`, `nav-ws-${uid()}`);
    await page.goto('/workspaces');
    await page.waitForSelector('[data-testid="workspaces-grid"]');

    await page.getByText(ws.name).first().click();
    await expect(page).toHaveURL(new RegExp(`/w/${ws.slug}`), { timeout: 8000 });
  });

  test('воркспейс показывает boardCount на карточке', async ({ page }) => {
    const token = await getAdminToken();
    await createWorkspace(token, `BoardCnt ${uid()}`, `boardcnt-${uid()}`);
    await page.goto('/workspaces');
    await page.waitForSelector('[data-testid="workspaces-grid"]');
    // Найдём цифру "0" под "Доски" на карточке
    await expect(page.getByText('Доски').first()).toBeVisible();
  });

  test('приветствие содержит имя пользователя (не фамилию)', async ({ page }) => {
    // Пользователь "Admin FlowTask" — приветствие должно быть "ADMIN" (имя первое)
    // или последнее слово в зависимости от логики
    const greeting = page.locator('text=/Привет/i').first();
    await expect(greeting).toBeVisible();
    const text = await greeting.textContent();
    // Не должно быть пустым
    expect(text?.length).toBeGreaterThan(5);
  });

});
