import { useCallback, useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';
import * as boardsApi from '../api/boards';

// ── Types ──────────────────────────────────────────────────────────────────────
type Zoom = 'week' | 'month' | 'quarter';

// ── Helpers ────────────────────────────────────────────────────────────────────
const DAY_MS = 86_400_000;

function d0(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number) {
  return new Date(+d0(d) + n * DAY_MS);
}
function diffDays(a: Date, b: Date) {
  return Math.round((+d0(b) - +d0(a)) / DAY_MS);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d0(d);
}
function fmtShort(d: Date) {
  return d.toLocaleString('ru', { day: 'numeric', month: 'short' });
}

// ── Zoom config ────────────────────────────────────────────────────────────────
function getToday() { return d0(new Date()); }

function zoomRange(z: Zoom): { start: Date; end: Date } {
  const t = getToday();
  switch (z) {
    case 'week':
      return { start: addDays(t, -21), end: addDays(t, 42) };
    case 'month':
      return {
        start: new Date(t.getFullYear(), t.getMonth() - 1, 1),
        end:   new Date(t.getFullYear(), t.getMonth() + 6, 1),
      };
    case 'quarter':
      return {
        start: new Date(t.getFullYear(), 0, 1),
        end:   new Date(t.getFullYear() + 1, 0, 1),
      };
  }
}

const TL_W = 1400;

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#03050F', leftBg: '#0F1320', border: '#1C2236',
  text: '#E2E8F8', muted: '#8B95B0', dimmed: '#484F58',
  hdrBg: '#0F1320', rowEven: 'rgba(255,255,255,.012)',
  curWeek: 'rgba(79,110,247,.05)', today: '#EF4444',
  toolbarBg: '#03050F', chip: '#1C2236', chipText: '#8B95B0', accent: '#4F6EF7',
};
const LIGHT: C = {
  bg: '#F5F3FF', leftBg: '#FDFCFF', border: '#E8E5F0',
  text: '#1A1A2E', muted: '#6B7194', dimmed: '#9B96B8',
  hdrBg: '#FDFCFF', rowEven: 'rgba(79,110,247,.025)',
  curWeek: 'rgba(79,110,247,.07)', today: '#EF4444',
  toolbarBg: '#F5F3FF', chip: '#EDE9FE', chipText: '#7C6FA8', accent: '#4F6EF7',
};

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  boardId: string;
  statuses: WorkflowStatus[];
}

// ── Row height constants ───────────────────────────────────────────────────────
const ROW_H  = 40;
const CROW_H = 36;

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface TipState { task: Task; x: number; y: number }

const PRIO_COLOR: Record<string, string> = {
  HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#10B981',
};
const PRIO_LABEL: Record<string, string> = {
  HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};
const STATUS_CHIP: Record<string, { bg: string; text: string }> = {
  OPEN:        { bg: 'rgba(79,110,247,.18)',  text: '#818CF8' },
  IN_PROGRESS: { bg: 'rgba(245,158,11,.18)',  text: '#FBB000' },
  DONE:        { bg: 'rgba(16,185,129,.18)',  text: '#34D399' },
  CANCELLED:   { bg: 'rgba(239,68,68,.16)',   text: '#F87171' },
};

function BarTooltip({ tip, isDark, statuses }: {
  tip: TipState;
  isDark: boolean;
  statuses: WorkflowStatus[];
}) {
  const { task, x, y } = tip;
  const bg      = isDark ? '#161C30' : '#FFFFFF';
  const border  = isDark ? '#1C2236' : '#E8E5F0';
  const text    = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted   = isDark ? '#8B95B0' : '#6B7194';
  const dimmed  = isDark ? '#484F58' : '#9B96B8';

  const start    = parseDate(task.startDate);
  const end      = parseDate(task.dueDate);
  const dur      = start && end ? diffDays(start, end) : null;
  const overdue  = end && end < getToday() && task.status?.category !== 'DONE';
  const overdueD = overdue && end ? diffDays(end, getToday()) : 0;
  const chip     = STATUS_CHIP[task.status?.category ?? 'OPEN'] ?? STATUS_CHIP.OPEN;
  const statusName = statuses.find(s => s.id === task.statusId)?.name ?? task.status?.name ?? '–';
  const childCount = task._count?.children ?? (task.children?.length ?? 0);
  const doneCount  = task.children?.filter(ch => ch.status?.category === 'DONE').length ?? 0;

  // viewport-aware positioning
  const W = 240, H = 160;
  const left = x + 14 + W > window.innerWidth  ? x - W - 14 : x + 14;
  const top  = y - 12 + H > window.innerHeight ? y - H      : y - 12;

  return (
    <div style={{
      position: 'fixed', left, top, width: W, zIndex: 9999,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,.35)',
      fontFamily: '"Inter",system-ui,sans-serif',
      pointerEvents: 'none',
    }}>
      {/* Overdue banner */}
      {overdue && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '5px 9px', marginBottom: 10 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#F87171" strokeWidth="1.3"/>
            <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="#F87171" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="6" cy="8.5" r=".75" fill="#F87171"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#F87171' }}>Просрочено на {overdueD} дн.</span>
        </div>
      )}

      {/* Title */}
      <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 8, lineHeight: '1.3', fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>
        {task.title}
      </div>

      {/* Key + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: dimmed, fontWeight: 500 }}>{task.issueKey}</span>
        <span style={{ background: chip.bg, color: chip.text, fontSize: 11, fontWeight: 500, borderRadius: 5, padding: '2px 7px' }}>
          {statusName}
        </span>
      </div>

      {/* Dates */}
      {start && end && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: muted, fontSize: 11.5, marginBottom: 5 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M1 4.5h10M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          {fmtShort(start)} → {fmtShort(end)}
          <span style={{ color: dimmed }}>({dur} дн.)</span>
        </div>
      )}

      {/* Priority */}
      {task.priority && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: muted, fontSize: 11.5, marginBottom: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: PRIO_COLOR[task.priority] ?? dimmed, flexShrink: 0 }} />
          Приоритет: {PRIO_LABEL[task.priority] ?? task.priority}
        </div>
      )}

      {/* Assignee */}
      {task.assignee && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: muted, fontSize: 11.5, marginBottom: childCount > 0 ? 8 : 0 }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#4F6EF7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>{task.assignee.name[0]?.toUpperCase()}</span>
          </div>
          {task.assignee.name}
        </div>
      )}

      {/* Subtasks */}
      {childCount > 0 && (
        <div style={{ paddingTop: 8, borderTop: `1px solid ${border}`, display: 'flex', alignItems: 'center', gap: 6, color: muted, fontSize: 11.5 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path d="M2 2h2v2H2zM5 2h5v2H5zM2 5h2v2H2zM5 5h5v2H5zM2 8h2v2H2zM5 8h3v2H5z" fill="currentColor"/>
          </svg>
          Подзадачи: {doneCount}/{childCount} закрыто
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RoadmapView({ boardId, statuses }: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [zoom, setZoom]           = useState<Zoom>('month');
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());
  const [hideOpen, setHideOpen]   = useState(false);
  const [tip, setTip]             = useState<TipState | null>(null);

  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const lockRef  = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const r = zoomRange(zoom);
    const from = r.start.toISOString().slice(0, 10);
    const to   = r.end.toISOString().slice(0, 10);
    boardsApi.getRoadmapTasks(boardId, from, to)
      .then(data => {
        setTasks(data);
        // expand all parents by default
        const ids = new Set(data.filter(t => (t._count?.children ?? 0) > 0).map(t => t.id));
        setExpanded(ids);
      })
      .catch(() => { message.error('Не удалось загрузить дорожную карту'); })
      .finally(() => setLoading(false));
  }, [boardId, zoom]);

  // ── Scroll sync ────────────────────────────────────────────────────────────
  useEffect(() => {
    const left  = leftRef.current;
    const right = rightRef.current;
    if (!left || !right) return;

    const onRight = () => {
      if (lockRef.current) return;
      lockRef.current = true;
      left.scrollTop = right.scrollTop;
      lockRef.current = false;
    };
    const onLeft = () => {
      if (lockRef.current) return;
      lockRef.current = true;
      right.scrollTop = left.scrollTop;
      lockRef.current = false;
    };
    right.addEventListener('scroll', onRight);
    left.addEventListener('scroll',  onLeft);
    return () => {
      right.removeEventListener('scroll', onRight);
      left.removeEventListener('scroll',  onLeft);
    };
  }, []);

  // ── Scroll to today ────────────────────────────────────────────────────────
  const scrollToToday = useCallback(() => {
    const right = rightRef.current;
    if (!right) return;
    const r = zoomRange(zoom);
    const total = diffDays(r.start, r.end);
    const dayPx = TL_W / total;
    const todayX = diffDays(r.start, getToday()) * dayPx;
    right.scrollLeft = Math.max(0, todayX - right.clientWidth * 0.35);
  }, [zoom]);

  useEffect(() => { setTimeout(scrollToToday, 50); }, [scrollToToday]);

  // ── Timeline math ──────────────────────────────────────────────────────────
  const range  = zoomRange(zoom);
  const total  = diffDays(range.start, range.end);
  const dayPx  = TL_W / total;
  const xOf    = (d: Date) => diffDays(range.start, d) * dayPx;
  const wOf    = (s: Date, e: Date) => Math.max(6, diffDays(s, e) * dayPx);

  // ── Visible rows ───────────────────────────────────────────────────────────
  const visibleRows = (): Task[] => {
    const out: Task[] = [];
    for (const t of tasks) {
      if (hideOpen && t.status?.category === 'OPEN') {
        const hasVisibleChild = (t.children ?? []).some(
          ch => ch.status?.category !== 'OPEN',
        );
        if (!hasVisibleChild) continue;
      }
      out.push(t);
      if (expanded.has(t.id) && t.children && t.children.length > 0) {
        for (const ch of t.children) {
          if (hideOpen && ch.status?.category === 'OPEN') continue;
          out.push(ch);
        }
      }
    }
    return out;
  };

  // ── Status bar color ───────────────────────────────────────────────────────
  function barColor(task: Task): { bg: string; border: string } {
    const color = task.status?.color ?? '#4F6EF7';
    const cat   = task.status?.category ?? 'OPEN';
    const alpha = cat === 'DONE' ? '.62' : cat === 'IN_PROGRESS' ? '.68' : '.55';
    return {
      bg:     `${color}${Math.round(parseFloat(alpha) * 255).toString(16).padStart(2,'0')}`,
      border: `${color}E0`,
    };
  }

  // ── Timeline header ────────────────────────────────────────────────────────
  function renderHeader() {
    if (zoom === 'week') {
      const weeks: { label: string; x: number; w: number; isCurrent: boolean }[] = [];
      const days:  { label: string; x: number; w: number; isToday: boolean; isWeekend: boolean }[] = [];
      let cur = new Date(range.start);
      while (cur < range.end) {
        const wEnd = addDays(cur, 7);
        const we   = wEnd < range.end ? wEnd : range.end;
        const w    = xOf(we) - xOf(cur);
        const isCW = cur <= getToday() && getToday() < we;
        weeks.push({ label: `${fmtShort(cur)} – ${fmtShort(addDays(we, -1))}`, x: xOf(cur), w, isCurrent: isCW });
        cur = wEnd;
      }
      cur = new Date(range.start);
      while (cur < range.end) {
        const isToday   = isSameDay(cur, getToday());
        const isWeekend = cur.getDay() === 0 || cur.getDay() === 6;
        const isMon     = cur.getDay() === 1;
        days.push({
          label: isMon
            ? `${cur.getDate()} ${cur.toLocaleString('ru', { month: 'short' })}`
            : `${cur.getDate()}`,
          x: xOf(cur), w: dayPx, isToday, isWeekend,
        });
        cur = addDays(cur, 1);
      }
      return { row1: weeks, row2: days, type: 'week' as const };
    }

    if (zoom === 'month') {
      const months: { label: string; x: number; w: number }[] = [];
      const weeks:  { label: string; x: number; w: number; isCurrent: boolean }[] = [];
      let cur = new Date(range.start);
      while (cur < range.end) {
        const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
        const me   = next < range.end ? next : range.end;
        const lbl  = cur.toLocaleString('ru', { month: 'long', year: 'numeric' });
        months.push({ label: lbl[0].toUpperCase() + lbl.slice(1), x: xOf(cur), w: xOf(me) - xOf(cur) });
        cur = next;
      }
      cur = new Date(range.start);
      while (cur < range.end) {
        const wEnd = addDays(cur, 7);
        const we   = wEnd < range.end ? wEnd : range.end;
        const isCW = cur <= getToday() && getToday() < wEnd;
        weeks.push({ label: fmtShort(cur), x: xOf(cur), w: xOf(we) - xOf(cur), isCurrent: isCW });
        cur = wEnd;
      }
      return { row1: months, row2: weeks, type: 'month' as const };
    }

    // quarter
    const quarters: { label: string; x: number; w: number }[] = [];
    const months:   { label: string; x: number; w: number; isCurrent: boolean }[] = [];
    const QS = [
      { label: 'Q1', start: new Date(getToday().getFullYear(), 0, 1), end: new Date(getToday().getFullYear(), 3, 1) },
      { label: 'Q2', start: new Date(getToday().getFullYear(), 3, 1), end: new Date(getToday().getFullYear(), 6, 1) },
      { label: 'Q3', start: new Date(getToday().getFullYear(), 6, 1), end: new Date(getToday().getFullYear(), 9, 1) },
      { label: 'Q4', start: new Date(getToday().getFullYear(), 9, 1), end: new Date(getToday().getFullYear() + 1, 0, 1) },
    ].filter(q => q.end > range.start && q.start < range.end);
    for (const q of QS) {
      const qs = q.start < range.start ? range.start : q.start;
      const qe = q.end   > range.end   ? range.end   : q.end;
      quarters.push({ label: `${q.label} ${getToday().getFullYear()}`, x: xOf(qs), w: xOf(qe) - xOf(qs) });
    }
    let cur = new Date(range.start);
    while (cur < range.end) {
      const next  = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const me    = next < range.end ? next : range.end;
      const isCM  = cur.getMonth() === getToday().getMonth() && cur.getFullYear() === getToday().getFullYear();
      const lbl   = cur.toLocaleString('ru', { month: 'short' });
      months.push({ label: lbl[0].toUpperCase() + lbl.slice(1), x: xOf(cur), w: xOf(me) - xOf(cur), isCurrent: isCM });
      cur = next;
    }
    return { row1: quarters, row2: months, type: 'quarter' as const };
  }

  const hdr = renderHeader();
  const rows = visibleRows();
  const totalH = rows.reduce((acc, t) => acc + (t.parentId ? CROW_H : ROW_H), 0);

  // ── Today X ───────────────────────────────────────────────────────────────
  const todayX = xOf(getToday());

  // ── Status color for tooltip ───────────────────────────────────────────────
  function statusLabel(task: Task) {
    const s = statuses.find(st => st.id === task.statusId);
    return s?.name ?? task.status?.name ?? '–';
  }

  // ── Overdue ────────────────────────────────────────────────────────────────
  function isOverdue(task: Task) {
    const due = parseDate(task.dueDate);
    return due && due < getToday() && task.status?.category !== 'DONE';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: c.bg, fontFamily: '"Inter",system-ui,sans-serif' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px',
        background: c.toolbarBg, borderBottom: `1px solid ${c.border}`, flexShrink: 0,
      }}>
        {/* Zoom */}
        <span style={{ fontSize: 12, color: c.muted, marginRight: 2 }}>Масштаб</span>
        <div style={{ display: 'flex', gap: 2, background: c.chip, borderRadius: 8, padding: 2 }}>
          {(['week', 'month', 'quarter'] as Zoom[]).map(z => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              style={{
                padding: '4px 11px', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                background: zoom === z ? c.accent : 'transparent',
                color: zoom === z ? '#fff' : c.chipText,
                transition: 'all .12s',
              }}
            >
              {{ week: 'Неделя', month: 'Месяц', quarter: 'Квартал' }[z]}
            </button>
          ))}
        </div>

        {/* Today button */}
        <button
          onClick={scrollToToday}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', border: `1px solid ${c.border}`,
            borderRadius: 7, background: 'transparent', cursor: 'pointer',
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.muted,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="6" y1="3.5" x2="6" y2="6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="6" y1="6" x2="7.5" y2="7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
          Сегодня
        </button>

        {/* Hide open toggle */}
        <button
          onClick={() => setHideOpen(v => !v)}
          title={hideOpen ? 'Показать открытые задачи' : 'Скрыть открытые задачи'}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', border: `1px solid ${c.border}`,
            borderRadius: 7, background: 'transparent', cursor: 'pointer',
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12,
            color: c.muted,
            opacity: hideOpen ? .5 : 1,
            textDecoration: hideOpen ? 'line-through' : 'none',
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.accent, flexShrink: 0 }} />
          Открыто
          {hideOpen ? (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M4.5 4.8A5.4 5.4 0 0 0 1.5 7c1 2 3 3.5 5.5 3.5a5.5 5.5 0 0 0 2.5-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7.5 3.6A5.4 5.4 0 0 1 12.5 7a5.5 5.5 0 0 1-.8 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1 }} />

        <span style={{ fontSize: 12, color: c.muted }}>{rows.length} задач</span>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ── Left panel ── */}
        <div style={{
          width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${c.border}`, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            height: 52, display: 'flex', alignItems: 'center',
            padding: '0 12px 0 16px', background: c.hdrBg,
            borderBottom: `1px solid ${c.border}`, flexShrink: 0, gap: 8,
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: c.dimmed, flex: 1 }}>
              Задача
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: c.dimmed, width: 72, textAlign: 'right', flexShrink: 0 }}>
              Дедлайн
            </span>
          </div>
          {/* Rows */}
          <div ref={leftRef} style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: c.muted, fontSize: 13 }}>Загрузка…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: c.dimmed, fontSize: 13 }}>
                Нет задач с датами в этом периоде
              </div>
            ) : rows.map((task, idx) => {
              const isChild  = !!task.parentId;
              const rh       = isChild ? CROW_H : ROW_H;
              const hasKids  = (task._count?.children ?? (task.children?.length ?? 0)) > 0;
              const isExp    = expanded.has(task.id);
              const due      = parseDate(task.dueDate);
              const overdue  = isOverdue(task);
              const dueColor = overdue ? '#EF4444' : due && diffDays(due, getToday()) < 7 && due >= getToday() ? '#F59E0B' : task.status?.category === 'DONE' ? '#10B981' : c.dimmed;

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'flex', alignItems: 'center', height: rh,
                    borderBottom: `1px solid ${c.border}`,
                    background: idx % 2 === 0 ? 'transparent' : c.rowEven,
                    paddingRight: 8, overflow: 'hidden', cursor: 'pointer',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `rgba(79,110,247,.05)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = idx % 2 === 0 ? 'transparent' : c.rowEven; }}
                >
                  {isChild ? (
                    <>
                      <div style={{ width: 26, flexShrink: 0, display: 'flex', alignItems: 'center', height: '100%', paddingLeft: 16 }}>
                        <div style={{ width: 1, height: '100%', background: c.border, opacity: .6, marginRight: 8 }} />
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" style={{ flexShrink: 0, opacity: .5 }}>
                          <circle cx="4" cy="4" r="2.5" stroke={c.muted} strokeWidth="1.3"/>
                        </svg>
                      </div>
                      <span style={{ fontSize: 10.5, color: c.dimmed, flexShrink: 0, marginRight: 5, fontWeight: 500 }}>{task.issueKey}</span>
                      <span style={{ fontSize: 12.5, color: c.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                    </>
                  ) : (
                    <>
                      {/* Expand button */}
                      <button
                        onClick={() => {
                          if (!hasKids) return;
                          setExpanded(prev => {
                            const next = new Set(prev);
                            if (next.has(task.id)) next.delete(task.id);
                            else next.add(task.id);
                            return next;
                          });
                        }}
                        style={{
                          width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', cursor: hasKids ? 'pointer' : 'default',
                          color: c.muted, flexShrink: 0, marginLeft: 10,
                          transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .18s',
                        }}
                      >
                        {hasKids && (
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                            <path d="M2 1.5L5.5 4L2 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                      <span style={{ fontSize: 10.5, color: c.dimmed, flexShrink: 0, margin: '0 5px 0 4px', fontWeight: 500 }}>{task.issueKey}</span>
                      <span style={{ fontSize: 12.5, color: c.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{task.title}</span>
                    </>
                  )}
                  <span style={{ fontSize: 11, color: dueColor, flexShrink: 0, width: 72, textAlign: 'right', fontWeight: 500 }}>
                    {due ? fmtShort(due) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right panel (timeline) ── */}
        <div
          ref={rightRef}
          style={{ flex: 1, overflow: 'auto', position: 'relative', minWidth: 0 }}
        >
          <div style={{ position: 'relative', width: TL_W, minWidth: '100%' }}>

            {/* Timeline header */}
            <div style={{
              height: 52, background: c.hdrBg, borderBottom: `1px solid ${c.border}`,
              position: 'sticky', top: 0, zIndex: 20, display: 'flex', flexDirection: 'column',
            }}>
              {/* Row 1 */}
              <div style={{ display: 'flex', height: 26, borderBottom: `1px solid ${c.border}` }}>
                {hdr.row1.map((cell, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: cell.x, width: cell.w, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: `1px solid ${c.border}`,
                    fontSize: 11, fontWeight: 600, color: c.muted,
                    overflow: 'hidden', whiteSpace: 'nowrap', paddingInline: 8,
                    background: 'isCurrent' in cell && (cell as { isCurrent?: boolean }).isCurrent ? c.curWeek : 'transparent',
                  }}>
                    {cell.label}
                  </div>
                ))}
              </div>
              {/* Row 2 */}
              <div style={{ display: 'flex', height: 26, position: 'relative' }}>
                {hdr.row2.map((cell, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: cell.x, width: cell.w, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRight: `1px solid rgba(255,255,255,.04)`,
                    fontSize: 10, color: c.dimmed, overflow: 'hidden', whiteSpace: 'nowrap',
                    background: 'isCurrent' in cell && (cell as { isCurrent?: boolean }).isCurrent ? c.curWeek : 'transparent',
                  }}>
                    {(cell as { label: string }).label}
                  </div>
                ))}
              </div>
            </div>

            {/* Bars area */}
            <div style={{ position: 'relative', height: totalH }}>

              {/* Current-week highlight */}
              {(() => {
                const ws = d0(new Date(getToday()));
                const dayOfWeek = ws.getDay();
                const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const monday = addDays(ws, mondayOffset);
                const sunday = addDays(monday, 7);
                const lx = Math.max(0, xOf(monday));
                const rx = Math.min(TL_W, xOf(sunday));
                return rx > lx ? (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: lx, width: rx - lx,
                    background: c.curWeek, pointerEvents: 'none',
                  }} />
                ) : null;
              })()}

              {/* Grid lines (month separators) */}
              {(() => {
                const lines: number[] = [];
                let cur = new Date(range.start);
                while (cur <= range.end) {
                  const x = xOf(cur);
                  if (x >= 0 && x <= TL_W) lines.push(x);
                  cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
                }
                return lines.map((x, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: 0, bottom: 0, left: x, width: 1,
                    background: c.border, opacity: .9, pointerEvents: 'none',
                  }} />
                ));
              })()}

              {/* Week grid lines */}
              {zoom !== 'week' && (() => {
                const lines: number[] = [];
                let cur = new Date(range.start);
                while (cur < range.end) {
                  const x = xOf(cur);
                  if (x > 0 && x < TL_W) lines.push(x);
                  cur = addDays(cur, 7);
                }
                return lines.map((x, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: 0, bottom: 0, left: x, width: 1,
                    background: c.border, opacity: .35, pointerEvents: 'none',
                  }} />
                ));
              })()}

              {/* Today line */}
              {todayX >= 0 && todayX <= TL_W && (
                <div style={{
                  position: 'absolute', top: 0, bottom: 0, left: todayX, width: 2,
                  background: c.today, zIndex: 15, pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: -3,
                    width: 8, height: 8, borderRadius: '50%', background: c.today,
                  }} />
                </div>
              )}

              {/* Task bars */}
              {rows.map((task, idx) => {
                const isChild = !!task.parentId;
                const rh      = isChild ? CROW_H : ROW_H;
                const yOffset = rows.slice(0, idx).reduce((acc, t) => acc + (t.parentId ? CROW_H : ROW_H), 0);
                const start   = parseDate(task.startDate) ?? parseDate(task.dueDate);
                const end     = parseDate(task.dueDate)   ?? parseDate(task.startDate);
                const { bg, border } = barColor(task);
                const barH    = isChild ? 22 : 30;
                const barR    = isChild ? 5  : 7;

                const rowStyle: React.CSSProperties = {
                  position: 'absolute', left: 0, right: 0,
                  top: yOffset, height: rh,
                  background: idx % 2 === 0 ? 'transparent' : c.rowEven,
                  borderBottom: `1px solid ${c.border}`,
                };

                if (!start || !end) {
                  return (
                    <div key={task.id} style={rowStyle}>
                      <span style={{
                        position: 'absolute', right: 10, top: '50%',
                        transform: 'translateY(-50%)', fontSize: 11, color: c.dimmed, fontStyle: 'italic',
                      }}>нет дат</span>
                    </div>
                  );
                }

                const bx = xOf(start);
                const bw = Math.max(6, wOf(start, end));
                const cx = Math.max(0, bx);
                const cw = Math.min(TL_W - cx, bw - (cx - bx));

                const overdue = isOverdue(task);
                const ovLeft  = Math.min(TL_W, Math.max(0, xOf(end)));
                const ovRight = Math.min(TL_W, xOf(getToday()));
                const ovW     = overdue ? ovRight - ovLeft : 0;
                const overdueDays = overdue ? diffDays(end, getToday()) : 0;

                return (
                  <div key={task.id} style={rowStyle}>
                    {cw > 0 && (
                      <div
                        title={`${task.issueKey} · ${task.title} · ${statusLabel(task)}`}
                        style={{
                          position: 'absolute',
                          top: '50%', transform: 'translateY(-50%)',
                          left: cx, width: cw, height: barH,
                          borderRadius: barR, overflow: 'hidden',
                          background: bg, border: `1px solid ${border}`,
                          display: 'flex', alignItems: 'center',
                          padding: '0 8px 0 10px', cursor: 'default',
                          color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)',
                          fontSize: isChild ? 11 : 12, fontWeight: 500,
                          whiteSpace: 'nowrap',
                          transition: 'filter .12s',
                          zIndex: 2,
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.12)';
                          setTip({ task, x: e.clientX, y: e.clientY });
                        }}
                        onMouseMove={e => setTip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.filter = '';
                          setTip(null);
                        }}
                      >
                        {/* Left accent stripe */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: isChild ? 3 : 4,
                          background: 'rgba(0,0,0,.25)',
                        }} />
                        {cw > 38 && <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 600, marginRight: 5, flexShrink: 0 }}>{task.issueKey}</span>}
                        {cw > 60 && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>}
                        {cw > 90 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.82)', marginLeft: 6, flexShrink: 0, fontWeight: 600 }}>{fmtShort(end)}</span>}
                      </div>
                    )}

                    {/* Overdue tail */}
                    {ovW > 4 && (
                      <div
                        title={`Просрочено на ${overdueDays} дн.`}
                        style={{
                          position: 'absolute',
                          top: '50%', transform: 'translateY(-50%)',
                          left: ovLeft, width: ovW, height: barH,
                          borderRadius: `0 ${barR}px ${barR}px 0`,
                          background: 'rgba(239,68,68,.28)',
                          border: '1.5px dashed rgba(239,68,68,.72)',
                          borderLeft: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          paddingRight: 6, zIndex: 3, cursor: 'default',
                          animation: task.priority === 'HIGH' ? 'ov-pulse 2s ease-in-out infinite' : 'none',
                        }}
                      >
                        {ovW > 36 && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(239,68,68,.95)', whiteSpace: 'nowrap' }}>
                            +{overdueDays}д
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes ov-pulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>

      {tip && <BarTooltip tip={tip} isDark={isDark} statuses={statuses} />}
    </div>
  );
}
