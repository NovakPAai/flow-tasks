import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import * as notificationsApi from '../api/notifications';
import type { Notification, MentionPayload, TaskAssignedPayload, CommentAddedPayload, MemberAddedPayload } from '../api/notifications';

const POLL_MS = 30_000;

const AVATAR_PALETTE = ['var(--brand-8)','var(--brand-gold-8)','var(--success-8)','var(--warning-6)','var(--brand-7)','var(--error-10)','var(--info-8)'];
function avatarColor(name: string) { return AVATAR_PALETTE[(name?.charCodeAt(0) ?? 0) % AVATAR_PALETTE.length]; }
function avatarInitials(name: string) { return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function bodyPreview(body?: string): string {
  if (!body) return '';
  return body.replace(/@\[([^\]]+)\]\([^)]+\)/g, '@$1').slice(0, 120);
}

function getActor(n: Notification): { id: string; name: string } {
  if (n.type === 'mention') return (n.payload as MentionPayload).mentionedBy;
  return (n.payload as TaskAssignedPayload | CommentAddedPayload | MemberAddedPayload).actor;
}

function getActionText(n: Notification): string {
  switch (n.type) {
    case 'mention': {
      const p = n.payload as MentionPayload;
      return p.context === 'comment' ? ' упомянул(а) вас в комментарии · ' : ' упомянул(а) вас в задаче · ';
    }
    case 'task_assigned': return ' назначил(а) вас на задачу · ';
    case 'comment_added': return ' прокомментировал(а) задачу · ';
    case 'member_added': return ' добавил(а) вас в воркспейс · ';
    default: return ' · ';
  }
}

function getTarget(n: Notification): string {
  if (n.type === 'member_added') return (n.payload as MemberAddedPayload).workspaceName;
  return (n.payload as MentionPayload | TaskAssignedPayload | CommentAddedPayload).taskKey;
}

function getSubtitle(n: Notification): string | null {
  if (n.type === 'member_added') return null;
  return (n.payload as MentionPayload | TaskAssignedPayload | CommentAddedPayload).taskTitle;
}

export default function NotificationBell() {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const bg = isDark ? 'var(--static-background-lightest)' : 'var(--neutral-0)';
  const border = isDark ? 'var(--static-border-neutral-tertiary)' : 'var(--static-border-neutral-tertiary)';
  const text = isDark ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)';
  const subText = isDark ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-tertiary)';
  const muted = isDark ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-tertiary)';
  const hoverBg = isDark ? 'var(--static-background-light)' : 'var(--static-background-lightest)';
  const previewBg = isDark ? 'var(--static-background-base)' : 'var(--component-fill-info-soft-default)';
  const unreadDot = isDark ? 'var(--component-fill-brand-soft-default)' : 'var(--component-fill-brand-soft-default)';

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
    const p = n.payload as unknown as Record<string, unknown>;
    if (p.workspaceSlug && p.boardSlug) {
      navigate(`/w/${p.workspaceSlug}/boards/${p.boardSlug}`, { state: { openTaskId: p.taskId } });
    } else if (p.workspaceSlug) {
      navigate(`/w/${String(p.workspaceSlug)}`);
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
            background: 'var(--error-10)', color: 'var(--neutral-0)',
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
          boxShadow: 'var(--shadow-lg)', zIndex: 9999,
          fontFamily: '"Inter",system-ui,sans-serif',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${border}` }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: text }}>Уведомления</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--brand-8)', padding: 0 }}>
                Прочитать все
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: muted }}>Нет уведомлений</div>
            ) : items.map(n => {
              const actor = getActor(n);
              const preview = n.type === 'mention' ? bodyPreview((n.payload as MentionPayload).body) : null;
              const subtitle = getSubtitle(n);
              const isTaskLink = n.type !== 'member_added';
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
                      background: avatarColor(actor.name),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--neutral-0)' }}>
                        {avatarInitials(actor.name)}
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Who + action */}
                      <div style={{ fontSize: 13, color: text, lineHeight: '18px', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600 }}>{actor.name}</span>
                        <span style={{ color: subText }}>{getActionText(n)}</span>
                        <span style={{ color: 'var(--brand-8)', fontWeight: 500 }}>{getTarget(n)}</span>
                      </div>

                      {/* Task title / subtitle */}
                      {subtitle && (
                        <div style={{ fontSize: 12, color: subText, marginBottom: preview ? 6 : 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {subtitle}
                        </div>
                      )}

                      {/* Comment preview (mention only) */}
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

                      {/* Footer */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, color: muted }}>
                          {new Date(n.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--brand-8)', fontWeight: 500 }}>
                          {isTaskLink ? 'Открыть задачу →' : 'Открыть воркспейс →'}
                        </span>
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-8)', flexShrink: 0, marginTop: 6 }} />
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
