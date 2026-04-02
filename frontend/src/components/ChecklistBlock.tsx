import { useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Checklist, ChecklistItem } from '../types';
import * as checklistsApi from '../api/checklists';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  titleText: '#E2E8F8', metaText: '#4A5578', itemText: '#C8D0E8', doneItemText: '#4A5578',
  trackBg: '#1E2640', barBg: '#4F6EF7',
  checkBg: 'transparent', checkBorder: '#2D3748',
  checkActiveBg: 'rgba(79,110,247,0.12)', checkActiveBorder: '#4F6EF7',
  delText: '#4A5578', delHover: '#EF4444',
  addText: '#4A5578', addHover: '#8B95B0',
  inputBg: '#0F1320', inputBorder: '#1E2640', inputBorderFocus: '#4F6EF7', inputText: '#E2E8F8',
  inputPlaceholder: '#4A5578',
  newChecklistBg: '#0F1320', newChecklistBorder: '#1E2640',
  addBtnBg: '#1C2236', addBtnBorder: '#2A3456', addBtnText: '#8B95B0',
};
const LIGHT: C = {
  titleText: '#1A1A2E', metaText: '#9B96B8', itemText: '#3A3A5C', doneItemText: '#9B96B8',
  trackBg: '#E8E5F0', barBg: '#4F6EF7',
  checkBg: '#FDFCFF', checkBorder: '#D1C8EC',
  checkActiveBg: 'rgba(79,110,247,0.08)', checkActiveBorder: '#4F6EF7',
  delText: '#9B96B8', delHover: '#EF4444',
  addText: '#9B96B8', addHover: '#6B7194',
  inputBg: '#F5F3FF', inputBorder: '#E8E5F0', inputBorderFocus: '#4F6EF7', inputText: '#1A1A2E',
  inputPlaceholder: '#9B96B8',
  newChecklistBg: '#F5F3FF', newChecklistBorder: '#E8E5F0',
  addBtnBg: '#FDFCFF', addBtnBorder: '#E8E5F0', addBtnText: '#6B7194',
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  taskId: string;
  checklists: Checklist[];
  onChecklistsChanged: (checklists: Checklist[]) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ChecklistBlock({ taskId, checklists, onChecklistsChanged }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [addingTitle, setAddingTitle]   = useState('');
  const [addingItem, setAddingItem]     = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState('');
  const [confirmClId, setConfirmClId]   = useState<string | null>(null);

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
      onChecklistsChanged(checklists.filter(cl => cl.id !== checklistId));
    } catch { message.error('Не удалось удалить чеклист'); }
    finally { setConfirmClId(null); }
  };

  const addItem = async (checklistId: string) => {
    if (!newItemTitle.trim()) { setAddingItem(null); return; }
    try {
      const item = await checklistsApi.createChecklistItem(checklistId, newItemTitle.trim());
      onChecklistsChanged(checklists.map(cl =>
        cl.id === checklistId ? { ...cl, items: [...cl.items, item] } : cl,
      ));
      setNewItemTitle(''); setAddingItem(null);
    } catch { message.error('Не удалось добавить пункт'); }
  };

  const toggleItem = async (checklistId: string, item: ChecklistItem) => {
    try {
      const updated = await checklistsApi.updateChecklistItem(item.id, { isDone: !item.isDone });
      onChecklistsChanged(checklists.map(cl =>
        cl.id === checklistId
          ? { ...cl, items: cl.items.map(i => i.id === item.id ? updated : i) }
          : cl,
      ));
    } catch { message.error('Не удалось обновить пункт'); }
  };

  const removeItem = async (checklistId: string, itemId: string) => {
    try {
      await checklistsApi.deleteChecklistItem(itemId);
      onChecklistsChanged(checklists.map(cl =>
        cl.id === checklistId ? { ...cl, items: cl.items.filter(i => i.id !== itemId) } : cl,
      ));
    } catch { message.error('Не удалось удалить пункт'); }
  };

  const inputStyle: React.CSSProperties = {
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 6, padding: '5px 8px', outline: 'none',
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.inputText,
  };

  return (
    <div>
      {checklists.map(checklist => {
        const total = checklist.items.length;
        const done  = checklist.items.filter(i => i.isDone).length;
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

        return (
          <div key={checklist.id} style={{ marginBottom: 18 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              {/* Checklist icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"
                  stroke={isDark ? '#8B95B0' : '#6B7194'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
                color: c.titleText, flex: 1,
              }}>
                {checklist.title}
              </span>
              {total > 0 && (
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.metaText }}>
                  {done}/{total}
                </span>
              )}
              {/* Delete / confirm */}
              {confirmClId === checklist.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.metaText }}>Удалить?</span>
                  <button
                    onClick={() => removeChecklist(checklist.id)}
                    style={{
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: '#EF4444',
                    }}
                  >Да</button>
                  <button
                    onClick={() => setConfirmClId(null)}
                    style={{
                      background: 'none', border: `1px solid ${isDark ? '#1C2236' : '#E8E5F0'}`,
                      borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.metaText,
                    }}
                  >Нет</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClId(checklist.id)}
                  title="Удалить чеклист"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 4px', borderRadius: 3, color: c.delText,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.delHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.delText; }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Progress bar */}
            {total > 0 && (
              <div style={{
                height: 4, borderRadius: 2, background: c.trackBg, marginBottom: 8, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 2, background: c.barBg,
                  width: `${pct}%`, transition: 'width 0.3s ease',
                }} />
              </div>
            )}

            {/* Items */}
            {checklist.items.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                {/* Custom checkbox */}
                <div
                  onClick={() => toggleItem(checklist.id, item)}
                  style={{
                    width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                    background: item.isDone ? c.checkActiveBg : c.checkBg,
                    border: `1.5px solid ${item.isDone ? c.checkActiveBorder : c.checkBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {item.isDone && (
                    <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                      <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#4F6EF7" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, flex: 1,
                  color: item.isDone ? c.doneItemText : c.itemText,
                  textDecoration: item.isDone ? 'line-through' : 'none',
                  lineHeight: '18px',
                }}>
                  {item.title}
                </span>
                <button
                  onClick={() => removeItem(checklist.id, item.id)}
                  title="Удалить пункт"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 4px', borderRadius: 3, color: c.delText, opacity: 0.5,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    (e.currentTarget as HTMLButtonElement).style.color = c.delHover;
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.5';
                    (e.currentTarget as HTMLButtonElement).style.color = c.delText;
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}

            {/* Add item */}
            {addingItem === checklist.id ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, paddingLeft: 23 }}>
                <input
                  value={newItemTitle}
                  onChange={e => setNewItemTitle(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addItem(checklist.id);
                    if (e.key === 'Escape') setAddingItem(null);
                  }}
                  onBlur={() => addItem(checklist.id)}
                  placeholder="Добавить пункт..."
                  autoFocus
                  style={{ ...inputStyle, flex: 1 }}
                  onFocus={e => { (e.target as HTMLInputElement).style.borderColor = c.inputBorderFocus; }}
                />
              </div>
            ) : (
              <button
                onClick={() => { setAddingItem(checklist.id); setNewItemTitle(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 5,
                  paddingLeft: 23, marginTop: 4,
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.addText,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.addHover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.addText; }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                Добавить пункт
              </button>
            )}
          </div>
        );
      })}

      {/* New checklist input */}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <input
          value={addingTitle}
          onChange={e => setAddingTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addChecklist(); }}
          placeholder="Добавить чеклист..."
          style={{ ...inputStyle, flex: 1 }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = c.inputBorderFocus; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = c.inputBorder; }}
        />
        <button
          onClick={addChecklist}
          disabled={!addingTitle.trim()}
          style={{
            background: c.addBtnBg, border: `1px solid ${c.addBtnBorder}`,
            borderRadius: 6, padding: '5px 10px', cursor: addingTitle.trim() ? 'pointer' : 'default',
            color: c.addBtnText, opacity: addingTitle.trim() ? 1 : 0.5, flexShrink: 0,
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
