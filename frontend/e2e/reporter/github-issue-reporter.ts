/**
 * Кастомный Playwright reporter.
 * При каждом упавшем тесте создаёт GitHub Issue через `gh issue create`.
 *
 * Требования:
 *   - gh CLI установлен и авторизован (`gh auth status`)
 *   - Переменная GITHUB_REPO задана или используется дефолт NovakPAai/flow-tasks
 */

import { spawnSync } from 'child_process';
import type {
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

const REPO = process.env.GITHUB_REPO ?? 'NovakPAai/flow-tasks';

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
    const title = `[E2E] ${test.title}`;
    const body  = buildBody(test, result);

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
