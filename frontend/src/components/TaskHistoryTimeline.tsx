import { useEffect, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { TaskHistory, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  text: '#E2E8F8', muted: '#8B95B0', dim: '#4A5578',
  line: '#1C2236', removed: '#F87171', added: '#4ADE80',
};
const LIGHT: C = {
  text: '#1A1A2E', muted: '#6B7194', dim: '#9B96B8',
  line: '#E8E5F0', removed: '#EF4444', added: '#10B981',
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }

// ── Field / value labels ───────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  title: 'заголовок', description: 'описание', priority: 'приоритет',
  statusId: 'статус', assigneeId: 'исполнитель', dueDate: 'срок', startDate: 'дата начала',
};
const PRIORITY_LABELS: Record<string, string> = { HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий' };

function formatValue(field: string, value: string | null, statuses: WorkflowStatus[]): string {
  if (value === null) return '—';
  if (field === 'statusId') return statuses.find(s => s.id === value)?.name ?? value;
  if (field === 'priority') return PRIORITY_LABELS[value] ?? value;
  if (field === 'dueDate' || field === 'startDate') {
    try { return new Date(value).toLocaleDateString('ru-RU'); } catch { return value; }
  }
  if (value.length > 60) return value.slice(0, 60) + '…';
  return value;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props { taskId: string; statuses: WorkflowStatus[]; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function TaskHistoryTimeline({ taskId, statuses }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    tasksApi.getTaskHistory(taskId)
      .then(data => { if (!controller.signal.aborted) setHistory(data); })
      .catch(() => { if (!controller.signal.aborted) message.error('Не удалось загрузить историю'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [taskId]);

  if (loading) {
    return (
      <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.dim }}>
        Загрузка...
      </span>
    );
  }
  if (history.length === 0) {
    return (
      <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.dim }}>
        История изменений пуста
      </span>
    );
  }

  return (
    <div style={{ marginTop: 8, paddingLeft: 0 }}>
      {history.map((entry, i) => {
        const dotColor = avatarColor(entry.user.name);
        const isLast = i === history.length - 1;
        return (
          <div key={entry.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
            {/* Vertical line */}
            {!isLast && (
              <div style={{
                position: 'absolute', left: 9, top: 20, bottom: 0, width: 1,
                background: c.line,
              }} />
            )}
            {/* Avatar dot */}
            <div style={{
              width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
              background: dotColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                {entry.user.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            </div>
            {/* Content */}
            <div style={{ flex: 1, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600, color: c.muted,
                }}>
                  {entry.user.name}
                </span>
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.dim }}>
                  изменил(-а) {FIELD_LABELS[entry.field] ?? entry.field}
                </span>
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, color: c.dim, marginLeft: 'auto',
                }}>
                  {new Date(entry.createdAt).toLocaleString('ru-RU', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              <div style={{ fontSize: 12, marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {entry.oldValue !== null && (
                  <span style={{
                    fontFamily: '"Inter",system-ui,sans-serif',
                    color: c.removed, textDecoration: 'line-through',
                  }}>
                    {formatValue(entry.field, entry.oldValue, statuses)}
                  </span>
                )}
                {entry.newValue !== null && (
                  <span style={{ fontFamily: '"Inter",system-ui,sans-serif', color: c.added }}>
                    {formatValue(entry.field, entry.newValue, statuses)}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
