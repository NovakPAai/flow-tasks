import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus, WorkspaceMember, Label, TaskLabel, Comment, Checklist } from '../types';
import * as tasksApi from '../api/tasks';
import CommentThread from './CommentThread';
import ChecklistBlock from './ChecklistBlock';
import LabelPicker from './LabelPicker';
import TaskHistoryTimeline from './TaskHistoryTimeline';
import SubtaskTree from './SubtaskTree';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;

const DARK: C = {
  bg: '#0A0D1A', border: '#1C2236', text: '#E2E8F8', muted: '#8B949E', label: '#484F58',
  inputBg: '#0F1320', inputBorder: '#1C2236', sectionBorder: '#1C2236',
  dropdownBg: '#0F1320', rowHover: '#131729', tabActive: '#4F6EF7', tabBorder: '#1C2236',
  backdrop: 'rgba(0,0,0,0.45)',
};
const LIGHT: C = {
  bg: '#FDFCFF', border: '#E8E5F0', text: '#1A1A2E', muted: '#9B96B8', label: '#B8B3D0',
  inputBg: '#F5F3FF', inputBorder: '#E8E5F0', sectionBorder: '#E8E5F0',
  dropdownBg: '#FDFCFF', rowHover: '#F0EEF8', tabActive: '#4F6EF7', tabBorder: '#E8E5F0',
  backdrop: 'rgba(0,0,0,0.2)',
};

const PRIO: Record<string, { bg: string; text: string; label: string }> = {
  HIGH:   { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444', label: 'HIGH' },
  MEDIUM: { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B', label: 'MED' },
  LOW:    { bg: 'rgba(107,114,128,0.12)', text: '#6B7280', label: 'LOW' },
};

const PRIO_OPTS = [
  { value: 'HIGH', label: 'HIGH' },
  { value: 'MEDIUM', label: 'MED' },
  { value: 'LOW', label: 'LOW' },
];

const AVATAR_COLORS = ['#4F6EF7', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899', '#EF4444', '#0EA5E9'];
function avatarColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }
function avatarInitials(name: string) { return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: '#fff', fontFamily: '"Inter",system-ui,sans-serif' }}>
        {avatarInitials(name)}
      </span>
    </div>
  );
}

function Dropdown({
  open, onClose, children, style,
}: { open: boolean; onClose: () => void; children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} style={{
      position: 'absolute', zIndex: 500, minWidth: 160,
      borderRadius: 8, overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  taskId: string | null;
  statuses: WorkflowStatus[];
  members?: WorkspaceMember[];
  workspaceId?: string;
  boardId?: string;
  workspaceLabels?: Label[];
  onWorkspaceLabelCreated?: (label: Label) => void;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}

type Tab = 'details' | 'comments' | 'history';

// ── Component ──────────────────────────────────────────────────────────────────
export default function TaskDrawer({
  taskId, statuses, members = [], workspaceId, boardId, workspaceLabels = [],
  onWorkspaceLabelCreated, onClose, onUpdated, onDeleted,
}: Props) {
  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('details');

  // Edit states
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');
  const [descVal, setDescVal] = useState('');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Dropdown open states
  const [statusOpen, setStatusOpen] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);

  // Load task
  useEffect(() => {
    if (!taskId) { setTask(null); return; }
    setLoading(true);
    setActiveTab('details');
    setEditTitle(false);
    tasksApi.getTask(taskId)
      .then((t) => { setTask(t); setTitleVal(t.title); setDescVal(t.description ?? ''); })
      .catch(() => message.error('Не удалось загрузить задачу'))
      .finally(() => setLoading(false));
  }, [taskId]);

  // ESC to close
  useEffect(() => {
    if (!taskId) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [taskId, onClose]);

  // Focus title input when editing
  useEffect(() => {
    if (editTitle) titleInputRef.current?.focus();
  }, [editTitle]);

  if (!taskId) return null;

  const save = async (patch: Parameters<typeof tasksApi.updateTask>[1]) => {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await tasksApi.updateTask(task.id, patch);
      setTask((prev) => prev ? { ...prev, ...updated } : updated);
      onUpdated(updated);
    } catch (err) {
      const details = (err as { response?: { data?: { details?: { message: string }[] } } })?.response?.data?.details;
      message.error(details?.map((d) => d.message).join('; ') ?? 'Ошибка сохранения');
    }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!task) return;
    if (!confirm('Удалить задачу?')) return;
    try {
      await tasksApi.deleteTask(task.id);
      onDeleted(task.id);
      onClose();
    } catch { message.error('Ошибка удаления'); }
  };

  const handleLabelsChanged = (labels: TaskLabel[]) =>
    setTask((prev) => prev ? { ...prev, labels } : prev);
  const handleCommentsChanged = (comments: Comment[]) =>
    setTask((prev) => prev ? { ...prev, comments } : prev);
  const handleChecklistsChanged = (checklists: Checklist[]) =>
    setTask((prev) => prev ? { ...prev, checklists } : prev);

  const status = task ? statuses.find((s) => s.id === task.statusId) : null;
  const prio = task?.priority ? PRIO[task.priority] : null;
  const assignee = task?.assignee ?? members.find((m) => m.userId === task?.assigneeId)?.user;
  const dueStr = task?.dueDate ? String(task.dueDate).slice(0, 10) : '';
  const isOverdue = dueStr && new Date(dueStr) < new Date();

  const selectStyle: React.CSSProperties = {
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 6, padding: '5px 8px', fontSize: 12, color: c.text,
    fontFamily: '"Inter",system-ui,sans-serif', outline: 'none',
    cursor: 'pointer', width: '100%',
  };

  const refreshTask = () => {
    if (!task) return;
    tasksApi.getTask(task.id).then((t) => {
      setTask(t); setTitleVal(t.title); setDescVal(t.description ?? '');
      onUpdated(t);
    }).catch(() => {});
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Детали' },
    { key: 'comments', label: 'Комментарии' },
    { key: 'history', label: 'История' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', top: 56, left: 0, right: 0, bottom: 0,
          background: c.backdrop, zIndex: 150,
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 56, right: 0, bottom: 0, width: 440,
        background: c.bg, borderLeft: `1px solid ${c.border}`,
        display: 'flex', flexDirection: 'column', zIndex: 151,
        fontFamily: '"Inter",system-ui,sans-serif',
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 20px', height: 48, borderBottom: `1px solid ${c.border}`, flexShrink: 0,
        }}>
          {/* Issue key */}
          <span style={{ fontSize: 12, color: c.muted, letterSpacing: '0.04em', flexShrink: 0 }}>
            {task?.issueKey}
          </span>

          {/* Status dropdown */}
          {status && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setStatusOpen((v) => !v); setPrioOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, fontWeight: 500,
                  color: status.color, background: `${status.color}18`,
                  border: `1px solid ${status.color}44`, borderRadius: 5, padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, flexShrink: 0 }} />
                {status.name}
              </button>
              <Dropdown
                open={statusOpen} onClose={() => setStatusOpen(false)}
                style={{
                  top: 'calc(100% + 4px)', left: 0,
                  background: c.dropdownBg, border: `1px solid ${c.border}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
              >
                {statuses.map((s) => (
                  <button
                    key={s.id}
                    onClick={(e) => { e.stopPropagation(); save({ statusId: s.id } as never); setStatusOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      width: '100%', padding: '8px 12px', fontSize: 12,
                      color: c.text, background: s.id === task?.statusId ? c.rowHover : 'transparent',
                      border: 'none', cursor: 'pointer', textAlign: 'left',
                      fontFamily: '"Inter",system-ui,sans-serif',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = c.rowHover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = s.id === task?.statusId ? c.rowHover : 'transparent'; }}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    {s.name}
                  </button>
                ))}
              </Dropdown>
            </div>
          )}

          {/* Priority dropdown */}
          {prio && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setPrioOpen((v) => !v); setStatusOpen(false); }}
                style={{
                  fontFamily: '"Inter",system-ui,sans-serif', fontSize: 10, fontWeight: 600,
                  color: prio.text, background: prio.bg, border: 'none',
                  borderRadius: 4, padding: '3px 7px', cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >
                {prio.label}
              </button>
              <Dropdown
                open={prioOpen} onClose={() => setPrioOpen(false)}
                style={{
                  top: 'calc(100% + 4px)', left: 0,
                  background: c.dropdownBg, border: `1px solid ${c.border}`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); save({ priority: undefined }); setPrioOpen(false); }}
                  style={{
                    width: '100%', padding: '8px 12px', fontSize: 12,
                    color: c.muted, background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left', fontFamily: '"Inter",system-ui,sans-serif',
                  }}
                >
                  — Без приоритета
                </button>
                {PRIO_OPTS.map((p) => {
                  const pr = PRIO[p.value];
                  return (
                    <button
                      key={p.value}
                      onClick={(e) => { e.stopPropagation(); save({ priority: p.value as 'HIGH' | 'MEDIUM' | 'LOW' }); setPrioOpen(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '8px 12px', fontSize: 12,
                        color: pr.text, background: task?.priority === p.value ? c.rowHover : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontFamily: '"Inter",system-ui,sans-serif',
                      }}
                    >
                      <span style={{ background: pr.bg, borderRadius: 3, padding: '1px 5px', fontSize: 10, fontWeight: 600 }}>
                        {p.label}
                      </span>
                    </button>
                  );
                })}
              </Dropdown>
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Delete */}
          {task && (
            <button
              onClick={handleDelete}
              title="Удалить задачу"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                color: c.muted, borderRadius: 4, display: 'flex', alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 3.5h10M5.5 3.5V2.5h3V3.5M5.5 6v4M8.5 6v4M3 3.5l.7 7.5h6.6l.7-7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: c.muted, borderRadius: 4, display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Title ── */}
        <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
          {editTitle ? (
            <input
              ref={titleInputRef}
              value={titleVal}
              onChange={(e) => setTitleVal(e.target.value)}
              onBlur={() => { setEditTitle(false); if (titleVal.trim() && titleVal !== task?.title) save({ title: titleVal.trim() }); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } if (e.key === 'Escape') { setEditTitle(false); setTitleVal(task?.title ?? ''); } }}
              style={{
                width: '100%', fontSize: 20, fontWeight: 700, color: c.text,
                fontFamily: '"Space Grotesk",system-ui,sans-serif',
                background: c.inputBg, border: `1px solid ${c.tabActive}`,
                borderRadius: 6, padding: '6px 10px', outline: 'none',
              }}
            />
          ) : (
            <h2
              onClick={() => setEditTitle(true)}
              style={{
                margin: 0, fontSize: 20, fontWeight: 700, color: c.text, cursor: 'text',
                fontFamily: '"Space Grotesk",system-ui,sans-serif', lineHeight: '28px',
              }}
            >
              {task?.title ?? ''}
            </h2>
          )}
        </div>

        {/* ── Tabs ── */}
        <div style={{
          display: 'flex', padding: '12px 20px 0', gap: 0,
          borderBottom: `1px solid ${c.tabBorder}`, flexShrink: 0, marginTop: 8,
        }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 14px', fontSize: 13,
                  fontFamily: '"Inter",system-ui,sans-serif',
                  color: active ? c.tabActive : c.muted,
                  fontWeight: active ? 500 : 400,
                  borderBottom: active ? `2px solid ${c.tabActive}` : '2px solid transparent',
                  marginBottom: -1,
                  transition: 'color 0.12s',
                }}
              >
                {tab.label}
                {tab.key === 'comments' && (task?.comments?.length ?? 0) > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 11, color: c.muted }}>
                    {task!.comments!.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px 24px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                border: `2px solid ${c.border}`, borderTopColor: '#4F6EF7',
                animation: 'spin 0.7s linear infinite',
              }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : !task ? null : (

            // ── Details tab ───────────────────────────────────────────────────
            activeTab === 'details' ? (
              <div>
                {/* Properties grid */}
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: 2,
                  marginBottom: 20,
                  borderBottom: `1px solid ${c.sectionBorder}`, paddingBottom: 16,
                }}>
                  {/* Assignee */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <span style={{ width: 80, fontSize: 12, color: c.label, flexShrink: 0 }}>Исполнитель</span>
                    <div style={{ flex: 1 }}>
                      {members.length > 0 ? (
                        <select
                          value={task.assigneeId ?? ''}
                          onChange={(e) => save({ assigneeId: e.target.value || undefined })}
                          disabled={saving}
                          style={{ ...selectStyle }}
                        >
                          <option value="">Не назначен</option>
                          {members.map((m) => (
                            <option key={m.userId} value={m.userId}>{m.user.name}</option>
                          ))}
                        </select>
                      ) : assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={assignee.name} size={20} />
                          <span style={{ fontSize: 13, color: c.text }}>{assignee.name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: c.label }}>Не назначен</span>
                      )}
                    </div>
                  </div>

                  {/* Due date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                    <span style={{ width: 80, fontSize: 12, color: c.label, flexShrink: 0 }}>Срок</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {dueStr && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: isOverdue ? '#EF4444' : c.muted }}>
                          <rect x="0.5" y="1.5" width="11" height="10" rx="1.5" stroke="currentColor" strokeWidth="1"/>
                          <path d="M3 0.5v2M9 0.5v2M0.5 5h11" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                        </svg>
                      )}
                      <input
                        type="date"
                        value={dueStr}
                        onChange={(e) => save({ dueDate: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined })}
                        disabled={saving}
                        style={{
                          ...selectStyle, width: 'auto',
                          color: isOverdue ? '#EF4444' : c.text,
                        }}
                      />
                    </div>
                  </div>

                  {/* Creator */}
                  {task.creator && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
                      <span style={{ width: 80, fontSize: 12, color: c.label, flexShrink: 0 }}>Создал</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={task.creator.name} size={20} />
                        <span style={{ fontSize: 13, color: c.text }}>{task.creator.name}</span>
                      </div>
                    </div>
                  )}

                  {/* Labels */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
                    <span style={{ width: 80, fontSize: 12, color: c.label, flexShrink: 0, paddingTop: 2 }}>Метки</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                      {(task.labels ?? []).map((tl) => (
                        <span
                          key={tl.labelId}
                          style={{
                            fontSize: 11, fontWeight: 500, color: tl.label.color,
                            background: `${tl.label.color}18`,
                            border: `1px solid ${tl.label.color}44`,
                            borderRadius: 5, padding: '2px 7px',
                          }}
                        >
                          {tl.label.name}
                        </span>
                      ))}
                      {workspaceId && (
                        <LabelPicker
                          taskId={task.id}
                          workspaceId={workspaceId}
                          workspaceLabels={workspaceLabels}
                          taskLabels={task.labels ?? []}
                          onLabelsChanged={handleLabelsChanged}
                          onWorkspaceLabelCreated={onWorkspaceLabelCreated ?? (() => {})}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: c.label,
                    letterSpacing: '0.06em', marginBottom: 8,
                  }}>
                    ОПИСАНИЕ
                  </div>
                  <textarea
                    value={descVal}
                    onChange={(e) => setDescVal(e.target.value)}
                    onBlur={() => { if (descVal !== (task.description ?? '')) save({ description: descVal }); }}
                    rows={4}
                    placeholder="Добавить описание..."
                    style={{
                      width: '100%', resize: 'none', fontSize: 13, color: c.text,
                      background: c.inputBg, border: `1px solid ${c.inputBorder}`,
                      borderRadius: 8, padding: '10px 12px', outline: 'none',
                      fontFamily: '"Inter",system-ui,sans-serif', lineHeight: '20px',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Subtasks */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 10,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v10M6 6H2M6 6h4M2 6V9M10 6V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      ПОДЗАДАЧИ
                      {(task._count?.children ?? (task.children?.length ?? 0)) > 0 && (
                        <span style={{ color: c.muted, fontWeight: 400 }}>
                          · {task._count?.children ?? task.children?.length}
                        </span>
                      )}
                    </span>
                  </div>
                  {boardId ? (
                    <SubtaskTree
                      tasks={task.children ?? []}
                      parentId={task.id}
                      boardId={boardId}
                      statuses={statuses}
                      onRefresh={refreshTask}
                    />
                  ) : (task._count?.children ?? 0) > 0 ? (
                    <span style={{ fontSize: 12, color: c.label }}>{task._count?.children} подзадач</span>
                  ) : null}
                </div>

                {/* Checklists */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: c.label,
                    letterSpacing: '0.06em', marginBottom: 8,
                  }}>
                    ЧЕКЛИСТЫ
                  </div>
                  <ChecklistBlock
                    taskId={task.id}
                    checklists={task.checklists ?? []}
                    onChecklistsChanged={handleChecklistsChanged}
                  />
                </div>

                {/* Meta */}
                <div style={{ paddingTop: 8, borderTop: `1px solid ${c.sectionBorder}` }}>
                  <span style={{ fontSize: 11, color: c.label }}>
                    Создано {new Date(task.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            )

            // ── Comments tab ──────────────────────────────────────────────────
            : activeTab === 'comments' ? (
              <CommentThread
                taskId={task.id}
                comments={task.comments ?? []}
                onCommentsChanged={handleCommentsChanged}
              />
            )

            // ── History tab ───────────────────────────────────────────────────
            : (
              <TaskHistoryTimeline taskId={task.id} statuses={statuses} />
            )
          )}
        </div>
      </div>
    </>
  );
}
