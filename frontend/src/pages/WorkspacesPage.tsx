import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { formatApiError } from '../utils/apiError';
import { useWorkspaceStore } from '../store/workspace.store';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { useResponsiveValue } from '../utils/useBreakpoint';
import type { Workspace, WorkspaceEvent } from '../types';
import * as workspacesApi from '../api/workspaces';

// ─── Design tokens (Paper: 135-0 dark, 16D-0 light) ──────────────────────────
type Theme = Record<string, string>;
const DARK_C: Theme = {
  rootBg:       'var(--static-background-base)',
  greeting:     'var(--static-text-neutral-tertiary)',
  title:        'var(--static-text-neutral-primary)',
  cardBg:       'var(--static-background-lightest)',
  cardBorder:   'var(--static-border-neutral-tertiary)',
  cardShadow:   'none',
  cardTitle:    'var(--static-text-neutral-primary)',
  cardSlug:     'var(--static-text-neutral-tertiary)',
  roleBg:       'var(--static-background-light)',
  roleBorder:   'var(--static-border-neutral-tertiary)',
  roleText:     'var(--static-text-neutral-tertiary)',
  statNum:      'var(--static-text-neutral-primary)',
  statLabel:    'var(--static-text-neutral-tertiary)',
  statDivBg:    'var(--static-border-neutral-tertiary)',
  statRowBg:    'var(--static-background-light)',
  statRowBorder:'var(--static-background-light)',
  avBorder:     'var(--static-background-lightest)',
  avCountBg:    'var(--static-border-neutral-tertiary)',
  avCountText:  'var(--static-text-neutral-tertiary)',
  actStatus:    'var(--static-text-neutral-tertiary)',
  actText:      'var(--static-text-neutral-secondary)',
  actTime:      'var(--static-text-neutral-tertiary)',
  actHeader:    'var(--static-text-neutral-tertiary)',
  newCardBg:    'var(--static-background-lightest)',
  newCardBorder:'var(--static-border-neutral-tertiary)',
  newIconBg:    'var(--static-background-light)',
  newIconBorder:'var(--static-border-neutral-tertiary)',
  newText:      'var(--static-text-neutral-tertiary)',
} as const;

const LIGHT_C: Theme = {
  rootBg:       'var(--static-background-base)',
  greeting:     'var(--static-text-neutral-tertiary)',
  title:        'var(--static-text-neutral-primary)',
  cardBg:       'var(--static-background-lightest)',
  cardBorder:   'var(--static-border-neutral-tertiary)',
  cardShadow:   'var(--shadow-sm)',
  cardTitle:    'var(--static-text-neutral-primary)',
  cardSlug:     'var(--static-text-neutral-tertiary)',
  roleBg:       'var(--static-background-light)',
  roleBorder:   'var(--component-border-neutral-medium)',
  roleText:     'var(--static-text-neutral-tertiary)',
  statNum:      'var(--static-text-neutral-primary)',
  statLabel:    'var(--static-text-neutral-tertiary)',
  statDivBg:    'var(--static-border-neutral-tertiary)',
  statRowBg:    'var(--static-background-base)',
  statRowBorder:'var(--static-border-neutral-tertiary)',
  avBorder:     'var(--static-background-lightest)',
  avCountBg:    'var(--static-background-light)',
  avCountText:  'var(--static-text-neutral-tertiary)',
  actStatus:    'var(--neutral-8)',
  actText:      'var(--static-text-neutral-secondary)',
  actTime:      'var(--neutral-8)',
  actHeader:    'var(--static-text-neutral-tertiary)',
  newCardBg:    'var(--static-background-lightest)',
  newCardBorder:'var(--component-border-neutral-medium)',
  newIconBg:    'var(--static-background-light)',
  newIconBorder:'var(--component-border-neutral-medium)',
  newText:      'var(--neutral-8)',
} as const;

const WS_GRADIENTS: Record<number, string> = {
  0: 'linear-gradient(in oklab 135deg, oklab(59.3% -0.002 -0.207) 0%, oklab(65.1% -0.002 -0.186) 100%)',
  1: 'linear-gradient(in oklab 135deg, oklab(59.6% -0.122 0.037) 0%, oklab(77.3% -0.147 0.044) 100%)',
  2: 'linear-gradient(in oklab 135deg, oklab(55% 0.08 -0.18) 0%, oklab(45% 0.06 -0.15) 100%)',
  3: 'linear-gradient(in oklab 135deg, oklab(60% -0.05 0.12) 0%, oklab(50% -0.04 0.10) 100%)',
};

const AVATAR_COLORS = ['var(--brand-8)', 'var(--brand-gold-8)', 'var(--warning-6)', 'var(--success-7)', 'var(--error-8)', 'var(--info-7)', 'var(--warning-7)'];

function initials(name: string): string {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function avatarColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

// ─── Workspace card ───────────────────────────────────────────────────────────
function WorkspaceCard({ ws, idx, onClick, C, isDark }: {
  ws: Workspace; idx: number; onClick: () => void;
  C: Theme; isDark: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const grad = WS_GRADIENTS[idx % Object.keys(WS_GRADIENTS).length];
  const letter = ws.name[0]?.toUpperCase() ?? '?';
  const members = ws.members ?? [];
  const visibleAvatars = members.slice(0, 3);
  const extraCount = Math.max(0, (ws.memberCount ?? members.length) - 3);
  const boardCount = ws.boardCount ?? ws.boards?.length ?? 0;
  const taskCount = ws.taskCount ?? 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: C.cardBg,
        border: `1px solid ${C.cardBorder}`,
        borderRadius: 12,
        boxShadow: hovered
          ? `${C.cardShadow}, 0 0 0 1px ${isDark ? 'var(--component-border-neutral-medium)' : 'var(--component-border-neutral-medium)'}`
          : C.cardShadow,
        boxSizing: 'border-box', cursor: 'pointer',
        overflow: 'clip', paddingBlock: 24, paddingInline: 24,
        position: 'relative', width: '100%',
        transition: 'box-shadow 0.15s',
      }}
    >
      {/* Card header */}
      <div style={{ alignItems: 'flex-start', display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
          <div style={{
            alignItems: 'center', backgroundImage: grad, borderRadius: 10,
            display: 'flex', flexShrink: 0, height: 44, justifyContent: 'center', width: 44,
          }}>
            <span style={{ color: 'var(--neutral-0)', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 18, fontWeight: 700, lineHeight: '22px' }}>
              {letter}
            </span>
          </div>
          <div>
            <div style={{ color: C.cardTitle, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '20px' }}>
              {ws.name}
            </div>
            <div style={{ color: C.cardSlug, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, lineHeight: '16px', marginTop: 2 }}>
              {ws.slug}
            </div>
          </div>
        </div>
        {ws.role && (
          <div style={{
            backgroundColor: C.roleBg, border: `1px solid ${C.roleBorder}`,
            borderRadius: 6, paddingBlock: 4, paddingInline: 10, flexShrink: 0,
          }}>
            <span style={{ color: C.roleText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
              {ws.role === 'OWNER' ? 'Owner' : ws.role === 'MEMBER' ? 'Member' : 'Viewer'}
            </span>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{
        borderTop: `1px solid ${C.statRowBorder}`, borderBottom: `1px solid ${C.statRowBorder}`,
        display: 'flex', gap: 20, marginBottom: 16, paddingBlock: 12,
      }}>
        {[
          { val: boardCount, label: 'Доски' },
          { val: taskCount, label: 'Задачи' },
          { val: ws.memberCount ?? members.length, label: 'Участники' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {i > 0 && <div style={{ backgroundColor: C.statDivBg, flexShrink: 0, width: 1, height: '100%', alignSelf: 'stretch' }}/>}
            <div>
              <div style={{ color: C.statNum, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 20, fontWeight: 700, lineHeight: '24px', textAlign: 'center' }}>
                {s.val}
              </div>
              <div style={{ color: C.statLabel, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 11, lineHeight: '14px', marginTop: 2, textAlign: 'center' }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Members avatar stack */}
      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ alignItems: 'center', display: 'flex' }}>
          {visibleAvatars.map((m, i) => (
            <div key={m.id} style={{
              alignItems: 'center', backgroundColor: avatarColor(m.user.name),
              border: `2px solid ${C.avBorder}`, borderRadius: '50%',
              display: 'flex', flexShrink: 0, height: 28, justifyContent: 'center',
              marginLeft: i > 0 ? -8 : 0, width: 28,
            }}>
              <span style={{ color: 'var(--neutral-0)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 10, fontWeight: 700, lineHeight: '12px' }}>
                {initials(m.user.name)}
              </span>
            </div>
          ))}
          {(extraCount > 0 || (members.length === 0 && (ws.memberCount ?? 0) > 0)) && (
            <div style={{
              alignItems: 'center', backgroundColor: C.avCountBg,
              border: `2px solid ${C.avBorder}`, borderRadius: '50%',
              display: 'flex', flexShrink: 0, height: 28, justifyContent: 'center',
              marginLeft: visibleAvatars.length > 0 ? -8 : 0, width: 28,
            }}>
              <span style={{ color: C.avCountText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 10, fontWeight: 600, lineHeight: '12px' }}>
                +{extraCount || ws.memberCount}
              </span>
            </div>
          )}
        </div>
        <span style={{ color: C.actStatus, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, lineHeight: '16px' }}>
          {idx === 0 ? 'Активно сейчас' : ''}
        </span>
      </div>

      {/* Corner glow */}
      <div style={{
        backgroundImage: `radial-gradient(circle farthest-corner at 100% 0% in oklab, ${grad.match(/oklab\([^)]+\)/)?.[0] ?? 'oklab(59.3% -0.002 -0.207)'} / 15%) 0%, oklab(0% 0 0 / 0%) 70%)`,
        boxSizing: 'border-box', height: 120, position: 'absolute', right: 0, top: 0, width: 120,
        pointerEvents: 'none',
      }}/>
    </div>
  );
}

// ─── "New workspace" empty card ───────────────────────────────────────────────
function NewWorkspaceCard({ onClick, C }: { onClick: () => void; C: Theme }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        alignItems: 'center', backgroundColor: C.newCardBg,
        border: `1px dashed ${C.newCardBorder}`, borderRadius: 12,
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
        gap: 12, justifyContent: 'center',
        minHeight: 200, opacity: hovered ? 1 : 0.6,
        paddingBlock: 24, paddingInline: 24, width: '100%',
        transition: 'opacity 0.15s',
      }}
      data-onboarding="create-workspace"
    >
      <div style={{
        alignItems: 'center', backgroundColor: C.newIconBg,
        border: `1px dashed ${C.newIconBorder}`, borderRadius: 10,
        display: 'flex', flexShrink: 0, height: 44, justifyContent: 'center', width: 44,
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 4v12M4 10h12" stroke={C.newText} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
      <div>
        <div style={{ color: C.newText, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 15, fontWeight: 600, lineHeight: '18px', textAlign: 'center' }}>
          Новое пространство
        </div>
        <div style={{ color: C.newText, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, lineHeight: '16px', marginTop: 4, opacity: 0.7, textAlign: 'center' }}>
          Создайте для новой команды
        </div>
      </div>
    </div>
  );
}

// ─── Create workspace modal ───────────────────────────────────────────────────
function CreateModal({ open, onClose, onCreate, C, isDark }: {
  open: boolean; onClose: () => void;
  onCreate: (name: string, slug: string, description?: string) => Promise<void>;
  C: Theme; isDark: boolean;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);

  function toSlug(s: string) {
    const CYR: Record<string, string> = {
      а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
      к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
      х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
    };
    return s.toLowerCase().split('').map(c => CYR[c] ?? c).join('')
      .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50);
  }

  const handleNameChange = (v: string) => {
    setName(v);
    setSlug(toSlug(v));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setCreating(true);
    try {
      await onCreate(name.trim(), slug.trim(), desc.trim() || undefined);
      setName(''); setSlug(''); setDesc('');
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  const overlayBg = isDark ? 'var(--component-fill-neutral-soft-active)' : 'var(--component-fill-neutral-soft-active)';
  const modalBg = isDark ? 'var(--static-background-lightest)' : 'var(--static-background-lightest)';
  const modalBorder = isDark ? 'var(--static-border-neutral-tertiary)' : 'var(--static-border-neutral-tertiary)';
  const labelColor = isDark ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-secondary)';
  const inputBg = isDark ? 'var(--static-background-light)' : 'var(--static-background-base)';
  const inputBorder = isDark ? 'var(--static-border-neutral-tertiary)' : 'var(--static-border-neutral-tertiary)';
  const inputText = isDark ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)';
  const inputPh = isDark ? 'var(--neutral-8)' : 'var(--neutral-8)';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: modalBg, border: `1px solid ${modalBorder}`, borderRadius: 12, padding: 32, width: 480, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ color: C.title, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 24 }}>
          Новое пространство
        </div>
        <form onSubmit={handleSubmit}>
          {[
            { label: 'Название', value: name, onChange: handleNameChange, placeholder: 'Моя команда', type: 'text' },
            { label: 'Slug (URL)', value: slug, onChange: setSlug, placeholder: 'moya-komanda', type: 'text' },
            { label: 'Описание', value: desc, onChange: setDesc, placeholder: 'Необязательно', type: 'text' },
          ].map(({ label, value, onChange, placeholder, type }) => (
            <div key={label} style={{ marginBottom: 16 }}>
              <div style={{ color: labelColor, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
                {label}
              </div>
              <input
                type={type} value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                required={label !== 'Описание'}
                style={{
                  width: '100%', backgroundColor: inputBg, border: `1px solid ${inputBorder}`,
                  borderRadius: 8, color: value ? inputText : inputPh,
                  fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13,
                  outline: 'none', padding: '10px 14px', boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="button" onClick={onClose} className="sigma-btn sigma-btn-md sigma-btn-neutral-outline">
              Отмена
            </button>
            <button type="submit" disabled={creating} className="sigma-btn sigma-btn-md sigma-btn-brand-solid">
              {creating ? '...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { workspaces, loading, load, create } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { mode } = useThemeStore();
  const C = mode === 'light' ? LIGHT_C : DARK_C;
  const [modalOpen, setModalOpen] = useState(false);
  const [recentEvents, setRecentEvents] = useState<WorkspaceEvent[]>([]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (workspaces.length === 0) return;
    const ownerWs = workspaces.find(w => w.role === 'OWNER');
    if (!ownerWs) return;
    workspacesApi.getWorkspaceHistory(ownerWs.id, { limit: 5 })
      .then(({ events }) => setRecentEvents(events))
      .catch(() => {});
  }, [workspaces]);

  const gap         = useResponsiveValue(20, 28, 32);
  const paddingBlock  = useResponsiveValue('24px', '32px', '48px');
  const paddingInline = useResponsiveValue('16px', '40px', '80px');
  const firstName = (user?.firstName ?? user?.name?.trim().split(/\s+/)[0] ?? 'ПОЛЬЗОВАТЕЛЬ').toUpperCase();

  const handleCreate = async (name: string, slug: string, description?: string) => {
    try {
      const ws = await create({ name, slug, description });
      message.success(`Workspace "${ws.name}" создан`);
      setModalOpen(false);
      navigate(`/w/${ws.slug}`);
    } catch (e) {
      message.error(formatApiError(e));
    }
  };

  return (
    <div style={{ backgroundColor: C.rootBg, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, gap, paddingBlock, paddingInline, minHeight: '100%' }}>
      {/* Header row */}
      <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: C.greeting, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', lineHeight: '16px', marginBottom: 8, textTransform: 'uppercase' }}>
            Привет, {firstName}
          </div>
          <div style={{ color: C.title, fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '34px' }}>
            Мои рабочие пространства
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="sigma-btn sigma-btn-md sigma-btn-brand-solid"
          style={{
            paddingInline: 18,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span>
            Создать
          </span>
        </button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 24 }}>
          {[0, 1].map(i => (
            <div key={i} style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, height: 200, opacity: 0.4 }}/>
          ))}
        </div>
      ) : (
        <div data-testid="workspaces-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 24 }}>
          {workspaces.map((ws: Workspace, idx: number) => (
            <WorkspaceCard key={ws.id} ws={ws} idx={idx} C={C} isDark={mode !== 'light'} onClick={() => navigate(`/w/${ws.slug}`)}/>
          ))}
          <NewWorkspaceCard C={C} onClick={() => setModalOpen(true)}/>
        </div>
      )}

      {/* Activity section */}
      <div>
        <div style={{ color: C.actHeader, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', lineHeight: '16px', marginBottom: 16, textTransform: 'uppercase' }}>
          Последняя активность
        </div>
        {recentEvents.length === 0 ? (
          <div style={{ color: C.actTime, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '18px', opacity: 0.6 }}>
            Нет последних событий
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentEvents.map(ev => {
              const name = ev.user?.name ?? 'Кто-то';
              const nameParts = name.trim().split(/\s+/);
              const isFem = /[аяАЯ]$/u.test(nameParts[nameParts.length - 1] ?? name);
              const ACTION_LABELS: Record<string, string> = {
                workspace_created: isFem ? 'создала пространство' : 'создал пространство',
                workspace_updated: isFem ? 'обновила настройки' : 'обновил настройки',
                member_added:      isFem ? 'добавила участника' : 'добавил участника',
                member_removed:    isFem ? 'удалила участника' : 'удалил участника',
                board_created:     isFem ? 'создала доску' : 'создал доску',
                board_deleted:     isFem ? 'удалила доску' : 'удалил доску',
                member_role_changed: isFem ? 'изменила роль участника' : 'изменил роль участника',
              };
              const label = ACTION_LABELS[ev.action] ?? ev.action;
              const ws = workspaces.find(w => w.id === ev.workspaceId);
              const time = new Date(ev.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-8)', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, color: C.actText, flex: 1, overflow: 'hidden' }}>
                    <span style={{ fontWeight: 600 }}>{name}</span>
                    {' '}{label}{ws ? ` «${ws.name}»` : ''}
                  </span>
                  <span style={{ fontFamily: '"Inter", system-ui, sans-serif', fontSize: 11, color: C.actTime, flexShrink: 0, whiteSpace: 'nowrap' }}>{time}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} C={C} isDark={mode !== 'light'}/>
    </div>
  );
}
