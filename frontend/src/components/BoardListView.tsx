import { useState } from 'react';
import { Table, Avatar, Tooltip, Select, Input, Typography, Button } from 'antd';
import { PlusOutlined, CalendarOutlined, BranchesOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

const { Text } = Typography;

const PRIORITY_OPTS = [
  { value: 'HIGH', label: '🔴 Высокий' },
  { value: 'MEDIUM', label: '🟡 Средний' },
  { value: 'LOW', label: '⚪ Низкий' },
];

interface Props {
  statuses: WorkflowStatus[];
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskUpdated: (task: Task) => void;
  quickAddStatusId: string | null;
  quickAddTitle: string;
  onQuickAddStart: (statusId: string) => void;
  onQuickAddChange: (title: string) => void;
  onQuickAddSubmit: (statusId: string) => void;
}

export default function BoardListView({
  statuses, tasks, onTaskClick, onTaskUpdated,
  quickAddStatusId, quickAddTitle, onQuickAddStart, onQuickAddChange, onQuickAddSubmit,
}: Props) {
  const [saving, setSaving] = useState<string | null>(null); // taskId being saved

  const saveField = async (taskId: string, patch: Parameters<typeof tasksApi.updateTask>[1]) => {
    setSaving(taskId);
    try {
      const updated = await tasksApi.updateTask(taskId, patch);
      onTaskUpdated(updated);
    } catch { /* ignore */ }
    finally { setSaving(null); }
  };

  const columns: ColumnsType<Task> = [
    {
      title: 'Ключ',
      dataIndex: 'issueKey',
      key: 'issueKey',
      width: 90,
      render: (key: string) => (
        <Text style={{ color: '#4A5578', fontFamily: 'monospace', fontSize: 11 }}>{key}</Text>
      ),
    },
    {
      title: 'Задача',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: Task) => (
        <Text
          style={{ color: '#E2E8F8', cursor: 'pointer', fontSize: 13 }}
          onClick={() => onTaskClick(record.id)}
        >
          {title}
          {(record._count?.children ?? 0) > 0 && (
            <span style={{ marginLeft: 6, color: '#4A5578', fontSize: 11 }}>
              <BranchesOutlined /> {record._count?.children}
            </span>
          )}
        </Text>
      ),
    },
    {
      title: 'Приоритет',
      dataIndex: 'priority',
      key: 'priority',
      width: 140,
      render: (priority: 'HIGH' | 'MEDIUM' | 'LOW' | null, record: Task) => (
        <Select<'HIGH' | 'MEDIUM' | 'LOW'>
          value={priority ?? undefined}
          placeholder="—"
          allowClear
          size="small"
          style={{ width: 130 }}
          loading={saving === record.id}
          disabled={saving === record.id}
          onChange={(v) => saveField(record.id, { priority: v ?? null })}
          onClear={() => saveField(record.id, { priority: null as unknown as undefined })}
          options={PRIORITY_OPTS}
          variant="borderless"
        />
      ),
    },
    {
      title: 'Срок',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (dueDate: string | null) => {
        if (!dueDate) return <Text style={{ color: '#4A5578' }}>—</Text>;
        const due = new Date(dueDate);
        const isOverdue = due < new Date();
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: isOverdue ? '#EF4444' : '#8B95B0', fontSize: 12 }}>
            <CalendarOutlined />
            {due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
          </span>
        );
      },
    },
    {
      title: 'Исполнитель',
      dataIndex: 'assignee',
      key: 'assignee',
      width: 120,
      render: (assignee: Task['assignee']) => {
        if (!assignee) return <Text style={{ color: '#4A5578', fontSize: 12 }}>—</Text>;
        return (
          <Tooltip title={assignee.name}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Avatar size={20} src={assignee.avatar} style={{ background: '#4F6EF7', fontSize: 10, flexShrink: 0 }}>
                {assignee.name?.[0]?.toUpperCase()}
              </Avatar>
              <Text style={{ color: '#8B95B0', fontSize: 12 }} ellipsis>{assignee.name}</Text>
            </div>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '0 24px 24px' }}>
      {statuses.map((status) => {
        const statusTasks = tasks
          .filter((t) => t.statusId === status.id)
          .sort((a, b) => a.orderIndex - b.orderIndex);

        return (
          <div key={status.id} style={{ marginBottom: 24 }}>
            {/* Status header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
              padding: '8px 0', borderBottom: '1px solid #1E2640',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
              <Text style={{ color: '#8B95B0', fontWeight: 600, fontSize: 13 }}>{status.name}</Text>
              <Text style={{ color: '#4A5578', fontSize: 12 }}>({statusTasks.length})</Text>
            </div>

            {/* Tasks table */}
            {statusTasks.length > 0 && (
              <Table<Task>
                dataSource={statusTasks}
                columns={columns}
                rowKey="id"
                pagination={false}
                size="small"
                style={{ marginBottom: 8 }}
                onRow={() => ({
                  style: { background: 'transparent', cursor: 'default' },
                })}
              />
            )}

            {/* Quick add */}
            {quickAddStatusId === status.id ? (
              <Input
                value={quickAddTitle}
                onChange={(e) => onQuickAddChange(e.target.value)}
                onPressEnter={() => onQuickAddSubmit(status.id)}
                onBlur={() => onQuickAddSubmit(status.id)}
                placeholder="Название задачи..."
                autoFocus
                style={{
                  background: '#0F1320', border: '1px solid #4F6EF7',
                  color: '#E2E8F8', borderRadius: 6, marginTop: 4,
                }}
              />
            ) : (
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => onQuickAddStart(status.id)}
                style={{ color: '#4A5578', paddingLeft: 4, fontSize: 12 }}
              >
                Добавить задачу
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
