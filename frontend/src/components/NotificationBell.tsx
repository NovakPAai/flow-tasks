import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import * as notificationsApi from '../api/notifications';
import type { Notification } from '../api/notifications';

const POLL_MS = 30_000;

export default function NotificationBell() {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? '#0F1320' : '#FFFFFF';
  const border = isDark ? '#1C2236' : '#E8E5F0';
  const text = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted = isDark ? '#8B949E' : '#9B96B8';
  const hover = isDark ? '#1C2236' : '#F5F5FF';

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
    const { workspaceSlug, boardSlug } = n.payload;
    if (workspaceSlug && boardSlug) {
      navigate(`/w/${workspaceSlug}/boards/${boardSlug}`);
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
          position: 'fixed', top: dropPos.top, right: dropPos.right, width: 320,
          background: bg, border: `1px solid ${border}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.28)', zIndex: 9999,
          fontFamily: '"Inter",system-ui,sans-serif',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: text }}>Уведомления</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#4F6EF7', padding: 0 }}>
                Прочитать все
              </button>
            )}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', fontSize: 13, color: muted }}>Нет уведомлений</div>
            ) : items.map(n => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  background: n.isRead ? 'transparent' : (isDark ? 'rgba(79,110,247,0.06)' : 'rgba(79,110,247,0.04)'),
                  borderBottom: `1px solid ${border}`,
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = hover; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = n.isRead ? 'transparent' : (isDark ? 'rgba(79,110,247,0.06)' : 'rgba(79,110,247,0.04)'); }}
              >
                {!n.isRead && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4F6EF7', flexShrink: 0, marginTop: 4 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: text, lineHeight: '18px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 500 }}>{n.payload.mentionedBy.name}</span>
                    {n.payload.context === 'comment' ? ' упомянул(а) вас в комментарии к ' : ' упомянул(а) вас в задаче '}
                    <span style={{ color: '#4F6EF7' }}>{n.payload.taskKey}</span>
                  </span>
                  <span style={{ fontSize: 11, color: muted }}>
                    {new Date(n.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
