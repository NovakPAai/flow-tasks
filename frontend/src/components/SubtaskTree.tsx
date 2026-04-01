import { useState } from 'react';
import { Input, Button, Popconfirm, Tooltip, message } from 'antd';
import {
  PlusOutlined, DeleteOutlined, RightOutlined, DownOutlined, CheckOutlined,
} from '@ant-design/icons';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

interface Props {
  tasks: Task[];
  parentId: string;
  boardId: string;
  statuses: WorkflowStatus[];
  depth?: number;
  onRefresh: () => void;
}

function isDone(task: Task, statuses: WorkflowStatus[]): boolean {
  const s = statuses.find((st) => st.id === task.statusId);
  return s?.category === 'DONE';
}

function findDoneStatusId(statuses: WorkflowStatus[]): string | undefined {
  return statuses.find((s) => s.category === 'DONE')?.id;
}

function findFirstStatusId(statuses: WorkflowStatus[]): string | undefined {
  return statuses[0]?.id;
}

export default function SubtaskTree({
  tasks, parentId, boardId, statuses, depth = 0, onRefresh,
}: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [subtrees, setSubtrees] = useState<Record<string, Task[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const indent = depth * 16;

  const handleExpand = async (task: Task) => {
    const id = task.id;
    if (expanded[id]) {
      setExpanded((p) => ({ ...p, [id]: false }));
      return;
    }
    setLoadingExpand((p) => ({ ...p, [id]: true }));
    try {
      const children = await tasksApi.getSubtree(id);
      // getSubtree returns ALL descendants; we only want direct children (depth+1)
      const direct = children.filter((c) => c.parentId === id);
      setSubtrees((p) => ({ ...p, [id]: direct }));
      setExpanded((p) => ({ ...p, [id]: true }));
    } catch {
      message.error('Не удалось загрузить подзадачи');
    } finally {
      setLoadingExpand((p) => ({ ...p, [id]: false }));
    }
  };

  const handleToggleDone = async (task: Task) => {
    const done = isDone(task, statuses);
    const targetStatusId = done
      ? findFirstStatusId(statuses)
      : findDoneStatusId(statuses);
    if (!targetStatusId) return;
    try {
      await tasksApi.moveTask(task.id, targetStatusId);
      onRefresh();
    } catch { message.error('Ошибка'); }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await tasksApi.deleteTask(taskId);
      onRefresh();
    } catch { message.error('Не удалось удалить'); }
  };

  const handleAddSubtask = async () => {
    if (!addTitle.trim()) { setAdding(false); return; }
    setSaving(true);
    try {
      await tasksApi.createTask(boardId, {
        title: addTitle.trim(),
        parentId,
        statusId: findFirstStatusId(statuses),
      });
      setAddTitle('');
      setAdding(false);
      onRefresh();
    } catch { message.error('Не удалось создать подзадачу'); }
    finally { setSaving(false); }
  };

  const lineColor = '#1C2236';

  return (
    <div style={{ position: 'relative' }}>
      {depth > 0 && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 1,
          background: lineColor,
        }} />
      )}

      {tasks.map((task) => {
        const done = isDone(task, statuses);
        const hasChildren = (task._count?.children ?? 0) > 0;
        const isExpanded = !!expanded[task.id];

        return (
          <div key={task.id}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: indent + (depth > 0 ? 12 : 0),
                paddingTop: 4,
                paddingBottom: 4,
                borderRadius: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#0F1320'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Expand toggle */}
              <span
                style={{
                  width: 16,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: hasChildren ? 'pointer' : 'default',
                  color: '#4A5578',
                  flexShrink: 0,
                }}
                onClick={() => hasChildren && handleExpand(task)}
              >
                {hasChildren
                  ? (loadingExpand[task.id]
                    ? <span style={{ fontSize: 10 }}>…</span>
                    : isExpanded
                      ? <DownOutlined style={{ fontSize: 9 }} />
                      : <RightOutlined style={{ fontSize: 9 }} />)
                  : null}
              </span>

              {/* Done checkbox */}
              <Tooltip title={done ? 'Снять отметку' : 'Отметить выполненным'}>
                <span
                  onClick={() => handleToggleDone(task)}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 3,
                    border: `1px solid ${done ? '#34D399' : '#2D3748'}`,
                    background: done ? '#34D39922' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.15s',
                  }}
                >
                  {done && <CheckOutlined style={{ fontSize: 9, color: '#34D399' }} />}
                </span>
              </Tooltip>

              {/* Title */}
              <span style={{
                flex: 1,
                fontSize: 13,
                color: done ? '#4A5578' : '#C8D0E8',
                textDecoration: done ? 'line-through' : 'none',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {task.title}
              </span>

              {/* Issue key */}
              <span style={{ fontSize: 10, color: '#2D3748', fontFamily: 'monospace', flexShrink: 0 }}>
                {task.issueKey}
              </span>

              {/* Delete */}
              <Popconfirm
                title="Удалить подзадачу?"
                onConfirm={() => handleDelete(task.id)}
                okText="Да"
                cancelText="Нет"
              >
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  style={{ opacity: 0.4, padding: '0 4px', height: 20 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4'; }}
                />
              </Popconfirm>
            </div>

            {/* Recursive subtree */}
            {isExpanded && subtrees[task.id] && (
              <div style={{ paddingLeft: indent + 28 }}>
                <SubtaskTree
                  tasks={subtrees[task.id]}
                  parentId={task.id}
                  boardId={boardId}
                  statuses={statuses}
                  depth={depth + 1}
                  onRefresh={() => {
                    handleExpand(task); // re-fetch children
                    onRefresh();
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add subtask row */}
      {adding ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: indent + (depth > 0 ? 12 : 0),
          paddingTop: 4,
        }}>
          <span style={{ width: 16, flexShrink: 0 }} />
          <Input
            size="small"
            autoFocus
            placeholder="Название подзадачи..."
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onPressEnter={handleAddSubtask}
            onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setAddTitle(''); } }}
            disabled={saving}
            style={{
              flex: 1,
              background: '#0F1320',
              border: '1px solid #4F6EF7',
              color: '#E2E8F8',
              fontSize: 12,
            }}
          />
          <Button
            type="primary"
            size="small"
            onClick={handleAddSubtask}
            loading={saving}
            style={{ padding: '0 8px', height: 24, fontSize: 12 }}
          >
            Добавить
          </Button>
          <Button
            type="text"
            size="small"
            onClick={() => { setAdding(false); setAddTitle(''); }}
            style={{ color: '#4A5578', padding: '0 8px', height: 24, fontSize: 12 }}
          >
            Отмена
          </Button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            paddingLeft: indent + (depth > 0 ? 12 : 0),
            paddingTop: 4,
            cursor: 'pointer',
            color: '#4A5578',
            fontSize: 12,
            borderRadius: 4,
            transition: 'color 0.15s',
          }}
          onClick={() => setAdding(true)}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.color = '#8B9DC8'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.color = '#4A5578'; }}
        >
          <PlusOutlined style={{ fontSize: 10 }} />
          <span>Добавить подзадачу</span>
        </div>
      )}
    </div>
  );
}
