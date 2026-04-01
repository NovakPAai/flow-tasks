import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useWorkspaceStore } from '../store/workspace.store';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import type { Workspace } from '../types';

// ─── Design tokens (Paper: 135-0 dark, 16D-0 light) ──────────────────────────
type Theme = Record<string, string>;
const DARK_C: Theme = {
  rootBg:       '#03050F',
  greeting:     '#8B95B0',
  title:        '#E2E8F8',
  cardBg:       '#0F1320',
  cardBorder:   '#1C2236',
  cardShadow:   'none',
  cardTitle:    '#E2E8F8',
  cardSlug:     '#8B95B0',
  roleBg:       '#151A2E',
  roleBorder:   '#1C2236',
  roleText:     '#8B95B0',
  statNum:      '#E2E8F8',
  statLabel:    '#8B95B0',
  statDivBg:    '#1C2236',
  statRowBg:    '#151A2E',
  statRowBorder:'#151A2E',
  avBorder:     '#0F1320',
  avCountBg:    '#1C2236',
  avCountText:  '#8B95B0',
  actStatus:    '#8B95B0',
  actText:      '#A0AABF',
  actTime:      '#8B95B0',
  actHeader:    '#8B95B0',
  newCardBg:    '#0F1320',
  newCardBorder:'#1C2236',
  newIconBg:    '#151A2E',
  newIconBorder:'#1C2236',
  newText:      '#8B95B0',
} as const;

const LIGHT_C: Theme = {
  rootBg:       '#F5F3FF',
  greeting:     '#6B7194',
  title:        '#1A1A2E',
  cardBg:       '#FDFCFF',
  cardBorder:   '#E8E5F0',
  cardShadow:   '#4F6EF70F 0px 2px 8px',
  cardTitle:    '#1A1A2E',
  cardSlug:     '#6B7194',
  roleBg:       '#F0ECF8',
  roleBorder:   '#D1CBF0',
  roleText:     '#6B7194',
  statNum:      '#1A1A2E',
  statLabel:    '#6B7194',
  statDivBg:    '#E8E5F0',
  statRowBg:    '#F5F3FF',
  statRowBorder:'#E8E5F0',
  avBorder:     '#FDFCFF',
  avCountBg:    '#F0ECF8',
  avCountText:  '#6B7194',
  actStatus:    '#9CA3AF',
  actText:      '#374151',
  actTime:      '#9CA3AF',
  actHeader:    '#6B7194',
  newCardBg:    '#FDFCFF',
  newCardBorder:'#D1CBF0',
  newIconBg:    '#F0ECF8',
  newIconBorder:'#D1CBF0',
  newText:      '#9CA3AF',
} as const;

const LOGO_GRAD = 'linear-gradient(in oklab 135deg, oklab(59.3% -0.002 -0.207) 0%, oklab(50.3% -.0006 -0.200) 100%)';

const WS_GRADIENTS: Record<number, string> = {
  0: 'linear-gradient(in oklab 135deg, oklab(59.3% -0.002 -0.207) 0%, oklab(65.1% -0.002 -0.186) 100%)',
  1: 'linear-gradient(in oklab 135deg, oklab(59.6% -0.122 0.037) 0%, oklab(77.3% -0.147 0.044) 100%)',
  2: 'linear-gradient(in oklab 135deg, oklab(55% 0.08 -0.18) 0%, oklab(45% 0.06 -0.15) 100%)',
  3: 'linear-gradient(in oklab 135deg, oklab(60% -0.05 0.12) 0%, oklab(50% -0.04 0.10) 100%)',
};

const AVATAR_COLORS = ['#4F6EF7', '#8B5CF6', '#F59E0B', '#34D399', '#F87171', '#38BDF8', '#FB923C'];

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
  const boardCount = ws.boards?.length ?? 0;
  const taskCount = 0; // no task count in API yet

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
          ? `${C.cardShadow}, 0 0 0 1px ${isDark ? '#2A3352' : '#D1CBF0'}`
          : C.cardShadow,
        boxSizing: 'border-box', cursor: 'pointer', flexShrink: 0,
        overflow: 'clip', paddingBlock: 24, paddingInline: 24,
        position: 'relative', width: 380,
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
            <span style={{ color: '#FFFFFF', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 18, fontWeight: 700, lineHeight: '22px' }}>
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
              <span style={{ color: '#FFFFFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 10, fontWeight: 700, lineHeight: '12px' }}>
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
        flexShrink: 0, gap: 12, justifyContent: 'center',
        minHeight: 200, opacity: hovered ? 1 : 0.6,
        paddingBlock: 24, paddingInline: 24, width: 380,
        transition: 'opacity 0.15s',
      }}
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
    return s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 50);
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

  const overlayBg = isDark ? 'rgba(0,0,0,0.6)' : 'rgba(15,19,32,0.25)';
  const modalBg = isDark ? '#0F1320' : '#FDFCFF';
  const modalBorder = isDark ? '#1C2236' : '#E8E5F0';
  const labelColor = isDark ? '#8B95B0' : '#374151';
  const inputBg = isDark ? '#151A2E' : '#F5F3FF';
  const inputBorder = isDark ? '#1C2236' : '#E8E5F0';
  const inputText = isDark ? '#E2E8F8' : '#1A1A2E';
  const inputPh = isDark ? '#3D4D6B' : '#9CA3AF';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: overlayBg, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ backgroundColor: modalBg, border: `1px solid ${modalBorder}`, borderRadius: 12, padding: 32, width: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
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
            <button type="button" onClick={onClose} style={{
              backgroundColor: 'transparent', border: `1px solid ${modalBorder}`,
              borderRadius: 8, color: C.actText, cursor: 'pointer',
              fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 500,
              padding: '9px 20px',
            }}>
              Отмена
            </button>
            <button type="submit" disabled={creating} style={{
              backgroundImage: LOGO_GRAD, border: 'none', borderRadius: 8,
              color: '#FFFFFF', cursor: creating ? 'not-allowed' : 'pointer',
              fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 600,
              opacity: creating ? 0.7 : 1, padding: '9px 24px',
            }}>
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

  useEffect(() => { load(); }, [load]);

  const firstName = user?.name?.split(' ')[0]?.toUpperCase() ?? 'ПОЛЬЗОВАТЕЛЬ';

  const handleCreate = async (name: string, slug: string, description?: string) => {
    try {
      const ws = await create({ name, slug, description });
      message.success(`Workspace "${ws.name}" создан`);
      setModalOpen(false);
      navigate(`/w/${ws.slug}`);
    } catch {
      message.error('Не удалось создать workspace');
    }
  };

  return (
    <div style={{ backgroundColor: C.rootBg, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, gap: 32, paddingBlock: '48px', paddingInline: '80px', minHeight: '100%' }}>
      {/* Header row */}
      <div style={{ alignItems: 'flex-end', display: 'flex', justifyContent: 'space-between' }}>
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
          style={{
            alignItems: 'center', backgroundImage: LOGO_GRAD,
            border: 'none', borderRadius: 8, cursor: 'pointer',
            display: 'flex', gap: 6, paddingBlock: '10px', paddingInline: '18px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 2v10M2 7h10" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <span style={{ color: '#FFFFFF', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
            Создать
          </span>
        </button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, flexShrink: 0, height: 200, opacity: 0.4, width: 380 }}/>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
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
        <div style={{ color: C.actTime, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '18px', opacity: 0.6 }}>
          Нет последних событий
        </div>
      </div>

      <CreateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} C={C} isDark={mode !== 'light'}/>
    </div>
  );
}
