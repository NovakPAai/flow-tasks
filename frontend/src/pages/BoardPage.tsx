import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DragDropContext, Droppable, Draggable, type DropResult, type DragStart,
} from '@hello-pangea/dnd';
import { message } from 'antd';
import type { Board, Task, WorkflowStatus, WorkspaceMember, Label } from '../types';
import { useThemeStore } from '../store/theme.store';
import * as boardsApi from '../api/boards';
import * as tasksApi from '../api/tasks';
import * as workspacesApi from '../api/workspaces';
import * as labelsApi from '../api/labels';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';
import BoardListView from '../components/BoardListView';
import BoardCalendarView from '../components/BoardCalendarView';
import FilterBar, { type FilterState, EMPTY_FILTERS } from '../components/FilterBar';

type ViewMode = 'board' | 'list' | 'calendar';
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

function applyFilters(tasks: Task[], f: FilterState): Task[] {
  return tasks.filter(t => {
    if (f.search && !t.title.toLowerCase().includes(f.search.toLowerCase())) return false;
    if (f.statusId && t.statusId !== f.statusId) return false;
    if (f.priority && t.priority !== f.priority) return false;
    if (f.assigneeId && t.assigneeId !== f.assigneeId) return false;
    if (f.labelId && !(t.labels ?? []).some(tl => tl.labelId === f.labelId)) return false;
    if (f.duePreset) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate() + 7);
      const nextWeekEnd = new Date(nextWeek); nextWeekEnd.setDate(nextWeekEnd.getDate() + 7);
      const due = t.dueDate ? new Date(t.dueDate) : null;
      if (f.duePreset === 'no_date' && due) return false;
      if (f.duePreset === 'no_date' && !due) return true;
      if (!due) return false;
      if (f.duePreset === 'today' && !(due >= today && due < tomorrow)) return false;
      if (f.duePreset === 'this_week' && !(due >= today && due < nextWeek)) return false;
      if (f.duePreset === 'next_week' && !(due >= nextWeek && due < nextWeekEnd)) return false;
      if (f.duePreset === 'overdue' && !(due < today)) return false;
    }
    return true;
  });
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

// ── Page ───────────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const mode = useThemeStore(s => s.mode);
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
  const viewActive= '#4F6EF7';

  // ── State ─────────────────────────────────────────────────────────────────
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [addTitle, setAddTitle] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [draggingFromStatusId, setDraggingFromStatusId] = useState<string | null>(null);
  const addInputRef = useRef<HTMLInputElement | null>(null);

  const statuses = board?.workflow.statuses ?? [];

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    if (!boardId) return;
    try {
      const b = await boardsApi.getBoard(boardId);
      setBoard(b);
      setColumns(groupByStatus(b.tasks ?? [], b.workflow.statuses));
    } catch { message.error('Не удалось загрузить доску'); }
    finally { setLoading(false); }
  }, [boardId]);

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
      await tasksApi.reorderTasks(boardId!, updates);
    } catch {
      message.error('Не удалось сохранить порядок');
      loadBoard();
    }
  };

  // ── Quick add ─────────────────────────────────────────────────────────────
  const submitAdd = async (statusId: string) => {
    if (!addTitle.trim()) { setAddingTo(null); return; }
    try {
      const task = await tasksApi.createTask(boardId!, { title: addTitle.trim(), statusId });
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
          arr[idx] = { ...updated, status: arr[idx].status };
          if (updated.statusId !== sid) {
            arr.splice(idx, 1);
            newCols[sid] = arr;
            newCols[updated.statusId] = [...(newCols[updated.statusId] ?? []), updated];
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

  // ── Filtered data ─────────────────────────────────────────────────────────
  const allTasks = useMemo(() => columnsToList(columns), [columns]);
  const filteredTasks = useMemo(() => applyFilters(allTasks, filters), [allTasks, filters]);
  const filteredColumns = useMemo(() => {
    const ids = new Set(filteredTasks.map(t => t.id));
    const result: Columns = {};
    for (const [sid, tasks] of Object.entries(columns)) {
      result[sid] = tasks.filter(t => ids.has(t.id));
    }
    return result;
  }, [columns, filteredTasks]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: pageBg }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${border}`, borderTopColor: '#4F6EF7', borderRadius: '50%', animation: 'ft-spin 0.8s linear infinite' }} />
        <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!board) return null;

  const viewBtns: { mode: ViewMode; icon: React.ReactNode }[] = [
    { mode: 'board',    icon: <KanbanIcon active={viewMode === 'board'} color={viewActive} /> },
    { mode: 'list',     icon: <ListIcon /> },
    { mode: 'calendar', icon: <CalIcon /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: pageBg }}>
      <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Board header ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '16px 24px', background: headerBg,
        borderBottom: `1px solid ${border}`, flexShrink: 0,
      }}>
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', color: addText }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Board name + task count */}
        <h1 style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 18, fontWeight: 700, color: nameColor, margin: 0, letterSpacing: '-0.3px' }}>
          {board.name}
        </h1>
        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: cntText, background: cntBg, borderRadius: 6, padding: '2px 8px', flexShrink: 0 }}>
          {allTasks.length} задач
        </span>

        <div style={{ flex: 1 }} />

        {/* View switcher */}
        <div style={{ display: 'flex', gap: 2, background: isDark ? '#0F1320' : '#EDE9FE', borderRadius: 10, padding: 3 }}>
          {viewBtns.map(btn => (
            <button
              key={btn.mode}
              onClick={() => setViewMode(btn.mode)}
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

        {/* Создать task button */}
        <button
          data-onboarding="create-task"
          onClick={() => { if (statuses.length > 0) { setAddingTo(statuses[0].id); setAddTitle(''); } }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#4F6EF7', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1v10M1 6h10" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff' }}>Создать</span>
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

      {/* ── View content ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: viewMode === 'board' ? 'hidden' : 'auto' }}>

        {/* Kanban */}
        {viewMode === 'board' && (
          <div style={{ overflowX: 'auto', padding: '24px', height: '100%' }}>
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
                        width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0,
                        opacity: draggingFromStatusId && !isDropAllowed ? 0.4 : 1,
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {/* Column header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 2px 10px', marginBottom: 2 }}>
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

                      <Droppable droppableId={status.id} isDropDisabled={!!draggingFromStatusId && !isDropAllowed}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{
                              flex: 1, minHeight: 80, borderRadius: 10, padding: 4,
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
                                    <TaskCard task={task} onClick={() => setSelectedTaskId(task.id)} />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      {/* Quick add */}
                      {addingTo === status.id ? (
                        <input
                          ref={addInputRef}
                          value={addTitle}
                          onChange={e => setAddTitle(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') submitAdd(status.id); if (e.key === 'Escape') setAddingTo(null); }}
                          onBlur={() => submitAdd(status.id)}
                          placeholder="Название задачи..."
                          style={{
                            background: inpBg, border: `1px solid ${inpBorder}`,
                            borderRadius: 8, padding: '8px 10px',
                            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
                            color: nameColor, outline: 'none', width: '100%',
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
            quickAddStatusId={addingTo}
            quickAddTitle={addTitle}
            onQuickAddStart={sid => { setAddingTo(sid); setAddTitle(''); }}
            onQuickAddChange={setAddTitle}
            onQuickAddSubmit={submitAdd}
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
      </div>

      {/* Task drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        statuses={statuses}
        members={members}
        workspaceId={board.workspaceId}
        boardId={boardId}
        workspaceLabels={labels}
        onWorkspaceLabelCreated={label => setLabels(prev => [...prev, label])}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={onTaskUpdated}
        onDeleted={onTaskDeleted}
      />
    </div>
  );
}
