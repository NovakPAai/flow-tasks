import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import { EMPTY_FILTERS } from '../types';
import type { FilterState, WorkflowStatus, WorkspaceMember, Label } from '../types';

interface Props {
  filters: FilterState;
  statuses: WorkflowStatus[];
  members: WorkspaceMember[];
  labels: Label[];
  onChange: (filters: FilterState) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const DUE_CHIPS = [
  { value: '',          label: 'Все' },
  { value: 'today',     label: 'Сегодня' },
  { value: 'this_week', label: 'Эта неделя' },
  { value: 'overdue',   label: 'Просрочено' },
  { value: 'no_date',   label: 'Без даты' },
];

const PRIORITY_OPTS = [
  { value: 'HIGH',   label: 'Высокий' },
  { value: 'MEDIUM', label: 'Средний' },
  { value: 'LOW',    label: 'Низкий' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function FilterBar({ filters, statuses, members, labels, onChange }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';

  const rowBg       = isDark ? '#03050F'  : '#F5F3FF';
  const border      = isDark ? '#1C2236'  : '#E8E5F0';
  const chipBg      = isDark ? '#1C2236'  : '#EDE9FE';
  const chipText    = isDark ? '#8B949E'  : '#7C6FA8';
  const chipActive  = 'rgba(79,110,247,0.12)';
  const chipActiveT = '#4F6EF7';
  const chipOverdue = isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2';
  const chipOverdueT= '#EF4444';

  const inputText   = isDark ? '#E2E8F8'  : '#1A1A2E';
  const selectBg    = isDark ? '#0F1320'  : '#FDFCFF';

  const [showAdvanced, setShowAdvanced] = useState(false);

  const set = (key: keyof FilterState, value: string) =>
    onChange({ ...filters, [key]: value });

  const hasAdvanced = !!(filters.search || filters.statusId || filters.priority || filters.assigneeId || filters.labelId);
  const hasAny = hasAdvanced || !!filters.duePreset;

  const selectStyle: React.CSSProperties = {
    background: selectBg, border: `1px solid ${border}`,
    borderRadius: 8, padding: '5px 10px',
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
    color: inputText, outline: 'none', cursor: 'pointer',
  };

  return (
    <div style={{ background: rowBg, borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
      {/* ── Date preset chips ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px' }}>
        {DUE_CHIPS.map(chip => {
          const active = filters.duePreset === chip.value;
          const isOverdue = chip.value === 'overdue';
          return (
            <button
              key={chip.value}
              onClick={() => set('duePreset', chip.value)}
              style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: active ? 500 : 400,
                color: isOverdue ? chipOverdueT : (active ? chipActiveT : chipText),
                background: isOverdue ? chipOverdue : (active ? chipActive : chipBg),
                border: active ? `1px solid ${isOverdue ? chipOverdueT : chipActiveT}33` : '1px solid transparent',
                borderRadius: 7, padding: '5px 12px', cursor: 'pointer', transition: 'all 0.12s',
              }}
            >
              {isOverdue && <span style={{ marginRight: 4, fontSize: 10 }}>⚠</span>}
              {chip.label}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Фильтры toggle */}
        <button
          onClick={() => setShowAdvanced(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
            color: (showAdvanced || hasAdvanced) ? chipActiveT : chipText,
            background: (showAdvanced || hasAdvanced) ? chipActive : chipBg,
            border: (showAdvanced || hasAdvanced) ? `1px solid ${chipActiveT}33` : '1px solid transparent',
            borderRadius: 7, padding: '5px 12px', cursor: 'pointer',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M1.5 3.5h10M3 6.5h7M5 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Фильтры
          {hasAdvanced && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F6EF7', flexShrink: 0 }} />
          )}
        </button>

        {/* Clear all */}
        {hasAny && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            title="Сбросить фильтры"
            style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: chipText,
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px 8px',
            }}
          >
            ✕ Сбросить
          </button>
        )}
      </div>

      {/* ── Advanced filters (collapsed by default) ── */}
      {showAdvanced && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px 12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: 'absolute', left: 10, color: chipText, pointerEvents: 'none' }}>
              <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M9 9L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              placeholder="Поиск задач..."
              style={{
                ...selectStyle,
                paddingLeft: 30, width: 180,
              }}
            />
          </div>

          {/* Status */}
          <select value={filters.statusId} onChange={e => set('statusId', e.target.value)} style={selectStyle}>
            <option value="">Статус</option>
            {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          {/* Priority */}
          <select value={filters.priority} onChange={e => set('priority', e.target.value)} style={selectStyle}>
            <option value="">Приоритет</option>
            {PRIORITY_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          {/* Assignee */}
          {members.length > 0 && (
            <select value={filters.assigneeId} onChange={e => set('assigneeId', e.target.value)} style={selectStyle}>
              <option value="">Исполнитель</option>
              {members.map(m => <option key={m.userId} value={m.userId}>{m.user.name}</option>)}
            </select>
          )}

          {/* Label */}
          {labels.length > 0 && (
            <select value={filters.labelId} onChange={e => set('labelId', e.target.value)} style={selectStyle}>
              <option value="">Метка</option>
              {labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
