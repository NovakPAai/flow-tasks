import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import { useWorkspaceStore } from '../store/workspace.store';
import * as boardsApi from '../api/boards';
import * as wfApi from '../api/workflows';
import type { Board, Workflow } from '../types';

type C = Record<string, string>;
const DARK: C = {
  bg: '#03050F', sidebar: '#0A0D1A', sidebarBorder: '#1C2236',
  border: '#1C2236', cardBg: '#0F1320',
  text: '#E2E8F8', muted: '#8B949E', label: '#484F58',
  inputBg: '#0F1320', inputBorder: '#1C2236',
  dangerBg: '#0F1320', dangerBorder: '#EF444440',
};
const LIGHT: C = {
  bg: '#F5F3FF', sidebar: '#FDFCFF', sidebarBorder: '#E8E5F0',
  border: '#E8E5F0', cardBg: '#FDFCFF',
  text: '#1A1A2E', muted: '#9B96B8', label: '#B8B3D0',
  inputBg: '#F5F3FF', inputBorder: '#E8E5F0',
  dangerBg: '#FDFCFF', dangerBorder: '#EF444440',
};

const INTER = '"Inter",system-ui,sans-serif';
const GROTESK = '"Space Grotesk",system-ui,sans-serif';

export default function BoardSettingsPage() {
  const { slug, boardId } = useParams<{ slug: string; boardId: string }>();
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const isDark = mode !== 'light';
  const { workspaces } = useWorkspaceStore();

  const [board, setBoard] = useState<Board | null>(null);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const workspace = workspaces.find((w) => w.slug === slug) ?? null;
  const isOwner = workspace?.role === 'OWNER';

  useEffect(() => {
    if (!boardId) return;
    boardsApi.getBoard(boardId).then((b) => {
      setBoard(b);
      setName(b.name);
      setDescription(b.description ?? '');
      setWorkflowId(b.workflowId);
      setIsPrivate(b.isPrivate ?? false);
    }).catch(() => message.error('Не удалось загрузить доску'));
  }, [boardId]);

  useEffect(() => {
    if (!workspace?.id) return;
    wfApi.listWorkflows(workspace.id).then(setWorkflows).catch(() => {});
  }, [workspace?.id]);

  const save = async () => {
    if (!boardId) return;
    setSaving(true);
    try {
      await boardsApi.updateBoard(boardId, { name, description, workflowId, isPrivate });
      message.success('Сохранено');
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!boardId || !confirm(`Удалить доску "${board?.name}"? Все задачи будут удалены.`)) return;
    setDeleting(true);
    try {
      await boardsApi.deleteBoard(boardId);
      navigate(`/w/${slug}`);
    } catch { message.error('Не удалось удалить доску'); setDeleting(false); }
  };

  if (!board) return null;

  const inp: React.CSSProperties = {
    fontFamily: INTER, fontSize: 13, color: c.text,
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 8, padding: '8px 12px', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', minHeight: '100%', fontFamily: INTER, background: c.bg }}>
      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, background: c.sidebar, borderRight: `1px solid ${c.sidebarBorder}`, padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text, fontFamily: GROTESK, letterSpacing: '-0.01em' }}>Настройки доски</div>
          <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{board.name}</div>
        </div>
        <button
          onClick={() => navigate(`/w/${slug}/boards/${boardId}`)}
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
              <select
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                disabled={!isOwner}
                style={{ ...inp, appearance: 'none' }}
              >
                {workflows.map((wf) => (
                  <option key={wf.id} value={wf.id}>{wf.name}{wf.isDefault ? ' (по умолчанию)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          {isOwner && (
            <button
              onClick={save}
              disabled={saving}
              style={{
                alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: INTER, fontSize: 13, fontWeight: 500,
                background: saving ? '#4F6EF788' : '#4F6EF7',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
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
                background: isPrivate ? '#4F6EF7' : (isDark ? '#1C2236' : '#D1CBF0'),
                position: 'relative', transition: 'background 0.2s',
                cursor: isOwner ? 'pointer' : 'not-allowed', opacity: isOwner ? 1 : 0.5,
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: isPrivate ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 0.18s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
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
          {isOwner && (
            <button
              onClick={save}
              disabled={saving}
              style={{
                marginTop: 16, display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: INTER, fontSize: 13, fontWeight: 500,
                background: saving ? '#4F6EF788' : '#4F6EF7',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 16px', cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          )}
        </div>

        {/* Danger zone */}
        {isOwner && (
          <div style={{ maxWidth: 480, marginTop: 48, border: '1px solid #EF444440', borderRadius: 10, padding: '20px 24px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Опасная зона</div>
            <div style={{ fontSize: 13, color: c.muted, marginBottom: 16 }}>
              Удаление доски необратимо. Все задачи будут удалены.
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              style={{
                background: 'transparent', border: '1px solid #EF4444', borderRadius: 8,
                color: '#EF4444', cursor: deleting ? 'not-allowed' : 'pointer',
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
