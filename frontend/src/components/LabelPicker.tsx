import { useState } from 'react';
import { Popover, Button, Input, Typography, Checkbox, ColorPicker, message } from 'antd';
import { PlusOutlined, TagOutlined } from '@ant-design/icons';
import type { Label, TaskLabel } from '../types';
import * as labelsApi from '../api/labels';

const { Text } = Typography;

interface Props {
  taskId: string;
  workspaceId: string;
  workspaceLabels: Label[];
  taskLabels: TaskLabel[];
  onLabelsChanged: (labels: TaskLabel[]) => void;
  onWorkspaceLabelCreated: (label: Label) => void;
}

export default function LabelPicker({
  taskId, workspaceId, workspaceLabels, taskLabels,
  onLabelsChanged, onWorkspaceLabelCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#4F6EF7');
  const [saving, setSaving] = useState(false);

  const taskLabelIds = new Set(taskLabels.map((tl) => tl.labelId));

  const toggle = async (label: Label) => {
    setSaving(true);
    try {
      let updated: TaskLabel[];
      if (taskLabelIds.has(label.id)) {
        updated = await labelsApi.removeLabelFromTask(taskId, label.id);
      } else {
        updated = await labelsApi.addLabelToTask(taskId, label.id);
      }
      onLabelsChanged(updated);
    } catch { message.error('Не удалось обновить метки'); }
    finally { setSaving(false); }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const label = await labelsApi.createLabel(workspaceId, { name: newName.trim(), color: newColor });
      onWorkspaceLabelCreated(label);
      // Auto-assign new label to task
      const updated = await labelsApi.addLabelToTask(taskId, label.id);
      onLabelsChanged(updated);
      setNewName('');
      setNewColor('#4F6EF7');
      setCreating(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error ?? 'Не удалось создать метку');
    } finally { setSaving(false); }
  };

  const content = (
    <div style={{ width: 220 }}>
      <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginBottom: 8 }}>МЕТКИ ПРОСТРАНСТВА</Text>
      {workspaceLabels.length === 0 && !creating && (
        <Text style={{ color: '#4A5578', fontSize: 12, display: 'block', marginBottom: 8 }}>Нет меток</Text>
      )}
      {workspaceLabels.map((label) => (
        <div
          key={label.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}
          onClick={() => toggle(label)}
        >
          <Checkbox checked={taskLabelIds.has(label.id)} disabled={saving} />
          <span style={{ width: 12, height: 12, borderRadius: 3, background: label.color, flexShrink: 0 }} />
          <Text style={{ color: '#E2E8F8', fontSize: 12, flex: 1 }}>{label.name}</Text>
        </div>
      ))}

      {creating ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название метки"
            size="small"
            autoFocus
            onPressEnter={handleCreate}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ColorPicker
              value={newColor}
              onChange={(c) => setNewColor(c.toHexString())}
              size="small"
            />
            <Text style={{ color: '#4A5578', fontSize: 11 }}>Цвет</Text>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Button size="small" type="primary" loading={saving} onClick={handleCreate}>Создать</Button>
            <Button size="small" onClick={() => setCreating(false)}>Отмена</Button>
          </div>
        </div>
      ) : (
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setCreating(true)}
          style={{ color: '#4A5578', marginTop: 8, width: '100%', justifyContent: 'flex-start' }}
        >
          Создать метку
        </Button>
      )}
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      content={content}
      trigger="click"
      placement="bottomLeft"
      styles={{ body: { background: '#0F1320', border: '1px solid #1E2640' } }}
    >
      <Button
        type="text"
        size="small"
        icon={<TagOutlined />}
        style={{ color: '#4A5578' }}
      >
        Метки
      </Button>
    </Popover>
  );
}
