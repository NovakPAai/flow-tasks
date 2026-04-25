import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '../store/workspace.store';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import type { Board } from '../types';
import * as boardsApi from '../api/boards';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F', border: '#1C2236',
  title: '#E2E8F8', sub: '#8B949E', muted: '#484F58',
  cardBg: '#0F1320', cardBorder: '#1C2236', cardTitle: '#E2E8F8', cardSub: '#484F58',
  pillBg: '#1C2236', pillText: '#8B949E', backText: '#484F58',
};
const LIGHT: C = {
  bg: '#F5F3FF', border: '#E8E5F0',
  title: '#1A1A2E', sub: '#9B96B8', muted: '#9B96B8',
  cardBg: '#FDFCFF', cardBorder: '#E8E5F0', cardTitle: '#1A1A2E', cardSub: '#9B96B8',
  pillBg: '#F0ECF8', pillText: '#7C6FA8', backText: '#9B96B8',
};

const BD_COLORS = ['#4F6EF7','#8B5CF6','#22C55E','#F59E0B','#EC4899','#EF4444','#0EA5E9'];
function boardColor(name: string) {
  return BD_COLORS[(name.charCodeAt(0) ?? 0) % BD_COLORS.length];
}

function pluralTasks(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m100 >= 11 && m100 <= 19) return `${n} задач`;
  if (m10 === 1) return `${n} задача`;
  if (m10 >= 2 && m10 <= 4) return `${n} задачи`;
  return `${n} задач`;
}

// ── Mini roadmap bar preview ───────────────────────────────────────────────────
function MiniPreview({ color }: { color: string }) {
  const bars = [
    { left: '2%',  width: '55%', opacity: .7 },
    { left: '20%', width: '35%', opacity: .55 },
    { left: '45%', width: '40%', opacity: .45 },
  ];
  return (
    <div style={{ position: 'relative', height: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '4px 0' }}>
      {bars.map((b, i) => (
        <div key={i} style={{ position: 'absolute', top: `${20 + i * 26}%`, height: 8, borderRadius: 4, background: color, opacity: b.opacity, left: b.left, width: b.width }} />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RoadmapsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate  = useNavigate();
  const mode      = useThemeStore(s => s.mode);
  const c         = mode === 'light' ? LIGHT : DARK;
  const isDark    = mode === 'dark';
  const bp        = useBreakpoint();
  const isMobile  = bp === 'mobile';

  const { workspaces, current, setCurrent, load } = useWorkspaceStore();
  const [boards, setBoards]   = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (workspaces.length === 0) load(); }, [workspaces.length, load]);

  useEffect(() => {
    if (!slug || workspaces.length === 0) return;
    const ws = workspaces.find(w => w.slug === slug);
    if (ws && ws.id !== current?.id) setCurrent(ws);
  }, [slug, workspaces, current?.id, setCurrent]);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    boardsApi.listBoards(current.id)
      .then(setBoards)
      .catch(() => setBoards([]))
      .finally(() => setLoading(false));
  }, [current?.id]);

  const padding = isMobile ? '20px 16px' : bp === 'tablet' ? '24px 32px' : '36px 48px';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: c.bg }}>

      {/* ── Header ── */}
      <div style={{ padding, borderBottom: `1px solid ${c.border}`, flexShrink: 0 }}>
        {/* Back */}
        <div
          onClick={() => navigate(`/w/${slug}`)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, cursor: 'pointer', width: 'fit-content' }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7L9 11.5" stroke={c.backText} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.backText, letterSpacing: '0.02em' }}>
            {current?.name ?? 'Пространство'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: isMobile ? 20 : 24, fontWeight: 700, color: c.title, letterSpacing: '-0.5px', margin: '0 0 4px' }}>
              Дорожные карты
            </h1>
            <p style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.sub, margin: 0 }}>
              Откройте любую доску в виде временно́й шкалы
            </p>
          </div>
        </div>
      </div>

      {/* ── Boards grid ── */}
      <div style={{ flex: 1, padding, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
            <div style={{ width: 28, height: 28, border: `2px solid ${c.border}`, borderTopColor: '#4F6EF7', borderRadius: '50%', animation: 'rm-spin .8s linear infinite' }} />
            <style>{`@keyframes rm-spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : boards.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: c.sub, fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14 }}>
            Нет досок. Создайте первую в разделе <span style={{ color: '#4F6EF7', cursor: 'pointer' }} onClick={() => navigate(`/w/${slug}`)}>Доски</span>.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {boards.map(board => {
              const color     = boardColor(board.name);
              const taskCount = board._count?.tasks ?? 0;
              const statuses  = board.workflow?.statuses ?? [];

              return (
                <div
                  key={board.id}
                  style={{
                    background: c.cardBg, border: `1px solid ${c.cardBorder}`,
                    borderRadius: 14, padding: '20px 22px', cursor: 'default',
                    display: 'flex', flexDirection: 'column', gap: 0,
                    boxShadow: isDark ? 'none' : '0 2px 8px rgba(79,110,247,.05)',
                    transition: 'border-color .14s, box-shadow .12s',
                  }}
                >
                  {/* Card header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 34, height: 34, background: color, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                        {board.name[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 15, fontWeight: 600, color: c.cardTitle, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {board.name}
                      </div>
                      <div style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.cardSub, marginTop: 2 }}>
                        {board.prefix}{board.description ? ` · ${board.description}` : ''}
                      </div>
                    </div>
                  </div>

                  {/* Status pills */}
                  {statuses.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                      {statuses.slice(0, 4).map(s => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: c.pillBg, borderRadius: 5, padding: '3px 8px' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.pillText }}>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Mini preview */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(79,110,247,.04)',
                    borderRadius: 8, padding: '8px 12px', marginBottom: 16, position: 'relative', overflow: 'hidden',
                  }}>
                    <MiniPreview color={color} />
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.cardSub }}>
                      {pluralTasks(taskCount)}
                    </span>
                    <button
                      onClick={() => navigate(`/w/${slug}/boards/${board.prefix.toLowerCase()}?view=roadmap`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '7px 14px', background: 'rgba(79,110,247,.1)',
                        border: '1px solid rgba(79,110,247,.25)', borderRadius: 8,
                        cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif',
                        fontSize: 12, fontWeight: 600, color: '#4F6EF7',
                        transition: 'background .14s, border-color .14s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = '#4F6EF7';
                        (e.currentTarget as HTMLButtonElement).style.color = '#fff';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = '#4F6EF7';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(79,110,247,.1)';
                        (e.currentTarget as HTMLButtonElement).style.color = '#4F6EF7';
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(79,110,247,.25)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                        <line x1="1" y1="4"   x2="9"  y2="4"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="5" y1="7.5" x2="13" y2="7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        <line x1="2" y1="11"  x2="10" y2="11"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                      Открыть дорожную карту
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
