import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import * as tasksApi from '../api/tasks';
import type { MyTask } from '../api/tasks';
import TaskAccordionPanel from '../components/TaskAccordionPanel';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-base)', rowBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)', borderHover: 'var(--brand-8)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', key: 'var(--neutral-8)',
  chipBg: 'var(--static-background-lightest)', chipText: 'var(--static-text-neutral-secondary)',
  chipActive: 'var(--component-fill-info-soft-default)', chipActiveText: 'var(--info-8)',
  searchBg: 'var(--static-background-lightest)', searchBorder: 'var(--static-border-neutral-tertiary)',
  wsBg: 'var(--static-background-base)', sectionBorder: 'var(--static-border-neutral-tertiary)',
};
const LIGHT: C = {
  bg: 'var(--static-background-base)', rowBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)', borderHover: 'var(--brand-8)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', key: 'var(--neutral-6)',
  chipBg: 'var(--static-background-lightest)', chipText: 'var(--static-text-neutral-secondary)',
  chipActive: 'var(--component-fill-info-soft-default)', chipActiveText: 'var(--info-8)',
  searchBg: 'var(--static-background-lightest)', searchBorder: 'var(--static-border-neutral-tertiary)',
  wsBg: 'var(--static-background-light)', sectionBorder: 'var(--static-border-neutral-tertiary)',
};

const PRIO: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: 'var(--component-fill-negative-soft-hover)',   text: 'var(--error-10)' },
  MEDIUM: { bg: 'var(--component-fill-warning-soft-hover)',  text: 'var(--warning-6)' },
  LOW:    { bg: 'var(--component-fill-neutral-soft-default)', text: 'var(--neutral-8)' },
};

// ── Due preset helpers ─────────────────────────────────────────────────────────
type DuePreset = '' | 'today' | 'this_week' | 'overdue' | 'no_date';

// Task IDs are cuid/cuid2 — validated before trusting URL params
const TASK_ID_RE = /^[a-z0-9_-]{10,40}$/i;

// ── Workspace icon colors ──────────────────────────────────────────────────────
const WS_COLORS = ['var(--success-8)', 'var(--brand-8)', 'var(--brand-gold-8)', 'var(--warning-6)', 'var(--brand-7)', 'var(--info-8)'];
function wsColor(name: string): string {
  return WS_COLORS[(name?.charCodeAt(0) ?? 0) % WS_COLORS.length];
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const bp = useBreakpoint();
  const current = useWorkspaceStore((s) => s.current);

  const [allTasks, setAllTasks] = useState<MyTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [duePreset, setDuePreset] = useState<DuePreset>('');
  const [search, setSearch] = useState('');
  const offsetRef = useRef(0);

  // Accordion state — one open at a time; initialized and synced from ?open= URL param
  const rawOpen = searchParams.get('open');
  const [openAccordionId, setOpenAccordionId] = useState<string | null>(
    () => rawOpen && TASK_ID_RE.test(rawOpen) ? rawOpen : null,
  );

  // Keep accordion in sync when URL changes (e.g. browser Back within My Tasks)
  useEffect(() => {
    const id = searchParams.get('open');
    setOpenAccordionId(id && TASK_ID_RE.test(id) ? id : null);
  }, [searchParams]);

  // Ref map for scroll-to-open after tasks load
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const fetchTasks = useCallback(async (preset: DuePreset, q: string, replace: boolean) => {
    const offset = replace ? 0 : offsetRef.current;
    if (replace) setLoading(true); else setLoadingMore(true);
    try {
      const result = await tasksApi.listMyTasks({
        duePreset: preset || undefined,
        search: q.trim() || undefined,
        limit: 100,
        offset,
      });
      setTotal(result.total);
      setAllTasks(prev => replace ? result.tasks : [...prev, ...result.tasks]);
      offsetRef.current = replace ? result.tasks.length : offset + result.tasks.length;
    } catch {
      message.error('Не удалось загрузить задачи');
    } finally {
      if (replace) setLoading(false); else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    offsetRef.current = 0;
    const timer = setTimeout(() => { fetchTasks(duePreset, search, true); }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [duePreset, search]); // fetchTasks is stable (empty useCallback deps)

  // Scroll to restored accordion after tasks load
  useEffect(() => {
    if (!loading && openAccordionId) {
      const el = rowRefs.current.get(openAccordionId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [loading, openAccordionId]);

  // Capture "now" once per render cycle to avoid per-task Date allocation and clock drift
  const now = useMemo(() => new Date(), []);

  const toggleAccordion = useCallback((taskId: string) => {
    setOpenAccordionId((prev) => {
      const next = prev === taskId ? null : taskId;
      setSearchParams(next ? { open: next } : {}, { replace: true });
      return next;
    });
  }, [setSearchParams]);

  const openInBoard = useCallback((task: MyTask) => {
    navigate(
      `/w/${task.board.workspace.slug}/boards/${task.board.prefix.toLowerCase()}` +
        `?from=my-tasks&open=${task.id}`,
      { state: { openTaskId: task.id } },
    );
  }, [navigate]);

  // Group by workspace → board
  const grouped = useMemo(() => {
    const wsMap = new Map<
      string,
      {
        wsId: string;
        wsName: string;
        wsSlug: string;
        boards: Map<string, { boardId: string; boardSlug: string; boardName: string; tasks: MyTask[] }>;
      }
    >();
    for (const t of allTasks) {
      const { workspace, id: boardId, name: boardName, prefix } = t.board;
      if (!wsMap.has(workspace.id)) {
        wsMap.set(workspace.id, {
          wsId: workspace.id,
          wsName: workspace.name,
          wsSlug: workspace.slug,
          boards: new Map(),
        });
      }
      const ws = wsMap.get(workspace.id)!;
      if (!ws.boards.has(boardId)) {
        ws.boards.set(boardId, { boardId, boardSlug: prefix.toLowerCase(), boardName, tasks: [] });
      }
      ws.boards.get(boardId)!.tasks.push(t);
    }
    return Array.from(wsMap.values()).map((ws) => ({
      ...ws,
      boards: Array.from(ws.boards.values()),
    }));
  }, [allTasks]);

  const chips: { value: DuePreset; label: string }[] = [
    { value: '', label: 'Все' },
    { value: 'today', label: 'Сегодня' },
    { value: 'this_week', label: 'Эта неделя' },
    { value: 'overdue', label: 'Просрочено' },
    { value: 'no_date', label: 'Без даты' },
  ];

  const handleBack = () => {
    if (current) {
      navigate(`/w/${current.slug}`);
    } else {
      navigate('/workspaces');
    }
  };

  return (
    <div style={{
      background: c.bg, minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      padding: bp === 'mobile' ? '20px 16px' : '32px 40px',
      fontFamily: '"Inter",system-ui,sans-serif',
    }}>
      {/* ── Back ── */}
      <div
        onClick={handleBack}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 16, width: 'fit-content' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 2.5L4.5 7L9 11.5" stroke={c.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.muted, letterSpacing: '0.02em' }}>Назад</span>
      </div>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <h1 style={{
          margin: 0, fontFamily: '"Space Grotesk",system-ui,sans-serif',
          fontSize: bp === 'mobile' ? 20 : 26, fontWeight: 700, color: c.text, letterSpacing: '-0.02em',
        }}>
          Мои задачи
        </h1>
        {!loading && (
          <span style={{
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
            color: c.chipText, background: c.chipBg,
            borderRadius: 6, padding: '2px 8px',
          }}>
            {total} задач
          </span>
        )}
      </div>

      {/* ── Filter chips row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap',
      }}>
        {chips.map((chip) => {
          const active = duePreset === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => setDuePreset(chip.value)}
              style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                fontWeight: active ? 500 : 400,
                color: active ? c.chipActiveText : c.chipText,
                background: active ? c.chipActive : c.chipBg,
                border: active
                  ? '1px solid var(--component-border-info-medium)'
                  : '1px solid var(--component-border-neutral-low)',
                borderRadius: 7, padding: '5px 12px',
                cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {chip.label}
              {active && total > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.8 }}>· {total}</span>
              )}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"
            style={{ position: 'absolute', left: 10, color: c.muted, pointerEvents: 'none' }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по задачам..."
            style={{
              paddingLeft: 30, paddingRight: 12, paddingBlock: 6,
              width: bp === 'mobile' ? '100%' : 220,
              minWidth: bp === 'mobile' ? 0 : 180,
              fontSize: 12, color: c.text,
              background: c.searchBg, border: `1px solid ${c.searchBorder}`,
              borderRadius: 8, outline: 'none',
              fontFamily: '"Inter",system-ui,sans-serif',
            }}
          />
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            border: `2px solid ${c.border}`, borderTopColor: 'var(--brand-8)',
            animation: 'spin 0.7s linear infinite',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : allTasks.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, gap: 8 }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="18" stroke={c.border} strokeWidth="1.5"/>
            <path d="M13 20h14M20 13v14" stroke={c.muted} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 13, color: c.muted }}>Нет задач по выбранным фильтрам</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {grouped.map((ws) => (
            <div key={ws.wsId}>
              {/* Workspace header */}
              <div
                onClick={() => navigate(`/w/${ws.wsSlug}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  marginBottom: 12, cursor: 'pointer',
                }}
              >
                <div style={{
                  width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                  background: wsColor(ws.wsName),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ color: 'var(--neutral-0)', fontSize: 10, fontWeight: 700 }}>
                    {ws.wsName[0]?.toUpperCase()}
                  </span>
                </div>
                <span style={{
                  fontSize: 14, fontWeight: 600, color: c.text,
                  fontFamily: '"Space Grotesk",system-ui,sans-serif',
                }}>
                  {ws.wsName}
                </span>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3l4 4-4 4" stroke={c.muted} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              {/* Boards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ws.boards.map((board) => (
                  <div key={board.boardId}>
                    {/* Board header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      marginBottom: 6, paddingLeft: 4,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <rect x="1" y="1" width="3" height="10" rx="1" fill={c.muted}/>
                        <rect x="6" y="1" width="3" height="10" rx="1" fill={c.muted} opacity="0.5"/>
                      </svg>
                      <span style={{ fontSize: 11, color: c.muted, fontWeight: 500 }}>
                        {board.boardName}
                      </span>
                    </div>

                    {/* Task rows */}
                    <div style={{
                      borderRadius: 10, overflow: 'hidden',
                      border: `1px solid ${c.border}`,
                    }}>
                      {board.tasks.map((task, idx) => {
                        const isDone = task.status?.category === 'DONE';
                        const due = task.dueDate ? new Date(task.dueDate) : null;
                        const isOverdue = due !== null && due < now && !isDone;
                        const prio = task.priority ? PRIO[task.priority] : null;
                        const statusColor = task.status?.color ?? 'var(--neutral-8)';
                        const isOpen = openAccordionId === task.id;

                        return (
                          <div key={task.id} ref={(el) => { if (el) rowRefs.current.set(task.id, el); else rowRefs.current.delete(task.id); }}>
                            {/* Task row */}
                            <div
                              role="button"
                              tabIndex={0}
                              aria-expanded={isOpen}
                              aria-controls={`accordion-${task.id}`}
                              onClick={() => toggleAccordion(task.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleAccordion(task.id);
                                }
                              }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: bp === 'mobile' ? 8 : 12,
                                padding: bp === 'mobile' ? '10px 12px' : '11px 16px',
                                minWidth: 0,
                                background: isOpen
                                  ? 'var(--static-background-base)'
                                  : isOverdue
                                    ? (mode === 'light' ? 'var(--component-fill-negative-soft-default)' : 'var(--component-fill-negative-soft-default)')
                                    : c.rowBg,
                                borderBottom: (!isOpen && idx < board.tasks.length - 1)
                                  ? `1px solid ${c.border}` : 'none',
                                borderLeft: `3px solid ${isOpen ? 'var(--component-border-info-medium)' : statusColor}`,
                                boxShadow: isOpen ? 'inset 0 0 0 1px var(--component-border-info-medium)' : 'none',
                                cursor: 'pointer', transition: 'background 0.12s, box-shadow 0.12s',
                              }}
                              onMouseEnter={(e) => {
                                if (!isOpen) {
                                  (e.currentTarget as HTMLElement).style.background =
                                    mode === 'light' ? 'var(--static-background-light)' : 'var(--static-background-light)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isOpen) {
                                  (e.currentTarget as HTMLElement).style.background = isOverdue
                                    ? (mode === 'light' ? 'var(--component-fill-negative-soft-default)' : 'var(--component-fill-negative-soft-default)')
                                    : c.rowBg;
                                }
                              }}
                            >
                              {/* Status circle */}
                              <div style={{
                                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: isDone ? 'var(--success-8)' : 'transparent',
                                border: isDone ? 'none' : `2px solid ${statusColor}`,
                              }}>
                                {isDone && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M2 5l2.5 2.5L8 3" stroke="var(--neutral-0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>

                              {/* Key */}
                              <span style={{
                                fontSize: 11, color: c.key, letterSpacing: '0.02em',
                                fontFamily: '"Inter",system-ui,sans-serif',
                                flexShrink: 0, minWidth: 52,
                              }}>
                                {task.issueKey}
                              </span>

                              {/* Title */}
                              <span style={{
                                fontSize: 13, color: isDone ? c.muted : c.text,
                                textDecoration: isDone ? 'line-through' : 'none',
                                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              }}>
                                {task.title}
                              </span>

                              {/* Right side: status + priority + due */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                {task.status && bp !== 'mobile' && (
                                  <span style={{
                                    fontSize: 11, fontWeight: 500,
                                    color: task.status.color,
                                    background: `${task.status.color}18`,
                                    borderRadius: 5, padding: '2px 7px',
                                  }}>
                                    {task.status.name}
                                  </span>
                                )}
                                {prio && bp !== 'mobile' && (
                                  <span style={{
                                    fontSize: 10, fontWeight: 600,
                                    color: prio.text, background: prio.bg,
                                    borderRadius: 4, padding: '2px 6px',
                                    letterSpacing: '0.04em',
                                  }}>
                                    {task.priority === 'MEDIUM' ? 'MED' : task.priority}
                                  </span>
                                )}
                                {due && (
                                  <span style={{
                                    fontSize: 11,
                                    color: isOverdue ? 'var(--error-10)' : c.muted,
                                    whiteSpace: 'nowrap',
                                  }}>
                                    {isOverdue && bp !== 'mobile' ? 'Просрочено · ' : ''}
                                    {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                  </span>
                                )}

                                {/* Chevron — far right, standard accordion position */}
                                <svg
                                  aria-hidden="true"
                                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                                  style={{
                                    flexShrink: 0, marginLeft: 4,
                                    transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s',
                                    color: isOpen ? 'var(--info-8)' : c.muted,
                                  }}
                                >
                                  <path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </div>
                            </div>

                            {/* Accordion panel */}
                            {isOpen && (
                              <TaskAccordionPanel
                                id={`accordion-${task.id}`}
                                task={task}
                                colors={c}
                                isDark={mode === 'dark'}
                                bp={bp}
                                now={now}
                                onOpenInBoard={openInBoard}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load more */}
      {!loading && allTasks.length < total && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
          <button
            onClick={() => fetchTasks(duePreset, search, false)}
            disabled={loadingMore}
            style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
              color: 'var(--brand-8)', background: 'transparent',
              border: '1px solid var(--brand-8)', borderRadius: 8,
              padding: '8px 24px', cursor: 'pointer',
              opacity: loadingMore ? 0.5 : 1,
            }}
          >
            {loadingMore ? 'Загрузка...' : `Загрузить ещё (${total - allTasks.length})`}
          </button>
        </div>
      )}

    </div>
  );
}
