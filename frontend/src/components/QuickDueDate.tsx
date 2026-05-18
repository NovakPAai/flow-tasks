import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { message } from 'antd';
import * as tasksApi from '../api/tasks';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint } from '../utils/useBreakpoint';

// ── Design tokens ────────────────────────────────────────────────────────────
type C = Record<string, string>;

const OVERDUE = '#F87171';

const DARK: C = {
  text: '#8B949E',
  triggerHoverBg: 'rgba(79,110,247,0.08)',
  popoverBg: '#0F1320',
  popoverBorder: '#1C2236',
  popoverShadow: '0 8px 24px rgba(0,0,0,0.45)',
  inputBg: '#03050F',
  inputBorder: '#1C2236',
  inputText: '#E2E8F8',
  btnText: '#8B949E',
  btnDangerText: '#EF4444',
  focusRing: '#4F6EF7',
};
const LIGHT: C = {
  text: '#6B7194',
  triggerHoverBg: 'rgba(79,110,247,0.08)',
  popoverBg: '#FFFFFF',
  popoverBorder: '#E8E5F0',
  popoverShadow: '0 8px 24px rgba(15,19,32,0.12)',
  inputBg: '#FFFFFF',
  inputBorder: '#E8E5F0',
  inputText: '#1A1A2E',
  btnText: '#6B7194',
  btnDangerText: '#EF4444',
  focusRing: '#4F6EF7',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const isoToDateInput = (iso: string | null): string =>
  iso && iso.length >= 10 ? iso.slice(0, 10) : '';

// Build ISO string from YYYY-MM-DD without timezone shift:
// "2026-05-25" → "2026-05-25T00:00:00.000Z" (treat user-picked calendar date as UTC date).
// Pairing with `timeZone: 'UTC'` in display avoids off-by-one in timezones west of UTC.
const dateInputToIso = (s: string): string | null =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : null;

const formatChip = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' };
  const nowYearUtc = new Date().getUTCFullYear();
  if (d.getUTCFullYear() !== nowYearUtc) opts.year = 'numeric';
  return d.toLocaleDateString('ru-RU', opts);
};

const formatTitle = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { timeZone: 'UTC' });
};

const CalendarIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 11 11" fill="none" style={{ flexShrink: 0 }} aria-hidden>
    <rect x="0.5" y="1.5" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1" />
    <path d="M3 0.5v2M8 0.5v2M0.5 4.5h10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

const Spinner = ({ size = 10, color }: { size?: number; color: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    style={{ animation: 'qdd-spin 0.8s linear infinite', flexShrink: 0 }}
    aria-hidden
  >
    <circle cx="8" cy="8" r="6" stroke={color} strokeOpacity="0.25" strokeWidth="2" fill="none" />
    <path d="M14 8a6 6 0 0 0-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
  </svg>
);

// ── Global style injection (once per page) ──────────────────────────────────
const STYLE_ID = 'qdd-styles';
const STYLE_CSS = `
@keyframes qdd-spin { to { transform: rotate(360deg); } }
.qdd-add-trigger { opacity: 0; transition: opacity 0.12s; }
.qdd-add-trigger:focus-visible { opacity: 1; }
@media (hover: hover) {
  *:hover > .qdd-add-trigger,
  *:hover .qdd-add-trigger { opacity: 1; }
}
@media (hover: none) {
  .qdd-add-trigger { opacity: 1; }
}
.qdd-btn:focus-visible,
.qdd-input:focus-visible {
  outline: 2px solid var(--qdd-focus, #4F6EF7);
  outline-offset: 1px;
}
.qdd-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
`;

function ensureGlobalStyle(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLE_CSS;
  document.head.appendChild(el);
}

// ── Component ────────────────────────────────────────────────────────────────

export interface QuickDueDateProps {
  taskId: string;
  value: string | null;
  canEdit: boolean;
  variant?: 'badge-only' | 'badge-or-add';
  size?: 'sm' | 'md';
  showOverdue?: boolean;
  onChange?: (next: string | null) => void;
}

export default function QuickDueDate({
  taskId,
  value,
  canEdit,
  variant = 'badge-only',
  size = 'sm',
  showOverdue = true,
  onChange,
}: QuickDueDateProps) {
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<string>(isoToDateInput(value));
  const [status, setStatus] = useState<string>('');
  const [pos, setPos] = useState<{ top: number; left: number; placement: 'bottom' | 'top' } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const clearBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveIdRef = useRef(0);
  const isMountedRef = useRef(true);

  const due = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [value]);
  const isOverdue = showOverdue && due !== null && due.getTime() < Date.now();
  const chipText = due ? formatChip(value as string) : '';

  useEffect(() => {
    ensureGlobalStyle();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    setDraft(isoToDateInput(value));
  }, [value]);

  // Outside-click + Escape: document-level so popover handles its own keys
  // before parent modals (TaskDrawer uses document too, so stopPropagation works).
  useEffect(() => {
    if (!open) return;

    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePopover(true);
      }
    };
    const onMouseDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node | null;
      if (
        popoverRef.current && target && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        closePopover(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  // Focus the input when popover opens
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Compute popover position relative to viewport (fixed) — avoids clipping by
  // ancestors with overflow:hidden (accordions, modals) and survives parent scroll.
  // Recomputes on scroll/resize so popover follows the trigger.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const compute = () => {
      const trigger = triggerRef.current;
      if (!trigger || typeof window === 'undefined') return;
      const r = trigger.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(POPOVER_WIDTH, vw - 16);
      const h = POPOVER_EST_HEIGHT;
      const spaceBelow = vh - r.bottom;
      const placement: 'bottom' | 'top' = spaceBelow < h + GAP && r.top > h + GAP ? 'top' : 'bottom';
      const top = placement === 'bottom' ? r.bottom + GAP : r.top - h - GAP;
      let left = r.left;
      if (left + w > vw - 8) left = vw - w - 8;
      if (left < 8) left = 8;
      setPos({ top, left, placement });
    };
    compute();
    window.addEventListener('scroll', compute, true);
    window.addEventListener('resize', compute);
    return () => {
      window.removeEventListener('scroll', compute, true);
      window.removeEventListener('resize', compute);
    };
  }, [open]);

  const closePopover = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  const save = useCallback(
    async (next: string | null) => {
      const requestId = ++saveIdRef.current;
      const prev = value;
      setSaving(true);
      onChange?.(next);
      try {
        await tasksApi.updateTask(taskId, { dueDate: next });
        if (!isMountedRef.current || saveIdRef.current !== requestId) return;
        setStatus(next ? `Срок обновлён: ${formatChip(next)}` : 'Срок очищен');
      } catch {
        if (!isMountedRef.current || saveIdRef.current !== requestId) return;
        onChange?.(prev);
        message.error('Не удалось обновить срок');
      } finally {
        if (isMountedRef.current && saveIdRef.current === requestId) {
          setSaving(false);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    },
    [taskId, value, onChange],
  );

  const handleTriggerClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setDraft(isoToDateInput(value));
    setOpen(o => !o);
  };

  const handleTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      setDraft(isoToDateInput(value));
      setOpen(true);
    }
  };

  // Focus trap: cycle Tab between input ↔ clear ↔ cancel
  const handlePopoverKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const focusables: HTMLElement[] = [];
    if (inputRef.current && !inputRef.current.disabled) focusables.push(inputRef.current);
    if (clearBtnRef.current && !clearBtnRef.current.disabled) focusables.push(clearBtnRef.current);
    const cancel = popoverRef.current?.querySelector<HTMLButtonElement>('[data-qdd-cancel]');
    if (cancel && !cancel.disabled) focusables.push(cancel);
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
  };

  const renderPopover = () => {
    if (typeof document === 'undefined') return null;
    const node = (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label="Выберите срок задачи"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onKeyDown={handlePopoverKey}
      style={{ ...popoverStyle(c, pos), ['--qdd-focus' as never]: c.focusRing } as CSSProperties}
    >
      <input
        ref={inputRef}
        type="date"
        className="qdd-input"
        aria-label="Дата срока"
        value={draft}
        onChange={e => {
          const next = dateInputToIso(e.target.value);
          if (next !== value) void save(next);
          else closePopover(true);
        }}
        disabled={saving}
        style={inputStyle(c)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, marginTop: 6 }}>
        <button
          ref={clearBtnRef}
          type="button"
          className="qdd-btn"
          onClick={() => void save(null)}
          disabled={saving || value === null}
          style={btnStyle(c, 'danger')}
        >
          Очистить
        </button>
        <button
          type="button"
          data-qdd-cancel
          className="qdd-btn"
          onClick={() => closePopover(true)}
          disabled={saving}
          style={btnStyle(c, 'default')}
        >
          Отмена
        </button>
      </div>
    </div>
    );
    return createPortal(node, document.body);
  };

  const liveRegion = (
    <span style={visuallyHidden} aria-live="polite" aria-atomic="true">{status}</span>
  );

  const triggerColor = isOverdue ? OVERDUE : c.text;

  // ── Read-only path ───────────────────────────────────────────────────────
  if (!canEdit) {
    if (!due) return null;
    return (
      <span
        title={formatTitle(value as string)}
        style={chipStyle({ size, isMobile, color: triggerColor, interactive: false })}
      >
        <CalendarIcon size={size === 'md' ? 12 : 11} />
        {chipText}
      </span>
    );
  }

  // ── Editable, no value ───────────────────────────────────────────────────
  if (!due) {
    if (variant !== 'badge-or-add') return null;
    return (
      <>
        <button
          ref={triggerRef}
          type="button"
          aria-label="Добавить срок задачи"
          title="Добавить срок"
          className="qdd-add-trigger qdd-btn"
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKey}
          style={addBtnStyle(c, size, isMobile)}
        >
          + срок
        </button>
        {open && renderPopover()}
        {liveRegion}
      </>
    );
  }

  // ── Editable, with value ─────────────────────────────────────────────────
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="qdd-btn"
        aria-label={`Изменить срок задачи, ${chipText}`}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKey}
        title={formatTitle(value as string)}
        style={chipStyle({ size, isMobile, color: triggerColor, interactive: true })}
      >
        <CalendarIcon size={size === 'md' ? 12 : 11} />
        {chipText}
        {saving && <Spinner size={size === 'md' ? 11 : 10} color={c.text} />}
      </button>
      {open && renderPopover()}
      {liveRegion}
    </>
  );
}

// ── Style helpers ────────────────────────────────────────────────────────────

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function chipStyle({
  size,
  isMobile,
  color,
  interactive,
}: { size: 'sm' | 'md'; isMobile: boolean; color: string; interactive: boolean }): CSSProperties {
  const font = size === 'md' ? 12 : 11;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: interactive ? (isMobile ? '8px 10px' : '4px 6px') : '0',
    margin: 0,
    border: 'none',
    background: 'transparent',
    borderRadius: 4,
    cursor: interactive ? 'pointer' : 'default',
    fontFamily: '"Inter",system-ui,sans-serif',
    fontSize: font,
    color,
    transition: 'background-color 0.12s',
    minHeight: interactive ? (isMobile ? 36 : 24) : undefined,
  };
}

function addBtnStyle(c: C, size: 'sm' | 'md', isMobile: boolean): CSSProperties {
  const font = size === 'md' ? 12 : 11;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: isMobile ? '8px 12px' : '4px 8px',
    border: `1px dashed ${c.popoverBorder}`,
    borderRadius: 4,
    background: 'transparent',
    color: c.text,
    fontFamily: '"Inter",system-ui,sans-serif',
    fontSize: font,
    cursor: 'pointer',
    transition: 'all 0.12s',
    minHeight: isMobile ? 36 : 24,
  };
}

const POPOVER_WIDTH = 220;
const POPOVER_EST_HEIGHT = 110;
const GAP = 4;

function popoverStyle(
  c: C,
  pos: { top: number; left: number; placement: 'bottom' | 'top' } | null,
): CSSProperties {
  // Position is computed against the viewport (fixed) so ancestors with
  // overflow:hidden (accordions, drawers) cannot clip the popover.
  // While pos is null (first paint before layout effect) keep it offscreen
  // to avoid a visible flicker at top:0/left:0.
  return {
    position: 'fixed',
    zIndex: 1000,
    top: pos?.top ?? -9999,
    left: pos?.left ?? -9999,
    padding: 8,
    background: c.popoverBg,
    border: `1px solid ${c.popoverBorder}`,
    borderRadius: 8,
    boxShadow: c.popoverShadow,
    width: POPOVER_WIDTH,
    maxWidth: 'calc(100vw - 16px)',
  };
}

function inputStyle(c: C): CSSProperties {
  return {
    width: '100%',
    padding: '6px 8px',
    fontFamily: '"Inter",system-ui,sans-serif',
    fontSize: 13,
    color: c.inputText,
    background: c.inputBg,
    border: `1px solid ${c.inputBorder}`,
    borderRadius: 6,
  };
}

function btnStyle(c: C, variant: 'default' | 'danger'): CSSProperties {
  return {
    flex: 1,
    padding: '6px 8px',
    fontFamily: '"Inter",system-ui,sans-serif',
    fontSize: 12,
    color: variant === 'danger' ? c.btnDangerText : c.btnText,
    background: 'transparent',
    border: `1px solid ${c.popoverBorder}`,
    borderRadius: 6,
    cursor: 'pointer',
    transition: 'background-color 0.12s',
    minHeight: 28,
  };
}
