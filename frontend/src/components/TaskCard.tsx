import { useThemeStore } from '../store/theme.store';
import type { Task } from '../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)', borderHover: 'var(--brand-8)',
  key: 'var(--neutral-8)', title: 'var(--static-text-neutral-primary)', titleDone: 'var(--neutral-8)', meta: 'var(--neutral-8)',
};
const LIGHT: C = {
  bg: 'var(--neutral-0)', border: 'var(--static-border-neutral-tertiary)', borderHover: 'var(--brand-8)',
  key: 'var(--static-text-neutral-tertiary)', title: 'var(--static-text-neutral-primary)', titleDone: 'var(--neutral-6)', meta: 'var(--static-text-neutral-tertiary)',
};

const PRIO: Record<string, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: 'var(--component-fill-negative-soft-hover)',   text: 'var(--error-10)', label: 'HIGH' },
  MEDIUM: { bg: 'var(--component-fill-warning-soft-hover)',  text: 'var(--warning-6)', label: 'MED' },
  LOW:    { bg: 'var(--component-fill-neutral-soft-default)', text: 'var(--neutral-8)', label: 'LOW' },
};

function avatarColor(name: string): string {
  const palette = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
  return palette[(name?.charCodeAt(0) ?? 0) % palette.length];
}

function avatarInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

interface Props {
  task: Task;
  onClick?: () => void;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
}

export default function TaskCard({ task, onClick, isSelected = false, onSelect }: Props) {
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;

  const childCount = task._count?.children ?? 0;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = due && due < new Date();
  const isDone = task.status?.category === 'DONE';
  const prio = task.priority ? PRIO[task.priority] : null;
  const taskLabels = task.labels ?? [];

  return (
    <div
      onClick={onClick}
      style={{
        background: c.bg,
        border: `1px solid ${isSelected ? 'var(--brand-8)' : c.border}`,
        borderRadius: 10, padding: '12px 14px',
        cursor: 'pointer', userSelect: 'none', transition: 'border-color 0.15s',
        outline: isSelected ? '2px solid var(--component-border-brand-medium)' : 'none',
      }}
      onMouseEnter={e => { (e.currentTarget.style.borderColor = isSelected ? 'var(--brand-8)' : c.borderHover); }}
      onMouseLeave={e => { (e.currentTarget.style.borderColor = isSelected ? 'var(--brand-8)' : c.border); }}
    >
      {/* Key + priority badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {onSelect && (
            <div
              onClick={e => { e.stopPropagation(); onSelect(task.id); }}
              style={{
                width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                border: `1.5px solid ${isSelected ? 'var(--brand-8)' : c.key}`,
                background: isSelected ? 'var(--brand-8)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {isSelected && (
                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                  <path d="M1 3l2 2 4-4" stroke="var(--neutral-0)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          )}
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.key, letterSpacing: '0.02em' }}>
            {task.issueKey}
          </span>
        </div>
        {prio && (
          <span style={{
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, fontWeight: 600,
            color: prio.text, background: prio.bg, borderRadius: 4,
            padding: '1px 6px', letterSpacing: '0.04em',
          }}>
            {prio.label}
          </span>
        )}
      </div>

      {/* Title */}
      <p style={{
        margin: '0 0 8px', fontFamily: '"Inter",system-ui,sans-serif',
        fontSize: 13, lineHeight: '18px', fontWeight: 500, wordBreak: 'break-word',
        color: isDone ? c.titleDone : c.title,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
        {isDone && (
          <span style={{ fontSize: 11, marginRight: 4, color: 'var(--success-8)' }}>✓</span>
        )}
        {task.title}
      </p>

      {/* Labels */}
      {taskLabels.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {taskLabels.map(tl => (
            <span
              key={tl.labelId}
              style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, fontWeight: 500,
                color: tl.label.color, background: `${tl.label.color}1A`,
                border: `1px solid ${tl.label.color}33`,
                borderRadius: 4, padding: '1px 6px',
              }}
            >
              {tl.label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: date + subtasks | assignee */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {due && (
            <span
              title={due.toLocaleDateString('ru-RU')}
              style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: isOverdue ? 'var(--error-10)' : c.meta }}
            >
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                <rect x="0.5" y="1.5" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M3 0.5v2M8 0.5v2M0.5 4.5h10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {childCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.meta }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="5.5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <circle cx="2" cy="9" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <circle cx="9" cy="9" r="1.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M5.5 3.5V5.5M5.5 5.5L2 7.5M5.5 5.5L9 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              {childCount} subtask
            </span>
          )}
        </div>
        {task.assignee && (
          <div
            title={task.assignee.name}
            style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: avatarColor(task.assignee.name),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 8, fontWeight: 700, color: 'var(--neutral-0)' }}>
              {avatarInitials(task.assignee.name)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
