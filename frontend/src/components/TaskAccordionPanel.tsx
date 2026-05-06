import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { MyTask } from '../api/tasks';
import type { Breakpoint } from '../utils/useBreakpoint';
import './TaskAccordionPanel.css';

const DESCRIPTION_PREVIEW_LIMIT = 500;
const HEX_COLOR_RE = /^#[0-9a-f]{3,8}$/i;

function isSafeAvatarUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function safeColor(color: string, fallback: string): string {
  return HEX_COLOR_RE.test(color) ? color : fallback;
}

interface TaskAccordionPanelProps {
  id: string;
  task: MyTask;
  colors: Record<string, string>;
  isDark: boolean;
  bp: Breakpoint;
  now: Date;
  onOpenInBoard: (task: MyTask) => void;
}

export default function TaskAccordionPanel({ id, task, colors: c, isDark, bp, now, onOpenInBoard }: TaskAccordionPanelProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const description = task.description ?? undefined;
  const isDescLong = description !== undefined && description.length > DESCRIPTION_PREVIEW_LIMIT;
  const displayedDesc = isDescLong && !descExpanded
    ? description.slice(0, DESCRIPTION_PREVIEW_LIMIT) + '...'
    : description;

  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isDone = task.status?.category === 'DONE';
  const isOverdue = due !== null && due < now && !isDone;

  const panelBg = isDark ? '#0D1025' : 'rgba(79,110,247,0.03)';

  const labelStyle = useMemo<CSSProperties>(() => ({
    fontSize: 10, fontWeight: 600, color: c.muted,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    fontFamily: '"Inter",system-ui,sans-serif',
    marginBottom: 4,
  }), [c.muted]);

  const valueStyle = useMemo<CSSProperties>(() => ({
    fontSize: 12, color: c.text,
    fontFamily: '"Inter",system-ui,sans-serif',
  }), [c.text]);

  const mutedValueStyle = useMemo<CSSProperties>(() => ({
    fontSize: 12, color: c.muted, fontStyle: 'italic',
    fontFamily: '"Inter",system-ui,sans-serif',
  }), [c.muted]);

  return (
    <div
      id={id}
      className="accordion-panel"
      onClick={(e) => e.stopPropagation()}
      style={{
        padding: '14px 16px 14px 38px',
        background: panelBg,
        borderTop: `1px solid ${c.border}`,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '14px 24px',
      }}
    >
      {/* Description — full width */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={labelStyle}>Описание</div>
        {description === undefined ? (
          <span style={mutedValueStyle}>Описание не добавлено</span>
        ) : (
          <>
            <p style={{ ...valueStyle, margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {displayedDesc}
            </p>
            {isDescLong && (
              <button
                aria-expanded={descExpanded}
                onClick={() => setDescExpanded((v) => !v)}
                style={{
                  marginTop: 4, fontSize: 11, color: '#4F6EF7',
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', padding: 0,
                  fontFamily: '"Inter",system-ui,sans-serif',
                }}
              >
                {descExpanded ? 'Свернуть' : 'Читать далее'}
              </button>
            )}
          </>
        )}
      </div>

      {/* Deadline */}
      <div>
        <div style={labelStyle}>Дедлайн</div>
        {due ? (
          <span style={{ ...valueStyle, color: isOverdue ? '#EF4444' : c.text }}>
            {isOverdue ? 'Просрочено, ' : ''}
            {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        ) : (
          <span style={mutedValueStyle}>Не указан</span>
        )}
      </div>

      {/* Assignee */}
      <div>
        <div style={labelStyle}>Исполнитель</div>
        {task.assignee ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {task.assignee.avatar && isSafeAvatarUrl(task.assignee.avatar) ? (
              <img
                src={task.assignee.avatar}
                alt=""
                aria-hidden="true"
                style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0 }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  background: '#4F6EF7',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span style={{ color: '#fff', fontSize: 9, fontWeight: 700 }}>
                  {task.assignee.name[0]?.toUpperCase()}
                </span>
              </div>
            )}
            <span style={valueStyle}>{task.assignee.name}</span>
          </div>
        ) : (
          <span style={mutedValueStyle}>Не назначен</span>
        )}
      </div>

      {/* Status — only on mobile; desktop row header already shows it */}
      {bp === 'mobile' && (
        <div>
          <div style={labelStyle}>Статус</div>
          {task.status ? (
            <span style={{
              fontSize: 11, fontWeight: 500,
              color: safeColor(task.status.color, c.muted),
              background: `${safeColor(task.status.color, c.border)}18`,
              borderRadius: 5, padding: '2px 7px',
              fontFamily: '"Inter",system-ui,sans-serif',
            }}>
              {task.status.name}
            </span>
          ) : (
            <span style={mutedValueStyle}>Не задан</span>
          )}
        </div>
      )}

      {/* Labels */}
      <div>
        <div style={labelStyle}>Теги</div>
        {task.labels && task.labels.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.labels.map(({ label }) => {
              const color = safeColor(label.color, c.muted);
              return (
                <span
                  key={label.id}
                  style={{
                    fontSize: 11, fontWeight: 500,
                    color,
                    background: `${color}18`,
                    borderRadius: 4, padding: '2px 6px',
                    fontFamily: '"Inter",system-ui,sans-serif',
                  }}
                >
                  {label.name}
                </span>
              );
            })}
          </div>
        ) : (
          <span style={mutedValueStyle}>Нет тегов</span>
        )}
      </div>

      {/* Open button */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onOpenInBoard(task)}
          style={{
            fontSize: 12, fontWeight: 500,
            color: '#4F6EF7',
            background: 'transparent',
            border: '1px solid #4F6EF788',
            borderRadius: 7, padding: '5px 14px',
            cursor: 'pointer', transition: 'background 0.12s',
            fontFamily: '"Inter",system-ui,sans-serif',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(79,110,247,0.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          Открыть
          <svg aria-hidden="true" width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 9L9 2M9 2H4M9 2V7" stroke="#4F6EF7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
