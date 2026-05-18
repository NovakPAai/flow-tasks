import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import { plural, DAYS_FORMS, BOARDS_FORMS, ELEMENTS_FORMS } from '../utils/plural';
import * as workspacesApi from '../api/workspaces';
import type { TrashedWorkspace } from '../api/workspaces';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F', cardBg: '#0F1320', border: '#1C2236',
  text: '#E2E8F8', muted: '#8B949E', label: '#8B95B0',
  accent: '#4F6EF7', danger: '#F87171', dangerBg: 'rgba(239,68,68,0.08)',
  warn: '#FBBF24', warnBg: 'rgba(251,191,36,0.10)',
  hoverBg: '#131729',
};
const LIGHT: C = {
  bg: '#F5F3FF', cardBg: '#FDFCFF', border: '#E8E5F0',
  text: '#1A1A2E', muted: '#6B7194', label: '#6B7194',
  accent: '#4F6EF7', danger: '#EF4444', dangerBg: '#FEE2E2',
  warn: '#D97706', warnBg: '#FFFBEB',
  hoverBg: '#F0EEF8',
};

const INTER = '"Inter", system-ui, sans-serif';

function avatarInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysUntil(iso: string): number {
  const diffMs = new Date(iso).getTime() - Date.now();
  // floor: "1 hour left" displays as "Сегодня", not "Через 1 день"
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

export default function TrashPage() {
  const navigate = useNavigate();
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const bp = useBreakpoint();
  const reloadWorkspaces = useWorkspaceStore(s => s.load);
  const refreshTrashCount = useWorkspaceStore(s => s.refreshTrashCount);

  const [items, setItems] = useState<TrashedWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<TrashedWorkspace | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await workspacesApi.listTrash();
      setItems(data);
    } catch {
      setError('Не удалось загрузить корзину');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRestore = useCallback(async (ws: TrashedWorkspace) => {
    setActionInFlight(ws.id);
    try {
      await workspacesApi.restoreWorkspace(ws.id);
      setItems(prev => prev.filter(w => w.id !== ws.id));
      // Reload + refresh count are best-effort — failure shouldn't surface as
      // "restore failed" because the restore itself succeeded.
      void reloadWorkspaces().catch(() => { /* main list refresh is best-effort */ });
      void refreshTrashCount().catch(() => { /* counter refresh is best-effort */ });
      message.success(`«${ws.name}» восстановлено`);
    } catch {
      message.error('Не удалось восстановить');
    } finally {
      setActionInFlight(null);
    }
  }, [reloadWorkspaces, refreshTrashCount]);

  const closeConfirm = useCallback(() => setConfirmPurge(null), []);

  const handlePurgeConfirmed = useCallback(async (ws: TrashedWorkspace) => {
    setActionInFlight(ws.id);
    try {
      await workspacesApi.purgeWorkspace(ws.id);
      setItems(prev => prev.filter(w => w.id !== ws.id));
      void refreshTrashCount().catch(() => { /* best-effort */ });
      message.success(`«${ws.name}» удалено навсегда`);
      setConfirmPurge(null);
    } catch {
      message.error('Не удалось удалить');
    } finally {
      setActionInFlight(null);
    }
  }, [refreshTrashCount]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: c.bg, minHeight: '100%',
      padding: bp === 'mobile' ? '20px 16px' : '32px 40px',
      fontFamily: INTER,
    }}>
      <BackButton color={c.muted} onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/workspaces');
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <h1 id="trash-title" style={{ color: c.text, fontFamily: INTER, fontSize: 28, fontWeight: 700, margin: 0 }}>
          Корзина
        </h1>
        {!loading && (
          <span aria-live="polite" style={{ color: c.muted, fontSize: 13 }}>
            {items.length === 0
              ? 'пусто'
              : `${items.length} ${plural(items.length, ELEMENTS_FORMS)}`}
          </span>
        )}
      </div>
      <p id="trash-desc" style={{ color: c.muted, fontSize: 13, marginTop: 0, marginBottom: 24 }}>
        Удалённые воркспейсы хранятся 10 рабочих дней. После этого срока они удаляются навсегда вместе со всеми досками и задачами.
      </p>

      {/* Loading */}
      {loading && (
        <div role="status" aria-live="polite" style={{ display: 'grid', gap: 12 }}>
          <span style={{ position: 'absolute', left: -9999, top: -9999 }}>Загрузка корзины…</span>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10,
              height: 84, opacity: 0.6, animation: 'tp-pulse 1.4s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <div role="alert" style={{
          background: c.dangerBg, border: `1px solid ${c.danger}`, borderRadius: 10,
          padding: 16, color: c.danger, fontSize: 13,
        }}>
          {error}
          <button
            onClick={() => void load()}
            className="tp-btn"
            style={{
              background: 'transparent', border: `1px solid ${c.danger}`, borderRadius: 6,
              color: c.danger, cursor: 'pointer', fontFamily: INTER, fontSize: 12,
              marginLeft: 12, padding: '4px 10px',
            }}
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{
          background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12,
          padding: 40, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden="true">🗑</div>
          <div style={{ color: c.text, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
            Корзина пуста
          </div>
          <div style={{ color: c.muted, fontSize: 13, marginBottom: 16 }}>
            Удалённые воркспейсы появятся здесь
          </div>
          <button
            onClick={() => navigate('/workspaces')}
            className="tp-btn"
            style={{
              background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 8,
              color: c.accent, cursor: 'pointer', fontFamily: INTER, fontSize: 13,
              fontWeight: 500, padding: '10px 16px', minHeight: 44,
            }}
          >
            К списку воркспейсов
          </button>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {items.map(ws => (
            <TrashItem
              key={ws.id}
              ws={ws}
              c={c}
              inFlight={actionInFlight === ws.id}
              isMobile={bp === 'mobile'}
              onRestore={() => void handleRestore(ws)}
              onAskPurge={() => setConfirmPurge(ws)}
            />
          ))}
        </ul>
      )}

      {/* Confirm purge modal */}
      {confirmPurge && (
        <ConfirmPurgeModal
          ws={confirmPurge}
          c={c}
          busy={actionInFlight === confirmPurge.id}
          onCancel={closeConfirm}
          onConfirm={() => void handlePurgeConfirmed(confirmPurge)}
        />
      )}

      <style>{`
        @keyframes tp-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
        .tp-btn:focus-visible {
          outline: 2px solid #4F6EF7;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}

// ── BackButton ────────────────────────────────────────────────────────────────

function BackButton({ color, onClick }: { color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="tp-btn"
      style={{
        alignItems: 'center', background: 'none', border: 'none',
        color, cursor: 'pointer', display: 'inline-flex',
        fontFamily: INTER, fontSize: 13, gap: 6, marginBottom: 16, padding: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Назад
    </button>
  );
}

// ── TrashItem ────────────────────────────────────────────────────────────────

interface TrashItemProps {
  ws: TrashedWorkspace;
  c: C;
  inFlight: boolean;
  isMobile: boolean;
  onRestore: () => void;
  onAskPurge: () => void;
}

function TrashItem({ ws, c, inFlight, isMobile, onRestore, onAskPurge }: TrashItemProps) {
  const days = ws.purgeAt ? daysUntil(ws.purgeAt) : 0;
  const expiringSoon = days <= 2;
  const purgeAt = ws.purgeAt ?? '';
  const deletedAt = ws.deletedAt ?? '';

  return (
    <li
      style={{
        background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12,
        padding: 16, display: 'flex', gap: 16, alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: c.text, fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          {ws.name}
        </div>
        <div style={{ color: c.muted, fontSize: 12, marginBottom: 6 }}>
          {ws.boardCount} {plural(ws.boardCount, BOARDS_FORMS)}
          {ws.description ? ` · ${ws.description.slice(0, 80)}${ws.description.length > 80 ? '…' : ''}` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {ws.deletedBy && deletedAt && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.muted, fontSize: 12 }}>
              <span style={{
                alignItems: 'center', background: c.accent, borderRadius: '50%',
                color: '#fff', display: 'inline-flex', fontSize: 9, fontWeight: 700,
                height: 18, justifyContent: 'center', width: 18,
              }} aria-hidden="true">
                {avatarInitials(ws.deletedBy.name)}
              </span>
              Удалил {ws.deletedBy.name} · {fmtDate(deletedAt)}
            </span>
          )}
          {purgeAt && (
            <span
              style={{
                background: expiringSoon ? c.dangerBg : c.warnBg,
                color: expiringSoon ? c.danger : c.warn,
                fontSize: 11, fontWeight: 600,
                padding: '2px 8px', borderRadius: 6,
              }}
              aria-label={`Удалится навсегда: ${fmtDate(purgeAt)}`}
            >
              {days === 0 ? 'Сегодня' : `Через ${days} ${plural(days, DAYS_FORMS)}`}
            </span>
          )}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: isMobile ? 12 : 8, flexShrink: 0,
        flexDirection: isMobile ? 'column' : 'row',
        width: isMobile ? '100%' : 'auto',
      }}>
        <button
          onClick={onRestore}
          disabled={inFlight}
          aria-label={`Восстановить ${ws.name}`}
          className="tp-btn"
          style={{
            background: 'transparent', border: `1px solid ${c.accent}`, borderRadius: 8,
            color: c.accent, cursor: 'pointer', fontFamily: INTER, fontSize: 13,
            fontWeight: 500, padding: '10px 16px', minHeight: 44,
            opacity: inFlight ? 0.5 : 1,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          Восстановить
        </button>
        {ws.role === 'OWNER' && (
          <button
            onClick={onAskPurge}
            disabled={inFlight}
            aria-label={`Удалить навсегда ${ws.name}`}
            className="tp-btn"
            style={{
              background: 'transparent', border: `1px solid ${c.danger}`, borderRadius: 8,
              color: c.danger, cursor: 'pointer', fontFamily: INTER, fontSize: 13,
              fontWeight: 500, padding: '10px 16px', minHeight: 44,
              opacity: inFlight ? 0.5 : 1,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            Удалить навсегда
          </button>
        )}
      </div>
    </li>
  );
}

// ── ConfirmPurgeModal ────────────────────────────────────────────────────────

interface ConfirmPurgeModalProps {
  ws: TrashedWorkspace;
  c: C;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmPurgeModal({ ws, c, busy, onCancel, onConfirm }: ConfirmPurgeModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const canPurge = confirmText.trim() === ws.name && !busy;

  // Capture trigger to restore focus on close, then focus the safe default (Cancel).
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    cancelBtnRef.current?.focus();
    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, []);

  // Esc closes; focus trap cycles Cancel ↔ Input ↔ Confirm.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Tab') {
        const raw: Array<HTMLButtonElement | HTMLInputElement | null> = [
          cancelBtnRef.current,
          inputRef.current,
          confirmBtnRef.current,
        ];
        const focusables: HTMLElement[] = [];
        for (const el of raw) if (el && !el.disabled) focusables.push(el);
        if (focusables.length === 0) return;
        const active = document.activeElement as HTMLElement | null;
        const idx = active ? focusables.indexOf(active) : -1;
        if (e.shiftKey) {
          if (idx <= 0) {
            e.preventDefault();
            focusables[focusables.length - 1].focus();
          }
        } else if (idx === focusables.length - 1) {
          e.preventDefault();
          focusables[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      // Backdrop intentionally does NOT dismiss on click — destructive irreversible action.
      style={{
        alignItems: 'center', background: 'rgba(0,0,0,0.5)', bottom: 0,
        display: 'flex', justifyContent: 'center', left: 0, position: 'fixed',
        right: 0, top: 0, zIndex: 1000,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purge-title"
        aria-describedby="purge-desc"
        style={{
          background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 12,
          maxWidth: 480, padding: 24, width: '90%',
        }}
      >
        <h2 id="purge-title" style={{ color: c.text, fontSize: 17, fontWeight: 600, margin: 0, marginBottom: 8 }}>
          Удалить «{ws.name}» навсегда?
        </h2>
        <p id="purge-desc" style={{ color: c.muted, fontSize: 13, marginTop: 0, marginBottom: 16 }}>
          Это действие необратимо. Воркспейс и все вложенные доски ({ws.boardCount}), задачи, метки и история будут удалены без возможности восстановления.
        </p>
        <label style={{ display: 'block', color: c.label, fontSize: 12, marginBottom: 6 }}>
          Введите имя воркспейса для подтверждения:
          <strong style={{ color: c.text, marginLeft: 6, fontWeight: 600 }}>{ws.name}</strong>
        </label>
        <input
          ref={inputRef}
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          aria-label={`Введите имя «${ws.name}» для подтверждения удаления`}
          autoComplete="off"
          spellCheck={false}
          disabled={busy}
          className="tp-btn"
          style={{
            background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8,
            color: c.text, fontFamily: INTER, fontSize: 13,
            padding: '10px 12px', width: '100%', marginBottom: 20,
            boxSizing: 'border-box', minHeight: 44,
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            className="tp-btn"
            style={{
              background: c.accent, border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer', fontFamily: INTER, fontSize: 13, fontWeight: 500,
              padding: '10px 16px', minHeight: 44,
            }}
          >
            Отмена
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={onConfirm}
            disabled={!canPurge}
            className="tp-btn"
            style={{
              background: 'transparent', border: `1px solid ${c.danger}`, borderRadius: 8,
              color: c.danger, cursor: canPurge ? 'pointer' : 'not-allowed',
              fontFamily: INTER, fontSize: 13, fontWeight: 500,
              padding: '10px 16px', minHeight: 44,
              opacity: canPurge ? 1 : 0.5,
            }}
          >
            Удалить навсегда
          </button>
        </div>
      </div>
    </div>
  );
}
