import { useEffect, useState } from 'react';
import {
  Button, ColorPicker, Input, Popconfirm, Select, Spin, Tag, Tooltip, Typography, message,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import {
  DeleteOutlined, HolderOutlined, PlusOutlined, SyncOutlined,
} from '@ant-design/icons';
import type { Workflow, WorkflowMode } from '../types';
import * as wfApi from '../api/workflows';

const { Text } = Typography;

const CATEGORY_OPTS = [
  { value: 'OPEN',        label: 'Open',        color: '#6B7280' },
  { value: 'IN_PROGRESS', label: 'In Progress',  color: '#4F6EF7' },
  { value: 'DONE',        label: 'Done',         color: '#22C55E' },
  { value: 'CANCELLED',   label: 'Cancelled',    color: '#EF4444' },
];

const MODE_OPTS = [
  { value: 'FORWARD_ONLY',  label: '→ Только вперёд' },
  { value: 'BIDIRECTIONAL', label: '⇄ В обе стороны' },
  { value: 'CUSTOM',        label: '⚙ Настраиваемый' },
];

interface Props {
  workflowId: string;
  isOwner: boolean;
}

export default function WorkflowEditor({ workflowId, isOwner }: Props) {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);

  // Add status form
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState('#6B7280');
  const [addCategory, setAddCategory] = useState<'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>('OPEN');
  const [addingStatus, setAddingStatus] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCategory, setEditCategory] = useState<'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'>('OPEN');

  // Drag state for reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    wfApi.getWorkflow(workflowId)
      .then(setWorkflow)
      .catch(() => message.error('Не удалось загрузить workflow'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [workflowId]);

  if (loading) return <Spin size="small" />;
  if (!workflow) return null;

  const statuses = workflow.statuses ?? [];
  const transitions = workflow.transitions ?? [];
  const mode = workflow.mode as WorkflowMode;

  // ─── Mode change ───────────────────────────────────────────────────────────

  const handleModeChange = async (newMode: string) => {
    try {
      await wfApi.updateWorkflow(workflowId, { mode: newMode as WorkflowMode });
      if (newMode !== 'CUSTOM') {
        await wfApi.regenerateTransitions(workflowId);
      }
      load();
      message.success('Режим обновлён');
    } catch { message.error('Ошибка обновления режима'); }
  };

  // ─── Add status ────────────────────────────────────────────────────────────

  const handleAddStatus = async () => {
    if (!addName.trim()) return;
    setAddingStatus(true);
    try {
      await wfApi.addStatus(workflowId, { name: addName.trim(), color: addColor, category: addCategory });
      setAddName('');
      setAddColor('#6B7280');
      setAddCategory('OPEN');
      load();
    } catch { message.error('Не удалось добавить статус'); }
    finally { setAddingStatus(false); }
  };

  // ─── Update status ─────────────────────────────────────────────────────────

  const handleSaveEdit = async (statusId: string) => {
    try {
      await wfApi.updateStatus(statusId, { name: editName, color: editColor, category: editCategory });
      setEditingId(null);
      load();
    } catch { message.error('Ошибка сохранения'); }
  };

  // ─── Delete status ─────────────────────────────────────────────────────────

  const handleDeleteStatus = async (statusId: string) => {
    try {
      await wfApi.deleteStatus(statusId);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось удалить статус');
    }
  };

  // ─── Drag reorder ──────────────────────────────────────────────────────────

  const handleDragEnd = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const newOrder = [...statuses];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dragOverIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    // Optimistic update
    setWorkflow((prev) => prev ? { ...prev, statuses: newOrder } : prev);
    try {
      await wfApi.reorderStatuses(workflowId, newOrder.map((s) => s.id));
      load();
    } catch { message.error('Ошибка изменения порядка'); load(); }
  };

  // ─── Custom transitions toggle ─────────────────────────────────────────────

  const hasTransition = (fromId: string, toId: string) =>
    transitions.some((t) => t.fromStatusId === fromId && t.toStatusId === toId);

  const handleTransitionToggle = async (fromId: string, toId: string) => {
    if (!isOwner || mode !== 'CUSTOM') return;
    const existing = transitions.find((t) => t.fromStatusId === fromId && t.toStatusId === toId);
    try {
      if (existing) {
        await wfApi.deleteTransition(existing.id);
      } else {
        await wfApi.addTransition(workflowId, fromId, toId);
      }
      load();
    } catch { message.error('Ошибка обновления перехода'); }
  };

  return (
    <div>
      {/* Mode selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <Text style={{ color: '#8B95B0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Режим
        </Text>
        <Select
          value={mode}
          onChange={handleModeChange}
          disabled={!isOwner}
          options={MODE_OPTS}
          size="small"
          style={{ width: 200 }}
        />
        {mode !== 'CUSTOM' && isOwner && (
          <Tooltip title="Перегенерировать переходы">
            <Button
              type="text" size="small" icon={<SyncOutlined />}
              style={{ color: '#4A5578' }}
              onClick={async () => {
                await wfApi.regenerateTransitions(workflowId);
                load();
                message.success('Переходы перегенерированы');
              }}
            />
          </Tooltip>
        )}
      </div>

      {/* Status list */}
      <div style={{ marginBottom: 16 }}>
        <Text style={{ color: '#8B95B0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 10 }}>
          Статусы
        </Text>

        {statuses.map((status, idx) => (
          <div
            key={status.id}
            draggable={isOwner && editingId !== status.id}
            onDragStart={() => setDragIdx(idx)}
            onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
            onDragEnd={handleDragEnd}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', marginBottom: 4, borderRadius: 6,
              background: dragOverIdx === idx ? '#1E2640' : '#0A0E1A',
              border: '1px solid #1E2640',
              opacity: dragIdx === idx ? 0.5 : 1,
              transition: 'background 0.1s',
            }}
          >
            {isOwner && (
              <HolderOutlined style={{ color: '#4A5578', cursor: 'grab', flexShrink: 0 }} />
            )}

            {editingId === status.id ? (
              <>
                <ColorPicker
                  value={editColor}
                  onChange={(c: Color) => setEditColor(c.toHexString())}
                  size="small"
                />
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  size="small"
                  style={{ background: '#0F1320', border: '1px solid #4F6EF7', color: '#E2E8F8', width: 140 }}
                  autoFocus
                />
                <Select
                  value={editCategory}
                  onChange={(v) => setEditCategory(v as typeof editCategory)}
                  size="small"
                  style={{ width: 130 }}
                  options={CATEGORY_OPTS.map((o) => ({ value: o.value, label: o.label }))}
                />
                <Button size="small" type="primary" onClick={() => handleSaveEdit(status.id)} style={{ background: '#4F6EF7' }}>OK</Button>
                <Button size="small" onClick={() => setEditingId(null)}>✕</Button>
              </>
            ) : (
              <>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
                <Text
                  style={{ color: '#E2E8F8', fontSize: 13, flex: 1, cursor: isOwner ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!isOwner) return;
                    setEditingId(status.id);
                    setEditName(status.name);
                    setEditColor(status.color);
                    setEditCategory(status.category as typeof editCategory);
                  }}
                >
                  {status.name}
                </Text>
                <Tag style={{ fontSize: 10, borderRadius: 4, background: '#0F1320', border: '1px solid #1E2640', color: '#4A5578' }}>
                  {CATEGORY_OPTS.find((o) => o.value === status.category)?.label}
                </Tag>
                {isOwner && (
                  <Popconfirm
                    title="Удалить статус?"
                    description="Все задачи с этим статусом нужно предварительно перенести."
                    onConfirm={() => handleDeleteStatus(status.id)}
                    okText="Удалить" cancelText="Нет"
                  >
                    <Button type="text" size="small" icon={<DeleteOutlined />} danger style={{ flexShrink: 0 }} />
                  </Popconfirm>
                )}
              </>
            )}
          </div>
        ))}

        {/* Add status row */}
        {isOwner && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <ColorPicker
              value={addColor}
              onChange={(c: Color) => setAddColor(c.toHexString())}
              size="small"
            />
            <Input
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              onPressEnter={handleAddStatus}
              placeholder="Название статуса..."
              size="small"
              style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8', flex: 1 }}
            />
            <Select
              value={addCategory}
              onChange={(v) => setAddCategory(v as typeof addCategory)}
              size="small"
              style={{ width: 130 }}
              options={CATEGORY_OPTS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Button
              size="small" icon={<PlusOutlined />}
              onClick={handleAddStatus}
              loading={addingStatus}
              disabled={!addName.trim()}
              style={{ flexShrink: 0 }}
            >
              Добавить
            </Button>
          </div>
        )}
      </div>

      {/* Transition matrix (CUSTOM mode only) */}
      {mode === 'CUSTOM' && statuses.length > 1 && (
        <div style={{ marginTop: 24 }}>
          <Text style={{ color: '#8B95B0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 12 }}>
            Матрица переходов
          </Text>
          <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 12 }}>
            Нажми ячейку чтобы разрешить/запретить переход (строка = откуда, столбец = куда)
          </Text>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '4px 8px', color: '#4A5578', textAlign: 'left', minWidth: 100 }}>Из ↓ / В →</th>
                  {statuses.map((s) => (
                    <th key={s.id} style={{ padding: '4px 6px', textAlign: 'center', minWidth: 72 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                        <Text style={{ color: '#8B95B0', fontSize: 11 }}>{s.name}</Text>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statuses.map((from) => (
                  <tr key={from.id}>
                    <td style={{ padding: '4px 8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: from.color, flexShrink: 0 }} />
                        <Text style={{ color: '#C8D0E8', fontSize: 12 }}>{from.name}</Text>
                      </span>
                    </td>
                    {statuses.map((to) => {
                      const isSelf = from.id === to.id;
                      const allowed = !isSelf && hasTransition(from.id, to.id);
                      return (
                        <td
                          key={to.id}
                          style={{ padding: '4px 6px', textAlign: 'center' }}
                        >
                          {isSelf ? (
                            <span style={{ color: '#1E2640', fontSize: 16 }}>—</span>
                          ) : (
                            <button
                              onClick={() => handleTransitionToggle(from.id, to.id)}
                              disabled={!isOwner}
                              style={{
                                width: 24, height: 24, borderRadius: 4, border: 'none',
                                background: allowed ? '#4F6EF7' : '#1E2640',
                                cursor: isOwner ? 'pointer' : 'default',
                                color: allowed ? '#fff' : '#4A5578',
                                fontSize: 14, lineHeight: 1,
                                transition: 'background 0.15s',
                              }}
                            >
                              {allowed ? '✓' : '·'}
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info for non-CUSTOM modes */}
      {mode !== 'CUSTOM' && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#0A0E1A', borderRadius: 6, border: '1px solid #1E2640' }}>
          <Text style={{ color: '#4A5578', fontSize: 12 }}>
            {mode === 'BIDIRECTIONAL'
              ? '⇄ В обе стороны — задачи можно перетаскивать в любую колонку.'
              : '→ Только вперёд — задачи движутся по порядку статусов (слева направо).'}
          </Text>
        </div>
      )}
    </div>
  );
}
