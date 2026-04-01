import { useEffect, useState } from 'react';
import { Avatar, Timeline, Typography, message } from 'antd';
import type { TaskHistory, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

const { Text } = Typography;

const FIELD_LABELS: Record<string, string> = {
  title: 'заголовок',
  description: 'описание',
  priority: 'приоритет',
  statusId: 'статус',
  assigneeId: 'исполнитель',
  dueDate: 'срок',
  startDate: 'дата начала',
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};

function formatValue(field: string, value: string | null, statuses: WorkflowStatus[]): string {
  if (value === null) return '—';
  if (field === 'statusId') {
    return statuses.find((s) => s.id === value)?.name ?? value;
  }
  if (field === 'priority') return PRIORITY_LABELS[value] ?? value;
  if (field === 'dueDate' || field === 'startDate') {
    try { return new Date(value).toLocaleDateString('ru-RU'); } catch { return value; }
  }
  if (value.length > 60) return value.slice(0, 60) + '…';
  return value;
}

interface Props {
  taskId: string;
  statuses: WorkflowStatus[];
}

export default function TaskHistoryTimeline({ taskId, statuses }: Props) {
  const [history, setHistory] = useState<TaskHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    tasksApi.getTaskHistory(taskId)
      .then(setHistory)
      .catch(() => message.error('Не удалось загрузить историю'))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) return <Text style={{ color: '#4A5578', fontSize: 12 }}>Загрузка...</Text>;
  if (history.length === 0) return <Text style={{ color: '#4A5578', fontSize: 12 }}>История изменений пуста</Text>;

  const items = history.map((entry) => ({
    key: entry.id,
    dot: (
      <Avatar size={20} style={{ background: '#4F6EF7', fontSize: 9, flexShrink: 0 }}>
        {entry.user.name?.[0]?.toUpperCase()}
      </Avatar>
    ),
    children: (
      <div style={{ paddingBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: '#8B95B0', fontSize: 12, fontWeight: 600 }}>{entry.user.name}</Text>
          <Text style={{ color: '#4A5578', fontSize: 11 }}>
            изменил(-а) {FIELD_LABELS[entry.field] ?? entry.field}
          </Text>
          <Text style={{ color: '#4A5578', fontSize: 10, marginLeft: 'auto' }}>
            {new Date(entry.createdAt).toLocaleString('ru-RU', {
              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
            })}
          </Text>
        </div>
        <div style={{ fontSize: 12, marginTop: 2 }}>
          {entry.oldValue !== null && (
            <Text style={{ color: '#EF4444', textDecoration: 'line-through', marginRight: 8 }}>
              {formatValue(entry.field, entry.oldValue, statuses)}
            </Text>
          )}
          {entry.newValue !== null && (
            <Text style={{ color: '#4ADE80' }}>
              {formatValue(entry.field, entry.newValue, statuses)}
            </Text>
          )}
        </div>
      </div>
    ),
  }));

  return (
    <Timeline
      items={items}
      style={{ marginTop: 8 }}
    />
  );
}
