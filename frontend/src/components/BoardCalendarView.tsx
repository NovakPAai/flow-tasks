import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-base)',
  calendarBg: 'transparent', calendarBorder: 'none', calendarRadius: '0',
  divider: 'var(--static-border-neutral-tertiary)',
  headerText: 'var(--static-text-neutral-tertiary)', headerWeekend: 'var(--static-text-neutral-tertiary)',
  dayText: 'var(--static-text-neutral-primary)', dayWeekend: 'var(--static-text-neutral-tertiary)', dayOther: 'var(--static-text-neutral-tertiary)',
  weekendBg: 'var(--static-background-lightest)',
  sidebarBg: 'var(--static-background-base)', sidebarBorder: 'var(--static-border-neutral-tertiary)', sidebarLabel: 'var(--static-text-neutral-tertiary)',
  cardBg: 'var(--static-background-lightest)', cardBorder: 'var(--static-border-neutral-tertiary)',
  keyText: 'var(--static-text-neutral-tertiary)', titleText: 'var(--static-text-neutral-primary)', emptyText: 'var(--static-text-neutral-tertiary)',
};

const LIGHT: C = {
  bg: 'var(--static-background-base)',
  calendarBg: 'var(--static-background-lightest)', calendarBorder: '1px solid var(--static-border-neutral-tertiary)', calendarRadius: '12px',
  divider: 'var(--static-border-neutral-tertiary)',
  headerText: 'var(--static-text-neutral-tertiary)', headerWeekend: 'var(--static-text-neutral-tertiary)',
  dayText: 'var(--static-text-neutral-primary)', dayWeekend: 'var(--neutral-6)', dayOther: 'var(--neutral-6)',
  weekendBg: 'var(--static-background-lightest)',
  sidebarBg: 'transparent', sidebarBorder: 'transparent', sidebarLabel: 'var(--brand-8)',
  cardBg: 'var(--static-background-lightest)', cardBorder: 'var(--static-border-neutral-tertiary)',
  keyText: 'var(--static-text-neutral-tertiary)', titleText: 'var(--static-text-neutral-primary)', emptyText: 'var(--static-text-neutral-tertiary)',
};

// ── Task chip configs ──────────────────────────────────────────────────────────
type ChipCfg = { bg: string; border: string; text: string };
const CHIP: Record<string, { dark: ChipCfg; light: ChipCfg }> = {
  done:    { dark: { bg:'var(--component-fill-positive-soft-default)', border:'var(--success-7)', text:'var(--success-7)' }, light: { bg:'var(--component-fill-positive-soft-default)', border:'var(--success-8)', text:'var(--success-10)' } },
  overdue: { dark: { bg:'var(--component-fill-negative-soft-default)', border:'var(--error-8)', text:'var(--error-8)' }, light: { bg:'var(--component-fill-negative-soft-default)', border:'var(--error-10)', text:'var(--error-10)' } },
  default: { dark: { bg:'var(--component-fill-info-soft-default)', border:'var(--brand-8)', text:'var(--brand-8)' }, light: { bg:'var(--component-fill-info-soft-default)', border:'var(--brand-8)', text:'var(--info-10)' } },
};

// ── Priority badge configs ─────────────────────────────────────────────────────
const PRIO: Record<string, { dark: ChipCfg; light: ChipCfg }> = {
  HIGH:   { dark:{bg:'var(--static-text-neutral-primary)', border:'var(--error-8)', text:'var(--error-8)'}, light:{bg:'var(--component-fill-negative-soft-default)', border:'var(--component-border-negative-medium)', text:'var(--error-10)'} },
  MEDIUM: { dark:{bg:'var(--component-fill-warning-soft-default)', border:'var(--warning-5)', text:'var(--warning-5)'}, light:{bg:'var(--component-fill-warning-soft-default)', border:'transparent', text:'var(--warning-10)'} },
  LOW:    { dark:{bg:'var(--static-background-light)', border:'var(--static-border-neutral-tertiary)', text:'var(--static-text-neutral-tertiary)'}, light:{bg:'var(--component-fill-positive-soft-default)', border:'var(--component-border-positive-medium)', text:'var(--success-10)'} },
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string): string { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

// ── Locale ────────────────────────────────────────────────────────────────────
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS_RU   = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  statuses: WorkflowStatus[];
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BoardCalendarView({ statuses, tasks, onTaskClick }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  // Build 42-cell (6×7) grid, Monday-start
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const cells: Date[] = Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 + i - startDow));

  // Index tasks by date key
  const tasksByDate = tasks.reduce<Record<string, Task[]>>((acc, task) => {
    if (!task.dueDate) return acc;
    const key = new Date(task.dueDate).toISOString().slice(0, 10);
    (acc[key] ??= []).push(task);
    return acc;
  }, {});

  const noDateTasks = tasks.filter(t => !t.dueDate);
  const statusById  = Object.fromEntries(statuses.map(s => [s.id, s]));
  const todayDate   = new Date(); todayDate.setHours(0, 0, 0, 0);
  const todayStr    = dateKey(todayDate);

  function getChip(task: Task): ChipCfg {
    const status = statusById[task.statusId];
    const isDone = status?.category === 'DONE';
    const due    = task.dueDate ? new Date(task.dueDate) : null;
    const over   = due && due < todayDate && !isDone;
    const key    = isDone ? 'done' : over ? 'overdue' : 'default';
    return CHIP[key][isDark ? 'dark' : 'light'];
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: c.bg }}>

      {/* ── Calendar area ── */}
      <div style={{
        flex: 1,
        padding: isDark ? '12px 0 0' : '12px 0 24px 24px',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Month navigation */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: isDark ? '0 24px 12px' : '0 24px 12px 0',
        }}>
          <span style={{
            fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
            color: isDark ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)',
          }}>
            {MONTHS_RU[month]} {year}
          </span>
          <div style={{ display: 'flex', gap: 2 }}>
            {['‹','›'].map((ch, i) => (
              <button
                key={ch}
                onClick={i === 0 ? prevMonth : nextMonth}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '4px 10px', borderRadius: 6,
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 18, lineHeight: 1,
                  color: isDark ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-tertiary)',
                }}
              >
                {ch}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar card */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: c.calendarBg,
          border: c.calendarBorder,
          borderRadius: c.calendarRadius,
          overflow: 'hidden',
        }}>
          {/* Day-of-week header */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${c.divider}`, flexShrink: 0 }}>
            {DAYS_RU.map((day, i) => (
              <div
                key={day}
                style={{
                  flex: 1, textAlign: 'center', padding: '8px 0',
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: (isDark && i >= 5) ? c.headerWeekend : c.headerText,
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {[0,1,2,3,4,5].map(row => (
              <div
                key={row}
                style={{
                  display: 'flex', flex: 1,
                  borderBottom: row < 5 ? `1px solid ${c.divider}` : 'none',
                }}
              >
                {[0,1,2,3,4,5,6].map(col => {
                  const cell       = cells[row * 7 + col];
                  const isCurrent  = cell.getMonth() === month;
                  const isWeekend  = col >= 5;
                  const key        = dateKey(cell);
                  const isToday    = key === todayStr;
                  const dayTasks   = tasksByDate[key] ?? [];
                  const hasOverdue = !isToday && cell < todayDate && dayTasks.some(t => statusById[t.statusId]?.category !== 'DONE');

                  return (
                    <div
                      key={col}
                      style={{
                        flex: 1, minHeight: 80,
                        borderRight: col < 6 ? `1px solid ${c.divider}` : 'none',
                        background: isCurrent && isWeekend ? c.weekendBg : 'transparent',
                        padding: isDark ? '8px' : '6px 8px',
                        opacity: !isCurrent ? 0.4 : 1,
                        overflow: 'hidden',
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                    >
                      {/* Date number */}
                      <div style={{ flexShrink: 0, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isToday ? (
                          <span style={{
                            width: isDark ? 24 : 20, height: isDark ? 24 : 20,
                            borderRadius: '50%', background: 'var(--brand-8)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: '"Inter",system-ui,sans-serif',
                            fontSize: isDark ? 12 : 11, fontWeight: 700, color: 'var(--neutral-0)',
                          }}>
                            {cell.getDate()}
                          </span>
                        ) : (
                          <span style={{
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, lineHeight: '16px',
                            fontWeight: isCurrent && !isWeekend ? 600 : 400,
                            color: !isCurrent ? c.dayOther : isWeekend ? c.dayWeekend : c.dayText,
                          }}>
                            {cell.getDate()}
                          </span>
                        )}
                        {isCurrent && hasOverdue && (
                          <span style={{
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 9, fontWeight: 600,
                            letterSpacing: '0.02em', color: isDark ? 'var(--error-8)' : 'var(--error-10)',
                          }}>
                            просрочено
                          </span>
                        )}
                      </div>

                      {/* Task chips */}
                      {dayTasks.slice(0, 3).map(task => {
                        const chip = getChip(task);
                        return (
                          <div
                            key={task.id}
                            onClick={e => { e.stopPropagation(); onTaskClick(task.id); }}
                            title={`${task.issueKey}: ${task.title}`}
                            style={{
                              display: 'block',
                              background: chip.bg,
                              borderLeft: `3px solid ${chip.border}`,
                              borderTopRightRadius: 4, borderBottomRightRadius: 4,
                              borderTopLeftRadius: isDark ? 0 : 4, borderBottomLeftRadius: isDark ? 0 : 4,
                              padding: `${isDark ? 3 : 2}px 6px`,
                              cursor: 'pointer', overflow: 'hidden',
                            }}
                          >
                            <span style={{
                              fontFamily: '"Inter",system-ui,sans-serif',
                              fontSize: 10, fontWeight: 500, lineHeight: '12px',
                              color: chip.text,
                              display: 'block', overflow: 'hidden',
                              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {task.title}
                            </span>
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <span style={{
                          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10,
                          color: isDark ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-tertiary)', paddingLeft: 2,
                        }}>
                          +{dayTasks.length - 3}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── No due date sidebar ── */}
      <div style={{
        width: 220, flexShrink: 0,
        background: c.sidebarBg,
        borderLeft: isDark ? `1px solid ${c.sidebarBorder}` : 'none',
        padding: '16px',
        display: 'flex', flexDirection: 'column',
        gap: isDark ? 12 : 8,
        overflowY: 'auto',
      }}>
        {/* Section label */}
        {isDark ? (
          <span style={{
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.04em', textTransform: 'uppercase', color: c.sidebarLabel,
          }}>
            Без даты · {noDateTasks.length}
          </span>
        ) : (
          <div style={{ background: 'var(--component-fill-info-soft-default)', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--brand-8)',
            }}>
              Без даты · {noDateTasks.length}
            </span>
          </div>
        )}

        {/* Task cards */}
        {noDateTasks.map(task => {
          const prioKey = task.priority ?? null;
          const prio    = prioKey ? PRIO[prioKey]?.[isDark ? 'dark' : 'light'] : null;
          return (
            <div
              key={task.id}
              onClick={() => onTaskClick(task.id)}
              style={{
                background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                borderRadius: isDark ? 8 : 10, padding: isDark ? '10px' : '10px 12px',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6,
              }}
            >
              <span style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10,
                color: c.keyText, lineHeight: '12px',
              }}>
                {task.issueKey}
              </span>
              <span style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                color: c.titleText, lineHeight: '16px', wordBreak: 'break-word',
              }}>
                {task.title}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {prio && prioKey && (
                  <span style={{
                    fontFamily: '"Inter",system-ui,sans-serif',
                    fontSize: isDark ? 10 : 9, fontWeight: 600,
                    color: prio.text, background: prio.bg, border: `1px solid ${prio.border}`,
                    borderRadius: isDark ? 3 : 4, padding: '1px 5px',
                  }}>
                    {prioKey === 'MEDIUM' ? 'MED' : prioKey}
                  </span>
                )}
                {task.assignee && (
                  <div
                    title={task.assignee.name}
                    style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginLeft: 'auto',
                      background: avatarColor(task.assignee.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 7, fontWeight: 700, color: 'var(--neutral-0)' }}>
                      {avatarInitials(task.assignee.name)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {noDateTasks.length === 0 && (
          <span style={{
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11,
            color: c.emptyText,
          }}>
            Все задачи с датой
          </span>
        )}
      </div>
    </div>
  );
}
