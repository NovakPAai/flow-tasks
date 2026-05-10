import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const SAFE_COLOR_RE = /^#[0-9a-fA-F]{3,8}$|^rgba?\([ \t]*\d+[ \t]*,[ \t]*\d+[ \t]*,[ \t]*\d+[ \t,\d.]*\)$|^hsla?\([ \t]*\d+[ \t]*,[ \t]*\d+%[ \t]*,[ \t]*\d+%[ \t,\d.]*\)$/;
function safeColor(c: string | null | undefined, fallback = '#4F6EF7'): string {
  return c && SAFE_COLOR_RE.test(c.trim()) ? c.trim() : fallback;
}

function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/.test(s)) return null;
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

function BarTooltip({ tip, isDark, statuses, today }: {
  tip: TipState;
  isDark: boolean;
  statuses: WorkflowStatus[];
  today: Date;
}) {
  const { task, x, y } = tip;
  const bg     = isDark ? '#161C30' : '#FFFFFF';
  const border = isDark ? '#1C2236' : '#E8E5F0';
  const text   = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted  = isDark ? '#8B95B0' : '#6B7194';
  const dimmed = isDark ? '#484F58' : '#9B96B8';

  const start       = parseDate(task.startDate);
  const end         = parseDate(task.dueDate);
  const isMilestone = !start && !!end;
  const dur         = start && end ? diffDays(start, end) : null;
  const overdue    = end && end < today && task.status?.category !== 'DONE';
  const overdueD   = overdue && end ? diffDays(end, today) : 0;
  const chip       = STATUS_CHIP[task.status?.category ?? 'OPEN'] ?? STATUS_CHIP.OPEN;
  const statusName = statuses.find(s => s.id === task.statusId)?.name ?? task.status?.name ?? '–';
  const childCount = task._count?.children ?? (task.children?.length ?? 0);
  const doneCount  = task.children?.filter(ch => ch.status?.category === 'DONE').length ?? 0;
  const statusMap  = new Map(statuses.map(s => [s.id, s]));

  // История статусов: вычисляем длительность каждого сегмента
  const history = task.statusHistory;
  const historySegs = history && history.length > 0 && start && end
    ? (() => {
        const totalMs = +end - +start;
        if (totalMs <= 0) return null;
        const segs = history.map(seg => {
          const segStart = parseDate(seg.startedAt);
          const segEnd   = seg.endedAt ? (parseDate(seg.endedAt) ?? (today < end ? today : end)) : (today < end ? today : end);
          const ms       = segStart ? Math.max(0, +segEnd - +segStart) : 0;
          const pct    = Math.round(ms / totalMs * 100);
          const st     = statusMap.get(seg.statusId);
          return { name: st?.name ?? '?', color: safeColor(st?.color, '#8B95B0'), days: Math.round(ms / DAY_MS), pct, ongoing: !seg.endedAt };
        });
        // Хвост: запланированное оставшееся время
        const last = history[history.length - 1];
        let tailSeg: { color: string; pct: number; days: number } | null = null;
        if (!last.endedAt && today < end) {
          const tailMs  = +end - +today;
          const tailPct = Math.round(tailMs / totalMs * 100);
          const st      = statusMap.get(last.statusId);
          tailSeg = { color: safeColor(st?.color, '#8B95B0'), pct: tailPct, days: Math.round(tailMs / DAY_MS) };
        }
        return { segs, tailSeg };
      })()
    : null;

  // viewport-aware position — высота зависит от содержимого
  const W  = 256;
  const vw = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const estH = 200 + (historySegs ? 80 : 0) + (task.description ? 40 : 0);
  const left = x + 14 + W > vw ? x - W - 14 : x + 14;
  const top  = y - 12 + estH > vh ? y - estH : y - 12;

  return (
    <div style={{
      position: 'fixed', left, top, width: W, zIndex: 9999,
      background: bg, border: `1px solid ${border}`,
      borderRadius: 10, padding: '12px 14px',
      boxShadow: '0 8px 32px rgba(0,0,0,.35)',
      fontFamily: '"Inter",system-ui,sans-serif',
      pointerEvents: 'none',
    }}>

      {/* Просрочка */}
      {overdue && (
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)', borderRadius:6, padding:'5px 9px', marginBottom:10 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="#F87171" strokeWidth="1.3"/>
            <line x1="6" y1="3.5" x2="6" y2="6.5" stroke="#F87171" strokeWidth="1.3" strokeLinecap="round"/>
            <circle cx="6" cy="8.5" r=".75" fill="#F87171"/>
          </svg>
          <span style={{ fontSize:12, fontWeight:600, color:'#F87171' }}>Просрочено на {overdueD} дн.</span>
        </div>
      )}

      {/* Заголовок */}
      <div style={{ fontSize:13, fontWeight:600, color:text, marginBottom:8, lineHeight:'1.3', fontFamily:'"Space Grotesk",system-ui,sans-serif' }}>
        {task.title}
      </div>

      {/* Key + статус */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <span style={{ fontSize:11, color:dimmed, fontWeight:500 }}>{task.issueKey}</span>
        <span style={{ background:chip.bg, color:chip.text, fontSize:11, fontWeight:500, borderRadius:5, padding:'2px 7px' }}>{statusName}</span>
      </div>

      {/* Даты */}
      {isMilestone ? (
        <>
          <div style={{ display:'flex', alignItems:'center', gap:5, color:muted, fontSize:11.5, marginBottom:5 }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="3" y="3" width="6" height="6" transform="rotate(45 6 6)" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
            Дедлайн: {fmtShort(end)}
          </div>
          <div style={{ fontSize:10.5, color:dimmed, fontStyle:'italic', marginBottom:5 }}>
            Добавьте дату начала — задача появится как диапазон
          </div>
        </>
      ) : start && end ? (
        <div style={{ display:'flex', alignItems:'center', gap:5, color:muted, fontSize:11.5, marginBottom:5 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.1"/>
            <path d="M1 4.5h10M4 1v2M8 1v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
          {fmtShort(start)} → {fmtShort(end)}
          <span style={{ color:dimmed }}>({dur} дн.)</span>
        </div>
      ) : null}

      {/* Приоритет */}
      {task.priority && (
        <div style={{ display:'flex', alignItems:'center', gap:5, color:muted, fontSize:11.5, marginBottom:5 }}>
          <div aria-hidden="true" style={{ width:6, height:6, borderRadius:'50%', background:PRIO_COLOR[task.priority] ?? dimmed, flexShrink:0 }}/>
          Приоритет: {PRIO_LABEL[task.priority] ?? task.priority}
        </div>
      )}

      {/* Исполнитель */}
      {task.assignee && (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:muted, fontSize:11.5, marginBottom: historySegs || childCount > 0 ? 0 : 0 }}>
          <div style={{ width:18, height:18, borderRadius:'50%', background:'#4F6EF7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ fontSize:8, fontWeight:700, color:'#fff' }}>
              {task.assignee.name.length > 0 ? task.assignee.name[0].toUpperCase() : '?'}
            </span>
          </div>
          {task.assignee.name.slice(0, 40)}
        </div>
      )}

      {/* Подзадачи */}
      {childCount > 0 && (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:muted, fontSize:11.5, marginTop:5 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2h2v2H2zM5 2h5v2H5zM2 5h2v2H2zM5 5h5v2H5zM2 8h2v2H2zM5 8h3v2H5z" fill="currentColor"/>
          </svg>
          Подзадачи: {doneCount}/{childCount} закрыто
        </div>
      )}

      {/* История статусов */}
      {historySegs && (
        <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${border}` }}>
          <div style={{ fontSize:10, fontWeight:600, textTransform:'uppercase', letterSpacing:'.06em', color:dimmed, marginBottom:6 }}>
            История статусов
          </div>
          {/* Мини-бар */}
          <div style={{ display:'flex', height:5, borderRadius:3, overflow:'hidden', marginBottom:7, gap:1 }}>
            {historySegs.segs.map((seg, i) => (
              <div key={`${seg.name}-${i}`} style={{ flex: seg.pct, background: seg.color, opacity: seg.ongoing ? .55 : .85, minWidth: seg.pct > 0 ? 3 : 0 }} />
            ))}
            {historySegs.tailSeg && (
              <div style={{ flex: historySegs.tailSeg.pct, background: historySegs.tailSeg.color, opacity: .2, minWidth: 3 }} />
            )}
          </div>
          {/* Текстовые строки */}
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            {historySegs.segs.map((seg, i) => (
              <div key={`${seg.name}-${i}`} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:muted }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:seg.color, flexShrink:0 }}/>
                <span>{seg.name}: {seg.days} дн.{seg.ongoing ? <span style={{ color:dimmed }}> (сейчас)</span> : ''}</span>
              </div>
            ))}
            {historySegs.tailSeg && (
              <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:dimmed, opacity:.7 }}>
                <div style={{ width:7, height:7, borderRadius:'50%', background:historySegs.tailSeg.color, opacity:.4, flexShrink:0 }}/>
                <span>Запланировано ещё: {historySegs.tailSeg.days} дн.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Описание */}
      {task.description && (
        <div style={{ marginTop:8, paddingTop:8, borderTop:`1px solid ${border}`, fontSize:11, color:dimmed, lineHeight:'1.45' }}>
          {task.description.length > 120 ? task.description.slice(0, 120) + '…' : task.description}
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
  const [showLegend, setShowLegend] = useState(false);

  // Быстрый доступ к цвету/категории статуса по id
  const statusMap = useMemo(
    () => new Map(statuses.map(s => [s.id, s])),
    [statuses],
  );

  const leftRef          = useRef<HTMLDivElement>(null);
  const rightRef         = useRef<HTMLDivElement>(null);
  const legendPopoverRef = useRef<HTMLDivElement>(null);
  const lockRef          = useRef(false);
  const rafRef           = useRef<number | null>(null);
  const touchTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchClearRef    = useRef<(() => void) | null>(null);

  // ── Cleanup rAF, touch timer and touch listener on unmount ─────────────────
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    if (touchClearRef.current) window.removeEventListener('touchmove', touchClearRef.current);
  }, []);

  // ── Focus legend popover on open ──────────────────────────────────────────
  useEffect(() => {
    if (showLegend) legendPopoverRef.current?.focus();
  }, [showLegend]);

  // ── Shared touch tooltip handler ──────────────────────────────────────────
  const handleTouch = useCallback((task: Task, e: React.TouchEvent) => {
    const t = e.touches[0];
    setTip({ task, x: t.clientX, y: t.clientY });
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    if (touchClearRef.current) window.removeEventListener('touchmove', touchClearRef.current);
    const clear = () => { setTip(null); };
    touchClearRef.current = clear;
    window.addEventListener('touchmove', clear, { once: true, passive: true });
    touchTimerRef.current = setTimeout(() => {
      window.removeEventListener('touchmove', clear);
      setTip(null);
    }, 4000);
  }, []);

  // ── Keyboard shortcuts W/M/Q ───────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as Element;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if ((t as HTMLElement).isContentEditable) return;
      if (t.closest('[role="textbox"],[role="combobox"],[role="listbox"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'w' || e.key === 'W') setZoom('week');
      else if (e.key === 'm' || e.key === 'M') setZoom('month');
      else if (e.key === 'q' || e.key === 'Q') setZoom('quarter');
      else if (e.key === 'Escape') setShowLegend(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const r = zoomRange(zoom);
    const from = r.start.toISOString().slice(0, 10);
    const to   = r.end.toISOString().slice(0, 10);
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await boardsApi.getRoadmapTasks(boardId, from, to);
        if (active) {
          setTasks(data);
          const ids = new Set(data.filter(t => (t._count?.children ?? 0) > 0).map(t => t.id));
          setExpanded(ids);
          setLoading(false);
        }
      } catch {
        if (active) {
          message.error('Не удалось загрузить дорожную карту');
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => { active = false; };
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

  useEffect(() => {
    const id = setTimeout(scrollToToday, 50);
    return () => clearTimeout(id);
  }, [scrollToToday]);

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
    const color = safeColor(task.status?.color);
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
    const t = getToday();
    const quarters: { label: string; x: number; w: number }[] = [];
    const months:   { label: string; x: number; w: number; isCurrent: boolean }[] = [];
    const QS = [
      { label: 'Q1', start: new Date(t.getFullYear(), 0, 1), end: new Date(t.getFullYear(), 3, 1) },
      { label: 'Q2', start: new Date(t.getFullYear(), 3, 1), end: new Date(t.getFullYear(), 6, 1) },
      { label: 'Q3', start: new Date(t.getFullYear(), 6, 1), end: new Date(t.getFullYear(), 9, 1) },
      { label: 'Q4', start: new Date(t.getFullYear(), 9, 1), end: new Date(t.getFullYear() + 1, 0, 1) },
    ].filter(q => q.end > range.start && q.start < range.end);
    for (const q of QS) {
      const qs = q.start < range.start ? range.start : q.start;
      const qe = q.end   > range.end   ? range.end   : q.end;
      quarters.push({ label: `${q.label} ${t.getFullYear()}`, x: xOf(qs), w: xOf(qe) - xOf(qs) });
    }
    let cur = new Date(range.start);
    while (cur < range.end) {
      const next  = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const me    = next < range.end ? next : range.end;
      const isCM  = cur.getMonth() === t.getMonth() && cur.getFullYear() === t.getFullYear();
      const lbl   = cur.toLocaleString('ru', { month: 'short' });
      months.push({ label: lbl[0].toUpperCase() + lbl.slice(1), x: xOf(cur), w: xOf(me) - xOf(cur), isCurrent: isCM });
      cur = next;
    }
    return { row1: quarters, row2: months, type: 'quarter' as const };
  }

  const hdr = renderHeader();
  const rows = visibleRows();
  const totalH = rows.reduce((acc, t) => acc + (t.parentId ? CROW_H : ROW_H), 0);

  // Computed once per render — avoids repeated new Date() across all rows
  const today  = getToday();
  const todayX = xOf(today);

  // ── Status color for tooltip ───────────────────────────────────────────────
  function statusLabel(task: Task) {
    const s = statuses.find(st => st.id === task.statusId);
    return s?.name ?? task.status?.name ?? '–';
  }

  // ── Overdue ────────────────────────────────────────────────────────────────
  function isOverdue(task: Task) {
    const due = parseDate(task.dueDate);
    return due && due < today && task.status?.category !== 'DONE';
  }

  // ── Milestone collision offsets ────────────────────────────────────────────
  // Pre-compute vertical offsets so overlapping diamonds don't stack on top of each other.
  const milestoneYOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    // Parse once, skip if either date is invalid
    const pts = rows.flatMap(t => {
      const due = parseDate(t.dueDate);
      return (!parseDate(t.startDate) && due) ? [{ id: t.id, mx: xOf(due) }] : [];
    }).sort((a, b) => a.mx - b.mx);

    // Cluster: group pts where each item is within 22px of the previous one, distribute ±7/0 offsets
    let i = 0;
    while (i < pts.length) {
      let j = i + 1;
      while (j < pts.length && pts[j].mx - pts[j - 1].mx < 22) j++;
      const cluster = pts.slice(i, j);
      // distribute evenly: -7, 0, +7 for 3; -7, +7 for 2; 0 for 1
      const step = cluster.length > 1 ? 14 / (cluster.length - 1) : 0;
      cluster.forEach((p, k) => offsets.set(p.id, Math.round(-7 + k * step)));
      i = j;
    }
    return offsets;
  }, [rows, dayPx]);

  // Cumulative Y offsets — avoids O(n²) reduce inside rows.map
  const rowYOffsets = useMemo(() => {
    const offsets: number[] = [];
    let y = 0;
    for (const t of rows) {
      offsets.push(y);
      y += t.parentId ? CROW_H : ROW_H;
    }
    return offsets;
  }, [rows]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-roadmap-root="" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: c.bg, fontFamily: '"Inter",system-ui,sans-serif' }}>

      {/* aria-live region: announces zoom changes to screen readers */}
      <span aria-live="polite" aria-atomic="true" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
        {zoom === 'week' ? 'Масштаб: неделя' : zoom === 'month' ? 'Масштаб: месяц' : 'Масштаб: квартал'}
      </span>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px',
        background: c.toolbarBg, borderBottom: `1px solid ${c.border}`, flexShrink: 0,
      }}>
        {/* Zoom */}
        <span style={{ fontSize: 12, color: c.muted, marginRight: 2 }}>Масштаб</span>
        <div role="group" aria-label="Масштаб временной шкалы" style={{ display: 'flex', gap: 2, background: c.chip, borderRadius: 8, padding: 2 }}>
          {(['week', 'month', 'quarter'] as Zoom[]).map(z => {
            const kbd = { week: 'W', month: 'M', quarter: 'Q' }[z];
            const label = { week: 'Неделя', month: 'Месяц', quarter: 'Квартал' }[z];
            return (
              <button
                key={z}
                onClick={() => setZoom(z)}
                title={`${label} (${kbd})`}
                aria-pressed={zoom === z}
                style={{
                  padding: '4px 11px', border: 'none', borderRadius: 6, cursor: 'pointer',
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
                  background: zoom === z ? c.accent : 'transparent',
                  color: zoom === z ? '#fff' : c.chipText,
                  transition: 'all .12s',
                }}
              >
                {label}
              </button>
            );
          })}
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
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
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
          aria-pressed={hideOpen}
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
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2 2l10 10M4.5 4.8A5.4 5.4 0 0 0 1.5 7c1 2 3 3.5 5.5 3.5a5.5 5.5 0 0 0 2.5-.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7.5 3.6A5.4 5.4 0 0 1 12.5 7a5.5 5.5 0 0 1-.8 1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="7" cy="7" r="1.5" fill="currentColor"/>
            </svg>
          )}
        </button>

        <div style={{ flex: 1 }} />

        <span aria-live="polite" aria-atomic="true" style={{ fontSize: 12, color: c.muted }}>{rows.length} задач</span>

        {/* Legend button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowLegend(v => !v)}
            title="Легенда дорожной карты"
            aria-expanded={showLegend}
            aria-haspopup="dialog"
            style={{
              width: 26, height: 26, borderRadius: '50%',
              border: `1px solid ${c.border}`, background: showLegend ? c.accent : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: showLegend ? '#fff' : c.muted, fontFamily: '"Inter",system-ui,sans-serif',
              fontSize: 12, fontWeight: 600, transition: 'all .12s',
            }}
          >?</button>
          {showLegend && (
            <>
              {/* Backdrop to close on click-outside */}
              <div
                aria-hidden="true"
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowLegend(false)}
              />
              <div
                ref={legendPopoverRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="rm-legend-heading"
                tabIndex={-1}
                style={{
                  position: 'absolute', top: 32, right: 0, width: 272, zIndex: 100,
                  background: isDark ? '#161C30' : '#FFFFFF',
                  border: `1px solid ${c.border}`, borderRadius: 10,
                  padding: '14px 16px', boxShadow: '0 8px 32px rgba(0,0,0,.25)',
                  fontFamily: '"Inter",system-ui,sans-serif', outline: 'none',
                }}
              >
                <div id="rm-legend-heading" style={{ fontSize: 12, fontWeight: 600, color: isDark ? '#E2E8F8' : '#1A1A2E', marginBottom: 12 }}>
                  Легенда дорожной карты
                </div>
                {[
                  { visual: <div style={{ width: 56, height: 14, borderRadius: 3, background: 'rgba(79,110,247,.6)', border: '1px solid rgba(79,110,247,.85)' }} />, label: 'Задача с датой начала и дедлайном' },
                  { visual: <div style={{ width: 56, display: 'flex', justifyContent: 'center' }}><div style={{ width: 12, height: 12, transform: 'rotate(45deg)', background: 'rgba(79,110,247,.6)', border: '2px solid rgba(79,110,247,.85)' }} /></div>, label: 'Задача только с дедлайном (milestone)' },
                  { visual: <div style={{ width: 56, height: 14, borderRadius: 3, display: 'flex', overflow: 'hidden', gap: 1 }}><div style={{ flex: 2, background: 'rgba(245,158,11,.7)' }} /><div style={{ flex: 3, background: 'rgba(79,110,247,.7)' }} /><div style={{ flex: 1, background: 'rgba(79,110,247,.2)', borderLeft: '1.5px dashed rgba(79,110,247,.5)' }} /></div>, label: 'История статусов (цветные сегменты)' },
                  { visual: <div style={{ width: 56, height: 14, borderRadius: 3, background: 'rgba(239,68,68,.2)', border: '1.5px dashed rgba(239,68,68,.65)' }} />, label: 'Просрочка (дни после дедлайна)' },
                  { visual: <div style={{ width: 56, display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 4, height: 14, borderRadius: '0 2px 2px 0', background: '#EF4444', opacity: .85, flexShrink: 0 }} /><span style={{ fontSize: 9, color: '#F87171', lineHeight: '1.2' }}>до диапазона</span></div>, label: 'Дедлайн за пределами экрана' },
                ].map((row) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <div style={{ flexShrink: 0 }}>{row.visual}</div>
                    <span style={{ fontSize: 11.5, color: isDark ? '#8B95B0' : '#6B7194' }}>{row.label}</span>
                  </div>
                ))}
                <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 9, marginTop: 2 }}>
                  <div style={{ fontSize: 10.5, color: isDark ? '#484F58' : '#9B96B8' }}>
                    Цвет = статус задачи · Клавиши: <b>W</b> нед · <b>M</b> мес · <b>Q</b> кварт
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
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
          <div ref={leftRef} aria-busy={loading} style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div role="status" aria-label="Загрузка дорожной карты…">
                {[70, 45, 85, 55, 65].map((w, i) => (
                  <div key={i} style={{ height: ROW_H, display: 'flex', alignItems: 'center', padding: '0 12px', borderBottom: `1px solid ${c.border}`, gap: 8 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 4, background: c.chip, flexShrink: 0, animation: 'rm-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                    <div style={{ flex: 1, height: 10, borderRadius: 5, background: c.chip, maxWidth: `${w}%`, animation: 'rm-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                    <div style={{ width: 40, height: 10, borderRadius: 5, background: c.chip, animation: 'rm-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                  </div>
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p role="status" aria-live="polite" style={{ padding: 24, textAlign: 'center', color: c.dimmed, fontSize: 13, margin: 0 }}>
                Нет задач с датами в этом периоде
              </p>
            ) : rows.map((task, idx) => {
              const isChild  = !!task.parentId;
              const rh       = isChild ? CROW_H : ROW_H;
              const hasKids  = (task._count?.children ?? (task.children?.length ?? 0)) > 0;
              const isExp    = expanded.has(task.id);
              const due      = parseDate(task.dueDate);
              const overdue  = isOverdue(task);
              const dueColor = overdue ? '#EF4444' : due && diffDays(due, today) < 7 && due >= today ? '#F59E0B' : task.status?.category === 'DONE' ? '#10B981' : c.dimmed;
              const toggleExpand = () => {
                if (!hasKids) return;
                setExpanded(prev => {
                  const n = new Set(prev);
                  if (n.has(task.id)) n.delete(task.id); else n.add(task.id);
                  return n;
                });
              };

              return (
                <div
                  key={task.id}
                  role={hasKids ? 'button' : undefined}
                  tabIndex={hasKids ? 0 : undefined}
                  aria-expanded={hasKids ? isExp : undefined}
                  aria-label={hasKids ? `${task.title} — ${isExp ? 'свернуть' : 'развернуть'} подзадачи` : undefined}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(); } }}
                  style={{
                    display: 'flex', alignItems: 'center', height: rh,
                    borderBottom: `1px solid ${c.border}`,
                    background: idx % 2 === 0 ? 'transparent' : c.rowEven,
                    paddingRight: 8, overflow: 'hidden', cursor: hasKids ? 'pointer' : 'default',
                    transition: 'background .1s', outline: 'none',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = `rgba(79,110,247,.05)`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = idx % 2 === 0 ? 'transparent' : c.rowEven; }}
                  onFocus={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = `inset 0 0 0 2px ${c.accent}`; }}
                  onBlur={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
                  onClick={toggleExpand}
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
                      {/* Expand button — aria-hidden since outer row is the keyboard target */}
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpand(); }}
                        tabIndex={-1}
                        aria-hidden="true"
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
        <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          {/* Scroll affordance: fade on right edge signals more content */}
          <div style={{
            position: 'absolute', top: 0, right: 0, bottom: 0, width: 32,
            background: `linear-gradient(to right, transparent, ${c.bg}CC)`,
            pointerEvents: 'none', zIndex: 10,
          }} />
          {/* Scroll affordance: fade on left edge */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 32,
            background: `linear-gradient(to left, transparent, ${c.bg}CC)`,
            pointerEvents: 'none', zIndex: 10,
          }} />
        <div
          ref={rightRef}
          style={{ flex: 1, overflow: 'auto', position: 'relative', minWidth: 0, height: '100%' }}
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
                <div role="presentation" style={{
                  position: 'absolute', top: 0, bottom: 0, left: todayX, width: 2,
                  background: c.today, zIndex: 15, pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: 0, left: -3,
                    width: 8, height: 8, borderRadius: '50%', background: c.today,
                  }} />
                </div>
              )}

              {/* Bars-area loading skeleton */}
              {loading && [70, 40, 85, 55, 65].map((w, i) => (
                <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: i * ROW_H, height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: `${8 + i * 7}%` }}>
                  <div style={{ height: 14, borderRadius: 5, background: c.chip, width: `${w}%`, maxWidth: 320, animation: 'rm-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                </div>
              ))}

              {/* Task bars */}
              {!loading && rows.map((task, idx) => {
                const isChild = !!task.parentId;
                const rh      = isChild ? CROW_H : ROW_H;
                const yOffset = rowYOffsets[idx];
                const rawStart = parseDate(task.startDate);
                const rawEnd   = parseDate(task.dueDate);
                const isMilestone = !rawStart && !!rawEnd;
                const start = rawStart ?? rawEnd;
                const end   = rawEnd   ?? rawStart;
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
                        position: 'absolute', left: 10, top: '50%',
                        transform: 'translateY(-50%)', fontSize: 11, color: c.dimmed, fontStyle: 'italic',
                      }}>нет дат</span>
                    </div>
                  );
                }

                // Milestone: only dueDate set, no startDate → render diamond marker
                if (isMilestone) {
                  const mx = xOf(end!);
                  const mSize  = isChild ? 14 : 16;
                  const hitbox = mSize + 16;
                  const overdue = isOverdue(task);
                  const clampedMx = Math.max(mSize / 2, Math.min(TL_W - mSize / 2, mx));
                  const inView = mx >= -hitbox && mx <= TL_W + hitbox;
                  // collision offset — pre-computed above
                  const yShift = milestoneYOffsets.get(task.id) ?? 0;
                  const mileInteract = {
                    onMouseEnter: (e: React.MouseEvent) => {
                      const inner = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>('[data-mile-inner]');
                      if (inner) inner.style.transform = 'rotate(45deg) scale(1.25)';
                      setTip({ task, x: e.clientX, y: e.clientY });
                    },
                    onMouseMove: (e: React.MouseEvent) => {
                      const { clientX, clientY } = e;
                      if (rafRef.current) return;
                      rafRef.current = requestAnimationFrame(() => {
                        rafRef.current = null;
                        setTip(prev => prev ? { ...prev, x: clientX, y: clientY } : null);
                      });
                    },
                    onMouseLeave: (e: React.MouseEvent) => {
                      const inner = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>('[data-mile-inner]');
                      if (inner) inner.style.transform = 'rotate(45deg) scale(1)';
                      setTip(null);
                    },
                    onTouchStart: (e: React.TouchEvent) => handleTouch(task, e),
                  };
                  return (
                    <div key={task.id} style={rowStyle}>
                      {inView && (
                        // Outer div: positioning only. Inner div: visual rotation + scale.
                        // Separating transforms prevents scale mutations from corrupting translateY(-50%).
                        <div
                          tabIndex={0}
                          role="button"
                          aria-label={`${task.issueKey} · ${task.title.slice(0, 200)} · ${statusLabel(task)} · дедлайн ${fmtShort(end!)}`}
                          title={`${task.issueKey} · ${task.title.slice(0, 200)} · ${statusLabel(task)} · дедлайн ${fmtShort(end!)}`}
                          onFocus={e => {
                            const inner = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>('[data-mile-inner]');
                            if (inner) inner.style.transform = 'rotate(45deg) scale(1.25)';
                            setTip({ task, x: e.currentTarget.getBoundingClientRect().left, y: e.currentTarget.getBoundingClientRect().top });
                          }}
                          onBlur={e => {
                            const inner = (e.currentTarget as HTMLDivElement).querySelector<HTMLDivElement>('[data-mile-inner]');
                            if (inner) inner.style.transform = 'rotate(45deg) scale(1)';
                            setTip(null);
                          }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); }}
                          style={{
                            position: 'absolute',
                            top: `calc(50% + ${yShift}px)`, left: clampedMx - hitbox / 2,
                            transform: 'translateY(-50%)',
                            width: hitbox, height: hitbox,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            zIndex: 2, cursor: 'default', outline: 'none',
                          }}
                          {...mileInteract}
                        >
                          <div
                            data-mile-inner=""
                            style={{
                              width: mSize, height: mSize,
                              transform: 'rotate(45deg)',
                              background: overdue ? 'rgba(239,68,68,.8)' : bg,
                              border: `2px solid ${overdue ? '#EF4444' : border}`,
                              transition: 'transform .12s',
                              animation: overdue ? 'ov-pulse 2s ease-in-out infinite' : 'none',
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                }

                const bx = xOf(start);
                const bw = Math.max(6, wOf(start, end));
                const cx = Math.max(0, bx);
                const cw = Math.min(TL_W - cx, bw - (cx - bx));

                const overdue = isOverdue(task);
                const ovLeft  = Math.min(TL_W, Math.max(0, xOf(end)));
                const ovRight = Math.min(TL_W, xOf(today));
                const ovW     = overdue ? ovRight - ovLeft : 0;
                // Overdue badge on left edge for tasks whose end is before range.start
                const overdueOffscreen = overdue && xOf(end) < 0;
                const overdueDays = overdue ? diffDays(end, today) : 0;

                // Сегментный бар когда есть история статусов
                const history = task.statusHistory;
                const isSegmented = history && history.length > 0;

                const barMouseProps = {
                  onMouseEnter: (e: React.MouseEvent) => {
                    (e.currentTarget as HTMLDivElement).style.filter = 'brightness(1.1)';
                    setTip({ task, x: e.clientX, y: e.clientY });
                  },
                  onMouseMove: (e: React.MouseEvent) => {
                    const { clientX, clientY } = e;
                    if (rafRef.current) return;
                    rafRef.current = requestAnimationFrame(() => {
                      rafRef.current = null;
                      setTip(prev => prev ? { ...prev, x: clientX, y: clientY } : null);
                    });
                  },
                  onMouseLeave: (e: React.MouseEvent) => {
                    (e.currentTarget as HTMLDivElement).style.filter = '';
                    setTip(null);
                  },
                  onTouchStart: (e: React.TouchEvent) => handleTouch(task, e),
                };

                return (
                  <div key={task.id} style={rowStyle}>
                    {/* Overdue badge on left edge for tasks whose deadline is before the visible range */}
                    {overdueOffscreen && (
                      <div
                        title={`Просрочено: дедлайн ${fmtShort(end!)}`}
                        onMouseEnter={e => setTip({ task, x: e.clientX, y: e.clientY })}
                        onMouseLeave={() => setTip(null)}
                        role="img"
                        aria-label={`Просрочено: дедлайн ${fmtShort(end!)}`}
                        onTouchStart={e => handleTouch(task, e)}
                        style={{
                          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                          width: 4, height: barH, borderRadius: '0 2px 2px 0',
                          background: '#EF4444', opacity: .85, zIndex: 3, cursor: 'default',
                        }}
                      />
                    )}
                    {cw > 0 && (
                      <div
                        title={`${task.issueKey} · ${task.title.slice(0, 200)} · ${statusLabel(task)}`}
                        style={{
                          position: 'absolute',
                          top: '50%', transform: 'translateY(-50%)',
                          left: cx, width: cw, height: barH,
                          borderRadius: barR, overflow: 'hidden',
                          background: isSegmented ? 'transparent' : bg,
                          border: isSegmented ? `1px solid ${c.border}` : `1px solid ${border}`,
                          display: 'flex', alignItems: 'center',
                          cursor: 'default', whiteSpace: 'nowrap',
                          transition: 'filter .12s', zIndex: 2,
                        }}
                        {...barMouseProps}
                      >
                        {isSegmented ? (
                          <>
                            {/* Цветные сегменты по истории статусов */}
                            {history!.map((seg) => {
                              const segStart = new Date(seg.startedAt);
                              const segEnd   = seg.endedAt ? new Date(seg.endedAt) : getToday();
                              const clampS   = segStart < start! ? start! : segStart;
                              const clampE   = segEnd   > end!   ? end!   : segEnd;
                              const segL     = Math.max(0, xOf(clampS) - cx);
                              const segW     = Math.max(2, xOf(clampE) - xOf(clampS));
                              const st       = statusMap.get(seg.statusId);
                              const color    = safeColor(st?.color, '#8B95B0');
                              const alpha    = st?.category === 'DONE'
                                ? 'A0' : st?.category === 'IN_PROGRESS' ? 'B0' : '70';
                              return (
                                <div key={seg.id} style={{
                                  position: 'absolute', top: 0, bottom: 0,
                                  left: segL, width: segW,
                                  background: `${color}${alpha}`,
                                }} />
                              );
                            })}
                            {/* Призрачный хвост: от сегодня до конца если задача ещё идёт */}
                            {(() => {
                              const last = history![history!.length - 1];
                              if (last.endedAt) return null; // задача уже завершена
                              if (today >= end!) return null; // просрочена — tail не нужен
                              const tailL = Math.max(0, xOf(today) - cx);
                              const tailW = Math.max(2, xOf(end!) - xOf(today));
                              const st    = statusMap.get(last.statusId);
                              return (
                                <div style={{
                                  position: 'absolute', top: 0, bottom: 0,
                                  left: tailL, width: tailW,
                                  background: `${safeColor(st?.color, '#8B95B0')}28`,
                                  borderLeft: `1px dashed ${safeColor(st?.color, '#8B95B0')}55`,
                                }} />
                              );
                            })()}
                            {/* Текст поверх сегментов */}
                            <div style={{
                              position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center',
                              height: '100%', width: '100%', padding: '0 8px 0 10px',
                              color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.4)',
                              fontSize: isChild ? 11 : 12, fontWeight: 500, pointerEvents: 'none',
                            }}>
                              {cw > 38 && <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 10, fontWeight: 600, marginRight: 5, flexShrink: 0 }}>{task.issueKey}</span>}
                              {cw > 60 && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</span>}
                              {cw > 90 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.85)', marginLeft: 6, flexShrink: 0, fontWeight: 600 }}>{fmtShort(end!)}</span>}
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Оригинальный сплошной бар */}
                            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: isChild ? 3 : 4, background: 'rgba(0,0,0,.25)' }} />
                            {cw > 38 && <span style={{ color: 'rgba(255,255,255,.7)', fontSize: 10, fontWeight: 600, marginRight: 5, flexShrink: 0, position: 'relative', zIndex: 1 }}>{task.issueKey}</span>}
                            {cw > 60 && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.35)', fontSize: isChild ? 11 : 12, fontWeight: 500, position: 'relative', zIndex: 1 }}>{task.title}</span>}
                            {cw > 90 && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.82)', marginLeft: 6, flexShrink: 0, fontWeight: 600, position: 'relative', zIndex: 1 }}>{fmtShort(end!)}</span>}
                          </>
                        )}
                      </div>
                    )}

                    {/* Overdue tail */}
                    {ovW > 4 && (
                      <div
                        role="img"
                        aria-label={`Просрочено на ${overdueDays} дн.`}
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
        </div>{/* end scroll wrapper */}
      </div>

      <style>{`
        @keyframes ov-pulse{0%,100%{opacity:1}50%{opacity:.55}}
        @keyframes rm-pulse{0%,100%{opacity:.4}50%{opacity:.15}}
        @media(prefers-reduced-motion:reduce){
          [data-roadmap-root] *,[data-roadmap-root] *::before,[data-roadmap-root] *::after{
            animation:none!important;transition:none!important
          }
        }
        [role="button"]:focus-visible{outline:2px solid #4F6EF7;outline-offset:-1px}
        button:focus-visible{outline:2px solid #4F6EF7;outline-offset:2px}
      `}</style>

      {tip && <BarTooltip tip={tip} isDark={isDark} statuses={statuses} today={today} />}
    </div>
  );
}
