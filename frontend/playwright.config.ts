import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,   // честно: тесты конкурируют за одну БД (внутри файла — серийно)
  retries: 2,             // 2 ретрая для отсева flaky
  workers: process.env.CI ? 2 : 3,  // разные spec-файлы запускаются параллельно
  timeout: 30_000,
  globalSetup: './e2e/global-setup.ts',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    // Auto-filer активен только при E2E_AUTO_FILE=1 (CI) — см. reporter
    ['./e2e/reporter/github-issue-reporter.ts'],
  ],
  use: {
    baseURL: 'http://localhost:5174',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    // Авторизация admin сохраняется global-setup'ом один раз и переиспользуется
    // всеми тестами без UI-логина. Тесты, проверяющие сам флоу аутентификации,
    // сбрасывают это через test.use({ storageState: { cookies: [], origins: [] } }).
    storageState: 'e2e/.auth/admin.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Запускает dev-сервер автоматически если он ещё не запущен
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
