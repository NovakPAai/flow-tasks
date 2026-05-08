import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Workflow, WorkflowMode, StatusCategory } from '../types';
import * as wfApi from '../api/workflows';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-base)', panelBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', dimmed: 'var(--neutral-8)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)',
  tabBg: 'var(--static-background-lightest)', tabActiveBg: 'var(--static-border-neutral-tertiary)', tabActiveText: 'var(--brand-8)',
  rowBg: 'var(--static-background-lightest)', rowHoverBg: 'var(--static-background-light)',
  categoryBg: 'var(--static-border-neutral-tertiary)', categoryText: 'var(--static-text-neutral-tertiary)',
  matrixSelf: 'var(--static-background-base)', matrixDisabled: 'var(--static-background-base)',
  addDash: 'var(--component-border-neutral-medium)',
};
const LIGHT: C = {
  bg: 'var(--static-background-base)', panelBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', dimmed: 'var(--neutral-6)',
  inputBg: 'var(--static-background-base)', inputBorder: 'var(--static-border-neutral-tertiary)',
  tabBg: 'var(--static-background-base)', tabActiveBg: 'var(--component-fill-info-soft-default)', tabActiveText: 'var(--brand-8)',
  rowBg: 'var(--static-background-lightest)', rowHoverBg: 'var(--static-background-base)',
  categoryBg: 'var(--static-background-base)', categoryText: 'var(--static-text-neutral-tertiary)',
  matrixSelf: 'var(--static-background-lightest)', matrixDisabled: 'var(--static-background-lightest)',
  addDash: 'var(--static-border-neutral-tertiary)',
};

const CATEGORY_CFG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:        { label: 'OPEN',        color: 'var(--static-text-neutral-tertiary)', bg: 'var(--component-fill-neutral-soft-default)' },
  IN_PROGRESS: { label: 'IN_PROGRESS', color: 'var(--brand-8)', bg: 'var(--component-fill-brand-soft-hover)' },
  DONE:        { label: 'DONE',        color: 'var(--success-7)', bg: 'var(--component-fill-positive-soft-default)' },
  CANCELLED:   { label: 'CANCELLED',   color: 'var(--error-10)', bg: 'var(--component-fill-negative-soft-hover)' },
};

const MODE_TABS: { value: WorkflowMode; label: string }[] = [
  { value: 'FORWARD_ONLY',  label: '→ Forward only' },
  { value: 'BIDIRECTIONAL', label: 'Bi-directional' },
  { value: 'CUSTOM',        label: 'Custom' },
];

// drag-handle icon (6 dots)
function DragHandle({ color }: { color: string }) {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none" style={{ flexShrink: 0, cursor: 'grab' }}>
      <circle cx="3" cy="3" r="1.5" fill={color}/>
      <circle cx="7" cy="3" r="1.5" fill={color}/>
      <circle cx="3" cy="7" r="1.5" fill={color}/>
      <circle cx="7" cy="7" r="1.5" fill={color}/>
      <circle cx="3" cy="11" r="1.5" fill={color}/>
      <circle cx="7" cy="11" r="1.5" fill={color}/>
    </svg>
  );
}

interface Props {
  workflowId: string;
  isOwner: boolean;
  onClose?: () => void;
}

export default function WorkflowEditor({ workflowId, isOwner, onClose }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [wfName, setWfName] = useState('');

  // Status inline edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCategory, setEditCategory] = useState<StatusCategory>('OPEN');
  const [savingEdit, setSavingEdit] = useState(false);

  // Add status form
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState('');
  const [addColor, setAddColor] = useState('var(--neutral-8)');
  const [addCategory, setAddCategory] = useState<StatusCategory>('OPEN');
  const [addingStatus, setAddingStatus] = useState(false);

  // Drag reorder
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const inputStyle: React.CSSProperties = {
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 6, padding: '5px 10px', fontSize: 12,
    color: c.text, outline: 'none', fontFamily: '"Inter",system-ui,sans-serif',
  };

  const load = useCallback(() => {
    setLoading(true);
    wfApi.getWorkflow(workflowId)
      .then((wf) => { setWorkflow(wf); setWfName(wf.name); })
      .catch(() => message.error('Не удалось загрузить workflow'))
      .finally(() => setLoading(false));
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ padding: 20, color: c.muted, fontSize: 13, fontFamily: '"Inter",system-ui,sans-serif' }}>
      Загрузка…
    </div>
  );
  if (!workflow) return null;

  const statuses = workflow.statuses ?? [];
  const transitions = workflow.transitions ?? [];
  const wfMode = workflow.mode as WorkflowMode;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleModeChange = async (newMode: WorkflowMode) => {
    try {
      await wfApi.updateWorkflow(workflowId, { mode: newMode });
      if (newMode !== 'CUSTOM') await wfApi.regenerateTransitions(workflowId);
      load(); message.success('Режим обновлён');
    } catch { message.error('Ошибка обновления режима'); }
  };

  const handleSaveEdit = async (statusId: string) => {
    setSavingEdit(true);
    try {
      await wfApi.updateStatus(statusId, { name: editName, color: editColor, category: editCategory });
      setEditingId(null);
      load();
    } catch { message.error('Ошибка сохранения'); }
    finally { setSavingEdit(false); }
  };

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Удалить статус? Все задачи с этим статусом нужно предварительно перенести.')) return;
    try {
      await wfApi.deleteStatus(statusId);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось удалить статус');
    }
  };

  const handleAddStatus = async () => {
    if (!addName.trim()) return;
    setAddingStatus(true);
    try {
      await wfApi.addStatus(workflowId, { name: addName.trim(), color: addColor, category: addCategory });
      setAddName(''); setAddColor('var(--neutral-8)'); setAddCategory('OPEN');
      setShowAdd(false);
      load();
    } catch { message.error('Не удалось добавить статус'); }
    finally { setAddingStatus(false); }
  };

  const handleDragEnd = async () => {
    if (dragIdx === null || dragOverIdx === null || dragIdx === dragOverIdx) {
      setDragIdx(null); setDragOverIdx(null); return;
    }
    const newOrder = [...statuses];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(dragOverIdx, 0, moved);
    setDragIdx(null); setDragOverIdx(null);
    setWorkflow((prev) => prev ? { ...prev, statuses: newOrder } : prev);
    try {
      await wfApi.reorderStatuses(workflowId, newOrder.map((s) => s.id));
      load();
    } catch { message.error('Ошибка изменения порядка'); load(); }
  };

  const hasTransition = (fromId: string, toId: string) =>
    transitions.some((t) => t.fromStatusId === fromId && t.toStatusId === toId);

  const handleTransitionToggle = async (fromId: string, toId: string) => {
    if (!isOwner || wfMode !== 'CUSTOM') return;
    const existing = transitions.find((t) => t.fromStatusId === fromId && t.toStatusId === toId);
    try {
      if (existing) await wfApi.deleteTransition(existing.id);
      else await wfApi.addTransition(workflowId, fromId, toId);
      load();
    } catch { message.error('Ошибка обновления перехода'); }
  };

  const handleSave = async () => {
    try {
      if (wfName.trim() && wfName !== workflow.name) {
        await wfApi.updateWorkflow(workflowId, { name: wfName.trim() });
      }
      onClose?.();
    } catch { message.error('Ошибка сохранения'); }
  };

  // ── Compute forward-only matrix ─────────────────────────────────────────────
  const isForwardAllowed = (fromIdx: number, toIdx: number): boolean => {
    if (wfMode === 'FORWARD_ONLY') return toIdx > fromIdx;
    if (wfMode === 'BIDIRECTIONAL') return true;
    return hasTransition(statuses[fromIdx].id, statuses[toIdx].id);
  };

  // ── Shared label style ───────────────────────────────────────────────────────
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: c.muted, fontFamily: '"Inter",system-ui,sans-serif', marginBottom: 8, display: 'block',
  };

  return (
    <div style={{ display: 'flex', gap: 28, height: '100%', overflow: 'hidden' }}>

      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <div style={{ width: 460, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'hidden' }}>

        {/* Name */}
        <div>
          <span style={sectionLabel}>Название</span>
          <input
            value={wfName}
            onChange={(e) => setWfName(e.target.value)}
            disabled={!isOwner}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box',
              borderColor: isDark ? 'var(--component-border-neutral-medium)' : 'var(--static-border-neutral-tertiary)',
              ...(isDark ? {} : { background: 'var(--static-background-lightest)' }),
            }}
          />
        </div>

        {/* Mode tabs */}
        <div>
          <span style={sectionLabel}>Режим переходов</span>
          <div style={{
            display: 'flex', gap: 2, padding: 3,
            background: c.tabBg, border: `1px solid ${c.border}`,
            borderRadius: 10,
          }}>
            {MODE_TABS.map((tab) => {
              const active = wfMode === tab.value;
              return (
                <button
                  key={tab.value}
                  disabled={!isOwner}
                  onClick={() => isOwner && handleModeChange(tab.value)}
                  style={{
                    flex: 1, padding: '7px 8px',
                    fontSize: 12, fontFamily: '"Inter",system-ui,sans-serif',
                    fontWeight: active ? 600 : 400,
                    color: active ? c.tabActiveText : c.muted,
                    background: active ? c.tabActiveBg : 'transparent',
                    border: 'none', borderRadius: 8,
                    cursor: isOwner ? 'pointer' : 'default',
                    transition: 'all 0.12s',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Statuses */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
            <span style={{ ...sectionLabel, marginBottom: 0 }}>Статусы</span>
            {wfMode === 'FORWARD_ONLY' && (
              <span style={{ fontSize: 10, color: c.muted, fontFamily: '"Inter",system-ui,sans-serif' }}>
                Порядок определяет «вперёд»
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto', flex: 1, paddingRight: 4 }}>
            {statuses.map((status, idx) => {
              const catCfg = CATEGORY_CFG[status.category] ?? CATEGORY_CFG.OPEN;
              const isEditing = editingId === status.id;
              const isDragging = dragIdx === idx;
              const isDragOver = dragOverIdx === idx;

              return (
                <div
                  key={status.id}
                  draggable={isOwner && !isEditing}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: isDragOver ? (isDark ? 'var(--static-background-light)' : 'var(--component-fill-brand-soft-default)') : c.rowBg,
                    border: `1px solid ${isEditing ? 'var(--brand-8)' : c.border}`,
                    boxShadow: isEditing ? '0 0 0 1px var(--brand-8)' : 'none',
                    opacity: isDragging ? 0.4 : 1,
                    transition: 'border-color 0.12s, background 0.12s',
                  }}
                >
                  {isOwner && <DragHandle color={c.dimmed} />}

                  {isEditing ? (
                    <>
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                      />
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(status.id); if (e.key === 'Escape') setEditingId(null); }}
                        style={{ ...inputStyle, flex: 1, padding: '4px 8px' }}
                      />
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value as StatusCategory)}
                        style={{ ...inputStyle, padding: '4px 6px', flexShrink: 0 }}
                      >
                        {Object.entries(CATEGORY_CFG).map(([val, cfg]) => (
                          <option key={val} value={val}>{cfg.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveEdit(status.id)}
                        disabled={savingEdit}
                        style={{ fontSize: 11, color: 'var(--neutral-0)', background: 'var(--brand-8)', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0 }}
                      >
                        OK
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ fontSize: 11, color: c.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: status.color, border: `2px solid ${status.color}44`, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 13, color: c.text, fontFamily: '"Inter",system-ui,sans-serif' }}>
                        {status.name}
                      </span>
                      <span style={{
                        fontSize: 10, color: catCfg.color, background: catCfg.bg,
                        borderRadius: 4, padding: '2px 8px',
                        fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0,
                      }}>
                        {catCfg.label}
                      </span>
                      {isOwner && (
                        <button
                          onClick={() => { setEditingId(status.id); setEditName(status.name); setEditColor(status.color); setEditCategory(status.category as StatusCategory); }}
                          style={{ fontSize: 11, color: c.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0, padding: '0 2px' }}
                        >
                          Изменить
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => handleDeleteStatus(status.id)}
                          style={{ fontSize: 11, color: 'var(--error-8)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0, padding: '0 2px' }}
                        >
                          ✕
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {/* Add status */}
            {isOwner && !showAdd && (
              <button
                onClick={() => setShowAdd(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 12px', borderRadius: 8,
                  border: `1px dashed ${c.addDash}`, background: 'transparent',
                  cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M6 1v10M1 6h10" stroke="var(--brand-8)" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span style={{ fontSize: 12, color: 'var(--brand-8)' }}>Добавить статус</span>
              </button>
            )}

            {isOwner && showAdd && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${c.border}`, background: c.rowBg,
              }}>
                <input
                  type="color"
                  value={addColor}
                  onChange={(e) => setAddColor(e.target.value)}
                  style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer', background: 'none', flexShrink: 0 }}
                />
                <input
                  autoFocus
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddStatus(); if (e.key === 'Escape') setShowAdd(false); }}
                  placeholder="Название статуса…"
                  style={{ ...inputStyle, flex: 1, padding: '4px 8px' }}
                />
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as StatusCategory)}
                  style={{ ...inputStyle, padding: '4px 6px', flexShrink: 0 }}
                >
                  {Object.entries(CATEGORY_CFG).map(([val, cfg]) => (
                    <option key={val} value={val}>{cfg.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleAddStatus}
                  disabled={addingStatus || !addName.trim()}
                  style={{ fontSize: 11, color: 'var(--neutral-0)', background: 'var(--brand-8)', border: 'none', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0, opacity: !addName.trim() ? 0.5 : 1 }}
                >
                  {addingStatus ? '…' : 'Добавить'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  style={{ fontSize: 11, color: c.muted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel: transition matrix ────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, overflow: 'hidden' }}>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>
            Матрица переходов
          </h3>
          <p style={{ margin: 0, fontSize: 12, color: c.muted, fontFamily: '"Inter",system-ui,sans-serif' }}>
            {wfMode === 'FORWARD_ONLY' && 'Forward only — авто-генерируется по порядку статусов. Переходы только вперёд.'}
            {wfMode === 'BIDIRECTIONAL' && 'Bi-directional — переходы разрешены в любую сторону.'}
            {wfMode === 'CUSTOM' && 'Custom — нажмите ячейку для разрешения/запрета перехода.'}
          </p>
        </div>

        {statuses.length > 1 && (
          <div style={{
            background: c.panelBg, border: `1px solid ${c.border}`,
            borderRadius: 10, overflow: 'auto', flex: 1, minHeight: 0,
          }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{
                    padding: '10px 12px', width: 120, textAlign: 'left',
                    borderBottom: `1px solid ${c.border}`,
                    borderRight: `1px solid ${c.border}`,
                    background: isDark ? c.panelBg : 'var(--static-background-lightest)',
                    color: c.muted, fontFamily: '"Inter",system-ui,sans-serif', fontWeight: 400, fontSize: 10, letterSpacing: '0.04em',
                  }}>
                    ИЗ → В
                  </th>
                  {statuses.map((s) => (
                    <th key={s.id} style={{
                      padding: '10px 8px', textAlign: 'center',
                      borderBottom: `1px solid ${c.border}`,
                      borderRight: `1px solid ${c.border}`,
                      fontWeight: 600, fontFamily: '"Inter",system-ui,sans-serif',
                      color: s.color, fontSize: 10,
                    }}>
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statuses.map((from, fromIdx) => (
                  <tr key={from.id}>
                    <td style={{
                      padding: '10px 12px', width: 120,
                      borderBottom: `1px solid ${c.border}`,
                      borderRight: `1px solid ${c.border}`,
                      background: isDark ? c.panelBg : 'var(--static-background-lightest)',
                      color: from.color, fontSize: 11, fontWeight: 500,
                      fontFamily: '"Inter",system-ui,sans-serif',
                    }}>
                      {from.name}
                    </td>
                    {statuses.map((to, toIdx) => {
                      const isSelf = from.id === to.id;
                      const allowed = !isSelf && isForwardAllowed(fromIdx, toIdx);
                      const canToggle = isOwner && wfMode === 'CUSTOM' && !isSelf;

                      return (
                        <td key={to.id} style={{
                          padding: 0, textAlign: 'center', height: 38,
                          borderBottom: `1px solid ${c.border}`,
                          borderRight: `1px solid ${c.border}`,
                          background: isSelf ? c.matrixSelf : (allowed ? 'transparent' : c.matrixDisabled),
                        }}>
                          {isSelf ? (
                            <span style={{ color: c.dimmed, fontSize: 14 }}>—</span>
                          ) : (
                            <button
                              onClick={() => canToggle && handleTransitionToggle(from.id, to.id)}
                              style={{
                                width: '100%', height: 38, border: 'none',
                                background: 'transparent',
                                cursor: canToggle ? 'pointer' : 'default',
                                fontSize: 14, color: allowed ? 'var(--success-7)' : c.dimmed,
                              }}
                            >
                              {allowed ? '✓' : '—'}
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
        )}

        {statuses.length <= 1 && (
          <div style={{ color: c.muted, fontSize: 12, fontFamily: '"Inter",system-ui,sans-serif', padding: 16 }}>
            Добавьте минимум 2 статуса, чтобы увидеть матрицу переходов.
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexShrink: 0, paddingTop: 4 }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: isDark ? 'var(--static-border-neutral-tertiary)' : 'var(--static-background-base)',
                border: `1px solid ${c.border}`,
                color: c.text, fontSize: 13, cursor: 'pointer',
                fontFamily: '"Inter",system-ui,sans-serif',
              }}
            >
              Отмена
            </button>
          )}
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'var(--brand-8)', border: 'none',
              color: 'var(--neutral-0)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif',
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
