import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import * as workspacesApi from '../api/workspaces';
import type { MemberCandidate } from '../api/workspaces';
import type { WorkspaceMember, WorkspaceRole } from '../types';
import MemberPickerRow from './MemberPickerRow';

// Minimal design tokens passed by host page so picker is theme-agnostic.
export interface ThemeTokens {
  bg: string;
  cardBg: string;
  border: string;
  text: string;
  muted: string;
  label: string;
  inputBg: string;
  inputBorder: string;
  accent: string;
  danger: string;
  rowHover: string;
}

export interface MemberPickerProps {
  workspaceId: string;
  theme: ThemeTokens;
  onAdded: (member: WorkspaceMember) => void;
  onFallbackInvite?: (email: string) => Promise<void>;
  onLostOwnership?: () => void;
  onClose?: () => void;
  defaultRole?: WorkspaceRole;
}

type Status =
  | { kind: 'idle' }
  | { kind: 'hint' }
  | { kind: 'loading' }
  | { kind: 'results'; rows: MemberCandidate[] }
  | { kind: 'empty'; queryIsEmail: boolean }
  | { kind: 'error' }
  | { kind: 'validationError'; message: string }
  | { kind: 'rateLimited'; retryAfterSec: number };

const DEBOUNCE_MS = 250;
const MIN_QUERY = 2;
const MAX_QUERY = 100;
// Permissive client check; backend Zod re-validates with stricter rules.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AxiosLikeError {
  status?: number;
  retryAfterSec?: number;
  message?: string;
}

function inspectError(err: unknown): AxiosLikeError {
  if (typeof err !== 'object' || err === null) return {};
  const resp = (err as { response?: { status?: number; headers?: Record<string, string>; data?: { error?: string } } }).response;
  if (!resp) return {};
  const retryRaw = resp.headers?.['retry-after'];
  let retryAfterSec: number | undefined;
  if (retryRaw) {
    const parsed = Number(retryRaw);
    retryAfterSec = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 600) : 60;
  }
  return { status: resp.status, retryAfterSec, message: resp.data?.error };
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function MemberPicker({
  workspaceId,
  theme,
  onAdded,
  onFallbackInvite,
  onLostOwnership,
  onClose,
  defaultRole = 'MEMBER',
}: MemberPickerProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [roles, setRoles] = useState<Record<string, WorkspaceRole>>({});
  const [retryRemaining, setRetryRemaining] = useState(0);
  const [liveMessage, setLiveMessage] = useState('');
  const [inputFocused, setInputFocused] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRefs = useRef<Record<string, HTMLSelectElement | null>>({});
  const inputId = useId();
  const listboxId = useId();
  const liveRegionId = useId();

  // ─── Run the search (debounced upstream) ─────────────────────────────────
  const runSearch = useCallback((q: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus({ kind: 'loading' });
    workspacesApi
      .searchCandidates(workspaceId, q, ctrl.signal)
      .then((rows) => {
        if (ctrl.signal.aborted) return;
        if (rows.length === 0) {
          setStatus({ kind: 'empty', queryIsEmail: EMAIL_RE.test(q.trim()) });
          setLiveMessage('Пользователь не найден');
        } else {
          setStatus({ kind: 'results', rows });
          setFocusedIndex(-1);
          setLiveMessage(`Найдено ${rows.length} ${rows.length === 1 ? 'пользователь' : 'пользователя'}`);
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const info = inspectError(err);
        if (info.status === 429) {
          const sec = info.retryAfterSec ?? 60;
          setStatus({ kind: 'rateLimited', retryAfterSec: sec });
          setRetryRemaining(sec);
          setLiveMessage('Слишком много запросов');
        } else if (info.status === 400) {
          setStatus({ kind: 'validationError', message: info.message ?? 'Слишком длинный запрос' });
          setLiveMessage('Невалидный запрос');
        } else {
          setStatus({ kind: 'error' });
          setLiveMessage('Не удалось выполнить поиск');
        }
      });
  }, [workspaceId]);

  // ─── Debounce ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: 'idle' });
      return;
    }
    if (trimmed.length < MIN_QUERY) {
      setStatus({ kind: 'hint' });
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(trimmed), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // ─── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    abortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ─── Rate-limit ticking countdown (1s per tick) ──────────────────────────
  useEffect(() => {
    if (status.kind !== 'rateLimited') return;
    if (retryRemaining <= 0) {
      setStatus({ kind: 'idle' });
      return;
    }
    const t = setTimeout(() => setRetryRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // status.kind is the discriminant; retryRemaining drives the tick.
    // Intentionally NOT depending on full `status` to avoid resets from unrelated state updates.
  }, [status.kind, retryRemaining]);

  // ─── Add member ───────────────────────────────────────────────────────────
  const handleAdd = useCallback(async (cand: MemberCandidate) => {
    if (cand.alreadyMember || addingId !== null) return;
    setAddingId(cand.id);
    try {
      const role = roles[cand.id] ?? defaultRole;
      const member = await workspacesApi.addMember(workspaceId, cand.id, role);
      onAdded(member);
      setQuery('');
      setLiveMessage(`${cand.name} добавлен в воркспейс`);
    } catch (err: unknown) {
      const info = inspectError(err);
      if (info.status === 403) {
        onLostOwnership?.();
      } else if (info.status === 409) {
        // Race: another Owner added them. Mark row and stay open.
        setStatus((prev) =>
          prev.kind === 'results'
            ? {
                kind: 'results',
                rows: prev.rows.map((r) => (r.id === cand.id ? { ...r, alreadyMember: true } : r)),
              }
            : prev,
        );
        setLiveMessage('Пользователь уже в воркспейсе');
      } else {
        setStatus({ kind: 'error' });
        setLiveMessage('Не удалось добавить участника');
      }
    } finally {
      setAddingId(null);
    }
  }, [addingId, defaultRole, onAdded, onLostOwnership, roles, workspaceId]);

  // ─── Fallback invite ──────────────────────────────────────────────────────
  const handleFallbackInvite = useCallback(async (email: string) => {
    if (!onFallbackInvite) return;
    setInviting(true);
    try {
      await onFallbackInvite(email);
      setLiveMessage('Приглашение отправлено');
    } catch (err: unknown) {
      const info = inspectError(err);
      if (info.status === 404) {
        setStatus({ kind: 'validationError', message: 'Пользователь с таким email не зарегистрирован' });
      } else {
        setStatus({ kind: 'error' });
      }
    } finally {
      setInviting(false);
    }
  }, [onFallbackInvite]);

  // ─── Find next non-disabled index, cyclic ────────────────────────────────
  const findNextEnabled = useCallback((current: number, dir: 1 | -1, rows: MemberCandidate[]): number => {
    if (rows.length === 0) return -1;
    const total = rows.length;
    let idx = current;
    for (let step = 0; step < total; step += 1) {
      idx = ((idx + dir) % total + total) % total;
      if (!rows[idx]?.alreadyMember) return idx;
    }
    return -1;
  }, []);

  // ─── Keyboard handlers ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      // First Esc: clear if there is something to clear.
      // Second Esc (when already idle): bubble up via onClose.
      if (query.length > 0 || status.kind !== 'idle') {
        setQuery('');
        setStatus({ kind: 'idle' });
      } else {
        onClose?.();
      }
      return;
    }

    if (status.kind !== 'results') return;
    const rows = status.rows;
    if (rows.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((i) => findNextEnabled(i === -1 ? -1 : i, 1, rows));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((i) => findNextEnabled(i === -1 ? 0 : i, -1, rows));
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      const row = rows[focusedIndex];
      if (row && !row.alreadyMember) {
        // Two-step: first Enter focuses the role select inside the row;
        // user can then change role + Tab to Add (or Enter again).
        // If select is already focused (Enter from within select), commit add.
        const sel = selectRefs.current[row.id];
        if (sel && document.activeElement !== sel) {
          sel.focus();
        } else {
          void handleAdd(row);
        }
      }
    }
  }, [findNextEnabled, focusedIndex, handleAdd, onClose, query, status]);

  const retry = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length >= MIN_QUERY) runSearch(trimmed);
  }, [query, runSearch]);

  const styles = useStyles(theme, inputFocused);

  const trimmedQuery = query.trim();
  const isRateLimited = status.kind === 'rateLimited';
  const showListbox = status.kind === 'results';
  const ariaActiveDescendant =
    status.kind === 'results' && focusedIndex >= 0
      ? `mp-opt-${status.rows[focusedIndex]?.id}`
      : undefined;

  return (
    <div style={styles.root}>
      {/* Permanent SR live region for state announcements (C2 fix). */}
      <div
        id={liveRegionId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={styles.srOnly}
      >
        {liveMessage}
      </div>

      <label htmlFor={inputId} style={styles.label}>
        Имя или email пользователя
      </label>

      <div style={styles.inputWrap}>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={ariaActiveDescendant}
          aria-describedby={liveRegionId}
          maxLength={MAX_QUERY}
          value={query}
          disabled={isRateLimited}
          placeholder="Иванов / ivanov@company.com"
          style={styles.input}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
        />
        {status.kind === 'loading' && (
          <span data-testid="member-picker-loading" style={styles.spinner} aria-hidden="true">
            <SpinnerIcon />
          </span>
        )}
      </div>

      {/* Non-listbox status messages — siblings, outside the listbox container */}
      {status.kind === 'hint' && (
        <div style={styles.statusBox}>{`Введите минимум ${MIN_QUERY} символа`}</div>
      )}

      {status.kind === 'loading' && (
        <div data-testid="member-picker-loading-skeleton" style={styles.skeletonWrap} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} style={styles.skeletonRow} />
          ))}
        </div>
      )}

      {status.kind === 'empty' && (
        <div style={styles.statusBox}>
          {status.queryIsEmail ? (
            <>
              <div style={styles.statusText}>
                Пользователь с таким email не найден в системе.
              </div>
              {onFallbackInvite && (
                <button
                  type="button"
                  disabled={inviting}
                  onClick={() => void handleFallbackInvite(trimmedQuery)}
                  style={styles.ctaBtn}
                  title={trimmedQuery}
                >
                  {inviting
                    ? 'Отправляем…'
                    : `Пригласить ${truncate(trimmedQuery, 40)} по почте`}
                </button>
              )}
            </>
          ) : (
            <div style={styles.statusText}>
              Пользователь не найден. Введите полный email, чтобы пригласить нового.
            </div>
          )}
        </div>
      )}

      {status.kind === 'error' && (
        <div style={styles.statusBox}>
          <div style={{ ...styles.statusText, color: theme.danger }}>Не удалось выполнить поиск</div>
          <button type="button" onClick={retry} style={styles.ctaBtn}>Повторить</button>
        </div>
      )}

      {status.kind === 'validationError' && (
        <div style={styles.statusBox}>
          <div style={{ ...styles.statusText, color: theme.danger }}>{status.message}</div>
        </div>
      )}

      {status.kind === 'rateLimited' && (
        <div style={styles.statusBox}>
          <div style={{ ...styles.statusText, color: theme.danger }}>
            {`Слишком много запросов. Попробуйте через ${retryRemaining} ${pluralizeSec(retryRemaining)}`}
          </div>
        </div>
      )}

      {showListbox && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Найденные пользователи"
          style={styles.listbox}
        >
          {status.rows.map((row, idx) => (
            <MemberPickerRow
              key={row.id}
              row={row}
              focused={focusedIndex === idx}
              role={roles[row.id] ?? defaultRole}
              onRoleChange={(r) => setRoles((prev) => ({ ...prev, [row.id]: r }))}
              onAdd={() => void handleAdd(row)}
              adding={addingId === row.id}
              theme={theme}
              onSelect={() => setFocusedIndex(idx)}
              registerSelectRef={(el) => { selectRefs.current[row.id] = el; }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function pluralizeSec(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'секунду';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'секунды';
  return 'секунд';
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

function useStyles(theme: ThemeTokens, inputFocused: boolean) {
  return useMemo(() => {
    const focusRing: CSSProperties = inputFocused
      ? { borderColor: theme.accent, boxShadow: `0 0 0 3px ${hexWithAlpha(theme.accent, 0.25)}` }
      : {};
    return {
      root: { position: 'relative' as const, width: '100%' },
      srOnly: {
        position: 'absolute' as const,
        width: 1, height: 1, padding: 0, margin: -1,
        overflow: 'hidden' as const, clip: 'rect(0,0,0,0)',
        whiteSpace: 'nowrap' as const, border: 0,
      },
      label: {
        display: 'block',
        marginBottom: 6,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
        color: theme.label, textTransform: 'uppercase' as const,
      },
      inputWrap: { position: 'relative' as const, width: '100%' },
      input: {
        width: '100%',
        boxSizing: 'border-box' as const,
        background: theme.inputBg,
        border: `1px solid ${theme.inputBorder}`,
        borderRadius: 8,
        padding: '10px 36px 10px 12px',
        fontSize: 13,
        color: theme.text,
        outline: 'none',
        fontFamily: 'inherit',
        minHeight: 40,
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
        ...focusRing,
      },
      spinner: {
        position: 'absolute' as const, right: 12, top: '50%',
        transform: 'translateY(-50%)', color: theme.muted,
        userSelect: 'none' as const, lineHeight: 0,
      },
      statusBox: {
        marginTop: 8,
        padding: '12px',
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column' as const,
        gap: 8,
      },
      statusText: { fontSize: 13, color: theme.text, lineHeight: 1.4 },
      skeletonWrap: {
        marginTop: 8,
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        overflow: 'hidden' as const,
      },
      skeletonRow: {
        height: 48,
        background: `linear-gradient(90deg, ${theme.cardBg} 0%, ${theme.rowHover} 50%, ${theme.cardBg} 100%)`,
        backgroundSize: '200% 100%',
        animation: 'pulse 1.4s ease-in-out infinite',
        borderTop: `1px solid ${theme.border}`,
      },
      listbox: {
        marginTop: 8,
        background: theme.cardBg,
        border: `1px solid ${theme.border}`,
        borderRadius: 8,
        overflow: 'hidden' as const,
        maxHeight: 420,
        overflowY: 'auto' as const,
      },
      ctaBtn: {
        alignSelf: 'flex-start' as const,
        background: theme.accent, color: '#fff',
        border: 'none', borderRadius: 6,
        padding: '8px 12px', fontSize: 12, minHeight: 36,
        cursor: 'pointer' as const, fontFamily: 'inherit',
        maxWidth: '100%',
        overflow: 'hidden' as const, textOverflow: 'ellipsis' as const, whiteSpace: 'nowrap' as const,
      },
    };
  }, [theme, inputFocused]);
}

function hexWithAlpha(hex: string, alpha: number): string {
  // Accepts #RRGGBB; returns rgba(r,g,b,alpha). Falls back to original if format mismatches.
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || !m[1]) return hex;
  const r = parseInt(m[1].slice(0, 2), 16);
  const g = parseInt(m[1].slice(2, 4), 16);
  const b = parseInt(m[1].slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
