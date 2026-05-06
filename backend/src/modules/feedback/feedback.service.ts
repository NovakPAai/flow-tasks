import { config } from '../../config.js';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { FeedbackDto } from './feedback.dto.js';

interface FeedbackUser {
  id: string;
  name: string;
  email: string;
}

// Escape Markdown special chars and strip newlines to prevent injection
function escapeMd(value: string | undefined | null): string {
  if (!value) return '—';
  return value.replace(/[\r\n]/g, ' ').replace(/[_*`[\]()~>#+=|{}.!\\-]/g, '\\$&');
}

async function uploadScreenshotToGitHub(file: Express.Multer.File): Promise<string | null> {
  if (!config.GITHUB_ISSUES_TOKEN) return null;

  const ext = file.mimetype.split('/')[1] ?? 'png';
  const filename = `feedback-screenshots/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const content = file.buffer.toString('base64');

  const res = await fetch(
    `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/contents/${filename}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${config.GITHUB_ISSUES_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ message: 'chore: feedback screenshot', content }),
    },
  );

  if (!res.ok) {
    console.error('[FEEDBACK] screenshot upload failed: status=%d', res.status);
    return null;
  }

  const data = await res.json() as { content: { download_url: string } };
  return data.content.download_url;
}

export async function submitFeedback(dto: FeedbackDto, user: FeedbackUser, screenshot?: Express.Multer.File) {
  if (!config.GITHUB_ISSUES_TOKEN) {
    throw new AppError(503, 'Отправка обратной связи временно недоступна');
  }

  const label = dto.type === 'bug' ? 'bug' : 'enhancement';
  const deviceSection = dto.meta
    ? [
        `**Устройство:** ${escapeMd(dto.meta.deviceType)} | **ОС:** ${escapeMd(dto.meta.os)} | **Браузер:** ${escapeMd(dto.meta.browser)}`,
        `**Экран:** ${escapeMd(dto.meta.screen)} / вьюпорт: ${escapeMd(dto.meta.viewport)}`,
        `**Язык:** ${escapeMd(dto.meta.language)}`,
        `**URL:** ${escapeMd(dto.meta.url)}`,
        `**UA:** \`${escapeMd(dto.meta.ua)}\``,
      ].join('\n')
    : '*нет данных об устройстве*';

  const screenshotUrl = screenshot ? await uploadScreenshotToGitHub(screenshot) : null;
  const screenshotSection = screenshotUrl ? `\n\n### Скриншот\n![Скриншот](${screenshotUrl})` : '';

  const bodyWithMeta = `${escapeMd(dto.body)}\n\n---\n**Отправитель:** ${escapeMd(user.name)} (${escapeMd(user.email)})\n**Окружение:** ${escapeMd(config.NODE_ENV)}\n\n### Устройство\n${deviceSection}${screenshotSection}`;

  const response = await fetch(
    `https://api.github.com/repos/${config.GITHUB_REPO_OWNER}/${config.GITHUB_REPO_NAME}/issues`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.GITHUB_ISSUES_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title: dto.title, body: bodyWithMeta, labels: [label] }),
    },
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error('[FEEDBACK] GitHub API error: status=%d body=%s', response.status, errText.slice(0, 200));
    throw new AppError(502, 'Не удалось создать обращение. Попробуйте позже.');
  }

  const issue = await response.json() as { html_url: string; number: number };

  await prisma.feedback.create({
    data: { userId: user.id, type: dto.type, title: dto.title, body: dto.body, githubUrl: issue.html_url, githubNum: issue.number },
  });

  return { url: issue.html_url, number: issue.number };
}
