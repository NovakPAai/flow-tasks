import { useState } from 'react';
import { Button, Checkbox, Input, Progress, Popconfirm, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { Checklist, ChecklistItem } from '../types';
import * as checklistsApi from '../api/checklists';

const { Text } = Typography;

interface Props {
  taskId: string;
  checklists: Checklist[];
  onChecklistsChanged: (checklists: Checklist[]) => void;
}

export default function ChecklistBlock({ taskId, checklists, onChecklistsChanged }: Props) {
  const [addingTitle, setAddingTitle] = useState('');
  const [addingItem, setAddingItem] = useState<string | null>(null); // checklistId
  const [newItemTitle, setNewItemTitle] = useState('');

  const addChecklist = async () => {
    if (!addingTitle.trim()) return;
    try {
      const created = await checklistsApi.createChecklist(taskId, addingTitle.trim());
      onChecklistsChanged([...checklists, created]);
      setAddingTitle('');
    } catch { message.error('Не удалось создать чеклист'); }
  };

  const removeChecklist = async (checklistId: string) => {
    try {
      await checklistsApi.deleteChecklist(checklistId);
      onChecklistsChanged(checklists.filter((c) => c.id !== checklistId));
    } catch { message.error('Не удалось удалить чеклист'); }
  };

  const addItem = async (checklistId: string) => {
    if (!newItemTitle.trim()) { setAddingItem(null); return; }
    try {
      const item = await checklistsApi.createChecklistItem(checklistId, newItemTitle.trim());
      onChecklistsChanged(checklists.map((c) =>
        c.id === checklistId ? { ...c, items: [...c.items, item] } : c,
      ));
      setNewItemTitle('');
      setAddingItem(null);
    } catch { message.error('Не удалось добавить пункт'); }
  };

  const toggleItem = async (checklistId: string, item: ChecklistItem) => {
    try {
      const updated = await checklistsApi.updateChecklistItem(item.id, { isDone: !item.isDone });
      onChecklistsChanged(checklists.map((c) =>
        c.id === checklistId
          ? { ...c, items: c.items.map((i) => (i.id === item.id ? updated : i)) }
          : c,
      ));
    } catch { message.error('Не удалось обновить пункт'); }
  };

  const removeItem = async (checklistId: string, itemId: string) => {
    try {
      await checklistsApi.deleteChecklistItem(itemId);
      onChecklistsChanged(checklists.map((c) =>
        c.id === checklistId ? { ...c, items: c.items.filter((i) => i.id !== itemId) } : c,
      ));
    } catch { message.error('Не удалось удалить пункт'); }
  };

  return (
    <div>
      {checklists.map((checklist) => {
        const total = checklist.items.length;
        const done = checklist.items.filter((i) => i.isDone).length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={checklist.id} style={{ marginBottom: 16 }}>
            {/* Checklist header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ color: '#E2E8F8', fontWeight: 600, fontSize: 13, flex: 1 }}>
                ☑ {checklist.title}
              </Text>
              {total > 0 && (
                <Text style={{ color: '#4A5578', fontSize: 11 }}>{done}/{total}</Text>
              )}
              <Popconfirm title="Удалить чеклист?" onConfirm={() => removeChecklist(checklist.id)} okText="Да" cancelText="Нет">
                <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#4A5578' }} />
              </Popconfirm>
            </div>

            {/* Progress */}
            {total > 0 && (
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                strokeColor="#4F6EF7"
                trailColor="#1E2640"
                style={{ marginBottom: 8 }}
              />
            )}

            {/* Items */}
            {checklist.items.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <Checkbox
                  checked={item.isDone}
                  onChange={() => toggleItem(checklist.id, item)}
                />
                <Text style={{
                  color: item.isDone ? '#4A5578' : '#C8D0E8',
                  fontSize: 13,
                  textDecoration: item.isDone ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {item.title}
                </Text>
                <Button
                  type="text" size="small" icon={<DeleteOutlined />}
                  style={{ color: '#4A5578', opacity: 0.6 }}
                  onClick={() => removeItem(checklist.id, item.id)}
                />
              </div>
            ))}

            {/* Add item */}
            {addingItem === checklist.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, paddingLeft: 24 }}>
                <Input
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                  onPressEnter={() => addItem(checklist.id)}
                  onBlur={() => addItem(checklist.id)}
                  placeholder="Добавить пункт..."
                  size="small"
                  autoFocus
                  style={{ background: '#0F1320', border: '1px solid #4F6EF7', color: '#E2E8F8' }}
                />
              </div>
            ) : (
              <Button
                type="text" size="small" icon={<PlusOutlined />}
                onClick={() => { setAddingItem(checklist.id); setNewItemTitle(''); }}
                style={{ color: '#4A5578', paddingLeft: 24, marginTop: 2 }}
              >
                Добавить пункт
              </Button>
            )}
          </div>
        );
      })}

      {/* Add checklist */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <Input
          value={addingTitle}
          onChange={(e) => setAddingTitle(e.target.value)}
          onPressEnter={addChecklist}
          placeholder="Добавить чеклист..."
          size="small"
          style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8' }}
        />
        <Button size="small" onClick={addChecklist} disabled={!addingTitle.trim()} style={{ flexShrink: 0 }}>
          <PlusOutlined />
        </Button>
      </div>
    </div>
  );
}
