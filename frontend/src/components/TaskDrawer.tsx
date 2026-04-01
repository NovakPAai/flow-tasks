import { useEffect, useState } from 'react';
import {
  Collapse, DatePicker, Drawer, Typography, Tag, Spin, Button, Select, Avatar,
  Divider, Input, message, Popconfirm,
} from 'antd';
import dayjs from 'dayjs';
import { DeleteOutlined, BranchesOutlined, HistoryOutlined } from '@ant-design/icons';
import type { Task, WorkflowStatus, WorkspaceMember, Label, TaskLabel, Comment, Checklist } from '../types';
import * as tasksApi from '../api/tasks';
import CommentThread from './CommentThread';
import ChecklistBlock from './ChecklistBlock';
import LabelPicker from './LabelPicker';
import TaskHistoryTimeline from './TaskHistoryTimeline';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_OPTS = [
  { value: 'HIGH', label: '🔴 Высокий' },
  { value: 'MEDIUM', label: '🟡 Средний' },
  { value: 'LOW', label: '⚪ Низкий' },
];

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#6B7280',
};

interface Props {
  taskId: string | null;
  statuses: WorkflowStatus[];
  members?: WorkspaceMember[];
  workspaceId?: string;
  workspaceLabels?: Label[];
  onWorkspaceLabelCreated?: (label: Label) => void;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

export default function TaskDrawer({
  taskId, statuses, members = [], workspaceId, workspaceLabels = [],
  onWorkspaceLabelCreated, onClose, onUpdated, onDeleted,
}: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    setLoading(true);
    tasksApi.getTask(taskId)
      .then((t) => { setTask(t); setTitleVal(t.title); setDescVal(t.description ?? ''); })
      .catch(() => message.error('Не удалось загрузить задачу'))
      .finally(() => setLoading(false));
  }, [taskId]);

  const save = async (patch: Parameters<typeof tasksApi.updateTask>[1]) => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await tasksApi.updateTask(task.id, patch);
      setTask((prev) => prev ? { ...prev, ...updated } : updated);
      onUpdated(updated);
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!task) return;
    try {
      await tasksApi.deleteTask(task.id);
      onDeleted(task.id);
      onClose();
    } catch { message.error('Ошибка удаления'); }
  };

  const handleLabelsChanged = (labels: TaskLabel[]) => {
    setTask((prev) => prev ? { ...prev, labels } : prev);
  };

  const handleCommentsChanged = (comments: Comment[]) => {
    setTask((prev) => prev ? { ...prev, comments } : prev);
  };

  const handleChecklistsChanged = (checklists: Checklist[]) => {
    setTask((prev) => prev ? { ...prev, checklists } : prev);
  };

  return (
    <Drawer
      open={!!taskId}
      onClose={onClose}
      width={520}
      styles={{
        body: { background: '#0A0E1A', padding: '24px' },
        header: { background: '#0A0E1A', borderBottom: '1px solid #1E2640' },
      }}
      title={
        task ? (
          <span style={{ color: '#4A5578', fontFamily: 'monospace', fontSize: 12 }}>{task.issueKey}</span>
        ) : null
      }
      extra={
        task && (
          <Popconfirm title="Удалить задачу?" onConfirm={handleDelete} okText="Да" cancelText="Нет">
            <Button type="text" icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        )
      }
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}><Spin /></div>
      ) : task ? (
        <div>
          {/* Title */}
          {editTitle ? (
            <Input
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={() => { setEditTitle(false); save({ title: titleVal }); }}
              onPressEnter={() => { setEditTitle(false); save({ title: titleVal }); }}
              autoFocus
              style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}
            />
          ) : (
            <Title
              level={4}
              style={{ color: '#E2E8F8', cursor: 'text', marginBottom: 16 }}
              onClick={() => setEditTitle(true)}
            >
              {task.title}
            </Title>
          )}

          {/* Labels */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {(task.labels ?? []).map((tl) => (
                <Tag
                  key={tl.labelId}
                  style={{
                    background: `${tl.label.color}22`,
                    border: `1px solid ${tl.label.color}55`,
                    color: tl.label.color,
                    fontSize: 11,
                  }}
                >
                  {tl.label.name}
                </Tag>
              ))}
              {workspaceId && (
                <LabelPicker
                  taskId={task.id}
                  workspaceId={workspaceId}
                  workspaceLabels={workspaceLabels}
                  taskLabels={task.labels ?? []}
                  onLabelsChanged={handleLabelsChanged}
                  onWorkspaceLabelCreated={onWorkspaceLabelCreated ?? (() => {})}
                />
              )}
            </div>
          </div>

          {/* Status + Priority */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>СТАТУС</Text>
              <Select
                value={task.statusId}
                style={{ width: '100%' }}
                disabled={saving}
                onChange={(v) => save({ statusId: v } as never)}
                options={statuses.map((s) => ({
                  value: s.id,
                  label: (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                      {s.name}
                    </span>
                  ),
                }))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>ПРИОРИТЕТ</Text>
              <Select
                value={task.priority ?? null}
                style={{ width: '100%' }}
                disabled={saving}
                allowClear
                placeholder="Не задан"
                onChange={(v) => save({ priority: v ?? null })}
                options={PRIORITY_OPTS.map((o) => ({ ...o }))}
              />
            </div>
          </div>

          {/* Assignee + Due date */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>ИСПОЛНИТЕЛЬ</Text>
              {members.length > 0 ? (
                <Select
                  value={task.assigneeId ?? null}
                  style={{ width: '100%' }}
                  disabled={saving}
                  allowClear
                  placeholder="Не назначен"
                  onChange={(v) => save({ assigneeId: v ?? null })}
                  options={members.map((m) => ({
                    value: m.userId,
                    label: (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar size={16} style={{ background: '#4F6EF7', fontSize: 9, flexShrink: 0 }}>
                          {m.user.name?.[0]?.toUpperCase()}
                        </Avatar>
                        {m.user.name}
                      </span>
                    ),
                  }))}
                />
              ) : task.assignee ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar size={24} style={{ background: '#4F6EF7', fontSize: 11 }}>
                    {task.assignee.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Text style={{ color: '#E2E8F8' }}>{task.assignee.name}</Text>
                </div>
              ) : (
                <Text style={{ color: '#4A5578' }}>Не назначен</Text>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>СРОК</Text>
              <DatePicker
                value={task.dueDate ? dayjs(task.dueDate) : null}
                style={{ width: '100%', background: '#0F1320', borderColor: '#1E2640' }}
                disabled={saving}
                allowClear
                placeholder="Без срока"
                onChange={(date) => save({ dueDate: date ? date.format('YYYY-MM-DD') : undefined })}
              />
            </div>
          </div>

          <Divider style={{ borderColor: '#1E2640' }} />

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 8 }}>ОПИСАНИЕ</Text>
            <TextArea
              value={descVal}
              onChange={(e) => setDescVal(e.target.value)}
              onBlur={() => { if (descVal !== (task.description ?? '')) save({ description: descVal }); }}
              rows={4}
              placeholder="Добавить описание..."
              style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8', resize: 'none' }}
            />
          </div>

          {/* Checklists */}
          {((task.checklists ?? []).length > 0 || true) && (
            <div style={{ marginBottom: 20 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 8 }}>ЧЕКЛИСТЫ</Text>
              <ChecklistBlock
                taskId={task.id}
                checklists={task.checklists ?? []}
                onChecklistsChanged={handleChecklistsChanged}
              />
            </div>
          )}

          {/* Subtasks count */}
          {(task._count?.children ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <BranchesOutlined style={{ color: '#4A5578' }} />
              <Text style={{ color: '#4A5578', fontSize: 12 }}>
                {task._count?.children} подзадач
              </Text>
            </div>
          )}

          <Divider style={{ borderColor: '#1E2640' }} />

          {/* Priority display */}
          {task.priority && (
            <div style={{ marginBottom: 12 }}>
              <Tag style={{
                background: `${PRIORITY_COLOR[task.priority]}18`,
                border: `1px solid ${PRIORITY_COLOR[task.priority]}44`,
                color: PRIORITY_COLOR[task.priority],
                fontSize: 11,
              }}>
                {PRIORITY_OPTS.find((o) => o.value === task.priority)?.label}
              </Tag>
            </div>
          )}

          {/* Comments */}
          <div style={{ marginBottom: 20 }}>
            <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 12 }}>
              КОММЕНТАРИИ {(task.comments ?? []).length > 0 && `(${task.comments!.length})`}
            </Text>
            <CommentThread
              taskId={task.id}
              comments={task.comments ?? []}
              onCommentsChanged={handleCommentsChanged}
            />
          </div>

          {/* History */}
          <Collapse
            ghost
            items={[{
              key: 'history',
              label: (
                <span style={{ color: '#4A5578', fontSize: 12 }}>
                  <HistoryOutlined style={{ marginRight: 6 }} />
                  История изменений
                </span>
              ),
              children: <TaskHistoryTimeline taskId={task.id} statuses={statuses} />,
            }]}
            style={{ marginBottom: 16 }}
          />

          {/* Meta */}
          <Divider style={{ borderColor: '#1E2640' }} />
          <Text style={{ color: '#4A5578', fontSize: 11, display: 'block' }}>
            Создано: {new Date(task.createdAt).toLocaleDateString('ru-RU')}
            {task.creator && ` · ${task.creator.name}`}
          </Text>
        </div>
      ) : null}
    </Drawer>
  );
}
