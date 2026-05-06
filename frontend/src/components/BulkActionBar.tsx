import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import type { WorkflowStatus, WorkspaceMember } from '../types';

interface BulkPatch {
  statusId?: string;
  assigneeId?: string | null;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW' | null;
}

interface Props {
  count: number;
  statuses: WorkflowStatus[];
  members: WorkspaceMember[];
  onBulkUpdate: (patch: BulkPatch) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onClose: () => void;
}

export default function BulkActionBar({ count, statuses, members, onBulkUpdate, onBulkDelete, onClose }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';

  const bg = isDark ? '#0F1320' : '#FFFFFF';
  const border = isDark ? '#1C2236' : '#E8E5F0';
  const text = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted = isDark ? '#8B95B0' : '#9B96B8';
  const inputBg = isDark ? '#07091A' : '#F5F3FF';
  const inputBorder = isDark ? '#2A3250' : '#DDD9F0';

  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handle = async (fn: () => Promise<void>) => {
    if (loading) return;
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  const CLEAR = '__clear__';

  const handleStatus = (statusId: string) => {
    if (!statusId) return;
    handle(() => onBulkUpdate({ statusId }));
  };

  const handlePriority = (val: string) => {
    if (!val) return;
    const priority = val === CLEAR ? null : val as 'HIGH' | 'MEDIUM' | 'LOW';
    handle(() => onBulkUpdate({ priority }));
  };

  const handleAssignee = (val: string) => {
    if (!val) return;
    const assigneeId = val === CLEAR ? null : val;
    handle(() => onBulkUpdate({ assigneeId }));
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    handle(onBulkDelete);
  };

  const selectStyle: React.CSSProperties = {
    background: inputBg,
    border: `1px solid ${inputBorder}`,
    borderRadius: 7,
    padding: '5px 8px',
    fontFamily: '"Inter",system-ui,sans-serif',
    fontSize: 12,
    color: text,
    cursor: 'pointer',
    outline: 'none',
    height: 30,
    appearance: 'none',
    WebkitAppearance: 'none',
    paddingRight: 24,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${isDark ? '%238B95B0' : '%239B96B8'}' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    minWidth: 120,
  };

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '8px 12px',
      boxShadow: isDark
        ? '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,110,247,0.15)'
        : '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(79,110,247,0.1)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      whiteSpace: 'nowrap',
      opacity: loading ? 0.6 : 1,
      transition: 'opacity 0.15s',
    }}>
      {/* Count + close */}
      <button
        onClick={onClose}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 3l8 8M11 3l-8 8" stroke={muted} strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        <span style={{
          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600,
          color: '#4F6EF7',
        }}>
          {count} {count === 1 ? 'задача' : count < 5 ? 'задачи' : 'задач'}
        </span>
      </button>

      <div style={{ width: 1, height: 20, background: border }} />

      {/* Status */}
      <select
        value=""
        onChange={e => handleStatus(e.target.value)}
        disabled={loading}
        style={selectStyle}
      >
        <option value="">Статус...</option>
        {statuses.map(s => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      {/* Priority */}
      <select
        value=""
        onChange={e => handlePriority(e.target.value)}
        disabled={loading}
        style={selectStyle}
      >
        <option value="">Приоритет...</option>
        <option value="HIGH">HIGH</option>
        <option value="MEDIUM">MEDIUM</option>
        <option value="LOW">LOW</option>
        <option value={CLEAR}>— Очистить</option>
      </select>

      {/* Assignee */}
      <select
        value=""
        onChange={e => handleAssignee(e.target.value)}
        disabled={loading}
        style={{ ...selectStyle, minWidth: 140 }}
      >
        <option value="">Исполнитель...</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>{m.user.name}</option>
        ))}
        <option value={CLEAR}>— Очистить</option>
      </select>

      <div style={{ width: 1, height: 20, background: border }} />

      {/* Delete */}
      {confirmDelete ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: '#EF4444' }}>
            Удалить {count}?
          </span>
          <button
            onClick={handleDelete}
            style={{
              background: '#EF4444', color: '#fff', border: 'none',
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 600,
            }}
          >
            Да
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              background: inputBg, color: muted,
              border: `1px solid ${inputBorder}`,
              borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
            }}
          >
            Нет
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={loading}
          title="Удалить выбранные задачи"
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(239,68,68,0.1)', color: '#EF4444',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 7, padding: '5px 10px', cursor: 'pointer',
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
            height: 30,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 3h9M4.5 3V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1m1 0-.5 7a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5L2.5 3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Удалить
        </button>
      )}
    </div>
  );
}
