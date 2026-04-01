import { useState } from 'react';
import { Calendar, Typography, Tooltip, Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import type { Task, WorkflowStatus } from '../types';

const { Text } = Typography;

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#6B7280',
};

interface Props {
  statuses: WorkflowStatus[];
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

export default function BoardCalendarView({ statuses, tasks, onTaskClick }: Props) {
  const [currentDate, setCurrentDate] = useState<Dayjs | null>(null);

  const statusById = Object.fromEntries(statuses.map((s) => [s.id, s]));

  // Group tasks by YYYY-MM-DD of dueDate
  const tasksByDate = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!task.dueDate) return acc;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const dateCellRender = (value: Dayjs) => {
    const key = value.format('YYYY-MM-DD');
    const dayTasks = tasksByDate[key];
    if (!dayTasks?.length) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
        {dayTasks.slice(0, 3).map((task) => {
          const status = statusById[task.statusId];
          const color = task.priority ? PRIORITY_COLOR[task.priority] : (status?.color ?? '#4A5578');
          return (
            <Tooltip key={task.id} title={`${task.issueKey}: ${task.title}`} placement="top">
              <div
                onClick={(e) => { e.stopPropagation(); onTaskClick(task.id); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  cursor: 'pointer', borderRadius: 3,
                  padding: '1px 4px',
                  background: `${color}18`,
                  border: `1px solid ${color}44`,
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <Text style={{ color: '#E2E8F8', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.title}
                </Text>
              </div>
            </Tooltip>
          );
        })}
        {dayTasks.length > 3 && (
          <Text style={{ color: '#4A5578', fontSize: 10, paddingLeft: 4 }}>
            +{dayTasks.length - 3} ещё
          </Text>
        )}
      </div>
    );
  };

  // Tasks without due dates
  const noDateTasks = tasks.filter((t) => !t.dueDate);

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <Calendar
        cellRender={dateCellRender}
        value={currentDate ?? undefined}
        onPanelChange={(val) => setCurrentDate(val)}
        headerRender={({ value, onChange }) => {
          const month = value.format('MMMM YYYY');
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 0 16px', justifyContent: 'space-between',
            }}>
              <Text style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 16 }}>
                {month}
              </Text>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  type="text" size="small" icon={<LeftOutlined />}
                  onClick={() => { const v = value.subtract(1, 'month'); onChange(v); setCurrentDate(v); }}
                  style={{ color: '#4A5578' }}
                />
                <Button
                  type="text" size="small" icon={<RightOutlined />}
                  onClick={() => { const v = value.add(1, 'month'); onChange(v); setCurrentDate(v); }}
                  style={{ color: '#4A5578' }}
                />
              </div>
            </div>
          );
        }}
        style={{ background: 'transparent' }}
      />

      {/* No due date tasks */}
      {noDateTasks.length > 0 && (
        <div style={{ marginTop: 24, borderTop: '1px solid #1E2640', paddingTop: 16 }}>
          <Text style={{ color: '#4A5578', fontSize: 12, display: 'block', marginBottom: 8 }}>
            БЕЗ СРОКА ({noDateTasks.length})
          </Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {noDateTasks.map((task) => {
              const status = statusById[task.statusId];
              const color = status?.color ?? '#4A5578';
              return (
                <div
                  key={task.id}
                  onClick={() => onTaskClick(task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                    background: '#0F1320', border: '1px solid #1E2640', borderRadius: 6,
                    padding: '4px 10px',
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <Text style={{ color: '#4A5578', fontSize: 10, fontFamily: 'monospace' }}>{task.issueKey}</Text>
                  <Text style={{ color: '#E2E8F8', fontSize: 12 }}>{task.title}</Text>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
