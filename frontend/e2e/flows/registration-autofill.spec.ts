/**
 * Feature: Registration form — auto-fill email from first/last name
 *
 * The registration form does NOT show a manual email prefix field.
 * Instead it derives the email from «Имя» + «Фамилия» via transliteration
 * and displays it as a read-only preview: <prefix>@<registrationDomain>.
 *
 * The submit button is:
 *  - disabled when either name field is empty (or password is blank)
 *  - enabled once both name fields and password are filled
 */

import { test, expect } from '@playwright/test';

// Registration tests navigate to /login unauthenticated — start with empty state.
test.use({ storageState: { cookies: [], origins: [] } });

// ── helpers ──────────────────────────────────────────────────────────────────

/** Click the link that switches to registration mode. */
async function openRegistrationForm(page: import('@playwright/test').Page) {
  await page.goto('/login');
  // The toggle link appears at the bottom of the login form
  await page.getByText('Зарегистрироваться').last().click();
  // Wait for the heading to confirm the mode switch
  await expect(page.getByText('Регистрация')).toBeVisible({ timeout: 5_000 });
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Форма регистрации — авто-заполнение email', () => {

  test('форма регистрации показывает поля Имя и Фамилия (без ручного email-префикса)', async ({ page }) => {
    await openRegistrationForm(page);

    // «Имя» and «Фамилия» label text must be present
    await expect(page.getByText('Имя')).toBeVisible();
    await expect(page.getByText('Фамилия')).toBeVisible();

    // Inputs are identified by their autocomplete attributes (set in LoginPage.tsx)
    await expect(page.locator('input[autocomplete="given-name"]')).toBeVisible();
    await expect(page.locator('input[autocomplete="family-name"]')).toBeVisible();

    // There must be NO manual email-prefix input in registration mode.
    // The email field (autocomplete="email") is only shown when registrationDomain
    // is absent, which never happens in the seeded environment.
    // We verify the label "Email (заполняется автоматически)" is present instead.
    await expect(page.getByText('Email (заполняется автоматически)')).toBeVisible();
    // And no editable email input (autocomplete="email") is visible
    await expect(page.locator('input[autocomplete="email"]')).not.toBeVisible();
  });

  test('Иван + Петров → ivan.petrov@flowtask.dev', async ({ page }) => {
    await openRegistrationForm(page);

    const firstInput = page.locator('input[autocomplete="given-name"]');
    const lastInput  = page.locator('input[autocomplete="family-name"]');

    await firstInput.fill('Иван');
    await lastInput.fill('Петров');

    // The email preview span is inside the read-only email display block
    const emailPreview = page.locator('span').filter({ hasText: 'ivan.petrov@flowtask.dev' });
    await expect(emailPreview).toBeVisible({ timeout: 3_000 });
  });

  test('Maria + Smith → maria.smith@flowtask.dev', async ({ page }) => {
    await openRegistrationForm(page);

    await page.locator('input[autocomplete="given-name"]').fill('Maria');
    await page.locator('input[autocomplete="family-name"]').fill('Smith');

    const emailPreview = page.locator('span').filter({ hasText: 'maria.smith@flowtask.dev' });
    await expect(emailPreview).toBeVisible({ timeout: 3_000 });
  });

  test('кириллица → корректная транслитерация в email', async ({ page }) => {
    await openRegistrationForm(page);

    await page.locator('input[autocomplete="given-name"]').fill('Александр');
    await page.locator('input[autocomplete="family-name"]').fill('Козлов');

    // transliterate('Александр') = 'aleksandr', transliterate('Козлов') = 'kozlov'
    const emailPreview = page.locator('span').filter({ hasText: 'aleksandr.kozlov@flowtask.dev' });
    await expect(emailPreview).toBeVisible({ timeout: 3_000 });
  });

  test('кнопка Submit отключена когда поля Имя/Фамилия пустые', async ({ page }) => {
    await openRegistrationForm(page);

    // All fields are blank → button must be disabled
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('кнопка Submit отключена когда только Имя заполнено (Фамилия пустая)', async ({ page }) => {
    await openRegistrationForm(page);

    await page.locator('input[autocomplete="given-name"]').fill('Иван');
    // password filled, but lastName empty
    await page.locator('input[autocomplete="current-password"], input[type="password"]').last().fill('Password1');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('кнопка Submit отключена когда только Фамилия заполнена (Имя пустое)', async ({ page }) => {
    await openRegistrationForm(page);

    await page.locator('input[autocomplete="family-name"]').fill('Петров');
    await page.locator('input[autocomplete="current-password"], input[type="password"]').last().fill('Password1');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('кнопка Submit включается когда Имя + Фамилия + пароль заполнены', async ({ page }) => {
    await openRegistrationForm(page);

    await page.locator('input[autocomplete="given-name"]').fill('Иван');
    await page.locator('input[autocomplete="family-name"]').fill('Петров');
    // The password input has autocomplete="new-password" in registration mode
    await page.locator('input[autocomplete="new-password"]').fill('Password1');

    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled({ timeout: 3_000 });
  });

  test('изменение имён обновляет email-превью в реальном времени', async ({ page }) => {
    await openRegistrationForm(page);

    const firstInput = page.locator('input[autocomplete="given-name"]');
    const lastInput  = page.locator('input[autocomplete="family-name"]');

    // First combination
    await firstInput.fill('Иван');
    await lastInput.fill('Петров');
    await expect(page.locator('span').filter({ hasText: 'ivan.petrov@flowtask.dev' })).toBeVisible({ timeout: 3_000 });

    // Clear and type second combination
    await firstInput.clear();
    await lastInput.clear();
    await firstInput.fill('Maria');
    await lastInput.fill('Smith');
    await expect(page.locator('span').filter({ hasText: 'maria.smith@flowtask.dev' })).toBeVisible({ timeout: 3_000 });
  });

  test('переключение обратно на форму входа скрывает поля регистрации', async ({ page }) => {
    await openRegistrationForm(page);

    // Switch back
    await page.getByText('Войти').last().click();

    await expect(page.getByText('Добро пожаловать')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('input[autocomplete="given-name"]')).not.toBeVisible();
    await expect(page.locator('input[autocomplete="family-name"]')).not.toBeVisible();
  });

});
