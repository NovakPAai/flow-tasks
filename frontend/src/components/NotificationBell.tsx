import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import * as notificationsApi from '../api/notifications';
import type { Notification } from '../api/notifications';

const POLL_MS = 30_000;

const AVATAR_PALETTE = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
function avatarColor(name: string) { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string) { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function bodyPreview(body?: string): string {
  if (!body) return '';
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').slice(0, 120);
}

export default function NotificationBell() {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? '#0F1320' : '#FFFFFF';
  const border = isDark ? '#1C2236' : '#E8E5F0';
  const text = isDark ? '#E2E8F8' : '#1A1A2E';
  const subText = isDark ? '#8B95B0' : '#6B7194';
  const muted = isDark ? '#8B949E' : '#9B96B8';
  const hoverBg = isDark ? '#141928' : '#F8F7FF';
  const previewBg = isDark ? '#0A0E1A' : '#F5F5FF';
  const unreadDot = isDark ? 'rgba(79,110,247,0.08)' : 'rgba(79,110,247,0.05)';

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const res = await notificationsApi.listNotifications();
      setItems(res.items);
      setUnread(res.unread);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleMarkAllRead = async () => {
    await notificationsApi.markAllRead();
    setItems(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      await notificationsApi.markRead(n.id);
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      setUnread(prev => Math.max(0, prev - 1));
    }
    setOpen(false);
    const { workspaceSlug, boardSlug, taskId } = n.payload;
    if (workspaceSlug && boardSlug) {
      navigate(`/w/${workspaceSlug}/boards/${boardSlug}?taskId=${taskId}`);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          if (!open && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
          }
          setOpen(v => !v);
        }}
        style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: muted, display: 'flex', alignItems: 'center' }}
        title="Уведомления"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 1.5C9 1.5 5.25 3 5.25 9V13.5H12.75V9C12.75 3 9 1.5 9 1.5Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
          <path d="M7.5 13.5C7.5 14.328 8.172 15 9 15C9.828 15 10.5 14.328 10.5 13.5" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M3.75 13.5H14.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#EF4444', color: '#fff',
            fontSize: 9, fontWeight: 700, fontFamily: '"Inter",system-ui,sans-serif',
            borderRadius: '50%', width: 14, height: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'fixed', top: dropPos.top, right: dropPos.right, width: 380,
          background: bg, border: `1px solid ${border}`, borderRadius: 10,
          boxShadow: '0 8px 32px rgba(0,0,0,0.22)', zIndex: 9999,
          fontFamily: '"Inter",system-ui,sans-serif',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: text }}>Уведомления</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#4F6EF7', padding: 0 }}>
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: muted }}>Нет уведомлений</div>
            ) : items.map(n => {
              const preview = bodyPreview(n.payload.body);
              return (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer',
                    background: n.isRead ? 'transparent' : unreadDot,
                    borderBottom: `1px solid ${border}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = hoverBg; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'transparent' : unreadDot; }}
                >
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: avatarColor(n.payload.mentionedBy.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>
                        {avatarInitials(n.payload.mentionedBy.name)}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Who + where */}
                      <div style={{ fontSize: 13, color: text, lineHeight: '18px', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{n.payload.mentionedBy.name}</span>
                        <span style={{ color: subText }}>
                          {n.payload.context === 'comment' ? ' упомянул(а) вас в комментарии · ' : ' упомянул(а) вас в задаче · '}
                        </span>
                        <span style={{ color: '#4F6EF7', fontWeight: 500 }}>{n.payload.taskKey}</span>
                      </div>

                      {/* Task title */}
                      <div style={{ fontSize: 12, color: subText, marginBottom: preview ? 6 : 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.payload.taskTitle}
                      </div>

                      {/* Comment preview */}
                      {preview && (
                        <div style={{
                          fontSize: 12, color: text, lineHeight: '17px',
                          background: previewBg, borderRadius: 6,
                          padding: '6px 8px', marginBottom: 6,
                          display: '-webkit-box', WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical', overflow: 'hidden',
                        }}>
                          {preview}
                        </div>
                      )}

                      {/* Footer: time + open button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: muted }}>
                          {new Date(n.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 11, color: '#4F6EF7', fontWeight: 500 }}>
                          Открыть задачу →
                        </span>
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4F6EF7', flexShrink: 0, marginTop: 6 }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
