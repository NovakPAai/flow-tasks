import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import { search } from '../api/search';
import type { SearchTask, SearchBoard, SearchWorkspace } from '../api/search';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  overlay: 'rgba(0,0,0,0.7)',
  bg: '#0F1320', border: '#1C2236',
  inputBg: '#0A0D1A', inputBorder: '#2D3748', inputText: '#E2E8F8',
  text: '#E2E8F8', muted: '#8B95B0', subText: '#6B7194',
  activeBg: '#1C2236', hoverBg: '#141928',
  sectionLabel: '#4A5578',
  keyBg: '#1C2236', keyText: '#6B7194',
  taskBadge: '#1C2236',
};
const LIGHT: C = {
  overlay: 'rgba(0,0,0,0.4)',
  bg: '#FDFCFF', border: '#E8E5F0',
  inputBg: '#F9FAFB', inputBorder: '#D1C8EC', inputText: '#1A1A2E',
  text: '#1A1A2E', muted: '#6B7194', subText: '#9B96B8',
  activeBg: '#EDE9FE', hoverBg: '#F5F3FF',
  sectionLabel: '#B0AACC',
  keyBg: '#EDE9FE', keyText: '#6B7194',
  taskBadge: '#EDE9FE',
};

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#EF4444',
  MEDIUM: '#F59E0B',
  LOW: '#22C55E',
};

// ── Flat result list item type ─────────────────────────────────────────────────
type ResultItem =
  | { kind: 'task';      data: SearchTask }
  | { kind: 'board';     data: SearchBoard }
  | { kind: 'workspace'; data: SearchWorkspace };

function buildItems(tasks: SearchTask[], boards: SearchBoard[], workspaces: SearchWorkspace[]): ResultItem[] {
  return [
    ...tasks.map((d): ResultItem => ({ kind: 'task', data: d })),
    ...boards.map((d): ResultItem => ({ kind: 'board', data: d })),
    ...workspaces.map((d): ResultItem => ({ kind: 'workspace', data: d })),
  ];
}

// ── Highlight matched text ─────────────────────────────────────────────────────
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: '#4F6EF7', fontWeight: 600 }}>{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

// ── Category icons ─────────────────────────────────────────────────────────────
function TaskIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="12" height="12" rx="2.5" stroke={color} strokeWidth="1.3"/>
      <path d="M4 7l2 2 4-4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function BoardIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="5.5" height="12" rx="1.5" stroke={color} strokeWidth="1.3"/>
      <rect x="7.5" y="1" width="5.5" height="7" rx="1.5" stroke={color} strokeWidth="1.3"/>
    </svg>
  );
}
function WorkspaceIcon({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="1" y="1" width="5" height="5" rx="1.2" fill={color}/>
      <rect x="8" y="1" width="5" height="5" rx="1.2" fill={color} opacity="0.5"/>
      <rect x="1" y="8" width="5" height="5" rx="1.2" fill={color} opacity="0.5"/>
      <rect x="8" y="8" width="5" height="5" rx="1.2" fill={color}/>
    </svg>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CommandPalette({ open, onClose }: Props) {
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'dark' ? DARK : LIGHT;
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ tasks: SearchTask[]; boards: SearchBoard[]; workspaces: SearchWorkspace[] }>({ tasks: [], boards: [], workspaces: [] });
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults({ tasks: [], boards: [], workspaces: [] });
      setSearchError(false);
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults({ tasks: [], boards: [], workspaces: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    setSearchError(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await search(query.trim());
        setResults(res);
        setActiveIdx(0);
      } catch {
        setSearchError(true);
        setResults({ tasks: [], boards: [], workspaces: [] });
      }
      finally { setLoading(false); }
    }, 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open]);

  const items = buildItems(results.tasks, results.boards, results.workspaces);
  const hasResults = items.length > 0;

  const navigateTo = useCallback((item: ResultItem) => {
    onClose();
    if (item.kind === 'task') {
      const { board: { workspace: { slug }, prefix } } = item.data;
      navigate(`/w/${slug}/boards/${prefix.toLowerCase()}`, { state: { openTaskId: item.data.id } });
    } else if (item.kind === 'board') {
      const { workspace: { slug }, prefix } = item.data;
      navigate(`/w/${slug}/boards/${prefix.toLowerCase()}`);
    } else {
      navigate(`/w/${item.data.slug}`);
    }
  }, [navigate, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (!hasResults) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[activeIdx];
        if (item) navigateTo(item);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, hasResults, items, activeIdx, navigateTo, onClose]);

  if (!open) return null;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function renderItem(item: ResultItem, idx: number) {
    const isActive = idx === activeIdx;
    const bg = isActive ? c.activeBg : 'transparent';
    const baseStyle: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
      cursor: 'pointer', background: bg, transition: 'background 0.1s',
    };

    if (item.kind === 'task') {
      const t = item.data;
      return (
        <div
          key={t.id}
          style={baseStyle}
          onClick={() => navigateTo(item)}
          onMouseEnter={() => setActiveIdx(idx)}
        >
          <TaskIcon color={t.status.color || '#4F6EF7'} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <Highlight text={t.title} query={query} />
              </span>
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
              <span style={{ color: '#4F6EF7', fontWeight: 500 }}>
                <Highlight text={t.issueKey} query={query} />
              </span>
              <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
              {t.board.workspace.name}
              <span style={{ margin: '0 4px', opacity: 0.5 }}>·</span>
              {t.board.name}
            </div>
          </div>
          {t.priority && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: PRIORITY_COLOR[t.priority] ?? c.muted,
              flexShrink: 0,
            }}>
              {t.priority}
            </span>
          )}
          <span style={{
            fontSize: 10, color: c.muted, background: c.taskBadge,
            borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          }}>
            {t.status.name}
          </span>
        </div>
      );
    }

    if (item.kind === 'board') {
      const b = item.data;
      return (
        <div
          key={b.id}
          style={baseStyle}
          onClick={() => navigateTo(item)}
          onMouseEnter={() => setActiveIdx(idx)}
        >
          <BoardIcon color={c.muted} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Highlight text={b.name} query={query} />
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
              {b.workspace.name}
            </div>
          </div>
          <span style={{ fontSize: 10, color: '#4F6EF7', fontWeight: 500, flexShrink: 0 }}>
            {b.prefix}
          </span>
        </div>
      );
    }

    // workspace
    const w = item.data;
    return (
      <div
        key={w.id}
        style={baseStyle}
        onClick={() => navigateTo(item)}
        onMouseEnter={() => setActiveIdx(idx)}
      >
        <WorkspaceIcon color={c.muted} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Highlight text={w.name} query={query} />
          </div>
          <div style={{ fontSize: 11, color: c.muted, marginTop: 1 }}>
            Workspace · /w/{w.slug}
          </div>
        </div>
      </div>
    );
  }

  // Section header offsets
  const taskCount = results.tasks.length;
  const boardCount = results.boards.length;
  const wsCount = results.workspaces.length;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: c.overlay, display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 580,
          background: c.bg, border: `1px solid ${c.border}`,
          borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          overflow: 'hidden',
          fontFamily: '"Inter",system-ui,sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${c.border}` }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: c.muted }}>
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Поиск задач, досок, воркспейсов..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              color: c.inputText, fontSize: 14, fontFamily: 'inherit',
            }}
          />
          {loading && (
            <span style={{ fontSize: 11, color: c.muted }}>...</span>
          )}
          <kbd style={{
            background: c.keyBg, border: `1px solid ${c.border}`,
            borderRadius: 4, color: c.keyText,
            fontSize: 10, padding: '2px 5px', flexShrink: 0,
          }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {searchError && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 13, color: '#EF4444' }}>
              Ошибка поиска, попробуйте позже
            </div>
          )}

          {!searchError && !hasResults && query.trim().length >= 2 && !loading && (
            <div style={{ padding: '28px 16px', textAlign: 'center', fontSize: 13, color: c.muted }}>
              Ничего не найдено
            </div>
          )}

          {!searchError && !hasResults && query.trim().length < 2 && (
            <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 12, color: c.muted }}>
              Введите минимум 2 символа для поиска
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 11 }}>
                <span>↑↓ навигация</span>
                <span>·</span>
                <span>Enter открыть</span>
                <span>·</span>
                <span>Esc закрыть</span>
              </div>
            </div>
          )}

          {hasResults && (
            <>
              {taskCount > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: c.sectionLabel, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Задачи
                  </div>
                  {results.tasks.map((t, i) => renderItem({ kind: 'task', data: t }, i))}
                </>
              )}
              {boardCount > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: c.sectionLabel, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Доски
                  </div>
                  {results.boards.map((b, i) => renderItem({ kind: 'board', data: b }, taskCount + i))}
                </>
              )}
              {wsCount > 0 && (
                <>
                  <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 600, color: c.sectionLabel, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Воркспейсы
                  </div>
                  {results.workspaces.map((w, i) => renderItem({ kind: 'workspace', data: w }, taskCount + boardCount + i))}
                </>
              )}

              {/* Footer hints */}
              <div style={{ padding: '8px 16px', borderTop: `1px solid ${c.border}`, display: 'flex', gap: 12, fontSize: 11, color: c.muted }}>
                <span>↑↓ навигация</span>
                <span>Enter открыть</span>
                <span>{isMac ? '⌘K' : 'Ctrl+K'} закрыть</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
