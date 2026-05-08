import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useWorkspaceStore } from '../store/workspace.store';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import type { Board, WorkspaceEvent } from '../types';
import * as workspacesApi from '../api/workspaces';
import * as boardsApi from '../api/boards';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: 'var(--static-background-base)',
  hdrBorder: 'var(--static-border-neutral-tertiary)',
  backText: 'var(--neutral-8)',
  title: 'var(--static-text-neutral-primary)',
  sub: 'var(--static-text-neutral-tertiary)',
  statsNum: 'var(--static-text-neutral-primary)',
  statsLbl: 'var(--neutral-8)',
  div: 'var(--static-border-neutral-tertiary)',
  secLbl: 'var(--neutral-8)',
  cardBg: 'var(--static-background-lightest)',
  cardBorder: 'var(--static-border-neutral-tertiary)',
  cardTitle: 'var(--static-text-neutral-primary)',
  cardSub: 'var(--neutral-8)',
  pillBg: 'var(--static-border-neutral-tertiary)',
  pillText: 'var(--static-text-neutral-tertiary)',
  taskCnt: 'var(--static-text-neutral-tertiary)',
  modalBg: 'var(--static-background-lightest)',
  inpBg: 'var(--static-background-light)',
  inpBorder: 'var(--component-border-neutral-medium)',
  inpText: 'var(--static-text-neutral-primary)',
  lbl: 'var(--static-text-neutral-tertiary)',
  overlay: 'var(--component-fill-neutral-soft-active)',
};

const LIGHT: C = {
  bg: 'var(--static-background-base)',
  hdrBorder: 'var(--static-border-neutral-tertiary)',
  backText: 'var(--static-text-neutral-tertiary)',
  title: 'var(--static-text-neutral-primary)',
  sub: 'var(--static-text-neutral-tertiary)',
  statsNum: 'var(--static-text-neutral-primary)',
  statsLbl: 'var(--static-text-neutral-tertiary)',
  div: 'var(--static-border-neutral-tertiary)',
  secLbl: 'var(--static-text-neutral-tertiary)',
  cardBg: 'var(--static-background-lightest)',
  cardBorder: 'var(--static-border-neutral-tertiary)',
  cardTitle: 'var(--static-text-neutral-primary)',
  cardSub: 'var(--static-text-neutral-tertiary)',
  pillBg: 'var(--static-background-base)',
  pillText: 'var(--static-text-neutral-tertiary)',
  taskCnt: 'var(--static-text-neutral-tertiary)',
  modalBg: 'var(--neutral-0)',
  inpBg: 'var(--static-background-base)',
  inpBorder: 'var(--static-border-neutral-tertiary)',
  inpText: 'var(--static-text-neutral-primary)',
  lbl: 'var(--static-text-neutral-tertiary)',
  overlay: 'var(--component-fill-neutral-soft-active)',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const WS_COLORS = ['var(--success-8)', 'var(--brand-8)', 'var(--brand-gold-8)', 'var(--warning-6)', 'var(--brand-7)', 'var(--info-8)'];
const BD_COLORS = ['var(--brand-8)', 'var(--brand-gold-8)', 'var(--success-8)', 'var(--warning-6)', 'var(--brand-7)', 'var(--error-10)', 'var(--info-8)'];

function pickColor(name: string, palette: string[]): string {
  return palette[(name.charCodeAt(0) || 0) % palette.length];
}

function initials(name: string, len = 2): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, len).join('').toUpperCase() || '?';
}

function pluralTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} задач`;
  if (m10 === 1) return `${n} задача`;
  if (m10 >= 2 && m10 <= 4) return `${n} задачи`;
  return `${n} задач`;
}

// ── SettingsBtn ───────────────────────────────────────────────────────────────
function SettingsBtn({ onClick, label, borderColor, iconColor }: {
  onClick: () => void; label?: string; borderColor: string; iconColor: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Настройки"
      style={{
        display: 'flex', alignItems: 'center', gap: label ? 6 : 0,
        justifyContent: 'center', height: 36, padding: label ? '0 12px' : '0 10px',
        background: hovered ? 'var(--component-fill-brand-soft-default)' : 'transparent',
        border: `1px solid ${hovered ? 'var(--component-fill-brand-soft-pressed)' : borderColor}`,
        borderRadius: 8, cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke={hovered ? 'var(--brand-8)' : iconColor} strokeWidth="1.4" strokeLinecap="round"/>
        <path d="M13.3 6.6l-.7-.4a5.1 5.1 0 0 0 0-1.4l.7-.4a.6.6 0 0 0 .2-.8l-.8-1.4a.6.6 0 0 0-.8-.2l-.7.4a5 5 0 0 0-1.2-.7V1a.6.6 0 0 0-.6-.6H7.6A.6.6 0 0 0 7 1v.7a5 5 0 0 0-1.2.7l-.7-.4a.6.6 0 0 0-.8.2L3.5 3.6a.6.6 0 0 0 .2.8l.7.4a5.1 5.1 0 0 0 0 1.4l-.7.4a.6.6 0 0 0-.2.8l.8 1.4c.2.3.5.4.8.2l.7-.4c.4.3.8.5 1.2.7V10a.6.6 0 0 0 .6.6h1.6a.6.6 0 0 0 .6-.6v-.7c.4-.2.8-.4 1.2-.7l.7.4c.3.2.6.1.8-.2l.8-1.4a.6.6 0 0 0-.2-.8Z" stroke={hovered ? 'var(--brand-8)' : iconColor} strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
      {label && <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 500, color: hovered ? 'var(--brand-8)' : iconColor, transition: 'color 0.15s' }}>{label}</span>}
    </button>
  );
}

// ── BoardCard ──────────────────────────────────────────────────────────────────
function BoardCard({ board, onClick, c, isDark }: {
  board: Board; onClick: () => void; c: C; isDark: boolean;
}) {
  const taskCount = board._count?.tasks ?? 0;
  const statuses = board.workflow?.statuses ?? [];
  const color = pickColor(board.name, BD_COLORS);

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', width: '100%',
        background: c.cardBg, border: `1px solid ${c.cardBorder}`,
        borderRadius: 14, padding: '22px 24px', cursor: 'pointer',
        boxShadow: isDark ? 'none' : 'var(--shadow-sm)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 34, height: 34, background: color, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--neutral-0)' }}>
            {initials(board.name, 1)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: c.cardTitle, letterSpacing: '-0.2px' }}>
              {board.name}
            </span>
            {board.isPrivate && (
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                <title>Приватная доска</title>
                <path d="M9.5 5.5H2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" stroke={c.cardSub} strokeWidth="1.2"/>
                <path d="M4 5.5V3.5a2 2 0 1 1 4 0v2" stroke={c.cardSub} strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            )}
          </div>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.cardSub }}>
            {board.prefix}{board.description ? ` · ${board.description}` : ''}
          </span>
        </div>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <path d="M5 2.5L9.5 7L5 11.5" stroke={c.cardSub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Workflow status pills */}
      {statuses.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {statuses.slice(0, 4).map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: c.pillBg, borderRadius: 6, padding: '4px 10px' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
              <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.pillText }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.taskCnt }}>
          {pluralTasks(taskCount)}
        </span>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const RU_TO_EN: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'j',к:'k',
  л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',
  ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};

function nameToPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  let result: string;
  if (words.length === 1) {
    // single word — take first 4 transliterated chars
    result = words[0].toLowerCase().slice(0, 6).split('').map(c => RU_TO_EN[c] ?? c).join('');
  } else {
    // multiple words — first transliterated letter of each word
    result = words.map(w => {
      const ch = w[0]?.toLowerCase() ?? '';
      return RU_TO_EN[ch] ?? ch;
    }).join('');
  }
  return result.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

// ── Page ───────────────────────────────────────────────────────────────────────
type FormState = { name: string; prefix: string; description: string };

export default function WorkspaceDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const isDark = mode === 'dark';

  const { workspaces, current, setCurrent, loading: wsLoading, load, incrementBoardCount } = useWorkspaceStore();
  const [boards, setBoards] = useState<Board[]>([]);
  const [activity, setActivity] = useState<WorkspaceEvent[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', prefix: '', description: '' });
  const [prefixTouched, setPrefixTouched] = useState(false);
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  useEffect(() => { if (workspaces.length === 0) load(); }, [workspaces.length, load]);

  // Derive the workspace ID outside the effect to avoid stale closure.
  // Always refresh current on mount/slug change so memberCount, boardCount
  // are never stale after settings mutations.
  const foundId = workspaces.find(w => w.slug === slug)?.id;
  useEffect(() => {
    if (!foundId) return;
    workspacesApi.getWorkspace(foundId).then(setCurrent).catch(() => null);
  }, [foundId, setCurrent]);

  const currentId = current?.id;
  useEffect(() => {
    if (!currentId) return;
    setBoardsLoading(true);
    boardsApi.listBoards(currentId)
      .then(setBoards)
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false));
    workspacesApi.getWorkspaceHistory(currentId, { limit: 6 })
      .then(({ events }) => setActivity(events))
      .catch(() => {});
  }, [currentId]);

  const onCreateBoard = async () => {
    if (!current || !form.name.trim() || !form.prefix.trim()) return;
    setCreating(true);
    try {
      const board = await boardsApi.createBoard(current.id, {
        name: form.name.trim(),
        prefix: form.prefix.trim().toUpperCase(),
        description: form.description.trim() || undefined,
      });
      setBoards(prev => [...prev, board]);
      incrementBoardCount(current.id);
      message.success(`Доска "${board.name}" создана`);
      closeModal();
      navigate(`/w/${slug}/boards/${board.prefix.toLowerCase()}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error ?? 'Не удалось создать доску');
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => { setCreateOpen(false); setForm({ name: '', prefix: '', description: '' }); setPrefixTouched(false); };

  // ── Spinner util ─────────────────────────────────────────────────────────────
  const Spinner = ({ size = 32 }: { size?: number }) => (
    <div style={{
      width: size, height: size,
      border: `${size > 24 ? 3 : 2}px solid ${c.hdrBorder}`,
      borderTopColor: 'var(--brand-8)', borderRadius: '50%',
      animation: 'ft-spin 0.8s linear infinite',
    }} />
  );

  if (wsLoading || (!current && workspaces.length === 0)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: c.bg }}>
        <Spinner />
        <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: c.bg, gap: 16 }}>
        <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, color: c.sub }}>Workspace не найден</span>
        <button
          onClick={() => navigate('/workspaces')}
          style={{ background: 'var(--brand-8)', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--neutral-0)' }}
        >
          Назад
        </button>
      </div>
    );
  }

  const wsColor = pickColor(current.name, WS_COLORS);
  const wsInit = initials(current.name);
  const role = current.role ?? 'MEMBER';
  const memberCount = current.memberCount ?? current.members?.length ?? 0;
  const totalTasks = boards.reduce((sum, b) => sum + (b._count?.tasks ?? 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: c.bg }}>
      <style>{`@keyframes ft-spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── Workspace header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: isMobile ? '20px 16px 16px' : bp === 'tablet' ? '24px 32px 20px' : '36px 48px 28px', borderBottom: `1px solid ${c.hdrBorder}`, flexShrink: 0 }}>
        {/* Back link */}
        <div
          onClick={() => navigate('/workspaces')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, cursor: 'pointer', width: 'fit-content' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7L9 11.5" stroke={c.backText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.backText, letterSpacing: '0.02em' }}>Все пространства</span>
        </div>

        {/* Title row — stacks on mobile/tablet */}
        <div style={{ display: 'flex', flexDirection: bp === 'desktop' ? 'row' : 'column', alignItems: bp === 'desktop' ? 'center' : 'flex-start', gap: bp === 'desktop' ? 0 : 12 }}>

          {/* Top: icon + name + role */}
          <div style={{ display: 'flex', alignItems: 'center', flex: isMobile ? undefined : 1, minWidth: 0, marginRight: isMobile ? 0 : 0 }}>
            <div style={{ width: 48, height: 48, background: wsColor, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, flexShrink: 0 }}>
              <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--neutral-0)' }}>{wsInit}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.title, letterSpacing: '-0.5px', margin: 0 }}>
                  {current.name}
                </h1>
                <span style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 500,
                  color: 'var(--brand-8)', background: isDark ? 'var(--component-fill-brand-soft-default)' : 'var(--component-fill-brand-soft-default)',
                  border: '1px solid var(--component-fill-brand-soft-hover)', borderRadius: 4, padding: '2px 8px',
                  letterSpacing: '0.05em', flexShrink: 0,
                }}>
                  {role}
                </span>
              </div>
              <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {current.slug}{current.description ? ` · ${current.description}` : ''}
              </span>
            </div>
          </div>

          {/* Stats + action buttons row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 8, flexWrap: 'wrap', width: isMobile ? '100%' : undefined }}>
            {/* Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 28, marginRight: isMobile ? 'auto' : 32, flexShrink: 0 }}>
              {([
                { num: boards.length, label: 'Доски' },
                { num: totalTasks, label: 'Задачи' },
                { num: memberCount, label: 'Участники' },
              ] as const).map((stat, i) => (
                <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 16 : 28 }}>
                  {i > 0 && <div style={{ width: 1, height: 28, background: c.div }} />}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: isMobile ? 18 : 22, fontWeight: 700, color: c.statsNum, lineHeight: '28px' }}>{stat.num}</span>
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.statsLbl, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Settings button */}
            <SettingsBtn onClick={() => navigate(`/w/${slug}/settings`)} label={bp !== 'mobile' ? 'Настройки' : undefined} borderColor={c.hdrBorder} iconColor={c.sub} />
            {/* Private badge */}
            {current.isPrivate && (
              <div title="Приватное пространство" style={{ display: 'flex', alignItems: 'center', gap: 4, background: isDark ? 'var(--component-fill-brand-soft-hover)' : 'var(--component-fill-brand-soft-default)', border: '1px solid var(--component-border-brand-medium)', borderRadius: 6, padding: '3px 8px', flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 12 12" fill="none"><path d="M9.5 5.5H2.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1Z" stroke="var(--brand-8)" strokeWidth="1.2"/><path d="M4 5.5V3.5a2 2 0 1 1 4 0v2" stroke="var(--brand-8)" strokeWidth="1.2" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--brand-8)', fontFamily: '"Inter",system-ui,sans-serif' }}>Приватное</span>
              </div>
            )}

            {/* Create board button */}
            <button
              data-onboarding="create-board"
              onClick={() => setCreateOpen(true)}
              className="sigma-btn sigma-btn-md sigma-btn-brand-solid"
              style={{ flexShrink: 0, paddingInline: 18 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {!isMobile && <span>Создать доску</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: isMobile ? '20px 16px' : '28px 48px', overflowY: 'auto' }}>

        {/* Quick nav */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginBottom: 32 }}>
          {[
            {
              title: 'Мои задачи',
              desc: 'Назначенные вам задачи',
              color: 'var(--brand-8)',
              icon: (
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <path d="M3 5.5h7M3 9h5M3 12.5h4" stroke="var(--brand-8)" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="13" cy="11" r="3.5" stroke="var(--brand-8)" strokeWidth="1.4"/>
                  <path d="M11.8 11l.8.8 1.7-1.7" stroke="var(--brand-8)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ),
              onClick: () => navigate('/my-tasks'),
            },
            {
              title: 'Дорожные карты',
              desc: `${boards.length} ${boards.length === 1 ? 'доска' : boards.length < 5 ? 'доски' : 'досок'} · сроки и прогресс`,
              color: 'var(--warning-6)',
              icon: (
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                  <line x1="2" y1="5"  x2="12" y2="5"  stroke="var(--warning-6)" strokeWidth="1.6" strokeLinecap="round"/>
                  <line x1="6" y1="9"  x2="16" y2="9"  stroke="var(--warning-6)" strokeWidth="1.6" strokeLinecap="round"/>
                  <line x1="3" y1="13" x2="13" y2="13" stroke="var(--warning-6)" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              ),
              onClick: () => navigate(`/w/${slug}/roadmaps`),
            },
          ].map(item => (
            <div
              key={item.title}
              onClick={item.onClick}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                transition: 'border-color .14s, box-shadow .12s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--component-border-brand-medium)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = c.cardBorder;
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${item.color}18` }}>
                {item.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: c.cardTitle }}>{item.title}</div>
                <div style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.cardSub, marginTop: 2 }}>{item.desc}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, color: c.cardSub }}>
                <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600, color: c.secLbl, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Доски · {boards.length}
          </span>
        </div>

        {boardsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <Spinner size={28} />
          </div>
        ) : boards.length === 0 ? (
          <div style={{ border: `2px dashed ${c.hdrBorder}`, borderRadius: 14, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="2" y="2" width="13" height="13" rx="3" stroke={c.secLbl} strokeWidth="1.5"/>
              <rect x="17" y="2" width="13" height="13" rx="3" stroke={c.secLbl} strokeWidth="1.5"/>
              <rect x="2" y="17" width="13" height="13" rx="3" stroke={c.secLbl} strokeWidth="1.5"/>
              <rect x="17" y="17" width="13" height="13" rx="3" stroke={c.secLbl} strokeWidth="1.5" strokeDasharray="2 2"/>
            </svg>
            <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, color: c.sub }}>Нет досок. Создайте первую!</span>
            <button
              onClick={() => setCreateOpen(true)}
              style={{ background: 'var(--brand-8)', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--neutral-0)' }}
            >
              Создать доску
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
            {boards.map(board => (
              <BoardCard
                key={board.id} board={board} c={c} isDark={isDark}
                onClick={() => navigate(`/w/${slug}/boards/${board.prefix.toLowerCase()}`)}
              />
            ))}
          </div>
        )}

        {/* ── Activity ──────────────────────────────────────────────────── */}
        {activity.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 600, color: c.secLbl, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: 14 }}>
              Последняя активность
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {activity.map(ev => {
                const name = ev.user?.name ?? 'Кто-то';
                const nameParts = name.trim().split(/\s+/);
                const isFem = /[аяАЯ]$/u.test(nameParts[nameParts.length - 1] ?? '');
                const m = (ev.meta ?? {}) as Record<string, string>;

                const ACTION_LABELS: Record<string, string> = {
                  workspace_created:       isFem ? 'создала пространство' : 'создал пространство',
                  workspace_updated:       isFem ? 'обновила настройки пространства' : 'обновил настройки пространства',
                  member_added:            isFem ? `добавила участника ${m.name ?? ''}` : `добавил участника ${m.name ?? ''}`,
                  member_removed:          isFem ? `удалила участника ${m.name ?? ''}` : `удалил участника ${m.name ?? ''}`,
                  member_role_changed:     isFem ? `изменила роль ${m.name ?? ''}` : `изменил роль ${m.name ?? ''}`,
                  board_created:           isFem ? `создала доску «${m.name ?? ''}»` : `создал доску «${m.name ?? ''}»`,
                  board_updated:           m.nameFrom
                    ? (isFem ? `переименовала доску «${m.nameFrom}» → «${m.nameTo ?? ''}»` : `переименовал доску «${m.nameFrom}» → «${m.nameTo ?? ''}»`)
                    : (isFem ? `обновила доску «${m.boardName ?? ''}»` : `обновил доску «${m.boardName ?? ''}»`),
                  board_deleted:           isFem ? `удалила доску «${m.name ?? ''}»` : `удалил доску «${m.name ?? ''}»`,
                  workflow_created:        isFem ? `создала воркфлоу «${m.name ?? ''}»` : `создал воркфлоу «${m.name ?? ''}»`,
                  workflow_updated:        m.nameFrom
                    ? (isFem ? `переименовала воркфлоу «${m.nameFrom}» → «${m.nameTo ?? ''}»` : `переименовал воркфлоу «${m.nameFrom}» → «${m.nameTo ?? ''}»`)
                    : (isFem ? `обновила воркфлоу «${m.workflowName ?? ''}»` : `обновил воркфлоу «${m.workflowName ?? ''}»`),
                  workflow_deleted:        isFem ? `удалила воркфлоу «${m.name ?? ''}»` : `удалил воркфлоу «${m.name ?? ''}»`,
                  workflow_status_added:   isFem ? `добавила колонку «${m.statusName ?? ''}» в воркфлоу «${m.workflowName ?? ''}»` : `добавил колонку «${m.statusName ?? ''}» в воркфлоу «${m.workflowName ?? ''}»`,
                  workflow_status_renamed: isFem ? `переименовала колонку «${m.nameFrom ?? ''}» → «${m.nameTo ?? ''}»` : `переименовал колонку «${m.nameFrom ?? ''}» → «${m.nameTo ?? ''}»`,
                  workflow_status_deleted: isFem ? `удалила колонку «${m.statusName ?? ''}» из воркфлоу «${m.workflowName ?? ''}»` : `удалил колонку «${m.statusName ?? ''}» из воркфлоу «${m.workflowName ?? ''}»`,
                };
                const label = ACTION_LABELS[ev.action] ?? ev.action;
                const time  = new Date(ev.createdAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                const AVATAR_COLORS = ['var(--brand-8)','var(--brand-gold-8)','var(--warning-6)','var(--success-7)','var(--error-8)','var(--info-7)'];
                const avColor = AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
                const initials = name.split(/\s+/).map((p: string) => p[0]).slice(0,2).join('').toUpperCase();

                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${c.cardBorder}` }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: avColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--neutral-0)' }}>{initials}</span>
                    </div>
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.cardSub, flex: 1 }}>
                      <span style={{ color: c.cardTitle, fontWeight: 500 }}>{name}</span> {label}
                    </span>
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.cardSub, flexShrink: 0 }}>{time}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Create board modal ────────────────────────────────────────────── */}
      {createOpen && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: c.overlay, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: c.modalBg, border: `1px solid ${c.hdrBorder}`, borderRadius: 16, padding: '28px 32px', width: 440, display: 'flex', flexDirection: 'column', gap: 20 }}
          >
            <h2 style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 18, fontWeight: 700, color: c.title, margin: 0 }}>Новая доска</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: c.lbl }}>
                Название <span style={{ color: 'var(--brand-8)' }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={e => {
                  const newName = e.target.value;
                  setForm(f => ({ ...f, name: newName, prefix: prefixTouched ? f.prefix : nameToPrefix(newName) }));
                }}
                placeholder="Frontend, Backend, Design..."
                maxLength={100}
                style={{ background: c.inpBg, border: `1px solid ${c.inpBorder}`, borderRadius: 8, padding: '10px 14px', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, color: c.inpText, outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: c.lbl }}>
                Префикс задач <span style={{ color: 'var(--brand-8)' }}>*</span>
              </label>
              <input
                value={form.prefix}
                onChange={e => { setPrefixTouched(true); setForm(f => ({ ...f, prefix: e.target.value.toUpperCase() })); }}
                placeholder="DEV, OPS, FRONT..."
                maxLength={8}
                style={{ background: c.inpBg, border: `1px solid ${c.inpBorder}`, borderRadius: 8, padding: '10px 14px', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, color: c.inpText, outline: 'none', textTransform: 'uppercase' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500, color: c.lbl }}>Описание</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Описание доски (необязательно)"
                rows={2}
                style={{ background: c.inpBg, border: `1px solid ${c.inpBorder}`, borderRadius: 8, padding: '10px 14px', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, color: c.inpText, outline: 'none', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={closeModal}
                style={{ background: 'transparent', border: `1px solid ${c.hdrBorder}`, borderRadius: 8, padding: '9px 18px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.sub }}
              >
                Отмена
              </button>
              <button
                data-testid="create-board-submit"
                onClick={onCreateBoard}
                disabled={creating || !form.name.trim() || !form.prefix.trim()}
                style={{
                  background: creating || !form.name.trim() || !form.prefix.trim() ? 'var(--component-disable-fill)' : 'var(--brand-8)',
                  border: 'none', borderRadius: 8, padding: '9px 18px',
                  cursor: creating || !form.name.trim() || !form.prefix.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--neutral-0)',
                }}
              >
                {creating ? 'Создаём...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
