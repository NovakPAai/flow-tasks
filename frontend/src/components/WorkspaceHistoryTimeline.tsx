import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { WorkspaceEvent } from '../types';
import * as workspacesApi from '../api/workspaces';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  text: '#C8D0E8', muted: '#8B95B0', dim: '#4A5578',
  line: '#1C2236', emptyText: '#4A5578',
};
const LIGHT: C = {
  text: '#1A1A2E', muted: '#6B7194', dim: '#9B96B8',
  line: '#E8E5F0', emptyText: '#9B96B8',
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
function avatarColor(name: string): string { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string): string { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

// ── Action config ──────────────────────────────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  member_added: '#34D399', member_removed: '#F87171', member_role_changed: '#FBBF24',
  workflow_created: '#4F6EF7', workflow_deleted: '#F87171',
  workspace_created: '#4F6EF7', workspace_updated: '#8B9DC8',
  board_created: '#34D399', board_deleted: '#F87171',
};

// SVG icons per action type
const ACTION_SVG: Record<string, string> = {
  member_added:    'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8zM19 8v6M22 11h-6', // UserPlus
  member_removed:  'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M12 7a4 4 0 100-8 4 4 0 000 8zM23 11H17', // UserMinus
  member_role_changed: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', // Users
  workflow_created: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z', // Zap
  workflow_deleted: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2', // Trash
  workspace_created: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', // Layers
  workspace_updated: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z', // Settings
  board_created:   'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  board_deleted:   'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
};

function formatMessage(event: WorkspaceEvent): string {
  const meta = event.meta as Record<string, string> | undefined;
  switch (event.action) {
    case 'member_added':         return `${event.user.name} добавил участника ${meta?.name ?? ''} (${meta?.role ?? ''})`;
    case 'member_removed':       return `${event.user.name} удалил участника ${meta?.name ?? ''}`;
    case 'member_role_changed':  return `${event.user.name} изменил роль ${meta?.name ?? ''} на ${meta?.role ?? ''}`;
    case 'workflow_created':     return `${event.user.name} создал workflow «${meta?.name ?? ''}»`;
    case 'workflow_deleted':     return `${event.user.name} удалил workflow «${meta?.name ?? ''}»`;
    case 'workspace_created':    return `${event.user.name} создал рабочее пространство «${meta?.name ?? ''}»`;
    case 'workspace_updated': {
      const changes: string[] = [];
      if (meta?.name)        changes.push(`название → «${meta.name}»`);
      if (meta?.description !== undefined) changes.push(`описание обновлено`);
      if (meta?.isPrivate !== undefined)   changes.push(meta.isPrivate === 'true' ? 'сделал приватным' : 'сделал публичным');
      return changes.length > 0
        ? `${event.user.name} изменил настройки: ${changes.join(', ')}`
        : `${event.user.name} обновил настройки пространства`;
    }
    case 'board_created':        return `${event.user.name} создал доску «${meta?.name ?? ''}»`;
    case 'board_deleted':        return `${event.user.name} удалил доску «${meta?.name ?? ''}»`;
    default: return `${event.user.name}: ${event.action}`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props { workspaceId: string; }

// ── Component ─────────────────────────────────────────────────────────────────
export default function WorkspaceHistoryTimeline({ workspaceId }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Inject spin keyframe once into document head
  const keyframeInjected = useRef(false);
  useEffect(() => {
    if (keyframeInjected.current) return;
    const id = 'flow-spin-keyframe';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    keyframeInjected.current = true;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    workspacesApi.getWorkspaceHistory(workspaceId)
      .then(data => { if (!controller.signal.aborted) setEvents(data); })
      .catch(() => { if (!controller.signal.aborted) message.error('Не удалось загрузить историю'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${isDark ? '#1C2236' : '#E8E5F0'}`,
          borderTopColor: '#4F6EF7',
          animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: isDark ? '#0F1320' : '#F5F3FF',
          border: `1px solid ${isDark ? '#1C2236' : '#E8E5F0'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke={isDark ? '#4A5578' : '#9B96B8'} strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.emptyText }}>
          Нет событий
        </span>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 8 }}>
      {events.map((ev, i) => {
        const dotColor = ACTION_COLOR[ev.action] ?? '#4A5578';
        const svgPath = ACTION_SVG[ev.action];
        const isLast = i === events.length - 1;
        return (
          <div key={ev.id} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: isLast ? 0 : 16 }}>
            {/* Vertical line */}
            {!isLast && (
              <div style={{
                position: 'absolute', left: 11, top: 24, bottom: 0, width: 1,
                background: c.line,
              }} />
            )}
            {/* Action dot */}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: isDark ? '#0F1320' : '#FDFCFF',
              border: `1.5px solid ${dotColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 1,
            }}>
              {svgPath ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d={svgPath} stroke={dotColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {/* User avatar */}
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: avatarColor(ev.user.name),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: 2,
              }}>
                <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 8, fontWeight: 700, color: '#fff' }}>
                  {avatarInitials(ev.user.name)}
                </span>
              </div>
              <div>
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.text }}>
                  {formatMessage(ev)}
                </span>
                <br />
                <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.dim }}>
                  {formatDate(ev.createdAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
