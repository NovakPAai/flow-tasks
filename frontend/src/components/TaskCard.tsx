import { Avatar, Tag, Tooltip } from 'antd';
import { CalendarOutlined, BranchesOutlined } from '@ant-design/icons';
import type { Task } from '../types';

const PRIORITY_COLOR: Record<string, string> = {
  HIGH:   '#EF4444',
  MEDIUM: '#F59E0B',
  LOW:    '#6B7280',
};

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};

interface Props {
  task: Task;
  onClick?: () => void;
}

export default function TaskCard({ task, onClick }: Props) {
  const childCount = task._count?.children ?? 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date();

  return (
    <div
      onClick={onClick}
      style={{
        background: '#0F1320',
        border: '1px solid #1E2640',
        borderRadius: 8,
        padding: '10px 12px',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#4F6EF7')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#1E2640')}
    >
      {/* Issue key + priority */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: '#4A5578', fontSize: 11, fontFamily: 'monospace' }}>{task.issueKey}</span>
        {task.priority && (
          <span
            style={{
              width: 6, height: 6, borderRadius: '50%',
              background: PRIORITY_COLOR[task.priority],
              flexShrink: 0,
            }}
            title={PRIORITY_LABEL[task.priority]}
          />
        )}
      </div>

      {/* Title */}
      <p style={{
        margin: '0 0 8px',
        color: '#E2E8F8',
        fontSize: 13,
        lineHeight: '18px',
        fontWeight: 500,
        wordBreak: 'break-word',
      }}>
        {task.title}
      </p>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Due date */}
          {due && (
            <Tooltip title={due.toLocaleDateString('ru-RU')}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 3,
                color: isOverdue ? '#EF4444' : '#4A5578', fontSize: 11,
              }}>
                <CalendarOutlined />
                {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </span>
            </Tooltip>
          )}
          {/* Subtasks */}
          {childCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#4A5578', fontSize: 11 }}>
              <BranchesOutlined />
              {childCount}
            </span>
          )}
        </div>

        {/* Assignee */}
        {task.assignee && (
          <Tooltip title={task.assignee.name}>
            <Avatar
              size={20}
              src={task.assignee.avatar}
              style={{ background: '#4F6EF7', fontSize: 10, flexShrink: 0 }}
            >
              {task.assignee.name?.[0]?.toUpperCase()}
            </Avatar>
          </Tooltip>
        )}
      </div>

      {/* Priority tag (for accessibility) */}
      {task.priority && (
        <Tag
          style={{
            marginTop: 6,
            background: `${PRIORITY_COLOR[task.priority]}18`,
            border: `1px solid ${PRIORITY_COLOR[task.priority]}44`,
            color: PRIORITY_COLOR[task.priority],
            fontSize: 10,
            lineHeight: '16px',
            padding: '0 6px',
          }}
        >
          {PRIORITY_LABEL[task.priority]}
        </Tag>
      )}
    </div>
  );
}
