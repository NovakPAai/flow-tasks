import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useWorkspaceStore } from '../store/workspace.store';
import { useThemeStore } from '../store/theme.store';
import type { Board } from '../types';
import * as workspacesApi from '../api/workspaces';
import * as boardsApi from '../api/boards';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F',
  hdrBorder: '#1C2236',
  backText: '#484F58',
  title: '#E2E8F8',
  sub: '#8B949E',
  statsNum: '#E2E8F8',
  statsLbl: '#484F58',
  div: '#1C2236',
  secLbl: '#484F58',
  cardBg: '#0F1320',
  cardBorder: '#1C2236',
  cardTitle: '#E2E8F8',
  cardSub: '#484F58',
  pillBg: '#1C2236',
  pillText: '#8B949E',
  taskCnt: '#8B949E',
  modalBg: '#0F1320',
  inpBg: '#161B22',
  inpBorder: '#30363D',
  inpText: '#E2E8F8',
  lbl: '#8B949E',
  overlay: 'rgba(0,0,0,0.7)',
};

const LIGHT: C = {
  bg: '#F5F3FF',
  hdrBorder: '#E8E5F0',
  backText: '#9B96B8',
  title: '#1A1A2E',
  sub: '#9B96B8',
  statsNum: '#1A1A2E',
  statsLbl: '#9B96B8',
  div: '#E8E5F0',
  secLbl: '#9B96B8',
  cardBg: '#FDFCFF',
  cardBorder: '#E8E5F0',
  cardTitle: '#1A1A2E',
  cardSub: '#9B96B8',
  pillBg: '#F5F3FF',
  pillText: '#9B96B8',
  taskCnt: '#9B96B8',
  modalBg: '#FFFFFF',
  inpBg: '#F5F3FF',
  inpBorder: '#E8E5F0',
  inpText: '#1A1A2E',
  lbl: '#6B6888',
  overlay: 'rgba(0,0,0,0.4)',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const WS_COLORS = ['#22C55E', '#4F6EF7', '#8B5CF6', '#F59E0B', '#EC4899', '#0EA5E9'];
const BD_COLORS = ['#4F6EF7', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899', '#EF4444', '#0EA5E9'];

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
        boxShadow: isDark ? 'none' : '0 2px 8px rgba(79,110,247,0.06)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{
          width: 34, height: 34, background: color, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {initials(board.name, 1)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: c.cardTitle, letterSpacing: '-0.2px' }}>
            {board.name}
          </span>
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
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>({ name: '', prefix: '', description: '' });
  const [prefixTouched, setPrefixTouched] = useState(false);

  useEffect(() => { if (workspaces.length === 0) load(); }, [workspaces.length, load]);

  useEffect(() => {
    if (!slug) return;
    const found = workspaces.find(w => w.slug === slug);
    if (found && found.id !== current?.id) {
      workspacesApi.getWorkspace(found.id).then(setCurrent).catch(() => null);
    }
  }, [slug, workspaces, current?.id, setCurrent]);

  useEffect(() => {
    if (!current) return;
    setBoardsLoading(true);
    boardsApi.listBoards(current.id)
      .then(setBoards)
      .catch(() => setBoards([]))
      .finally(() => setBoardsLoading(false));
  }, [current?.id]);

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
      navigate(`/w/${slug}/boards/${board.id}`);
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
      borderTopColor: '#4F6EF7', borderRadius: '50%',
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
          style={{ background: '#4F6EF7', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff' }}
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
      <div style={{ display: 'flex', flexDirection: 'column', padding: '36px 48px 28px', borderBottom: `1px solid ${c.hdrBorder}`, flexShrink: 0 }}>
        {/* Back link */}
        <div
          onClick={() => navigate('/workspaces')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, cursor: 'pointer', width: 'fit-content' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7L9 11.5" stroke={c.backText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.backText, letterSpacing: '0.02em' }}>Все пространства</span>
        </div>

        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Workspace icon */}
          <div style={{ width: 48, height: 48, background: wsColor, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 16, flexShrink: 0 }}>
            <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 20, fontWeight: 700, color: '#fff' }}>{wsInit}</span>
          </div>

          {/* Name & description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 24, fontWeight: 700, color: c.title, letterSpacing: '-0.5px', margin: 0 }}>
                {current.name}
              </h1>
              <span style={{
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 500,
                color: '#4F6EF7', background: isDark ? 'rgba(79,110,247,0.10)' : 'rgba(79,110,247,0.08)',
                border: '1px solid rgba(79,110,247,0.19)', borderRadius: 4, padding: '2px 8px',
                letterSpacing: '0.05em', flexShrink: 0,
              }}>
                {role}
              </span>
            </div>
            <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {current.slug}{current.description ? ` · ${current.description}` : ''}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, marginRight: 32, flexShrink: 0 }}>
            {([
              { num: boards.length, label: 'Доски' },
              { num: totalTasks, label: 'Задачи' },
              { num: memberCount, label: 'Участники' },
            ] as const).map((stat, i) => (
              <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
                {i > 0 && <div style={{ width: 1, height: 28, background: c.div }} />}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 22, fontWeight: 700, color: c.statsNum, lineHeight: '28px' }}>{stat.num}</span>
                  <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.statsLbl, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Settings button */}
          <button
            onClick={() => navigate(`/w/${slug}/settings`)}
            title="Настройки пространства"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'transparent', border: `1px solid ${c.hdrBorder}`, borderRadius: 8, cursor: 'pointer', flexShrink: 0, marginRight: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke={c.sub} strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M13.3 6.6l-.7-.4a5.1 5.1 0 0 0 0-1.4l.7-.4a.6.6 0 0 0 .2-.8l-.8-1.4a.6.6 0 0 0-.8-.2l-.7.4a5 5 0 0 0-1.2-.7V1a.6.6 0 0 0-.6-.6H7.6A.6.6 0 0 0 7 1v.7a5 5 0 0 0-1.2.7l-.7-.4a.6.6 0 0 0-.8.2L3.5 3.6a.6.6 0 0 0 .2.8l.7.4a5.1 5.1 0 0 0 0 1.4l-.7.4a.6.6 0 0 0-.2.8l.8 1.4c.2.3.5.4.8.2l.7-.4c.4.3.8.5 1.2.7V10a.6.6 0 0 0 .6.6h1.6a.6.6 0 0 0 .6-.6v-.7c.4-.2.8-.4 1.2-.7l.7.4c.3.2.6.1.8-.2l.8-1.4a.6.6 0 0 0-.2-.8Z" stroke={c.sub} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Create board button */}
          <button
            data-onboarding="create-board"
            onClick={() => setCreateOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#4F6EF7', border: 'none', borderRadius: 8, padding: '10px 18px', cursor: 'pointer', flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 2v10M2 7h10" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff' }}>Создать доску</span>
          </button>
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, padding: '28px 48px' }}>
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
              style={{ background: '#4F6EF7', border: 'none', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff' }}
            >
              Создать доску
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
            {boards.map(board => (
              <BoardCard
                key={board.id} board={board} c={c} isDark={isDark}
                onClick={() => navigate(`/w/${slug}/boards/${board.id}`)}
              />
            ))}
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
                Название <span style={{ color: '#4F6EF7' }}>*</span>
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
                Префикс задач <span style={{ color: '#4F6EF7' }}>*</span>
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
                  background: creating || !form.name.trim() || !form.prefix.trim() ? 'rgba(79,110,247,0.5)' : '#4F6EF7',
                  border: 'none', borderRadius: 8, padding: '9px 18px',
                  cursor: creating || !form.name.trim() || !form.prefix.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 600, color: '#fff',
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
