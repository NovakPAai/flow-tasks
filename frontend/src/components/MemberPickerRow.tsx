import type { CSSProperties } from 'react';
import type { MemberCandidate } from '../api/workspaces';
import type { WorkspaceRole } from '../types';
import type { ThemeTokens } from './MemberPicker';

const ROLE_OPTIONS: ReadonlyArray<{ value: WorkspaceRole; label: string }> = [
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'OWNER',  label: 'Owner' },
];

const AVATAR_COLORS = ['#4F6EF7', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899', '#EF4444', '#0EA5E9'];
function avatarColor(name: string): string {
  return AVATAR_COLORS[Math.abs(name.charCodeAt(0)) % AVATAR_COLORS.length] ?? '#4F6EF7';
}
function avatarInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export interface MemberPickerRowProps {
  row: MemberCandidate;
  focused: boolean;
  role: WorkspaceRole;
  onRoleChange: (r: WorkspaceRole) => void;
  onAdd: () => void;
  adding: boolean;
  theme: ThemeTokens;
  onSelect: () => void;
  /** Callback to register the row's <select> element so the parent can focus it. */
  registerSelectRef?: (el: HTMLSelectElement | null) => void;
}

export default function MemberPickerRow({
  row, focused, role, onRoleChange, onAdd, adding, theme, onSelect, registerSelectRef,
}: MemberPickerRowProps) {
  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '32px 1fr 130px 90px', // avatar + identity + role + add
    alignItems: 'center',
    gap: 12,
    padding: '8px 12px',
    background: focused ? theme.rowHover : 'transparent',
    borderTop: `1px solid ${theme.border}`,
    opacity: row.alreadyMember ? 0.55 : 1,
    cursor: row.alreadyMember ? 'default' : 'pointer',
    outline: focused ? `2px solid ${theme.accent}` : 'none',
    outlineOffset: -2,
  };

  return (
    <div
      id={`mp-opt-${row.id}`}
      role="option"
      data-testid="member-picker-option"
      aria-selected={focused ? 'true' : 'false'}
      aria-disabled={row.alreadyMember ? 'true' : undefined}
      aria-label={
        row.alreadyMember
          ? `${row.name} (${row.email}) — уже в воркспейсе`
          : `${row.name} (${row.email})`
      }
      style={rowStyle}
      onClick={onSelect}
    >
      <span
        aria-hidden="true"
        style={{
          width: 28, height: 28, borderRadius: '50%',
          background: avatarColor(row.name), color: '#fff',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600,
          backgroundImage: row.avatar ? `url(${row.avatar})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}
      >
        {!row.avatar && avatarInitials(row.name)}
      </span>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13, color: theme.text,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {row.name}
        </div>
        <div
          style={{
            fontSize: 11, color: theme.muted,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {row.email}
        </div>
      </div>

      {row.alreadyMember ? (
        <span
          style={{
            fontSize: 11, color: theme.muted, textAlign: 'center',
            gridColumn: '3 / span 2', // role + add columns
            background: theme.border, padding: '4px 8px', borderRadius: 6,
          }}
        >
          уже в воркспейсе
        </span>
      ) : (
        <>
          <select
            ref={registerSelectRef}
            value={role}
            onChange={(e) => onRoleChange(e.target.value as WorkspaceRole)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Роль для ${row.name}`}
            style={{
              background: theme.inputBg, border: `1px solid ${theme.inputBorder}`,
              color: theme.text, borderRadius: 6, padding: '6px 8px',
              fontSize: 12, minHeight: 32,
            }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={adding}
            aria-label={`Добавить ${row.name} как ${role.toLowerCase()}`}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            style={{
              background: theme.accent, color: '#fff',
              border: 'none', borderRadius: 6,
              padding: '8px 10px', fontSize: 12, minHeight: 36,
              cursor: adding ? 'wait' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {adding ? 'Добавляем…' : 'Добавить'}
          </button>
        </>
      )}
    </div>
  );
}
