import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-base)',
  headerBg: 'var(--static-background-base)',      headerBorder: 'var(--static-border-neutral-tertiary)',     headerText: 'var(--static-text-neutral-tertiary)',
  groupBg: 'var(--static-background-lightest)',       groupBorder: 'var(--static-background-light)',
  rowBg: 'transparent',     rowBorder: 'var(--static-background-lightest)',         rowActiveBg: 'var(--component-fill-info-soft-hover)',
  countBadgeBg: 'var(--static-border-neutral-tertiary)',  countBadgeText: 'var(--static-text-neutral-tertiary)',
  keyText: 'var(--static-text-neutral-tertiary)',       keyActiveText: 'var(--brand-8)',
  titleText: 'var(--static-text-neutral-primary)',     doneTitleText: 'var(--static-text-neutral-tertiary)',
  metaText: 'var(--static-text-neutral-tertiary)',      overdueText: 'var(--error-8)',
  avatarName: 'var(--static-text-neutral-secondary)',
  addBtnText: 'var(--neutral-8)',
  inputBg: 'var(--static-background-lightest)',       inputBorder: 'var(--brand-8)',       inputText: 'var(--static-text-neutral-primary)',
  inputPlaceholder: 'var(--neutral-8)',
};

const LIGHT: C = {
  bg: 'var(--static-background-base)',
  headerBg: 'var(--static-background-lightest)',      headerBorder: 'var(--static-border-neutral-tertiary)',      headerText: 'var(--static-text-neutral-tertiary)',
  groupBg: 'var(--static-background-base)',       groupBorder: 'var(--static-background-light)',
  rowBg: 'var(--static-background-lightest)',         rowBorder: 'var(--static-background-light)',          rowActiveBg: 'var(--component-fill-info-soft-hover)',
  countBadgeBg: 'var(--static-border-neutral-tertiary)',  countBadgeText: 'var(--static-text-neutral-tertiary)',
  keyText: 'var(--static-text-neutral-tertiary)',       keyActiveText: 'var(--brand-8)',
  titleText: 'var(--static-text-neutral-primary)',     doneTitleText: 'var(--neutral-8)',
  metaText: 'var(--static-text-neutral-tertiary)',      overdueText: 'var(--error-10)',
  avatarName: 'var(--static-text-neutral-tertiary)',
  addBtnText: 'var(--static-text-neutral-tertiary)',
  inputBg: 'var(--static-background-lightest)',       inputBorder: 'var(--brand-8)',       inputText: 'var(--static-text-neutral-primary)',
  inputPlaceholder: 'var(--static-text-neutral-tertiary)',
};

// ── Status badge configs per category ──────────────────────────────────────────
type BadgeCfg = { bg: string; border: string; dot: string; text: string };
const STATUS_BADGE: Record<string, [BadgeCfg, BadgeCfg]> = {
  // [dark, light]
  OPEN:        [{ bg:'var(--static-background-light)', border:'var(--static-border-neutral-tertiary)', dot:'var(--neutral-8)', text:'var(--static-text-neutral-tertiary)' }, { bg:'var(--static-background-base)', border:'var(--static-border-neutral-tertiary)', dot:'var(--neutral-8)', text:'var(--static-text-neutral-tertiary)' }],
  IN_PROGRESS: [{ bg:'var(--component-fill-info-soft-default)', border:'var(--brand-8)', dot:'var(--brand-8)', text:'var(--brand-8)' }, { bg:'var(--component-fill-info-soft-default)', border:'var(--component-border-info-medium)', dot:'var(--brand-8)', text:'var(--brand-8)' }],
  DONE:        [{ bg:'var(--component-fill-positive-soft-default)', border:'var(--success-7)', dot:'var(--success-7)', text:'var(--success-7)' }, { bg:'var(--component-fill-positive-soft-default)', border:'var(--component-border-positive-medium)', dot:'var(--success-8)', text:'var(--success-8)' }],
  CANCELLED:   [{ bg:'var(--component-fill-negative-soft-default)', border:'var(--error-10)', dot:'var(--error-10)', text:'var(--error-10)' }, { bg:'var(--component-fill-negative-soft-default)', border:'var(--component-border-negative-medium)', dot:'var(--error-10)', text:'var(--error-10)' }],
};

// ── Priority badge configs ─────────────────────────────────────────────────────
type PrioCfg = { bg: string; border: string; text: string; label: string };
const PRIO: Record<string, [PrioCfg, PrioCfg]> = {
  // [dark, light]
  HIGH:   [{ bg:'var(--static-text-neutral-primary)', border:'var(--error-8)', text:'var(--error-8)', label:'HIGH' }, { bg:'var(--component-fill-negative-soft-default)', border:'var(--component-border-negative-medium)', text:'var(--error-10)', label:'HIGH' }],
  MEDIUM: [{ bg:'var(--component-fill-warning-soft-default)', border:'var(--warning-5)', text:'var(--warning-5)', label:'MED'  }, { bg:'var(--component-fill-warning-soft-default)', border:'var(--component-border-warning-medium)', text:'var(--warning-8)', label:'MED'  }],
  LOW:    [{ bg:'var(--static-background-light)', border:'var(--static-border-neutral-tertiary)', text:'var(--static-text-neutral-tertiary)', label:'LOW'  }, { bg:'var(--static-background-lightest)', border:'var(--component-border-neutral-medium)', text:'var(--neutral-8)', label:'LOW'  }],
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string): string { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

// ── Column widths ──────────────────────────────────────────────────────────────
const W = { checkbox: 36, key: 120, status: 140, priority: 100, assignee: 140, due: 100, labels: 160 };

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  statuses: WorkflowStatus[];
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskUpdated: (task: Task) => void;
  quickAddStatusId: string | null;
  quickAddTitle: string;
  onQuickAddStart: (statusId: string) => void;
  onQuickAddChange: (title: string) => void;
  onQuickAddSubmit: (statusId: string) => void;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BoardListView({
  statuses, tasks, onTaskClick, onTaskUpdated,
  quickAddStatusId, quickAddTitle, onQuickAddStart, onQuickAddChange, onQuickAddSubmit,
  selectedTaskIds, onToggleSelect, onSelectAll,
}: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const saveField = async (taskId: string, patch: Parameters<typeof tasksApi.updateTask>[1]) => {
    setSaving(taskId);
    try {
      const updated = await tasksApi.updateTask(taskId, patch);
      const existing = tasks.find(t => t.id === taskId);
      onTaskUpdated(existing ? { ...existing, ...updated } : updated);
    } catch { /* ignore */ }
    finally { setSaving(null); }
  };

  const toggleCollapse = (id: string) =>
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ background: c.bg, minHeight: '100%' }}>

      {/* ── Table header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: c.headerBg, borderBottom: `1px solid ${c.headerBorder}`,
        padding: '10px 24px',
        fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600,
        color: c.headerText, letterSpacing: '0.04em', textTransform: 'uppercase',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {onToggleSelect && (
          <div style={{ width: W.checkbox, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            {onSelectAll && (() => {
              const allIds = tasks.map(t => t.id);
              const allSelected = allIds.length > 0 && allIds.every(id => selectedTaskIds?.has(id));
              return (
                <div
                  onClick={() => onSelectAll(allSelected ? [] : allIds)}
                  style={{
                    width: 14, height: 14, borderRadius: 3,
                    border: `1.5px solid ${allSelected ? 'var(--brand-8)' : c.headerText}`,
                    background: allSelected ? 'var(--brand-8)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {allSelected && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="var(--neutral-0)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <div style={{ width: W.key, flexShrink: 0 }}>Ключ</div>
        <div style={{ flex: 1 }}>Задача</div>
        <div style={{ width: W.status, flexShrink: 0 }}>Статус</div>
        <div style={{ width: W.priority, flexShrink: 0 }}>Приоритет</div>
        <div style={{ width: W.assignee, flexShrink: 0 }}>Исполнитель</div>
        <div style={{ width: W.due, flexShrink: 0 }}>Срок</div>
        <div style={{ width: W.labels, flexShrink: 0 }}>Метки</div>
      </div>

      {/* ── Status groups ── */}
      {statuses.map(status => {
        const statusTasks = tasks
          .filter(t => t.statusId === status.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);

        const cat = status.category ?? 'OPEN';
        const badge = (STATUS_BADGE[cat] ?? STATUS_BADGE.OPEN)[isDark ? 0 : 1];
        const isInProgress = cat === 'IN_PROGRESS';
        const isDoneGroup = cat === 'DONE';
        const isCollapsed = collapsed[status.id] ?? false;

        return (
          <div key={status.id}>
            {/* Group header */}
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: c.groupBg,
                borderTop: `1px solid ${c.groupBorder}`,
                borderBottom: `1px solid ${c.groupBorder}`,
                padding: '8px 24px', cursor: 'pointer', userSelect: 'none',
              }}
              onClick={() => toggleCollapse(status.id)}
            >
              {/* Chevron */}
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{ flexShrink: 0, transition: 'transform 0.15s', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke={badge.dot} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {/* Status dot */}
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
              {/* Status name */}
              <span style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
                color: badge.text,
              }}>
                {status.name}
              </span>
              {/* Count badge */}
              <span style={{
                background: c.countBadgeBg, borderRadius: 10,
                padding: '1px 8px',
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11,
                color: c.countBadgeText,
              }}>
                {statusTasks.length}
              </span>
            </div>

            {/* Task rows */}
            {!isCollapsed && (
              <>
                {statusTasks.map(task => {
                  const isActive = isInProgress;
                  const isDoneRow = isDoneGroup;
                  const childCount = task._count?.children ?? 0;
                  const due = task.dueDate ? new Date(task.dueDate) : null;
                  const isOverdue = due && due < new Date();
                  const labels = task.labels ?? [];
                  const prioKey = task.priority ?? null;
                  const prio = prioKey ? (PRIO[prioKey] ?? null) : null;
                  const prioCfg = prio ? prio[isDark ? 0 : 1] : null;

                  const isRowSelected = selectedTaskIds?.has(task.id) ?? false;
                  return (
                    <div
                      key={task.id}
                      style={{
                        display: 'flex', alignItems: 'center',
                        background: isRowSelected
                          ? (isDark ? 'var(--component-fill-info-soft-hover)' : 'var(--component-fill-info-soft-hover)')
                          : (isActive ? c.rowActiveBg : c.rowBg),
                        borderBottom: `1px solid ${c.rowBorder}`,
                        borderLeft: isRowSelected
                          ? '3px solid var(--brand-8)'
                          : (!isDark && isActive) ? '3px solid var(--brand-8)' : 'none',
                        padding: '12px 24px',
                        opacity: isDoneRow ? 0.65 : 1,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive && !isRowSelected) (e.currentTarget as HTMLDivElement).style.background = isDark ? 'var(--static-background-lightest)' : 'var(--static-background-lightest)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isRowSelected ? (isDark ? 'var(--component-fill-info-soft-hover)' : 'var(--component-fill-info-soft-hover)') : (isActive ? c.rowActiveBg : c.rowBg); }}
                    >
                      {/* Checkbox */}
                      {onToggleSelect && (
                        <div style={{ width: W.checkbox, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <div
                            onClick={e => { e.stopPropagation(); onToggleSelect(task.id); }}
                            style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${isRowSelected ? 'var(--brand-8)' : c.keyText}`,
                              background: isRowSelected ? 'var(--brand-8)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
                            }}
                          >
                            {isRowSelected && (
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3l2 2 4-4" stroke="var(--neutral-0)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Key */}
                      <div style={{
                        width: W.key - (isRowSelected || (!isDark && isActive) ? 3 : 0),
                        flexShrink: 0,
                        fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600,
                        color: isActive ? c.keyActiveText : c.keyText,
                        letterSpacing: '0.02em',
                      }}>
                        {task.issueKey}
                      </div>

                      {/* Title */}
                      <div
                        style={{ flex: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}
                        onClick={() => onTaskClick(task.id)}
                      >
                        <span style={{
                          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, lineHeight: '16px',
                          fontWeight: isActive ? 500 : 400,
                          color: isDoneRow ? c.doneTitleText : c.titleText,
                          textDecoration: isDoneRow ? 'line-through' : 'none',
                          textDecorationThickness: '1px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {task.title}
                        </span>
                        {childCount > 0 && (
                          <span style={{
                            flexShrink: 0,
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11,
                            color: c.metaText,
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}>
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <circle cx="5" cy="2" r="1.5" stroke="currentColor" strokeWidth="1"/>
                              <circle cx="2" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
                              <circle cx="8" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
                              <path d="M5 3.5V5.5M5 5.5L2 7M5 5.5L8 7" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                            </svg>
                            {childCount}
                          </span>
                        )}
                      </div>

                      {/* Status badge */}
                      <div style={{ width: W.status, flexShrink: 0 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          background: badge.bg, border: `1px solid ${badge.border}`,
                          borderRadius: 6, padding: '3px 8px',
                          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11,
                          color: badge.text,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: badge.dot, flexShrink: 0 }} />
                          {status.name}
                        </span>
                      </div>

                      {/* Priority */}
                      <div style={{ width: W.priority, flexShrink: 0 }}>
                        {prioCfg ? (
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <span style={{
                              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600,
                              color: prioCfg.text, background: prioCfg.bg,
                              border: `1px solid ${prioCfg.border}`,
                              borderRadius: 4, padding: '2px 6px',
                              pointerEvents: 'none',
                            }}>
                              {prioCfg.label}
                            </span>
                            <select
                              value={task.priority ?? ''}
                              disabled={saving === task.id}
                              onChange={e => saveField(task.id, { priority: (e.target.value as 'HIGH' | 'MEDIUM' | 'LOW') || null })}
                              style={{
                                position: 'absolute', inset: 0, opacity: 0,
                                cursor: 'pointer', width: '100%', height: '100%',
                              }}
                            >
                              <option value="">—</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MED</option>
                              <option value="LOW">LOW</option>
                            </select>
                          </div>
                        ) : (
                          <div style={{ position: 'relative', display: 'inline-flex' }}>
                            <span style={{
                              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                              color: c.metaText,
                            }}>—</span>
                            <select
                              value=""
                              disabled={saving === task.id}
                              onChange={e => saveField(task.id, { priority: (e.target.value as 'HIGH' | 'MEDIUM' | 'LOW') || null })}
                              style={{
                                position: 'absolute', inset: 0, opacity: 0,
                                cursor: 'pointer', width: '100%', height: '100%',
                              }}
                            >
                              <option value="">—</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MED</option>
                              <option value="LOW">LOW</option>
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Assignee */}
                      <div style={{ width: W.assignee, flexShrink: 0 }}>
                        {task.assignee ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                            <span style={{
                              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                              color: c.avatarName,
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {task.assignee.name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.metaText }}>—</span>
                        )}
                      </div>

                      {/* Due date */}
                      <div style={{ width: W.due, flexShrink: 0 }}>
                        {due ? (
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                            color: isOverdue ? c.overdueText : c.metaText,
                            fontWeight: (!isDark && isOverdue) ? 500 : 400,
                          }}>
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }}>
                              <rect x="0.5" y="1.5" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1"/>
                              <path d="M3 0.5v2M8 0.5v2M0.5 4.5h10" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                            </svg>
                            {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                          </span>
                        ) : (
                          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.metaText }}>—</span>
                        )}
                      </div>

                      {/* Labels */}
                      <div style={{ width: W.labels, flexShrink: 0, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {labels.length > 0 ? labels.slice(0, 2).map(tl => (
                          <span
                            key={tl.labelId}
                            style={{
                              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, fontWeight: 500,
                              color: tl.label.color,
                              background: `${tl.label.color}1A`,
                              border: `1px solid ${tl.label.color}33`,
                              borderRadius: 20, padding: '2px 8px',
                              lineHeight: '12px', whiteSpace: 'nowrap',
                            }}
                          >
                            {tl.label.name}
                          </span>
                        )) : (
                          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.metaText }}>—</span>
                        )}
                        {labels.length > 2 && (
                          <span style={{
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10,
                            color: c.metaText, lineHeight: '16px',
                          }}>
                            +{labels.length - 2}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Quick add */}
                {quickAddStatusId === status.id ? (
                  <div style={{ padding: '8px 24px', borderBottom: `1px solid ${c.rowBorder}` }}>
                    <input
                      value={quickAddTitle}
                      onChange={e => onQuickAddChange(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') onQuickAddSubmit(status.id); if (e.key === 'Escape') onQuickAddSubmit(''); }}
                      onBlur={() => onQuickAddSubmit(status.id)}
                      placeholder="Название задачи..."
                      autoFocus
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: c.inputBg, border: `1px solid ${c.inputBorder}`,
                        borderRadius: 6, padding: '6px 10px',
                        fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
                        color: c.inputText, outline: 'none',
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      padding: '8px 24px', borderBottom: `1px solid ${c.rowBorder}`,
                      display: 'flex', alignItems: 'center', gap: 6,
                      cursor: 'pointer',
                    }}
                    onClick={() => onQuickAddStart(status.id)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isDark ? 'var(--static-background-lightest)' : 'var(--static-background-lightest)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke={c.addBtnText} strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <span style={{
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                      color: c.addBtnText,
                    }}>
                      Добавить задачу
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
