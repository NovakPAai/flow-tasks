import { useEffect, useState } from 'react';
import {
  Drawer, Typography, Spin, Button, Select, Avatar,
  Divider, Input, message, Popconfirm,
} from 'antd';
import { DeleteOutlined, BranchesOutlined } from '@ant-design/icons';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PRIORITY_OPTS = [
  { value: 'HIGH', label: '🔴 Высокий' },
  { value: 'MEDIUM', label: '🟡 Средний' },
  { value: 'LOW', label: '⚪ Низкий' },
];

interface Props {
  taskId: string | null;
  statuses: WorkflowStatus[];
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

export default function TaskDrawer({ taskId, statuses, onClose, onUpdated, onDeleted }: Props) {
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
      setTask(updated);
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

  return (
    <Drawer
      open={!!taskId}
      onClose={onClose}
      width={480}
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

          {/* Status + Priority */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>СТАТУС</Text>
              <Select
                value={task.statusId}
                style={{ width: '100%' }}
                disabled={saving}
                onChange={(_v) => save({ title: task.title })} // placeholder — move via API
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

          {/* Assignee */}
          <div style={{ marginBottom: 20 }}>
            <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 4 }}>ИСПОЛНИТЕЛЬ</Text>
            {task.assignee ? (
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

          {/* Subtasks count */}
          {(task._count?.children ?? 0) > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BranchesOutlined style={{ color: '#4A5578' }} />
              <Text style={{ color: '#4A5578', fontSize: 12 }}>
                {task._count?.children} подзадач
              </Text>
            </div>
          )}

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
