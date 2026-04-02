import { useState } from 'react';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Task, WorkflowStatus } from '../types';
import * as tasksApi from '../api/tasks';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  line: '#1C2236', rowHover: '#0F1320',
  titleText: '#C8D0E8', doneTitleText: '#4A5578',
  keyText: '#2D3748', dimText: '#4A5578', addText: '#4A5578',
  inputBg: '#0F1320', inputBorder: '#4F6EF7', inputText: '#E2E8F8',
  btnBg: '#4F6EF7', btnText: '#fff',
  cancelText: '#4A5578',
  checkBorder: '#2D3748', checkBg: 'transparent', doneCheckBorder: '#34D399', doneCheckBg: 'rgba(52,211,153,0.13)',
};
const LIGHT: C = {
  line: '#E8E5F0', rowHover: '#F5F3FF',
  titleText: '#1A1A2E', doneTitleText: '#9B96B8',
  keyText: '#B0AACC', dimText: '#9B96B8', addText: '#9B96B8',
  inputBg: '#FDFCFF', inputBorder: '#4F6EF7', inputText: '#1A1A2E',
  btnBg: '#4F6EF7', btnText: '#fff',
  cancelText: '#9B96B8',
  checkBorder: '#D1C8EC', checkBg: '#FDFCFF', doneCheckBorder: '#10B981', doneCheckBg: 'rgba(16,185,129,0.08)',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function isDone(task: Task, statuses: WorkflowStatus[]): boolean {
  return statuses.find(s => s.id === task.statusId)?.category === 'DONE';
}
function findDoneStatusId(statuses: WorkflowStatus[]): string | undefined {
  return statuses.find(s => s.category === 'DONE')?.id;
}
function findFirstStatusId(statuses: WorkflowStatus[]): string | undefined {
  return statuses[0]?.id;
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  tasks: Task[];
  parentId: string;
  boardId: string;
  statuses: WorkflowStatus[];
  depth?: number;
  onRefresh: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SubtaskTree({
  tasks, parentId, boardId, statuses, depth = 0, onRefresh,
}: Props) {
  const mode = useThemeStore(s => s.mode);
  const isDark = mode === 'dark';
  const c = isDark ? DARK : LIGHT;

  const [expanded, setExpanded]           = useState<Record<string, boolean>>({});
  const [subtrees, setSubtrees]           = useState<Record<string, Task[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<Record<string, boolean>>({});
  const [adding, setAdding]               = useState(false);
  const [addTitle, setAddTitle]           = useState('');
  const [saving, setSaving]               = useState(false);
  const [confirmId, setConfirmId]         = useState<string | null>(null);

  const indent = depth * 16;

  const handleExpand = async (task: Task) => {
    const id = task.id;
    if (expanded[id]) { setExpanded(p => ({ ...p, [id]: false })); return; }
    setLoadingExpand(p => ({ ...p, [id]: true }));
    try {
      const children = await tasksApi.getSubtree(id);
      const direct = children.filter(ch => ch.parentId === id);
      setSubtrees(p => ({ ...p, [id]: direct }));
      setExpanded(p => ({ ...p, [id]: true }));
    } catch { message.error('Не удалось загрузить подзадачи'); }
    finally { setLoadingExpand(p => ({ ...p, [id]: false })); }
  };

  const handleToggleDone = async (task: Task) => {
    const done = isDone(task, statuses);
    const targetStatusId = done ? findFirstStatusId(statuses) : findDoneStatusId(statuses);
    if (!targetStatusId) return;
    try { await tasksApi.moveTask(task.id, targetStatusId); onRefresh(); }
    catch { message.error('Ошибка'); }
  };

  const handleDelete = async (taskId: string) => {
    try { await tasksApi.deleteTask(taskId); onRefresh(); }
    catch { message.error('Не удалось удалить'); }
    finally { setConfirmId(null); }
  };

  const handleAddSubtask = async () => {
    if (!addTitle.trim()) { setAdding(false); return; }
    setSaving(true);
    try {
      await tasksApi.createTask(boardId, { title: addTitle.trim(), parentId, statusId: findFirstStatusId(statuses) });
      setAddTitle(''); setAdding(false); onRefresh();
    } catch { message.error('Не удалось создать подзадачу'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'relative' }}>
      {depth > 0 && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 1, background: c.line }} />
      )}

      {tasks.map(task => {
        const done = isDone(task, statuses);
        const hasChildren = (task._count?.children ?? 0) > 0;
        const isExpanded = !!expanded[task.id];

        return (
          <div key={task.id}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                paddingLeft: indent + (depth > 0 ? 12 : 0),
                paddingTop: 4, paddingBottom: 4, borderRadius: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = c.rowHover; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Expand toggle */}
              <span
                style={{
                  width: 16, height: 16, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: hasChildren ? 'pointer' : 'default', color: c.dimText,
                }}
                onClick={() => hasChildren && handleExpand(task)}
              >
                {hasChildren && (
                  loadingExpand[task.id]
                    ? <span style={{ fontSize: 10 }}>…</span>
                    : isExpanded
                      ? (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      )
                      : (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M2.5 1L5.5 4L2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      )
                )}
              </span>

              {/* Done checkbox */}
              <span
                title={done ? 'Снять отметку' : 'Отметить выполненным'}
                onClick={() => handleToggleDone(task)}
                style={{
                  width: 15, height: 15, borderRadius: 3, flexShrink: 0,
                  border: `1px solid ${done ? c.doneCheckBorder : c.checkBorder}`,
                  background: done ? c.doneCheckBg : c.checkBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {done && (
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#34D399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>

              {/* Title */}
              <span style={{
                flex: 1, fontSize: 13,
                fontFamily: '"Inter",system-ui,sans-serif',
                color: done ? c.doneTitleText : c.titleText,
                textDecoration: done ? 'line-through' : 'none',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {task.title}
              </span>

              {/* Issue key */}
              <span style={{
                fontSize: 10, color: c.keyText,
                fontFamily: '"Inter",system-ui,sans-serif', flexShrink: 0,
              }}>
                {task.issueKey}
              </span>

              {/* Delete / confirm */}
              {confirmId === task.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <span style={{ fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.dimText }}>Удалить?</span>
                  <button
                    onClick={() => handleDelete(task.id)}
                    style={{
                      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: '#EF4444',
                    }}
                  >Да</button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{
                      background: 'none', border: `1px solid ${c.line}`,
                      borderRadius: 3, padding: '1px 6px', cursor: 'pointer',
                      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 11, color: c.dimText,
                    }}
                  >Нет</button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(task.id)}
                  title="Удалить подзадачу"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 4px', borderRadius: 3, flexShrink: 0,
                    color: c.dimText, opacity: 0.4,
                    display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                    (e.currentTarget as HTMLButtonElement).style.color = '#EF4444';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.4';
                    (e.currentTarget as HTMLButtonElement).style.color = c.dimText;
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              )}
            </div>

            {/* Recursive subtree */}
            {isExpanded && subtrees[task.id] && (
              <div style={{ paddingLeft: indent + 28 }}>
                <SubtaskTree
                  tasks={subtrees[task.id]}
                  parentId={task.id}
                  boardId={boardId}
                  statuses={statuses}
                  depth={depth + 1}
                  onRefresh={() => { handleExpand(task); onRefresh(); }}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* Add subtask row */}
      {adding ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          paddingLeft: indent + (depth > 0 ? 12 : 0), paddingTop: 4,
        }}>
          <span style={{ width: 16, flexShrink: 0 }} />
          <input
            autoFocus
            placeholder="Название подзадачи..."
            value={addTitle}
            onChange={e => setAddTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddSubtask();
              if (e.key === 'Escape') { setAdding(false); setAddTitle(''); }
            }}
            disabled={saving}
            style={{
              flex: 1, background: c.inputBg, border: `1px solid ${c.inputBorder}`,
              borderRadius: 6, padding: '4px 8px', outline: 'none',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.inputText,
            }}
          />
          <button
            onClick={handleAddSubtask}
            disabled={saving}
            style={{
              background: c.btnBg, border: 'none', borderRadius: 6,
              padding: '4px 10px', cursor: saving ? 'default' : 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, fontWeight: 500,
              color: c.btnText, opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '...' : 'Добавить'}
          </button>
          <button
            onClick={() => { setAdding(false); setAddTitle(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.cancelText,
            }}
          >
            Отмена
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            paddingLeft: indent + (depth > 0 ? 12 : 0), paddingTop: 4,
            cursor: 'pointer', borderRadius: 4, transition: 'color 0.15s',
            fontFamily: '"Inter",system-ui,sans-serif', fontSize: 12, color: c.addText,
          }}
          onClick={() => setAdding(true)}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = isDark ? '#8B9DC8' : '#6B7194'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = c.addText; }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>Добавить подзадачу</span>
        </div>
      )}
    </div>
  );
}
