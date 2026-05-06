import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F',
  headerBg: '#0A0D1A',      headerBorder: '#1C2236',     headerText: '#8B95B0',
  groupBg: '#0D1017',       groupBorder: '#151A2E',
  rowBg: 'transparent',     rowBorder: '#0D1017',         rowActiveBg: '#0F1420',
  countBadgeBg: '#1C2236',  countBadgeText: '#8B95B0',
  keyText: '#8B95B0',       keyActiveText: '#4F6EF7',
  titleText: '#E2E8F8',     doneTitleText: '#8B95B0',
  metaText: '#8B95B0',      overdueText: '#F87171',
  avatarName: '#A0AABF',
  addBtnText: '#4A5578',
  inputBg: '#0F1320',       inputBorder: '#4F6EF7',       inputText: '#E2E8F8',
  inputPlaceholder: '#4A5578',
};

const LIGHT: C = {
  bg: '#F5F3FF',
  headerBg: '#F8F7FE',      headerBorder: '#E8E5F0',      headerText: '#6B7194',
  groupBg: '#F5F3FF',       groupBorder: '#EDE9F8',
  rowBg: '#FDFCFF',         rowBorder: '#F0EEF8',          rowActiveBg: '#F0F1FF',
  countBadgeBg: '#E8E5F0',  countBadgeText: '#6B7194',
  keyText: '#6B7194',       keyActiveText: '#4F6EF7',
  titleText: '#1A1A2E',     doneTitleText: '#9CA3AF',
  metaText: '#6B7194',      overdueText: '#EF4444',
  avatarName: '#4B5280',
  addBtnText: '#6B7194',
  inputBg: '#FDFCFF',       inputBorder: '#4F6EF7',       inputText: '#1A1A2E',
  inputPlaceholder: '#9B96B8',
};

// ── Status badge configs per category ──────────────────────────────────────────
type BadgeCfg = { bg: string; border: string; dot: string; text: string };
const STATUS_BADGE: Record<string, [BadgeCfg, BadgeCfg]> = {
  // [dark, light]
  OPEN:        [{ bg:'#151A2E', border:'#1C2236', dot:'#6B7280', text:'#8B95B0' }, { bg:'#F5F3FF', border:'#E8E5F0', dot:'#9CA3AF', text:'#6B7194' }],
  IN_PROGRESS: [{ bg:'#1A2144', border:'#4F6EF7', dot:'#4F6EF7', text:'#4F6EF7' }, { bg:'#EEF0FF', border:'#C7D0FF', dot:'#4F6EF7', text:'#4F6EF7' }],
  DONE:        [{ bg:'#0D2020', border:'#34D399', dot:'#34D399', text:'#34D399' }, { bg:'#F0FDF4', border:'#BBF7D0', dot:'#10B981', text:'#10B981' }],
  CANCELLED:   [{ bg:'#1A0E0E', border:'#EF4444', dot:'#EF4444', text:'#EF4444' }, { bg:'#FEF2F2', border:'#FECACA', dot:'#EF4444', text:'#EF4444' }],
};

// ── Priority badge configs ─────────────────────────────────────────────────────
type PrioCfg = { bg: string; border: string; text: string; label: string };
const PRIO: Record<string, [PrioCfg, PrioCfg]> = {
  // [dark, light]
  HIGH:   [{ bg:'#1A1A2E', border:'#F87171', text:'#F87171', label:'HIGH' }, { bg:'#FEF2F2', border:'#FECACA', text:'#EF4444', label:'HIGH' }],
  MEDIUM: [{ bg:'#1A1500', border:'#FBBF24', text:'#FBBF24', label:'MED'  }, { bg:'#FFFBEB', border:'#FDE68A', text:'#D97706', label:'MED'  }],
  LOW:    [{ bg:'#151A2E', border:'#1C2236', text:'#8B95B0', label:'LOW'  }, { bg:'#F9FAFB', border:'#E5E7EB', text:'#9CA3AF', label:'LOW'  }],
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
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
                    border: `1.5px solid ${allSelected ? '#4F6EF7' : c.headerText}`,
                    background: allSelected ? '#4F6EF7' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.12s',
                  }}
                >
                  {allSelected && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
                          ? (isDark ? '#111A30' : '#F0F1FF')
                          : (isActive ? c.rowActiveBg : c.rowBg),
                        borderBottom: `1px solid ${c.rowBorder}`,
                        borderLeft: isRowSelected
                          ? '3px solid #4F6EF7'
                          : (!isDark && isActive) ? '3px solid #4F6EF7' : 'none',
                        padding: '12px 24px',
                        opacity: isDoneRow ? 0.65 : 1,
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => { if (!isActive && !isRowSelected) (e.currentTarget as HTMLDivElement).style.background = isDark ? '#0D1017' : '#F7F5FD'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isRowSelected ? (isDark ? '#111A30' : '#F0F1FF') : (isActive ? c.rowActiveBg : c.rowBg); }}
                    >
                      {/* Checkbox */}
                      {onToggleSelect && (
                        <div style={{ width: W.checkbox, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          <div
                            onClick={e => { e.stopPropagation(); onToggleSelect(task.id); }}
                            style={{
                              width: 14, height: 14, borderRadius: 3,
                              border: `1.5px solid ${isRowSelected ? '#4F6EF7' : c.keyText}`,
                              background: isRowSelected ? '#4F6EF7' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
                            }}
                          >
                            {isRowSelected && (
                              <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                <path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
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
                              <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 8, fontWeight: 700, color: '#fff' }}>
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
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isDark ? '#0D1017' : '#F7F5FD'; }}
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
