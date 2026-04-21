/**
 * Кастомный Playwright reporter.
 * При каждом упавшем тесте создаёт GitHub Issue через `gh issue create`.
 *
 * Требования:
 *   - gh CLI установлен и авторизован (`gh auth status`)
 *   - Переменная GITHUB_REPO задана или используется дефолт NovakPAai/flow-tasks
 *
 * Управление:
 *   - Репортер активен ТОЛЬКО если E2E_AUTO_FILE=1
 *   - Дедупликация: если issue с таким заголовком уже открыт — добавляет комментарий вместо нового issue
 */

import { spawnSync } from 'child_process';
import type {
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

const REPO = process.env.GITHUB_REPO ?? 'NovakPAai/flow-tasks';
// Репортер постит issues только если явно включён
const AUTO_FILE_ENABLED = process.env.E2E_AUTO_FILE === '1';

function buildBody(test: TestCase, result: TestResult): string {
  const location = `${test.location.file}:${test.location.line}`;
  const errorMsg = result.errors.map(e => e.message ?? String(e)).join('\n\n') || 'No error message';

  const screenshotAttach = result.attachments.find(a => a.name === 'screenshot');
  const screenshotLine = screenshotAttach
    ? `\n**Screenshot:** ${screenshotAttach.path ?? '(see CI artifacts)'}`
    : '';

  return [
    `## Упавший тест`,
    ``,
    `**Тест:** \`${test.title}\``,
    `**Файл:** \`${location}\``,
    `**Результат:** ${result.status}`,
    `**Длительность:** ${result.duration}ms`,
    screenshotLine,
    ``,
    `## Ошибка`,
    ``,
    `\`\`\``,
    errorMsg.slice(0, 3000), // GitHub issue body limit
    `\`\`\``,
    ``,
    `## Путь воспроизведения`,
    ``,
    `Запустить конкретный тест:`,
    `\`\`\`bash`,
    `cd frontend && npx playwright test --grep "${test.title.replace(/"/g, '\\"')}"`,
    `\`\`\``,
    ``,
    `---`,
    `*Создано автоматически Playwright E2E suite*`,
  ].join('\n');
}

class GitHubIssueReporter implements Reporter {
  private failCount = 0;

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    this.failCount += 1;

    if (!AUTO_FILE_ENABLED) {
      console.log(`[github-issue-reporter] Skipping issue creation (E2E_AUTO_FILE not set) for: "${test.title}"`);
      return;
    }

    const title = `[E2E] ${test.title}`;
    const body  = buildBody(test, result);

    // Дедупликация: ищем открытый issue с таким же заголовком
    const searchResult = spawnSync(
      'gh',
      ['issue', 'list', '--repo', REPO, '--state', 'open', '--search', title, '--json', 'number,title', '--limit', '5'],
      { encoding: 'utf8' },
    );

    let existingNumber: number | null = null;
    if (searchResult.status === 0 && searchResult.stdout) {
      try {
        const issues = JSON.parse(searchResult.stdout) as Array<{ number: number; title: string }>;
        const match = issues.find(i => i.title === title);
        if (match) existingNumber = match.number;
      } catch { /* ignore parse errors */ }
    }

    if (existingNumber !== null) {
      // Добавляем комментарий к существующему issue
      spawnSync(
        'gh',
        ['issue', 'comment', String(existingNumber), '--repo', REPO, '--body', `Повторное падение:\n\n${body}`],
        { encoding: 'utf8' },
      );
      console.log(`[github-issue-reporter] Added comment to existing issue #${existingNumber} for: "${test.title}"`);
      return;
    }

    const { status, stderr } = spawnSync(
      'gh',
      [
        'issue', 'create',
        '--repo',   REPO,
        '--title',  title,
        '--body',   body,
        '--label',  'bug',
      ],
      { encoding: 'utf8' },
    );

    if (status !== 0) {
      // Не ломаем прогон если gh не доступен — просто логируем
      console.error(`[github-issue-reporter] Failed to create issue for "${test.title}": ${stderr}`);
    } else {
      console.log(`[github-issue-reporter] Issue created for: "${test.title}"`);
    }
  }

  onEnd(): void {
    if (this.failCount > 0) {
      console.log(`\n[github-issue-reporter] Created ${this.failCount} GitHub issue(s) for failed tests.`);
    }
  }
}

export default GitHubIssueReporter;
