import { test, expect } from '@playwright/test';
import { loginAs, ADMIN_EMAIL, USER_EMAIL, PASSWORD } from '../fixtures/auth';
import { uid } from '../helpers/data';

// These tests validate the login/registration UI — start unauthenticated.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Аутентификация', () => {

  test('успешный логин admin → редирект на /workspaces', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/workspaces/);
    // Заголовок страницы должен содержать что-то про воркспейсы
    await expect(page.getByText('Мои рабочие пространства')).toBeVisible();
  });

  test('успешный логин user → редирект на /workspaces', async ({ page }) => {
    await loginAs(page, USER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test('неверный пароль → сообщение об ошибке', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();
    // Остаёмся на логине
    await expect(page).toHaveURL(/\/login/);
    // Ant Design message или кастомное — ищем любое сообщение об ошибке
    await expect(page.locator('.ant-message-notice, [class*="message"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('несуществующий email → ошибка', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('nobody@example.com');
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('.ant-message-notice').first()).toBeVisible({ timeout: 5000 });
  });

  test('пустые поля — форма не отправляется (HTML validation)', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button[type="submit"]').click();
    // Поскольку поле email required, браузер не даст submit
    await expect(page).toHaveURL(/\/login/);
  });

  test('переключение на форму регистрации', async ({ page }) => {
    await page.goto('/login');
    // Кнопка "Зарегистрироваться" переключает форму
    await page.getByText('Зарегистрироваться').last().click();
    await expect(page.getByText('Регистрация')).toBeVisible();
    // Форма регистрации имеет два поля: Имя и Фамилия
    await expect(page.locator('input[autocomplete="given-name"]')).toBeVisible();
  });

  test('регистрация нового пользователя', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Зарегистрироваться').last().click();
    await expect(page.getByText('Регистрация')).toBeVisible();
    // Форма регистрации разделена на два поля: Имя + Фамилия
    await page.locator('input[autocomplete="given-name"]').fill('Тест');
    await page.locator('input[autocomplete="family-name"]').fill('Юзер');
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    // Backend создаёт PENDING заявку → frontend переключается обратно на логин
    await expect(page.getByText('Регистрация')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Добро пожаловать')).toBeVisible({ timeout: 3000 });
  });

  test('переключение видимости пароля (eye icon)', async ({ page }) => {
    await page.goto('/login');
    const pwdInput = page.locator('input[type="password"]');
    await pwdInput.fill('secret123');
    // Кнопка eye — SVG внутри прямого родителя поля пароля (flex container)
    // :has(> input[type="password"]) = прямой родитель пароля → последний svg = eye toggle
    const eyeBtn = page.locator(':has(> input[type="password"]) > svg').last();
    await eyeBtn.click();
    // После клика type меняется на text
    await expect(page.locator('input[type="text"]').first()).toHaveValue('secret123', { timeout: 3000 });
  });

  test('авторизованный пользователь на /login → редирект на /workspaces', async ({ page }) => {
    await loginAs(page);
    await page.goto('/login');
    await expect(page).toHaveURL(/\/workspaces/);
  });

  test('неавторизованный → редирект на /login', async ({ page }) => {
    await page.goto('/workspaces');
    await expect(page).toHaveURL(/\/login/);
  });

});
