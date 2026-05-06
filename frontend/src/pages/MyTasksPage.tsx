import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import * as tasksApi from '../api/tasks';
import * as boardsApi from '../api/boards';
import * as workspacesApi from '../api/workspaces';
import * as labelsApi from '../api/labels';
import type { MyTask } from '../api/tasks';
import type { WorkflowStatus, WorkspaceMember, Label } from '../types';
import TaskDrawer from '../components/TaskDrawer';

interface BoardContext {
  statuses: WorkflowStatus[];
  members: WorkspaceMember[];
  labels: Label[];
  workspaceId: string;
}

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F', rowBg: '#0F1320', border: '#1C2236', borderHover: '#4F6EF7',
  text: '#E2E8F8', muted: '#8B949E', key: '#484F58',
  chipBg: '#1C2236', chipText: '#8B949E',
  chipActive: 'rgba(79,110,247,0.12)', chipActiveText: '#4F6EF7',
  chipOverdue: 'rgba(239,68,68,0.12)', chipOverdueText: '#EF4444',
  searchBg: '#0F1320', searchBorder: '#1C2236',
  wsBg: '#0A0D1A', sectionBorder: '#1C2236',
};
const LIGHT: C = {
  bg: '#F5F3FF', rowBg: '#FDFCFF', border: '#E8E5F0', borderHover: '#4F6EF7',
  text: '#1A1A2E', muted: '#9B96B8', key: '#B8B3D0',
  chipBg: '#EDE9FE', chipText: '#7C6FA8',
  chipActive: 'rgba(79,110,247,0.10)', chipActiveText: '#4F6EF7',
  chipOverdue: '#FEE2E2', chipOverdueText: '#EF4444',
  searchBg: '#FDFCFF', searchBorder: '#E8E5F0',
  wsBg: '#F0EEF8', sectionBorder: '#E8E5F0',
};

const PRIO: Record<string, { bg: string; text: string }> = {
  HIGH:   { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B' },
  LOW:    { bg: 'rgba(107,114,128,0.12)', text: '#6B7280' },
};

// ── Due preset helpers ─────────────────────────────────────────────────────────
type DuePreset = '' | 'today' | 'this_week' | 'overdue' | 'no_date';

// ── Workspace icon colors ──────────────────────────────────────────────────────
const WS_COLORS = ['#22C55E', '#4F6EF7', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9'];
function wsColor(name: string): string {
  return WS_COLORS[(name?.charCodeAt(0) ?? 0) % WS_COLORS.length];
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function MyTasksPage() {
  const navigate = useNavigate();
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

  // Drawer state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerCtx, setDrawerCtx] = useState<BoardContext | null>(null);
  const [drawerBoardId, setDrawerBoardId] = useState<string | null>(null);
  const boardCtxCache = useRef<Map<string, BoardContext>>(new Map());
  // Tracks the boardId of the in-flight fetch; used to discard stale responses on rapid clicks
  const fetchingBoardIdRef = useRef<string | null>(null);

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
  }, [duePreset, search, fetchTasks]);

  const openDrawer = useCallback(async (task: MyTask) => {
    const { id: boardId, workspace } = task.board;

    const cached = boardCtxCache.current.get(boardId);
    if (cached) {
      setDrawerCtx(cached);
      setDrawerBoardId(boardId);
      setSelectedTaskId(task.id);
      return;
    }

    // Mark this boardId as in-flight; any concurrent click will overwrite this ref
    fetchingBoardIdRef.current = boardId;
    try {
      const [board, members, labels] = await Promise.all([
        boardsApi.getBoard(boardId),
        workspacesApi.listMembers(workspace.id),
        labelsApi.listLabels(workspace.id),
      ]);
      // Discard result if another click started a newer fetch
      if (fetchingBoardIdRef.current !== boardId) return;
      const ctx: BoardContext = {
        statuses: board.workflow.statuses,
        members,
        labels,
        workspaceId: workspace.id,
      };
      boardCtxCache.current.set(boardId, ctx);
      setDrawerCtx(ctx);
      setDrawerBoardId(boardId);
      setSelectedTaskId(task.id);
    } catch {
      if (fetchingBoardIdRef.current === boardId) {
        message.error('Не удалось загрузить данные задачи');
      }
    } finally {
      if (fetchingBoardIdRef.current === boardId) {
        fetchingBoardIdRef.current = null;
      }
    }
  }, []);

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
          const isOverdue = chip.value === 'overdue';
          return (
            <button
              key={chip.value}
              onClick={() => setDuePreset(chip.value)}
              style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                fontWeight: active ? 500 : 400,
                color: isOverdue && active
                  ? c.chipOverdueText
                  : active ? c.chipActiveText : c.chipText,
                background: isOverdue && active
                  ? c.chipOverdue
                  : active ? c.chipActive : c.chipBg,
                border: active
                  ? `1px solid ${isOverdue ? c.chipOverdueText : c.chipActiveText}33`
                  : '1px solid transparent',
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
            border: `2px solid ${c.border}`, borderTopColor: '#4F6EF7',
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
                  <span style={{ color: '#fff', fontSize: 10, fontWeight: 700 }}>
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
                        const isOverdue = due && due < new Date() && !isDone;
                        const prio = task.priority ? PRIO[task.priority] : null;
                        const statusColor = task.status?.color ?? '#484F58';

                        return (
                          <div
                            key={task.id}
                            onClick={() => openDrawer(task)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: bp === 'mobile' ? 8 : 12,
                              padding: bp === 'mobile' ? '10px 12px' : '11px 16px',
                              minWidth: 0,
                              background: isOverdue
                                ? (mode === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.05)')
                                : c.rowBg,
                              borderBottom: idx < board.tasks.length - 1
                                ? `1px solid ${c.border}` : 'none',
                              borderLeft: `3px solid ${statusColor}`,
                              cursor: 'pointer', transition: 'background 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background =
                                mode === 'light' ? '#F0EEF8' : '#131729';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = isOverdue
                                ? (mode === 'light' ? 'rgba(239,68,68,0.04)' : 'rgba(239,68,68,0.05)')
                                : c.rowBg;
                            }}
                          >
                            {/* Status circle */}
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: isDone ? '#22C55E' : 'transparent',
                              border: isDone ? 'none' : `2px solid ${statusColor}`,
                            }}>
                              {isDone && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                              {/* Status badge — hidden on mobile to save space */}
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

                              {/* Priority badge — hidden on mobile */}
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

                              {/* Due date — compact on mobile */}
                              {due ? (
                                <span style={{
                                  fontSize: 11,
                                  color: isOverdue ? '#EF4444' : c.muted,
                                  whiteSpace: 'nowrap',
                                }}>
                                  {isOverdue && bp !== 'mobile' ? 'Просрочено · ' : ''}
                                  {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                                </span>
                              ) : null}
                            </div>
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
              color: '#4F6EF7', background: 'transparent',
              border: '1px solid #4F6EF7', borderRadius: 8,
              padding: '8px 24px', cursor: 'pointer',
              opacity: loadingMore ? 0.5 : 1,
            }}
          >
            {loadingMore ? 'Загрузка...' : `Загрузить ещё (${total - allTasks.length})`}
          </button>
        </div>
      )}

      <TaskDrawer
        taskId={selectedTaskId}
        statuses={drawerCtx?.statuses ?? []}
        members={drawerCtx?.members ?? []}
        workspaceId={drawerCtx?.workspaceId}
        boardId={drawerBoardId ?? undefined}
        workspaceLabels={drawerCtx?.labels ?? []}
        onClose={() => {
          setSelectedTaskId(null);
          setDrawerBoardId(null);
          setDrawerCtx(null);
        }}
        onUpdated={(updated) =>
          setAllTasks((prev) =>
            prev.map((t) =>
              t.id === updated.id ? { ...t, ...updated, board: t.board } : t,
            ),
          )
        }
        onDeleted={(id) =>
          setAllTasks((prev) => prev.filter((t) => t.id !== id))
        }
      />
    </div>
  );
}
