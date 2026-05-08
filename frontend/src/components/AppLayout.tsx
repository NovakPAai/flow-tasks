import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import { useAuthStore } from '../store/auth.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint, useIsLandscape } from '../utils/useBreakpoint';
import NotificationBell from './NotificationBell';
import CommandPalette from './CommandPalette';


interface Props { children: React.ReactNode }

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Logo icon (4 squares) ────────────────────────────────────────────────────
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="#FFFFFF" opacity="0.55"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="#FFFFFF" opacity="0.55"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
    </svg>
  );
}

// ─── User dropdown menu ───────────────────────────────────────────────────────
function UserMenu({ user, onLogout, onProfile, onSettings, hasSettings, onAdminUsers, isSuperadmin, navBg, border, textPrimary, textMuted, onClose }: {
  user: { name: string; email?: string };
  onLogout: () => void;
  onProfile: () => void;
  onSettings: () => void;
  hasSettings: boolean;
  onAdminUsers: () => void;
  isSuperadmin: boolean;
  navBg: string; border: string; textPrimary: string; textMuted: string;
  onClose: () => void;
}) {
  const menuBg = navBg === '#0A0D1A' ? '#0F1320' : '#FFFFFF';
  return (
    <div
      style={{
        backgroundColor: menuBg, border: `1px solid ${border}`, borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 200,
        padding: '6px 0', position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 200,
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* User info */}
      <div style={{ padding: '10px 16px 8px' }}>
        <div style={{ color: textPrimary, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, fontWeight: 600, lineHeight: '18px' }}>
          {user.name}
        </div>
        {user.email && (
          <div style={{ color: textMuted, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 11, lineHeight: '16px', marginTop: 2 }}>
            {user.email}
          </div>
        )}
      </div>
      <div style={{ backgroundColor: border, height: 1, margin: '4px 0' }}/>
      <button onClick={() => { onProfile(); onClose(); }} style={{
        background: 'none', border: 'none', borderRadius: 6, color: textMuted,
        cursor: 'pointer', display: 'block', fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 13, padding: '8px 16px', textAlign: 'left', width: '100%',
      }}>
        Профиль
      </button>
      {isSuperadmin && (
        <button onClick={() => { onAdminUsers(); onClose(); }} style={{
          background: 'none', border: 'none', borderRadius: 6, color: '#4F6EF7',
          cursor: 'pointer', display: 'block', fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: 13, padding: '8px 16px', textAlign: 'left', width: '100%', fontWeight: 500,
        }}>
          Пользователи
        </button>
      )}
      {hasSettings && (
        <button onClick={() => { onSettings(); onClose(); }} style={{
          background: 'none', border: 'none', borderRadius: 6, color: textMuted,
          cursor: 'pointer', display: 'block', fontFamily: '"Inter", system-ui, sans-serif',
          fontSize: 13, padding: '8px 16px', textAlign: 'left', width: '100%',
        }}>
          Настройки workspace
        </button>
      )}
      <div style={{ backgroundColor: border, height: 1, margin: '4px 0' }}/>
      <button onClick={() => { onLogout(); onClose(); }} style={{
        background: 'none', border: 'none', borderRadius: 6, color: '#F87171',
        cursor: 'pointer', display: 'block', fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: 13, padding: '8px 16px', textAlign: 'left', width: '100%',
      }}>
        Выйти
      </button>
    </div>
  );
}

// ─── Workspace selector dropdown ──────────────────────────────────────────────
function WorkspaceSelector({ workspaces, current, onSelect, navBg, border, textPrimary, onClose }: {
  workspaces: Array<{ id: string; name: string; slug: string }>;
  current: { id: string; name: string; slug: string } | null;
  onSelect: (slug: string) => void;
  navBg: string; border: string; textPrimary: string;
  onClose: () => void;
}) {
  const menuBg = navBg === '#0A0D1A' ? '#0F1320' : '#FFFFFF';
  return (
    <div
      style={{
        backgroundColor: menuBg, border: `1px solid ${border}`, borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)', minWidth: 200,
        padding: '6px 0', position: 'absolute', left: 0, top: 'calc(100% + 8px)', zIndex: 200,
      }}
      onClick={e => e.stopPropagation()}
    >
      {workspaces.map(ws => (
        <button key={ws.id} onClick={() => { onSelect(ws.slug); onClose(); }} style={{
          alignItems: 'center', background: ws.id === current?.id ? (navBg === '#0A0D1A' ? '#1C2236' : '#EDE9FE') : 'none',
          border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex',
          gap: 8, padding: '8px 12px', textAlign: 'left', width: '100%',
        }}>
          <div style={{
            alignItems: 'center', backgroundColor: '#4F6EF7', borderRadius: 4,
            display: 'flex', flexShrink: 0, height: 18, justifyContent: 'center', width: 18,
          }}>
            <span style={{ color: '#FFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 9, fontWeight: 700 }}>
              {ws.name[0]?.toUpperCase()}
            </span>
          </div>
          <span style={{ color: textPrimary, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '16px' }}>
            {ws.name}
          </span>
        </button>
      ))}
    </div>
  );
}

function pluralDays(n: number) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

function mfaGraceBanner(workspace: { requireMfa?: boolean; mfaGraceUntil?: string | null } | null | undefined) {
  if (!workspace?.requireMfa || !workspace.mfaGraceUntil) return null;
  const until = new Date(workspace.mfaGraceUntil);
  if (until <= new Date()) return null;
  const daysLeft = Math.ceil((until.getTime() - Date.now()) / 86_400_000);
  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        background: 'rgba(245,158,11,0.12)', borderBottom: '1px solid rgba(245,158,11,0.25)',
        paddingTop: 8, paddingBottom: 8,
        paddingLeft: 'max(24px, env(safe-area-inset-left))',
        paddingRight: 'max(24px, env(safe-area-inset-right))',
        fontSize: 12, color: '#F59E0B',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap',
        fontFamily: '"Inter",system-ui,sans-serif',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M7 1.5L1 12.5h12L7 1.5z" stroke="#F59E0B" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M7 5.5v3M7 10h.01" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
      Требуется настроить двухфакторную аутентификацию — осталось {daysLeft} {pluralDays(daysLeft)}
    </div>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export default function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { workspaces, current, load, setCurrent } = useWorkspaceStore();
  const { mode, toggle } = useThemeStore();

  const bp          = useBreakpoint();
  const isLandscape = useIsLandscape();
  // В landscape на мобиле/планшете используем компактный топбар
  const topbarH = isLandscape && bp !== 'desktop' ? 40 : 56;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [wsMenuOpen, setWsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ── Design tokens ──────────────────────────────────────────────────────────
  const isDark = mode !== 'light';
  const navBg      = isDark ? '#0A0D1A' : '#FDFCFF';
  const navBorder  = isDark ? '#1C2236' : '#E8E5F0';
  const sepColor   = isDark ? '#1C2236' : '#E8E5F0';
  const logoText   = isDark ? '#E2E8F8' : '#1A1A2E';
  const wsSelectorBg     = isDark ? '#0F1320' : '#F5F3FF';
  const wsSelectorBorder = isDark ? '#1C2236' : '#E8E5F0';
  const wsSelectorText   = isDark ? '#E2E8F8' : '#1A1A2E';
  const tabActiveBg   = isDark ? '#1C2236' : '#EDE9FE';
  const tabActiveText = '#4F6EF7';
  const tabIdleText   = isDark ? '#8B95B0' : '#6B7194';
  const rootBg        = isDark ? '#03050F' : '#F5F3FF';

  // ── Logic ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (workspaces.length === 0) load();
  }, [workspaces.length, load]);

  const slugMatch = location.pathname.match(/^\/w\/([^/]+)/);
  const urlSlug = slugMatch?.[1];
  useEffect(() => {
    if (urlSlug && workspaces.length > 0) {
      const found = workspaces.find(w => w.slug === urlSlug);
      if (found && found.id !== current?.id) setCurrent(found);
    }
  }, [urlSlug, workspaces, current?.id, setCurrent]);

  useEffect(() => {
    const close = () => { setUserMenuOpen(false); setWsMenuOpen(false); };
    if (userMenuOpen || wsMenuOpen) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [userMenuOpen, wsMenuOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); }
    catch { message.error('Ошибка выхода'); }
  };

  const isWorkspace = !!urlSlug;
  const isRoadmaps = isWorkspace && location.pathname.endsWith('/roadmaps');
  const isBoards   = isWorkspace
    && (location.pathname === `/w/${urlSlug}`
        || location.pathname.startsWith(`/w/${urlSlug}/boards`));
  const isMyTasks  = location.pathname === '/my-tasks';

  const userInitials = user ? initials(user.name) : '?';

  return (
    <div style={{ backgroundColor: rootBg, display: 'flex', flexDirection: 'column', position: 'fixed', inset: 0 }}>
      {/* ── Topbar ── */}
      <div style={{
        alignItems: 'center', backgroundColor: navBg, borderBottom: `1px solid ${navBorder}`,
        display: 'flex', flexShrink: 0, gap: isLandscape ? 10 : 16, height: topbarH,
        // safe-area-inset-left/right для iPhone notch в landscape
        paddingLeft:  isLandscape ? 'max(16px, env(safe-area-inset-left))' : 24,
        paddingRight: isLandscape ? 'max(16px, env(safe-area-inset-right))' : 24,
        position: 'relative', zIndex: 100,
      }}>
        {/* Logo */}
        <div
          onClick={() => navigate('/workspaces')}
          style={{ alignItems: 'center', borderRadius: 8, cursor: 'pointer', display: 'flex', gap: 8, padding: '4px 6px', transition: 'background 0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}
        >
          <div style={{ alignItems: 'center', backgroundColor: '#4F6EF7', borderRadius: 8, display: 'flex', flexShrink: 0, height: 32, justifyContent: 'center', width: 32 }}>
            <GridIcon/>
          </div>
          {bp === 'desktop' && (
            <span style={{ color: logoText, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '20px' }}>
              FlowTask
            </span>
          )}
        </div>

        {/* Separator + workspace selector (only on workspace pages) */}
        {isWorkspace && current && (
          <>
            <div style={{ backgroundColor: sepColor, flexShrink: 0, height: 20, width: 1 }}/>

            {/* Workspace dropdown */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={e => { e.stopPropagation(); setWsMenuOpen(v => !v); setUserMenuOpen(false); }}
                style={{
                  alignItems: 'center', backgroundColor: wsSelectorBg,
                  border: `1px solid ${wsSelectorBorder}`, borderRadius: 8,
                  cursor: 'pointer', display: 'flex', gap: 6, paddingBlock: 5, paddingInline: 12,
                }}
              >
                <div style={{ alignItems: 'center', backgroundColor: '#4F6EF7', borderRadius: 4, display: 'flex', flexShrink: 0, height: 18, justifyContent: 'center', width: 18 }}>
                  <span style={{ color: '#FFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 9, fontWeight: 700 }}>
                    {current.name[0]?.toUpperCase()}
                  </span>
                </div>
                <span style={{ color: wsSelectorText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '16px', maxWidth: bp === 'desktop' ? undefined : bp === 'tablet' ? 160 : 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {current.name}
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                  <path d="M3 4.5L6 7.5L9 4.5" stroke={tabIdleText} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              {wsMenuOpen && (
                <WorkspaceSelector
                  workspaces={workspaces} current={current}
                  onSelect={slug => { const ws = workspaces.find(w => w.slug === slug); if (ws) { setCurrent(ws); navigate(`/w/${ws.slug}`); } }}
                  navBg={navBg} border={navBorder} textPrimary={wsSelectorText}
                  onClose={() => setWsMenuOpen(false)}
                />
              )}
            </div>

            {/* Boards tab */}
            <div
              onClick={() => navigate(`/w/${current.slug}`)}
              style={{
                alignItems: 'center', backgroundColor: isBoards ? tabActiveBg : 'transparent',
                borderRadius: 8, cursor: 'pointer', display: 'flex', gap: 4,
                paddingBlock: 5, paddingInline: 12,
              }}
            >
              <span style={{ color: isBoards ? tabActiveText : tabIdleText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, fontWeight: isBoards ? 500 : 400, lineHeight: '16px' }}>
                Boards
              </span>
            </div>

            {/* My Tasks tab */}
            <div
              onClick={() => navigate('/my-tasks')}
              style={{ borderRadius: 8, cursor: 'pointer', paddingBlock: 5, paddingInline: 12 }}
            >
              <span style={{ color: isMyTasks ? tabActiveText : tabIdleText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '16px' }}>
                My Tasks
              </span>
            </div>

            {/* Roadmaps tab */}
            <div
              onClick={() => navigate(`/w/${current.slug}/roadmaps`)}
              style={{
                alignItems: 'center', backgroundColor: isRoadmaps ? tabActiveBg : 'transparent',
                borderRadius: 8, cursor: 'pointer', display: 'flex', gap: 4,
                paddingBlock: 5, paddingInline: 12,
              }}
            >
              <span style={{ color: isRoadmaps ? tabActiveText : tabIdleText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, fontWeight: isRoadmaps ? 500 : 400, lineHeight: '16px' }}>
                Roadmaps
              </span>
            </div>
          </>
        )}

        <div style={{ flex: 1 }}/>

        {/* Search trigger */}
        <button
          onClick={() => setSearchOpen(true)}
          title="Поиск (Cmd+K)"
          style={{
            alignItems: 'center', background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            border: `1px solid ${isDark ? '#1C2236' : '#E8E5F0'}`, borderRadius: 8,
            color: tabIdleText, cursor: 'pointer', display: 'flex',
            gap: 6, padding: '5px 10px', flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M9.5 9.5l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {bp === 'desktop' && (
            <>
              <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, lineHeight: '16px' }}>Поиск</span>
              <kbd style={{
                background: isDark ? '#1C2236' : '#EDE9FE',
                border: `1px solid ${isDark ? '#2D3748' : '#D1C8EC'}`,
                borderRadius: 4, color: tabIdleText,
                fontSize: 10, padding: '1px 4px',
              }}>
                {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl+K'}
              </kbd>
            </>
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            alignItems: 'center', background: 'none', border: 'none', borderRadius: 8,
            color: tabIdleText, cursor: 'pointer', display: 'flex', flexShrink: 0,
            height: 32, justifyContent: 'center', padding: 0, width: 32,
          }}
        >
          {isDark ? (
            /* Sun icon — switch to light */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3"/>
              <line x1="8" y1="1" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="1" y1="8" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="13.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="2.929" y1="2.929" x2="3.99" y2="3.99" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="12.01" y1="12.01" x2="13.071" y2="13.071" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="13.071" y1="2.929" x2="12.01" y2="3.99" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <line x1="3.99" y1="12.01" x2="2.929" y2="13.071" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          ) : (
            /* Moon icon — switch to dark */
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>

        {/* Notification Bell */}
        <NotificationBell />

        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          <div
            data-testid="user-avatar"
            onClick={e => { e.stopPropagation(); setUserMenuOpen(v => !v); setWsMenuOpen(false); }}
            style={{ alignItems: 'center', backgroundColor: '#4F6EF7', borderRadius: '50%', cursor: 'pointer', display: 'flex', flexShrink: 0, height: 32, justifyContent: 'center', width: 32 }}
          >
            <span style={{ color: '#FFFFFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 700, lineHeight: '16px' }}>
              {userInitials}
            </span>
          </div>
          {userMenuOpen && user && (
            <UserMenu
              user={user}
              onLogout={handleLogout}
              onProfile={() => navigate('/profile')}
              onSettings={() => current && navigate(`/w/${current.slug}/settings`)}
              hasSettings={!!current}
              onAdminUsers={() => navigate('/admin/users')}
              isSuperadmin={!!user.isSuperadmin}
              navBg={navBg} border={navBorder} textPrimary={wsSelectorText} textMuted={tabIdleText}
              onClose={() => setUserMenuOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── MFA grace period banner ── */}
      {mfaGraceBanner(current)}

      {/* ── Page content ── */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'column', overflow: 'auto' }}>
        {children}
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
