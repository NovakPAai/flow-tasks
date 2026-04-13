import { config } from '../../config.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { FeedbackDto } from './feedback.dto.js';

interface FeedbackUser {
  name: string;
  email: string;
}

export async function submitFeedback(dto: FeedbackDto, user: FeedbackUser) {
  if (!config.GITHUB_ISSUES_TOKEN) {
    throw new AppError(503, 'Отправка обратной связи временно недоступна');
  }

  const label = dto.type === 'bug' ? 'bug' : 'enhancement';
  const bodyWithMeta = `${dto.body}\n\n---\n**Отправитель:** ${user.name} (${user.email})\n**Окружение:** ${config.NODE_ENV}`;

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
    const err = await response.text();
    console.error('[FEEDBACK] GitHub API error:', err);
    throw new AppError(502, 'Не удалось создать обращение. Попробуйте позже.');
  }

  const issue = await response.json() as { html_url: string; number: number };
  return { url: issue.html_url, number: issue.number };
}
