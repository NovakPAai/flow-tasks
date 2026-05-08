import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { TaskHistory, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

type C = Record<string, string>;
const DARK: C = {
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', dim: 'var(--neutral-8)',
  line: 'var(--static-border-neutral-tertiary)', removed: 'var(--error-8)', added: 'var(--success-7)',
};
const LIGHT: C = {
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', dim: 'var(--static-text-neutral-tertiary)',
  line: 'var(--static-border-neutral-tertiary)', removed: 'var(--error-10)', added: 'var(--success-8)',
};

const AVATAR_PALETTE = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }

const FIELD_LABELS: Record<string, string> = {
  title:       'заголовок',
  description: 'описание',
  priority:    'приоритет',
  statusId:    'статус',
  assigneeId:  'исполнитель',
  dueDate:     'срок',
  startDate:   'дата начала',
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};

// Russian verb form heuristic: names ending in а/я are typically feminine.
// Checks the last word (usually given name in "Фамилия Имя" format).
function verbForm(name: string): string {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[parts.length - 1] ?? name;
  return /[аяАЯ]$/u.test(firstName) ? 'изменила' : 'изменил';
}

function formatValue(field: string, value: string | null, statuses: WorkflowStatus[]): string {
  if (value === null || value === '') return '—';
  if (field === 'statusId') return statuses.find(s => s.id === value)?.name ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value] ?? value;
  if (field === 'dueDate' || field === 'startDate') {
    try {
      return new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return value; }
  }
  return value.length > 80 ? value.slice(0, 80) + '…' : value;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface Props { taskId: string; statuses: WorkflowStatus[]; }

export default function TaskHistoryTimeline({ taskId, statuses }: Props) {
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'dark' ? DARK : LIGHT;

  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await tasksApi.getTaskHistory(taskId);
        if (!controller.signal.aborted) setHistory(data);
      } catch {
        if (!controller.signal.aborted) message.error('Не удалось загрузить историю');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
  }, [taskId]);

  if (loading) return <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.dim }}>Загрузка…</span>;
  if (history.length === 0) return <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.dim }}>История изменений пуста</span>;

  return (
    <div style={{ marginTop: 8 }}>
      {history.map((entry, i) => {
        const dotColor = avatarColor(entry.user.name);
        const isLast = i === history.length - 1;
        const fieldLabel = FIELD_LABELS[entry.field] ?? entry.field;
        const verb = verbForm(entry.user.name);

        return (
          <div key={entry.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
            {!isLast && (
              <div style={{ position: 'absolute', left: 9, top: 20, bottom: 0, width: 1, background: c.line }} />
            )}
            {/* Avatar dot */}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: dotColor, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
            }}>
              <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 8, fontWeight: 700, color: 'var(--neutral-0)' }}>
                {entry.user.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600, color: c.muted }}>
                  {entry.user.name}
                </span>
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.dim }}>
                  {verb} {fieldLabel}
                </span>
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, color: c.dim, marginLeft: 'auto' }}>
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              {/* Old → New values */}
              {(entry.oldValue !== null || entry.newValue !== null) && (
                <div style={{ fontSize: 12, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {entry.oldValue !== null && (
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', color: c.removed, textDecoration: 'line-through' }}>
                      {formatValue(entry.field, entry.oldValue, statuses)}
                    </span>
                  )}
                  {entry.oldValue !== null && entry.newValue !== null && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1 5h8M6 2l3 3-3 3" stroke={c.dim} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {entry.newValue !== null && (
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', color: c.added }}>
                      {formatValue(entry.field, entry.newValue, statuses)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
