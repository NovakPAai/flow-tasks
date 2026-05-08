import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import * as boardsApi from '../api/boards';
import * as wfApi from '../api/workflows';
import type { Board, Workflow } from '../types';

type C = Record<string, string>;
const DARK: C = {
  bg: 'var(--static-background-base)', sidebar: 'var(--static-background-base)', sidebarBorder: 'var(--static-border-neutral-tertiary)',
  border: 'var(--static-border-neutral-tertiary)', cardBg: 'var(--static-background-lightest)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--neutral-8)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)',
};
const LIGHT: C = {
  bg: 'var(--static-background-base)', sidebar: 'var(--static-background-lightest)', sidebarBorder: 'var(--static-border-neutral-tertiary)',
  border: 'var(--static-border-neutral-tertiary)', cardBg: 'var(--static-background-lightest)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--neutral-6)',
  inputBg: 'var(--static-background-base)', inputBorder: 'var(--static-border-neutral-tertiary)',
};

const INTER = '"Inter",system-ui,sans-serif';
const GROTESK = '"Space Grotesk",system-ui,sans-serif';

export default function BoardSettingsPage() {
  const { slug, boardSlug } = useParams<{ slug: string; boardSlug: string }>();
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const isDark = mode !== 'light';
  const { workspaces, loading: wsLoading } = useWorkspaceStore();

  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const workspace = workspaces.find((w) => w.slug === slug) ?? null;
  const wsId = workspace?.id;
  const isOwner = workspace?.role === 'OWNER';

  useEffect(() => {
    if (!boardSlug) { setLoadError(true); return; }
    if (!wsId) {
      if (!wsLoading) setLoadError(true);
      return;
    }
    boardsApi.getBoardByPrefix(wsId, boardSlug).then((b) => {
      setBoard(b);
      setName(b.name);
      setDescription(b.description ?? '');
      setWorkflowId(b.workflowId);
      setIsPrivate(b.isPrivate ?? false);
    }).catch(() => { message.error('Не удалось загрузить доску'); setLoadError(true); });
  }, [wsId, wsLoading, boardSlug]);

  useEffect(() => {
    if (!workspace?.id) return;
    wfApi.listWorkflows(workspace.id).then(setWorkflows).catch(() => {});
  }, [workspace?.id]);

  const save = async () => {
    if (!board) return;
    setSaving(true);
    try {
      await boardsApi.updateBoard(board.id, { name, description, workflowId, isPrivate });
      message.success('Сохранено');
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!board || !confirm(`Удалить доску "${board.name}"? Все задачи будут удалены.`)) return;
    setDeleting(true);
    try {
      await boardsApi.deleteBoard(board.id);
      navigate(`/w/${slug}`);
    } catch { message.error('Не удалось удалить доску'); setDeleting(false); }
  };

  const inp: React.CSSProperties = {
    fontFamily: INTER, fontSize: 13, color: c.text,
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 8, padding: '8px 12px', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };

  const SaveBtn = ({ style }: { style?: React.CSSProperties }) => (
    <button
      onClick={save}
      disabled={saving}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: INTER, fontSize: 13, fontWeight: 500,
        background: saving ? 'var(--component-disable-fill)' : 'var(--brand-8)',
        color: 'var(--neutral-0)', border: 'none', borderRadius: 8,
        padding: '8px 16px', cursor: saving ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {saving ? 'Сохранение...' : 'Сохранить изменения'}
    </button>
  );

  // Loading / error state
  if (!board) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: c.bg }}>
        {loadError
          ? <span style={{ fontFamily: INTER, fontSize: 14, color: c.muted }}>Не удалось загрузить настройки доски</span>
          : <Spin size="large" />
        }
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100%', fontFamily: INTER, background: c.bg }}>
      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, background: c.sidebar, borderRight: `1px solid ${c.sidebarBorder}`, padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text, fontFamily: GROTESK, letterSpacing: '-0.01em' }}>Настройки доски</div>
          <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{board.name}</div>
        </div>
        <button
          onClick={() => navigate(`/w/${slug}/boards/${boardSlug}`)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            margin: '0 12px', padding: '8px 12px', borderRadius: 8,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: c.muted, fontFamily: INTER, fontSize: 13,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4.5 7L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Назад к доске
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '40px 48px', overflowY: 'auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c.text, fontFamily: GROTESK }}>Основное</h2>
        <div style={{ marginBottom: 32, fontSize: 12, color: c.muted }}>Настройки доски</div>

        <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>НАЗВАНИЕ</div>
            <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} style={inp} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>ОПИСАНИЕ</div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!isOwner} rows={3} style={{ ...inp, resize: 'none' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>ПРЕФИКС</div>
            <input value={board.prefix} disabled style={{ ...inp, color: c.muted, fontFamily: 'monospace' }} />
          </div>
          {workflows.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>WORKFLOW</div>
              {/* wrapper for custom dropdown arrow */}
              <div style={{ position: 'relative' }}>
                <select
                  value={workflowId}
                  onChange={(e) => setWorkflowId(e.target.value)}
                  disabled={!isOwner}
                  style={{ ...inp, paddingRight: 32, appearance: 'none' }}
                >
                  {workflows.map((wf) => (
                    <option key={wf.id} value={wf.id}>{wf.name}{wf.isDefault ? ' (по умолчанию)' : ''}</option>
                  ))}
                </select>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', opacity: 0.5 }}>
                  <path d="M2 4l4 4 4-4" stroke={c.text} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div style={{ maxWidth: 480, marginTop: 32, border: `1px solid ${c.border}`, borderRadius: 10, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>Приватность</div>
          <div style={{ fontSize: 12, color: c.muted, marginBottom: 16 }}>
            Приватная доска скрыта от наблюдателей (Viewer). Видна только владельцу и участникам.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: isOwner ? 'pointer' : 'default' }}>
            <div
              onClick={() => isOwner && setIsPrivate((v) => !v)}
              style={{
                width: 40, height: 22, borderRadius: 11, flexShrink: 0,
                background: isPrivate ? 'var(--brand-8)' : (isDark ? 'var(--static-border-neutral-tertiary)' : 'var(--component-border-neutral-medium)'),
                position: 'relative', transition: 'background 0.2s',
                cursor: isOwner ? 'pointer' : 'not-allowed', opacity: isOwner ? 1 : 0.5,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: isPrivate ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'var(--neutral-0)',
                transition: 'left 0.18s', boxShadow: 'var(--shadow-md)',
              }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>
                {isPrivate ? 'Приватная' : 'Публичная'}
              </div>
              <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
                {isPrivate ? 'Скрыта от наблюдателей' : 'Видна всем участникам пространства'}
              </div>
            </div>
          </label>
        </div>

        {/* Single save button covering all sections */}
        {isOwner && <SaveBtn style={{ marginTop: 24 }} />}

        {/* Danger zone */}
        {isOwner && (
          <div style={{ maxWidth: 480, marginTop: 48, border: '1px solid var(--component-border-negative-medium)', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--error-10)', letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Опасная зона</div>
            <div style={{ fontSize: 13, color: c.muted, marginBottom: 16 }}>
              Удаление доски необратимо. Все задачи будут удалены.
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: 'transparent', border: '1px solid var(--error-10)', borderRadius: 8,
                color: 'var(--error-10)', cursor: deleting ? 'not-allowed' : 'pointer',
                fontFamily: INTER, fontSize: 13, fontWeight: 600, padding: '8px 18px',
              }}
            >
              {deleting ? 'Удаление...' : 'Удалить доску'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
