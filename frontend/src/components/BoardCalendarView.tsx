import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F',
  calendarBg: 'transparent', calendarBorder: 'none', calendarRadius: '0',
  divider: '#1C2236',
  headerText: '#8B95B0', headerWeekend: '#4B5280',
  dayText: '#E2E8F8', dayWeekend: '#4B5280', dayOther: '#8B95B0',
  weekendBg: '#0D1017',
  sidebarBg: '#0A0D1A', sidebarBorder: '#1C2236', sidebarLabel: '#8B95B0',
  cardBg: '#0F1320', cardBorder: '#1C2236',
  keyText: '#8B95B0', titleText: '#E2E8F8', emptyText: '#4B5280',
};

const LIGHT: C = {
  bg: '#F5F3FF',
  calendarBg: '#FDFCFF', calendarBorder: '1px solid #E8E5F0', calendarRadius: '12px',
  divider: '#E8E5F0',
  headerText: '#6B7194', headerWeekend: '#6B7194',
  dayText: '#1A1A2E', dayWeekend: '#B0AACC', dayOther: '#B0AACC',
  weekendBg: '#F9F8FC',
  sidebarBg: 'transparent', sidebarBorder: 'transparent', sidebarLabel: '#4F6EF7',
  cardBg: '#FDFCFF', cardBorder: '#E8E5F0',
  keyText: '#6B7194', titleText: '#1A1A2E', emptyText: '#9B96B8',
};

// ── Task chip configs ──────────────────────────────────────────────────────────
type ChipCfg = { bg: string; border: string; text: string };
const CHIP: Record<string, { dark: ChipCfg; light: ChipCfg }> = {
  done:    { dark: { bg:'#0D2020', border:'#34D399', text:'#34D399' }, light: { bg:'#D1FAE5', border:'#10B981', text:'#065F46' } },
  overdue: { dark: { bg:'#1A0A0A', border:'#F87171', text:'#F87171' }, light: { bg:'#FEE2E2', border:'#EF4444', text:'#991B1B' } },
  default: { dark: { bg:'#0D2040', border:'#4F6EF7', text:'#4F6EF7' }, light: { bg:'#EEF0FF', border:'#4F6EF7', text:'#3730A3' } },
};

// ── Priority badge configs ─────────────────────────────────────────────────────
const PRIO: Record<string, { dark: ChipCfg; light: ChipCfg }> = {
  HIGH:   { dark:{bg:'#1A1A2E', border:'#F87171', text:'#F87171'}, light:{bg:'#FEF2F2', border:'#FECACA', text:'#EF4444'} },
  MEDIUM: { dark:{bg:'#1A1500', border:'#FBBF24', text:'#FBBF24'}, light:{bg:'#FEF3C7', border:'transparent', text:'#92400E'} },
  LOW:    { dark:{bg:'#151A2E', border:'#1C2236', text:'#8B95B0'}, light:{bg:'#F0FDF4', border:'#BBF7D0', text:'#166534'} },
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
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
            color: isDark ? '#E2E8F8' : '#1A1A2E',
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
                  color: isDark ? '#8B95B0' : '#6B7194',
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
                            borderRadius: '50%', background: '#4F6EF7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: '"Inter",system-ui,sans-serif',
                            fontSize: isDark ? 12 : 11, fontWeight: 700, color: '#fff',
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
                            letterSpacing: '0.02em', color: isDark ? '#F87171' : '#EF4444',
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
                          color: isDark ? '#8B95B0' : '#6B7194', paddingLeft: 2,
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
          <div style={{ background: '#EEF0FF', borderRadius: 8, padding: '8px 12px' }}>
            <span style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.02em', textTransform: 'uppercase', color: '#4F6EF7',
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
                    <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 7, fontWeight: 700, color: '#fff' }}>
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
