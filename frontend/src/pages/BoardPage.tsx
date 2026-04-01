import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import { Button, Input, Spin, Typography, message, type InputRef } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import type { Board, Task, WorkflowStatus } from '../types';
import * as boardsApi from '../api/boards';
import * as tasksApi from '../api/tasks';
import TaskCard from '../components/TaskCard';
import TaskDrawer from '../components/TaskDrawer';

const { Text } = Typography;

// Tasks grouped by statusId
type Columns = Record<string, Task[]>;

function groupByStatus(tasks: Task[], statuses: WorkflowStatus[]): Columns {
  const cols: Columns = {};
  for (const s of statuses) cols[s.id] = [];
  for (const t of tasks) {
    if (cols[t.statusId]) cols[t.statusId].push(t);
    else cols[t.statusId] = [t];
  }
  // sort by orderIndex within each column
  for (const id of Object.keys(cols)) {
    cols[id].sort((a, b) => a.orderIndex - b.orderIndex);
  }
  return cols;
}

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Columns>({});
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null); // statusId
  const [addTitle, setAddTitle] = useState('');
  const addInputRef = useRef<InputRef | null>(null);

  const statuses = board?.workflow.statuses ?? [];

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
    if (addingTo) setTimeout(() => addInputRef.current?.focus(), 50);
  }, [addingTo]);

  // ─── DnD ───────────────────────────────────────────────────────────────────

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const fromStatusId = source.droppableId;
    const toStatusId = destination.droppableId;

    // Validate transition
    if (fromStatusId !== toStatusId && board?.workflow.transitions) {
      const allowed = board.workflow.transitions.some(
        (t) => t.fromStatusId === fromStatusId && t.toStatusId === toStatusId,
      );
      if (!allowed) {
        message.warning('Переход не разрешён правилами workflow');
        return;
      }
    }

    // Optimistic update
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

    // Persist reorder
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
      loadBoard(); // rollback
    }
  };

  // ─── Quick add ──────────────────────────────────────────────────────────────

  const submitAdd = async (statusId: string) => {
    if (!addTitle.trim()) { setAddingTo(null); return; }
    try {
      const task = await tasksApi.createTask(boardId!, { title: addTitle.trim(), statusId });
      setColumns((prev) => ({
        ...prev,
        [statusId]: [...(prev[statusId] ?? []), task],
      }));
      setAddTitle('');
      setAddingTo(null);
    } catch { message.error('Не удалось создать задачу'); }
  };

  // ─── Task updates from drawer ────────────────────────────────────────────────

  const onTaskUpdated = (updated: Task) => {
    setColumns((prev) => {
      const newCols = { ...prev };
      for (const [sid, tasks] of Object.entries(newCols)) {
        const idx = tasks.findIndex((t) => t.id === updated.id);
        if (idx !== -1) {
          const arr = [...tasks];
          arr[idx] = { ...updated, status: arr[idx].status };
          // If status changed, move between columns
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
    setColumns((prev) => {
      const newCols = { ...prev };
      for (const [sid, tasks] of Object.entries(newCols)) {
        newCols[sid] = tasks.filter((t) => t.id !== taskId);
      }
      return newCols;
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#03050F' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!board) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#03050F', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        background: '#0A0E1A',
        borderBottom: '1px solid #1E2640',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexShrink: 0,
      }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          style={{ color: '#4A5578' }}
        />
        <div>
          <Text strong style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk', fontSize: 16 }}>
            {board.name}
          </Text>
          <Text style={{ color: '#4A5578', fontSize: 12, marginLeft: 8, fontFamily: 'monospace' }}>
            [{board.prefix}]
          </Text>
        </div>
      </div>

      {/* Kanban columns */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '24px' }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 0 }}>
            {statuses.map((status) => {
              const tasks = columns[status.id] ?? [];
              return (
                <div
                  key={status.id}
                  style={{
                    width: 280,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '0 4px',
                    marginBottom: 4,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: status.color, flexShrink: 0,
                    }} />
                    <Text style={{ color: '#8B95B0', fontWeight: 600, fontSize: 13, flex: 1 }}>
                      {status.name}
                    </Text>
                    <Text style={{ color: '#4A5578', fontSize: 12 }}>{tasks.length}</Text>
                  </div>

                  {/* Droppable */}
                  <Droppable droppableId={status.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{
                          flex: 1,
                          minHeight: 80,
                          borderRadius: 8,
                          padding: 4,
                          background: snapshot.isDraggingOver ? '#1E2640' : 'transparent',
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
                                style={{
                                  marginBottom: 8,
                                  opacity: snap.isDragging ? 0.85 : 1,
                                  ...drag.draggableProps.style,
                                }}
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
                    <Input
                      ref={addInputRef}
                      value={addTitle}
                      onChange={(e) => setAddTitle(e.target.value)}
                      onPressEnter={() => submitAdd(status.id)}
                      onBlur={() => submitAdd(status.id)}
                      placeholder="Название задачи..."
                      style={{
                        background: '#0F1320', border: '1px solid #4F6EF7',
                        color: '#E2E8F8', borderRadius: 8,
                      }}
                    />
                  ) : (
                    <Button
                      type="text"
                      icon={<PlusOutlined />}
                      onClick={() => { setAddingTo(status.id); setAddTitle(''); }}
                      style={{ color: '#4A5578', textAlign: 'left', width: '100%', justifyContent: 'flex-start' }}
                    >
                      Добавить задачу
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Task detail drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        statuses={statuses}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={onTaskUpdated}
        onDeleted={onTaskDeleted}
      />
    </div>
  );
}
