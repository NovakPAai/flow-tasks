import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  DragDropContext, Droppable, Draggable, type DropResult, type DragStart,
} from '@hello-pangea/dnd';
import { message } from 'antd';
import { EMPTY_FILTERS } from '../types';
import type { Board, FilterState, Task, WorkflowStatus, WorkspaceMember, Label } from '../types';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import * as boardsApi from '../api/boards';
import * as tasksApi from '../api/tasks';
import * as workspacesApi from '../api/workspaces';
import * as labelsApi from '../api/labels';
import { useBreakpoint, useIsLandscape } from '../utils/useBreakpoint';
import { useAuthStore } from '../store/auth.store';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';
import WorkflowEditor from '../components/WorkflowEditor';
import BoardListView from '../components/BoardListView';
import BoardCalendarView from '../components/BoardCalendarView';
import RoadmapView from '../components/RoadmapView';
import FilterBar from '../components/FilterBar';
import BulkActionBar from '../components/BulkActionBar';

type ViewMode = 'board' | 'list' | 'calendar' | 'roadmap';

const TASK_ID_RE = /^[a-z0-9_-]{10,40}$/i;
type Columns = Record<string, Task[]>;

function groupByStatus(tasks: Task[], statuses: WorkflowStatus[]): Columns {
  const cols: Columns = {};
  for (const s of statuses) cols[s.id] = [];
  for (const t of tasks) {
    if (cols[t.statusId]) cols[t.statusId].push(t);
    else cols[t.statusId] = [t];
  }
  for (const id of Object.keys(cols)) cols[id].sort((a, b) => a.orderIndex - b.orderIndex);
  return cols;
}

function columnsToList(columns: Columns): Task[] {
  return Object.values(columns).flat();
}

/** Map non-empty filter fields to API query params (statusId omitted — columns have it) */
function toApiParams(f: FilterState): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.search)     p.search     = f.search;
  if (f.priority)   p.priority   = f.priority;
  if (f.assigneeId) p.assigneeId = f.assigneeId;
  if (f.labelId)    p.labelId    = f.labelId;
  if (f.duePreset)  p.duePreset  = f.duePreset;
  return p;
}

function isFilterActive(f: FilterState): boolean {
  return !!(f.search || f.priority || f.assigneeId || f.labelId || f.duePreset);
}

// ── View icons ─────────────────────────────────────────────────────────────────
function KanbanIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="4" height="12" rx="1.5" fill={active ? color : 'currentColor'} opacity={active ? 1 : 0.4}/>
      <rect x="6" y="1" width="4" height="8" rx="1.5" fill={active ? color : 'currentColor'} opacity={active ? 1 : 0.4}/>
      <rect x="11" y="1" width="2" height="10" rx="1" fill={active ? color : 'currentColor'} opacity={active ? 1 : 0.3}/>
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 3.5h10M2 7h10M2 10.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function CalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="2" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M1 5.5h12M4.5 1v2M9.5 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ── ColumnsBtn ────────────────────────────────────────────────────────────────
function ColumnsBtn({ onClick, border, addText }: { onClick: () => void; border: string; addText: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Управление колонками"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 34,
        padding: '0 12px',
        background: hovered ? 'rgba(79,110,247,0.08)' : 'transparent',
        border: `1px solid ${hovered ? 'rgba(79,110,247,0.4)' : border}`,
        borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="3.5" height="12" rx="1.5" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2"/>
        <rect x="5.5" y="1" width="3.5" height="12" rx="1.5" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2"/>
        <rect x="10" y="1" width="3.5" height="12" rx="1.5" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2" strokeDasharray="2 1.5"/>
        <path d="M11.75 5v4M9.75 7h4" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: hovered ? '#4F6EF7' : addText, transition: 'color 0.15s' }}>Колонки</span>
    </button>
  );
}

// ── BoardSettingsBtn ───────────────────────────────────────────────────────────
function BoardSettingsBtn({ onClick, border, addText, isPrivate }: {
  onClick: () => void; border: string; addText: string; isPrivate: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Настройки доски"
      style={{
        display: 'flex', alignItems: 'center', gap: 6, height: 34,
        padding: '0 12px',
        background: hovered ? 'rgba(79,110,247,0.08)' : 'transparent',
        border: `1px solid ${hovered ? 'rgba(79,110,247,0.4)' : border}`,
        borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M13.3 6.6l-.7-.4a5.1 5.1 0 0 0 0-1.4l.7-.4a.6.6 0 0 0 .2-.8l-.8-1.4a.6.6 0 0 0-.8-.2l-.7.4a5 5 0 0 0-1.2-.7V1a.6.6 0 0 0-.6-.6H7.6A.6.6 0 0 0 7 1v.7a5 5 0 0 0-1.2.7l-.7-.4a.6.6 0 0 0-.8.2L3.5 3.6a.6.6 0 0 0 .2.8l.7.4a5.1 5.1 0 0 0 0 1.4l-.7.4a.6.6 0 0 0-.2.8l.8 1.4c.2.3.5.4.8.2l.7-.4c.4.3.8.5 1.2.7V10a.6.6 0 0 0 .6.6h1.6a.6.6 0 0 0 .6-.6v-.7c.4-.2.8-.4 1.2-.7l.7.4c.3.2.6.1.8-.2l.8-1.4a.6.6 0 0 0-.2-.8Z" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: hovered ? '#4F6EF7' : addText, transition: 'color 0.15s' }}>Настройки</span>
      {isPrivate && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.7 }}>
          <path d="M9.5 5.5H2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2"/>
          <path d="M4 5.5V3.5a2 2 0 1 1 4 0v2" stroke={hovered ? '#4F6EF7' : addText} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      )}
    </button>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const { slug, boardSlug } = useParams<{ slug: string; boardSlug: string }>();
  const navigate = useNavigate();
  const bp         = useBreakpoint();
  const isMobile   = bp === 'mobile';
  const isLandscape = useIsLandscape();
  const isCompact   = isMobile && isLandscape;

  const mode = useThemeStore(s => s.mode);
  const workspaces = useWorkspaceStore(s => s.workspaces);
  const wsLoading = useWorkspaceStore(s => s.loading);
  const wsId = workspaces.find(w => w.slug === slug)?.id;
  const isDark = mode === 'dark';

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const pageBg    = isDark ? '#03050F' : '#F5F3FF';
  const headerBg  = isDark ? '#03050F' : '#F5F3FF';
  const border    = isDark ? '#1C2236' : '#E8E5F0';
  const nameColor = isDark ? '#E2E8F8' : '#1A1A2E';
  const cntBg     = isDark ? '#1C2236' : '#EDE9FE';
  const cntText   = isDark ? '#8B949E' : '#7C6FA8';
  const colText   = isDark ? '#E2E8F8' : '#1A1A2E';
  const addText   = isDark ? '#484F58' : '#9B96B8';
  const dropOver  = isDark ? '#1C2236' : '#EDE9FE';
  const inpBg     = isDark ? '#0F1320' : '#FDFCFF';
  const inpBorder = isDark ? '#4F6EF7' : '#4F6EF7';
  const colBg     = isDark ? '#07091A' : '#F7F5FF';
  const viewActive= '#4F6EF7';

  // ── State ─────────────────────────────────────────────────────────────────
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const fromMyTasks = searchParams.get('from') === 'my-tasks';
  const rawMyTasksOpen = searchParams.get('open');
  const myTasksOpenId = rawMyTasksOpen && TASK_ID_RE.test(rawMyTasksOpen) ? rawMyTasksOpen : null;
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const v = searchParams.get('view');
    return (v === 'roadmap' || v === 'list' || v === 'calendar') ? v : 'board';
  });

  // Auto-open drawer when navigated from accordion "Открыть" or notification
  useEffect(() => {
    const state = location.state as { openTaskId?: string } | null;
    if (state?.openTaskId) {
      setSelectedTaskId(state.openTaskId);
      // Use React Router navigate to clear state so back-navigation doesn't re-trigger
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [wfEditorOpen, setWfEditorOpen] = useState(false);
  const [draggingFromStatusId, setDraggingFromStatusId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [columnOffsets, setColumnOffsets] = useState<Record<string, number>>({});
  const [columnTotals, setColumnTotals] = useState<Record<string, number>>({});
  const [loadingMoreCols, setLoadingMoreCols] = useState<Set<string>>(new Set());
  const [filterLoading, setFilterLoading] = useState(false);
  const hadActiveFiltersRef = useRef(false);
  const filterFetchIdRef = useRef(0);
  const lastBoardIdRef = useRef<string | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const currentUserId = useAuthStore(s => s.user?.id);
  const myRole = members.find(m => m.userId === currentUserId)?.role ?? null;
  const isOwner = myRole === 'OWNER';
  const canEdit = myRole === 'OWNER' || myRole === 'MEMBER';
  const statuses = board?.workflow.statuses ?? [];

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    if (!boardSlug) { setLoading(false); return; }
    if (!wsId) {
      if (!wsLoading) setLoading(false); // store loaded but workspace not found
      return;
    }
    try {
      const b = await boardsApi.getBoardByPrefix(wsId, boardSlug);
      setBoard(b);
      const cols = groupByStatus(b.tasks ?? [], b.workflow.statuses);
      setColumns(cols);
      setColumnOffsets(Object.fromEntries(
        b.workflow.statuses.map(s => [s.id, cols[s.id]?.length ?? 0])
      ));
      // For columns that hit the 100-task cap, fetch real totals so the load-more button is shown
      const fullCols = b.workflow.statuses.filter(s => (cols[s.id]?.length ?? 0) >= 100);
      if (fullCols.length > 0) {
        const totals = await Promise.all(
          fullCols.map(s =>
            tasksApi.listTasks(b.id, { statusId: s.id, rootOnly: 'true', limit: '1', offset: '0' })
              .then(r => [s.id, r.total] as const)
              .catch(() => [s.id, 100] as const)
          )
        );
        setColumnTotals(Object.fromEntries(totals));
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 403) { setNotFound(true); }
      else { message.error('Не удалось загрузить доску'); }
    }
    finally { setLoading(false); }
  }, [wsId, wsLoading, boardSlug]);

  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    if (!board?.workspaceId) return;
    const wid = board.workspaceId;
    Promise.all([workspacesApi.listMembers(wid), labelsApi.listLabels(wid)])
      .then(([m, l]) => { setMembers(m); setLabels(l); })
      .catch(() => {});
  }, [board?.workspaceId]);

  useEffect(() => {
    if (addingTo) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addingTo]);

  // ── Server-side filters ───────────────────────────────────────────────────
  const fetchFilteredColumns = useCallback(async (f: FilterState, b: Board) => {
    const fetchId = ++filterFetchIdRef.current;
    const params = toApiParams(f);
    setFilterLoading(true);
    try {
      const results = await Promise.all(
        b.workflow.statuses.map(s =>
          tasksApi.listTasks(b.id, { ...params, statusId: s.id, rootOnly: 'true', limit: '100', offset: '0' })
            .then(r => [s.id, r] as const),
        ),
      );
      if (fetchId !== filterFetchIdRef.current) return; // discard stale response
      const newCols: Columns = {};
      const newOffsets: Record<string, number> = {};
      const newTotals: Record<string, number> = {};
      for (const [sid, { tasks, total }] of results) {
        newCols[sid] = tasks;
        newOffsets[sid] = tasks.length;
        if (total > tasks.length) newTotals[sid] = total;
      }
      setColumns(newCols);
      setColumnOffsets(newOffsets);
      setColumnTotals(newTotals);
    } catch {
      if (fetchId === filterFetchIdRef.current) {
        message.error('Не удалось применить фильтры');
      }
    } finally {
      if (fetchId === filterFetchIdRef.current) setFilterLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!board) return;
    // Reset guard when navigating to a different board
    if (board.id !== lastBoardIdRef.current) {
      lastBoardIdRef.current = board.id;
      hadActiveFiltersRef.current = false;
    }
    const active = isFilterActive(filters);
    if (!active) {
      if (hadActiveFiltersRef.current) {
        hadActiveFiltersRef.current = false;
        loadBoard();
      }
      return;
    }
    hadActiveFiltersRef.current = true;
    const timer = setTimeout(
      () => { fetchFilteredColumns(filters, board); },
      filters.search ? 300 : 0,
    );
    return () => clearTimeout(timer);
  }, [filters, board, loadBoard, fetchFilteredColumns]);

  // ── DnD ───────────────────────────────────────────────────────────────────
  const onDragStart = (start: DragStart) => {
    setDraggingFromStatusId(start.source.droppableId);
  };

  const onDragEnd = async (result: DropResult) => {
    setDraggingFromStatusId(null);
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const fromStatusId = source.droppableId;
    const toStatusId = destination.droppableId;

    if (fromStatusId !== toStatusId && board?.workflow.transitions) {
      const allowed = board.workflow.transitions.some(
        t => t.fromStatusId === fromStatusId && t.toStatusId === toStatusId,
      );
      if (!allowed) { message.warning('Переход не разрешён правилами workflow'); return; }
    }

    const newCols = { ...columns };
    const fromCol = [...(newCols[fromStatusId] ?? [])];
    const toCol = fromStatusId === toStatusId ? fromCol : [...(newCols[toStatusId] ?? [])];
    const [moved] = fromCol.splice(source.index, 1);
    toCol.splice(destination.index, 0, { ...moved, statusId: toStatusId });

    if (fromStatusId === toStatusId) {
      newCols[fromStatusId] = toCol;
    } else {
      newCols[fromStatusId] = fromCol;
      newCols[toStatusId] = toCol;
    }
    setColumns(newCols);

    const updates: { id: string; statusId: string; orderIndex: number }[] = [];
    for (const [sid, tasks] of Object.entries(newCols)) {
      if (sid === fromStatusId || sid === toStatusId) {
        tasks.forEach((t, i) => updates.push({ id: t.id, statusId: sid, orderIndex: i }));
      }
    }
    try {
      await tasksApi.reorderTasks(board!.id, updates);
    } catch {
      message.error('Не удалось сохранить порядок');
      loadBoard();
    }
  };

  // ── Load more (column pagination) ────────────────────────────────────────
  const loadMoreColumn = async (statusId: string) => {
    if (!board || loadingMoreCols.has(statusId) || filterLoading) return;
    const offset = columnOffsets[statusId] ?? 0;
    // Snapshot active filters so a mid-flight filter change doesn't corrupt results
    const snapshotParams = toApiParams(filters);
    const snapshotFetchId = filterFetchIdRef.current;
    setLoadingMoreCols(prev => new Set(prev).add(statusId));
    try {
      const { tasks: more, total } = await tasksApi.listTasks(board.id, { ...snapshotParams, statusId, offset: String(offset), limit: '100', rootOnly: 'true' });
      // Discard if a new filter fetch has started since we began
      if (filterFetchIdRef.current !== snapshotFetchId) return;
      setColumns(prev => ({ ...prev, [statusId]: [...(prev[statusId] ?? []), ...more] }));
      setColumnOffsets(prev => ({ ...prev, [statusId]: offset + more.length }));
      setColumnTotals(prev => ({ ...prev, [statusId]: total }));
    } catch { message.error('Не удалось загрузить задачи'); }
    finally { setLoadingMoreCols(prev => { const s = new Set(prev); s.delete(statusId); return s; }); }
  };

  // ── Quick add ─────────────────────────────────────────────────────────────
  const submitAdd = async (statusId: string) => {
    if (!addTitle.trim()) { setAddingTo(null); return; }
    try {
      const task = await tasksApi.createTask(board!.id, { title: addTitle.trim(), statusId });
      setColumns(prev => ({ ...prev, [statusId]: [...(prev[statusId] ?? []), task] }));
      setAddTitle('');
      setAddingTo(null);
    } catch { message.error('Не удалось создать задачу'); }
  };

  // ── Task updates ──────────────────────────────────────────────────────────
  const onTaskUpdated = (updated: Task) => {
    setColumns(prev => {
      const newCols = { ...prev };
      for (const [sid, tasks] of Object.entries(newCols)) {
        const idx = tasks.findIndex(t => t.id === updated.id);
        if (idx !== -1) {
          const arr = [...tasks];
          const mergedTask = { ...arr[idx], ...updated };
          arr[idx] = mergedTask;
          if (updated.statusId !== sid) {
            arr.splice(idx, 1);
            newCols[sid] = arr;
            newCols[updated.statusId] = [...(newCols[updated.statusId] ?? []), mergedTask];
          } else {
            newCols[sid] = arr;
          }
          break;
        }
      }
      return newCols;
    });
  };

  const onTaskDeleted = (taskId: string) => {
    setColumns(prev => {
      const newCols = { ...prev };
      for (const [sid, tasks] of Object.entries(newCols)) {
        newCols[sid] = tasks.filter(t => t.id !== taskId);
      }
      return newCols;
    });
  };

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = (ids: string[]) => {
    setSelectedTaskIds(ids.length === 0 ? new Set() : new Set(ids));
  };

  // ── Bulk operations ───────────────────────────────────────────────────────
  const handleBulkUpdate = async (patch: { statusId?: string; assigneeId?: string | null; priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null }) => {
    if (!board || selectedTaskIds.size === 0) return;
    const ids = [...selectedTaskIds];
    try {
      await tasksApi.bulkUpdateTasks(board.id, { ids, patch });

      setColumns(prev => {
        const idSet = new Set(ids);
        // Apply patch to all selected tasks
        const allUpdated: Task[] = [];
        for (const tasks of Object.values(prev)) {
          for (const t of tasks) {
            if (!idSet.has(t.id)) {
              allUpdated.push(t);
            } else {
              const updated = { ...t };
              if (patch.statusId !== undefined) updated.statusId = patch.statusId!;
              if (patch.priority !== undefined) updated.priority = patch.priority ?? undefined;
              if (patch.assigneeId !== undefined) {
                if (patch.assigneeId === null) {
                  updated.assignee = undefined;
                } else {
                  const m = members.find(mb => mb.userId === patch.assigneeId);
                  updated.assignee = m ? { id: m.userId, name: m.user.name, avatar: m.user.avatar } : undefined;
                }
              }
              allUpdated.push(updated);
            }
          }
        }
        // Redistribute into columns by current statusId
        const newCols: Columns = {};
        for (const sid of Object.keys(prev)) newCols[sid] = [];
        for (const t of allUpdated) {
          if (!newCols[t.statusId]) newCols[t.statusId] = [];
          newCols[t.statusId].push(t);
        }
        return newCols;
      });

      setSelectedTaskIds(new Set());
      message.success(`Обновлено ${ids.length} задач`);
    } catch {
      message.error('Не удалось обновить задачи');
    }
  };

  const handleBulkDelete = async () => {
    if (!board || selectedTaskIds.size === 0) return;
    const ids = [...selectedTaskIds];
    try {
      await tasksApi.bulkDeleteTasks(board.id, ids);
      setSelectedTaskIds(new Set());
      message.success(`Удалено ${ids.length} задач`);
      // Reload to remove deleted subtasks that aren't in selection
      loadBoard();
    } catch {
      message.error('Не удалось удалить задачи');
    }
  };

  // ── Filtered data ─────────────────────────────────────────────────────────
  // Server already applied search/priority/assignee/label/due filters.
  // Only statusId is applied client-side (column visibility / list view).
  const allTasks = useMemo(() => columnsToList(columns), [columns]);
  const filteredTasks = useMemo(
    () => filters.statusId ? allTasks.filter(t => t.statusId === filters.statusId) : allTasks,
    [allTasks, filters.statusId],
  );
  const hasMoreTasks = useMemo(
    () => Object.entries(columnTotals).some(([sid, total]) => (columns[sid]?.length ?? 0) < total),
    [columnTotals, columns],
  );
  const filteredColumns = useMemo(() => {
    if (!filters.statusId) return columns;
    const result: Columns = {};
    for (const sid of Object.keys(columns)) {
      result[sid] = sid === filters.statusId ? columns[sid] : [];
    }
    return result;
  }, [columns, filters.statusId]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: pageBg }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${border}`, borderTopColor: '#4F6EF7', borderRadius: '50%', animation: 'ft-spin 0.8s linear infinite' }} />
        <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (notFound || (!loading && !board)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, background: pageBg }}>
        <div style={{ fontSize: 15, color: isDark ? '#8B949E' : '#9B96B8', fontFamily: '"Inter",system-ui,sans-serif' }}>Доска не найдена</div>
        <button onClick={() => navigate(-1)} style={{ fontSize: 13, color: '#4F6EF7', background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}>← Назад</button>
      </div>
    );
  }
  if (!board) return null;

  const viewBtns: { mode: ViewMode; icon: React.ReactNode; title: string }[] = [
    { mode: 'board',    title: 'Канбан',        icon: <KanbanIcon active={viewMode === 'board'} color={viewActive} /> },
    { mode: 'list',     title: 'Список',         icon: <ListIcon /> },
    { mode: 'calendar', title: 'Календарь',      icon: <CalIcon /> },
    { mode: 'roadmap',  title: 'Дорожная карта', icon: (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <line x1="1" y1="4"   x2="9"  y2="4"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="2" y1="11"  x2="10" y2="11"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )},
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: pageBg }}>
      <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Board header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
        padding: isCompact ? '6px 16px' : isMobile ? '12px 16px' : '16px 24px',
        background: headerBg, borderBottom: `1px solid ${border}`,
        flexShrink: 0, minWidth: 0, overflow: 'hidden',
      }}>
        {/* Back */}
        <button
          onClick={() => fromMyTasks
            ? navigate(`/my-tasks${myTasksOpenId ? `?open=${myTasksOpenId}` : ''}`)
            : navigate(-1)
          }
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', gap: 4, color: addText, flexShrink: 0 }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {fromMyTasks && (
            <span style={{ fontSize: 12, fontFamily: '"Inter",system-ui,sans-serif', color: addText }}>
              Мои задачи
            </span>
          )}
        </button>

        {/* Board name + task count */}
        <h1 style={{
          fontFamily: '"Space Grotesk",system-ui,sans-serif',
          fontSize: isCompact ? 14 : isMobile ? 16 : 18, fontWeight: 700, color: nameColor,
          margin: 0, letterSpacing: '-0.3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0, flex: isMobile ? '1 1 0' : undefined,
        }}>
          {board.name}
        </h1>
        {!isMobile && (
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: cntText, background: cntBg, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
            {allTasks.length}{hasMoreTasks ? '+' : ''} задач
          </span>
        )}

        <div style={{ flex: isMobile ? undefined : 1 }} />

        {/* View switcher */}
        <div style={{ display: 'flex', gap: 2, background: isDark ? '#0F1320' : '#EDE9FE', borderRadius: 10, padding: 3 }}>
          {viewBtns.map(btn => (
            <button
              key={btn.mode}
              onClick={() => setViewMode(btn.mode)}
              title={btn.title}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 28, border: 'none', cursor: 'pointer', borderRadius: 7,
                background: viewMode === btn.mode ? (isDark ? '#1C2236' : '#FFFFFF') : 'transparent',
                color: viewMode === btn.mode ? viewActive : (isDark ? '#484F58' : '#9B96B8'),
                boxShadow: viewMode === btn.mode ? (isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.08)') : 'none',
                transition: 'all 0.12s',
              }}
            >
              {btn.icon}
            </button>
          ))}
        </div>

        {/* Columns / workflow editor */}
        {!isMobile && (
          <ColumnsBtn onClick={() => setWfEditorOpen(true)} border={border} addText={addText} />
        )}

        {/* Board settings button */}
        <BoardSettingsBtn
          onClick={() => navigate(`settings`)}
          border={border}
          addText={addText}
          isPrivate={board.isPrivate}
        />

        {/* Создать task button */}
        <button
          data-onboarding="create-task"
          onClick={() => { if (statuses.length > 0) { setAddingTo(statuses[0].id); setAddTitle(''); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#4F6EF7', border: 'none', borderRadius: 8, padding: isMobile ? '7px 10px' : '7px 14px', cursor: 'pointer', flexShrink: 0 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          {!isMobile && <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff' }}>Создать</span>}
        </button>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <FilterBar
        filters={filters}
        statuses={statuses}
        members={members}
        labels={labels}
        onChange={setFilters}
      />
      {filterLoading && (
        <>
          <style>{`@keyframes ft-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}`}</style>
          <div style={{ height: 2, backgroundImage: 'linear-gradient(90deg,#4F6EF7,#7C3AED,#4F6EF7)', backgroundSize: '200% 100%', borderRadius: 1, animation: 'ft-shimmer 1.2s linear infinite' }} />
        </>
      )}

      {/* ── View content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: viewMode === 'board' || viewMode === 'roadmap' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Kanban */}
        {viewMode === 'board' && (
          <div style={{ overflowX: 'auto', padding: isMobile ? '12px 16px' : '24px', height: '100%', WebkitOverflowScrolling: 'touch' }}>
            <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
                {statuses.map(status => {
                  const tasks = filteredColumns[status.id] ?? [];
                  const isDropAllowed = !draggingFromStatusId
                    || draggingFromStatusId === status.id
                    || !board.workflow.transitions
                    || board.workflow.transitions.some(
                      t => t.fromStatusId === draggingFromStatusId && t.toStatusId === status.id,
                    );

                  return (
                    <div
                      key={status.id}
                      style={{
                        flex: '1 1 0', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 0,
                        background: colBg,
                        border: `1px solid ${border}`,
                        borderRadius: 12,
                        padding: '10px 8px 8px',
                        opacity: draggingFromStatusId && !isDropAllowed ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Column header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 4px 8px' }}>
                        <div style={{ width: 3, height: 18, borderRadius: 2, background: status.color, flexShrink: 0 }} />
                        <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: colText, flex: 1 }}>
                          {status.name}
                        </span>
                        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: cntText, background: cntBg, borderRadius: 5, padding: '1px 7px' }}>
                          {tasks.length}
                        </span>
                        <button
                          onClick={() => { setAddingTo(status.id); setAddTitle(''); }}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: addText, padding: 2, display: 'flex', alignItems: 'center' }}
                          title="Добавить задачу"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Quick add — above cards */}
                      {addingTo === status.id ? (
                        <input
                          ref={addInputRef}
                          value={addTitle}
                          onChange={e => setAddTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') submitAdd(status.id); if (e.key === 'Escape') { setAddingTo(null); setAddTitle(''); } }}
                          onBlur={() => { setAddingTo(null); setAddTitle(''); }}
                          placeholder="Название задачи..."
                          style={{
                            background: inpBg, border: `1px solid ${inpBorder}`,
                            borderRadius: 8, padding: '8px 10px',
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
                            color: nameColor, outline: 'none', width: '100%',
                            marginBottom: 8, boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <button
                          onClick={() => { setAddingTo(status.id); setAddTitle(''); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'transparent', border: `1px dashed ${border}`,
                            borderRadius: 8, padding: '8px 10px',
                            cursor: 'pointer', width: '100%',
                            marginBottom: 8, boxSizing: 'border-box',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 1v10M1 6h10" stroke={addText} strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: addText }}>
                            Быстрое добавление...
                          </span>
                        </button>
                      )}

                      <Droppable droppableId={status.id} isDropDisabled={!!draggingFromStatusId && !isDropAllowed}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{
                              flex: 1, minHeight: 80, borderRadius: 10, padding: 4,
                              overflowY: 'auto',
                              background: snapshot.isDraggingOver ? dropOver : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            {tasks.map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(drag, snap) => (
                                  <div
                                    ref={drag.innerRef}
                                    {...drag.draggableProps}
                                    {...drag.dragHandleProps}
                                    style={{ marginBottom: 8, opacity: snap.isDragging ? 0.85 : 1, ...drag.draggableProps.style }}
                                  >
                                    <TaskCard
                                      task={task}
                                      onClick={() => setSelectedTaskId(task.id)}
                                      isSelected={selectedTaskIds.has(task.id)}
                                      onSelect={toggleSelect}
                                      canEdit={canEdit}
                                      onTaskUpdated={onTaskUpdated}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                      {/* Load more button — shown when server has more tasks than loaded */}
                      {columnTotals[status.id] !== undefined && (columns[status.id]?.length ?? 0) < columnTotals[status.id] && (
                        <button
                          onClick={() => loadMoreColumn(status.id)}
                          disabled={loadingMoreCols.has(status.id)}
                          style={{
                            marginTop: 4, width: '100%', background: 'transparent',
                            border: `1px dashed ${border}`, borderRadius: 8,
                            padding: '6px 10px', cursor: 'pointer',
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                            color: addText, opacity: loadingMoreCols.has(status.id) ? 0.5 : 1,
                          }}
                        >
                          {loadingMoreCols.has(status.id) ? 'Загрузка...' : `Загрузить ещё (${columnTotals[status.id] - (columns[status.id]?.length ?? 0)})`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          </div>
        )}

        {/* List */}
        {viewMode === 'list' && (
          <BoardListView
            statuses={statuses}
            tasks={filteredTasks}
            onTaskClick={setSelectedTaskId}
            onTaskUpdated={onTaskUpdated}
            canEdit={canEdit}
            quickAddStatusId={addingTo}
            quickAddTitle={addTitle}
            onQuickAddStart={sid => { setAddingTo(sid); setAddTitle(''); }}
            onQuickAddChange={setAddTitle}
            onQuickAddSubmit={submitAdd}
            selectedTaskIds={selectedTaskIds}
            onToggleSelect={toggleSelect}
            onSelectAll={selectAll}
          />
        )}

        {/* Calendar */}
        {viewMode === 'calendar' && (
          <BoardCalendarView
            statuses={statuses}
            tasks={filteredTasks}
            onTaskClick={setSelectedTaskId}
          />
        )}

        {/* Roadmap */}
        {viewMode === 'roadmap' && (
          <RoadmapView
            boardId={board.id}
            statuses={statuses}
          />
        )}
      </div>

      {/* Bulk action bar */}
      {selectedTaskIds.size > 0 && (
        <BulkActionBar
          count={selectedTaskIds.size}
          statuses={statuses}
          members={members}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          onClose={() => setSelectedTaskIds(new Set())}
        />
      )}

      {/* Task drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        statuses={statuses}
        members={members}
        workspaceId={board.workspaceId}
        boardId={board.id}
        workspaceLabels={labels}
        onWorkspaceLabelCreated={label => setLabels(prev => [...prev, label])}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={onTaskUpdated}
        onDeleted={onTaskDeleted}
      />

      {/* Workflow / columns editor modal */}
      {wfEditorOpen && board.workflow && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setWfEditorOpen(false); loadBoard(); } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(0,0,0,0.55)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div style={{
            width: 'min(92vw, 1200px)',
            height: 'min(88vh, 860px)',
            display: 'flex', flexDirection: 'column',
            background: isDark ? '#0F1320' : '#FDFCFF',
            borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '18px 24px', borderBottom: `1px solid ${border}`,
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 16, fontWeight: 700, color: isDark ? '#E2E8F8' : '#1A1A2E' }}>
                Колонки доски
              </span>
              <button
                onClick={() => { setWfEditorOpen(false); loadBoard(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#8B95B0' : '#9B96B8', display: 'flex', alignItems: 'center', padding: 4 }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'hidden', padding: '24px 28px' }}>
              <WorkflowEditor
                workflowId={board.workflow.id}
                isOwner={isOwner}
                onClose={() => { setWfEditorOpen(false); loadBoard(); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
