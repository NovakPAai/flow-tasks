import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Label, TaskLabel } from '../types';
import * as labelsApi from '../api/labels';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  triggerText: '#4A5578', triggerHover: '#8B95B0',
  dropdownBg: '#0F1320', dropdownBorder: '#1E2640',
  sectionLabel: '#4A5578', emptyText: '#4A5578',
  labelText: '#E2E8F8',
  checkBg: 'transparent', checkBorder: '#2D3748', checkActive: '#4F6EF7',
  inputBg: '#0F1320', inputBorder: '#1E2640', inputBorderFocus: '#4F6EF7', inputText: '#E2E8F8', inputPlaceholder: '#4A5578',
  createText: '#4A5578', createHover: '#8B95B0',
  btnBg: '#4F6EF7', btnText: '#fff',
  cancelText: '#4A5578',
};
const LIGHT: C = {
  triggerText: '#9B96B8', triggerHover: '#6B7194',
  dropdownBg: '#FDFCFF', dropdownBorder: '#E8E5F0',
  sectionLabel: '#9B96B8', emptyText: '#9B96B8',
  labelText: '#1A1A2E',
  checkBg: '#FDFCFF', checkBorder: '#D1C8EC', checkActive: '#4F6EF7',
  inputBg: '#F5F3FF', inputBorder: '#E8E5F0', inputBorderFocus: '#4F6EF7', inputText: '#1A1A2E', inputPlaceholder: '#9B96B8',
  createText: '#9B96B8', createHover: '#6B7194',
  btnBg: '#4F6EF7', btnText: '#fff',
  cancelText: '#9B96B8',
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  taskId: string;
  workspaceId: string;
  workspaceLabels: Label[];
  taskLabels: TaskLabel[];
  onLabelsChanged: (labels: TaskLabel[]) => void;
  onWorkspaceLabelCreated: (label: Label) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LabelPicker({
  taskId, workspaceId, workspaceLabels, taskLabels,
  onLabelsChanged, onWorkspaceLabelCreated,
}: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [open, setOpen]         = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('#4F6EF7');
  const [saving, setSaving]     = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const taskLabelIds = new Set(taskLabels.map(tl => tl.labelId));

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
      const updated = await labelsApi.addLabelToTask(taskId, label.id);
      onLabelsChanged(updated);
      setNewName(''); setNewColor('#4F6EF7'); setCreating(false);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error ?? 'Не удалось создать метку');
    } finally { setSaving(false); }
  };

  const inputStyle = (focus?: boolean): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box',
    background: c.inputBg,
    border: `1px solid ${focus ? c.inputBorderFocus : c.inputBorder}`,
    borderRadius: 6, padding: '5px 8px', outline: 'none',
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.inputText,
  });

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }} ref={wrapRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5, padding: '3px 6px', borderRadius: 4,
          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.triggerText,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.triggerHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.triggerText; }}
      >
        {/* Tag icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Метки
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100,
          marginTop: 4, width: 228,
          background: c.dropdownBg, border: `1px solid ${c.dropdownBorder}`,
          borderRadius: 10, padding: '12px',
          boxShadow: isDark
            ? '0 8px 24px rgba(0,0,0,0.5)'
            : '0 8px 24px rgba(79,110,247,0.08)',
        }}>
          {/* Section header */}
          <div style={{
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, fontWeight: 600,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: c.sectionLabel, marginBottom: 8,
          }}>
            Метки пространства
          </div>

          {/* Label list */}
          {workspaceLabels.length === 0 && !creating && (
            <div style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
              color: c.emptyText, marginBottom: 8,
            }}>
              Нет меток
            </div>
          )}
          {workspaceLabels.map(label => {
            const checked = taskLabelIds.has(label.id);
            return (
              <div
                key={label.id}
                onClick={() => !saving && toggle(label)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 0', cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {/* Custom checkbox */}
                <div style={{
                  width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                  background: checked ? c.checkActive : c.checkBg,
                  border: `1.5px solid ${checked ? c.checkActive : c.checkBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {checked && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {/* Color swatch */}
                <span style={{ width: 11, height: 11, borderRadius: 3, background: label.color, flexShrink: 0 }} />
                {/* Name */}
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
                  color: c.labelText, flex: 1,
                }}>
                  {label.name}
                </span>
              </div>
            );
          })}

          {/* Create form */}
          {creating ? (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Название метки"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
                style={inputStyle()}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = c.inputBorderFocus; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = c.inputBorder; }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={newColor}
                  onChange={e => setNewColor(e.target.value)}
                  style={{
                    width: 28, height: 24, borderRadius: 4,
                    border: `1px solid ${c.inputBorder}`,
                    background: 'none', cursor: 'pointer', padding: 1,
                  }}
                />
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.sectionLabel }}>
                  {newColor}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  style={{
                    background: c.btnBg, border: 'none', borderRadius: 6,
                    padding: '4px 12px', cursor: saving ? 'default' : 'pointer',
                    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                    color: c.btnText, opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? '...' : 'Создать'}
                </button>
                <button
                  onClick={() => setCreating(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.cancelText,
                  }}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                marginTop: 10, padding: '3px 0', width: '100%',
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.createText,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = c.createHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = c.createText; }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              Создать метку
            </button>
          )}
        </div>
      )}
    </div>
  );
}
