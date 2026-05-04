import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { useThemeStore } from '../store/theme.store';
import type { Label, Workflow, WorkspaceMember, WorkspaceRole } from '../types';
import * as workspacesApi from '../api/workspaces';
import * as labelsApi from '../api/labels';
import * as wfApi from '../api/workflows';
import WorkflowEditor from '../components/WorkflowEditor';
import WorkspaceHistoryTimeline from '../components/WorkspaceHistoryTimeline';
import { useWorkspaceStore } from '../store/workspace.store';
import { useAuthStore } from '../store/auth.store';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  bg: '#03050F', sidebar: '#0A0D1A', sidebarBorder: '#1C2236',
  border: '#1C2236', cardBg: '#0F1320',
  text: '#E2E8F8', muted: '#8B949E', label: '#484F58',
  inputBg: '#0F1320', inputBorder: '#1C2236',
  navActive: 'rgba(79,110,247,0.12)', navActiveText: '#4F6EF7',
  navHover: 'rgba(255,255,255,0.04)',
  rowHover: '#131729',
};
const LIGHT: C = {
  bg: '#F5F3FF', sidebar: '#FDFCFF', sidebarBorder: '#E8E5F0',
  border: '#E8E5F0', cardBg: '#FDFCFF',
  text: '#1A1A2E', muted: '#9B96B8', label: '#B8B3D0',
  inputBg: '#F5F3FF', inputBorder: '#E8E5F0',
  navActive: 'rgba(79,110,247,0.10)', navActiveText: '#4F6EF7',
  navHover: 'rgba(0,0,0,0.03)',
  rowHover: '#F0EEF8',
};

const AVATAR_COLORS = ['#4F6EF7', '#8B5CF6', '#22C55E', '#F59E0B', '#EC4899', '#EF4444', '#0EA5E9'];
function avatarColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }
function avatarInitials(name: string) { return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

const ROLE_LABEL: Record<string, string> = { OWNER: 'Owner', MEMBER: 'Member', VIEWER: 'Viewer' };
const ROLE_OPTS = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'MEMBER', label: 'Участник' },
  { value: 'VIEWER', label: 'Наблюдатель' },
];
const WF_MODE_LABEL: Record<string, string> = {
  FORWARD_ONLY: 'Forward only',
  BIDIRECTIONAL: 'Bi-directional',
  CUSTOM: 'Custom',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
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

function PrimaryBtn({
  children, onClick, disabled, loading, style,
}: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; loading?: boolean; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 500,
        background: disabled || loading ? '#4F6EF788' : '#4F6EF7',
        color: '#fff', border: 'none', borderRadius: 8,
        padding: '8px 16px', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {loading && <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid #ffffff44', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />}
      {children}
    </button>
  );
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div ref={ref} style={{
        background: c.sidebar, border: `1px solid ${c.border}`, borderRadius: 12,
        padding: 24, width: 400, maxWidth: '90vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        fontFamily: '"Inter",system-ui,sans-serif',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>
            {title}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, padding: 4 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function WorkspaceSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'members';

  const mode = useThemeStore((s) => s.mode);
  const c = mode === 'light' ? LIGHT : DARK;

  const { workspaces, load } = useWorkspaceStore();
  const currentUser = useAuthStore((s) => s.user);
  const workspace = workspaces.find((w) => w.slug === slug) ?? null;

  const [members, setMembers]     = useState<WorkspaceMember[]>([]);
  const [labels, setLabels]       = useState<Label[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  // General settings
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate]     = useState(false);
  const [saving, setSaving]           = useState(false);

  // Invite
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail]       = useState('');
  const [inviting, setInviting]             = useState(false);

  // Label modal
  const [labelModal, setLabelModal] = useState(false);
  const [editLabelId, setEditLabelId] = useState<string | null>(null);
  const [labelName, setLabelName]   = useState('');
  const [labelColor, setLabelColor] = useState('#4F6EF7');
  const [savingLabel, setSavingLabel] = useState(false);

  // Workflow modal + editing
  const [wfModal, setWfModal]       = useState(false);
  const [wfName, setWfName]         = useState('');
  const [wfMode, setWfMode]         = useState<'FORWARD_ONLY' | 'BIDIRECTIONAL' | 'CUSTOM'>('BIDIRECTIONAL');
  const [creatingWf, setCreatingWf] = useState(false);
  const [editingWfId, setEditingWfId] = useState<string | null>(null);

  useEffect(() => { if (workspaces.length === 0) load(); }, [workspaces.length, load]);
  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setDescription(workspace.description ?? '');
    setIsPrivate(workspace.isPrivate ?? false);
    Promise.all([
      workspacesApi.listMembers(workspace.id),
      labelsApi.listLabels(workspace.id),
      wfApi.listWorkflows(workspace.id),
    ]).then(([m, l, wfs]) => { setMembers(m); setLabels(l); setWorkflows(wfs); }).catch(() => {});
  }, [workspace?.id]);

  const myRole = members.find((m) => m.userId === currentUser?.id)?.role;
  const isOwner = myRole === 'OWNER';

  if (!workspace) return null;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const saveSettings = async () => {
    setSaving(true);
    try { await workspacesApi.updateWorkspace(workspace.id, { name, description, isPrivate }); await load(); message.success('Сохранено'); }
    catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (userId: string, role: WorkspaceRole) => {
    try {
      await workspacesApi.updateMemberRole(workspace.id, userId, role);
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
      load(); // refresh memberCount in workspace store
    } catch { message.error('Не удалось изменить роль'); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Удалить участника?')) return;
    try {
      await workspacesApi.removeMember(workspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      load(); // refresh memberCount in workspace store
    }
    catch { message.error('Не удалось удалить'); }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await workspacesApi.inviteByEmail(workspace.id, inviteEmail.trim());
      const updated = await workspacesApi.listMembers(workspace.id);
      setMembers(updated); setInviteEmail(''); setShowInviteForm(false);
      message.success('Участник добавлен');
      load(); // refresh memberCount in workspace store
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось пригласить');
    } finally { setInviting(false); }
  };

  const openCreateLabel = () => { setEditLabelId(null); setLabelName(''); setLabelColor('#4F6EF7'); setLabelModal(true); };
  const openEditLabel = (l: Label) => { setEditLabelId(l.id); setLabelName(l.name); setLabelColor(l.color); setLabelModal(true); };

  const handleSaveLabel = async () => {
    if (!labelName.trim()) return;
    setSavingLabel(true);
    try {
      if (editLabelId) {
        const updated = await labelsApi.updateLabel(editLabelId, { name: labelName.trim(), color: labelColor });
        setLabels((prev) => prev.map((l) => l.id === editLabelId ? updated : l));
      } else {
        const created = await labelsApi.createLabel(workspace.id, { name: labelName.trim(), color: labelColor });
        setLabels((prev) => [...prev, created]);
      }
      setLabelModal(false);
    } catch { message.error('Не удалось сохранить метку'); }
    finally { setSavingLabel(false); }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm('Удалить метку?')) return;
    try { await labelsApi.deleteLabel(labelId); setLabels((prev) => prev.filter((l) => l.id !== labelId)); }
    catch { message.error('Не удалось удалить'); }
  };

  const handleCreateWorkflow = async () => {
    if (!wfName.trim()) return;
    setCreatingWf(true);
    try {
      const created = await wfApi.createWorkflow(workspace.id, {
        name: wfName.trim(), mode: wfMode,
        statuses: [
          { name: 'To Do',       color: '#6B7280', category: 'OPEN' },
          { name: 'In Progress', color: '#4F6EF7', category: 'IN_PROGRESS' },
          { name: 'Done',        color: '#22C55E', category: 'DONE' },
        ],
      });
      setWorkflows((prev) => [...prev, created]);
      setWfModal(false); setWfName(''); setWfMode('BIDIRECTIONAL');
      setEditingWfId(created.id);
    } catch { message.error('Не удалось создать'); }
    finally { setCreatingWf(false); }
  };

  const handleDeleteWorkflow = async (wfId: string) => {
    if (!confirm('Удалить workflow? Доски с этим workflow перестанут работать.')) return;
    try {
      await wfApi.deleteWorkflow(wfId);
      setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
      if (editingWfId === wfId) setEditingWfId(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось удалить');
    }
  };

  const handleSetDefaultWorkflow = async (wfId: string) => {
    try {
      const updated = await wfApi.updateWorkflow(wfId, { isDefault: true });
      setWorkflows((prev) => prev.map((w) => ({ ...w, isDefault: w.id === updated.id })));
      message.success('Дефолтный workflow обновлён');
    } catch {
      message.error('Не удалось обновить дефолтный workflow');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!confirm(`Удалить workspace "${workspace.name}"? Это действие необратимо.`)) return;
    try {
      await workspacesApi.deleteWorkspace(workspace.id);
      await load();
      navigate('/workspaces');
    } catch { message.error('Не удалось удалить workspace'); }
  };

  // ─── Input style ───────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.text,
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 8, padding: '8px 12px', outline: 'none', width: '100%',
    boxSizing: 'border-box',
  };

  // ─── Nav items ─────────────────────────────────────────────────────────────
  const NAV = [
    { key: 'members',   label: 'Участники' },
    { key: 'workflows', label: 'Workflows' },
    { key: 'labels',    label: 'Метки' },
    ...(isOwner ? [{ key: 'history', label: 'История' }] : []),
    { key: 'general',   label: 'Основное' },
  ];

  // ─── Tab content ───────────────────────────────────────────────────────────

  const renderMembers = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>Участники</h2>
          <span style={{ fontSize: 12, color: c.muted }}>
            {members.length} участника · {members.filter((m) => m.role === 'OWNER').length} owner · {members.filter((m) => m.role === 'MEMBER').length} member · {members.filter((m) => m.role === 'VIEWER').length} viewer
          </span>
        </div>
        {isOwner && (
          <PrimaryBtn onClick={() => setShowInviteForm((v) => !v)}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Пригласить участника
          </PrimaryBtn>
        )}
      </div>

      {/* Invite form */}
      {showInviteForm && isOwner && (
        <div style={{ marginBottom: 16, padding: 16, background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, display: 'flex', gap: 8 }}>
          <input
            autoFocus value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); if (e.key === 'Escape') setShowInviteForm(false); }}
            placeholder="Email пользователя..." style={{ ...inp, flex: 1, width: 'auto' }}
          />
          <PrimaryBtn onClick={handleInvite} loading={inviting} disabled={!inviteEmail.trim()}>
            Пригласить
          </PrimaryBtn>
          <button onClick={() => setShowInviteForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.muted, padding: '0 8px', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Members table */}
      <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 180px 60px', padding: '10px 16px', borderBottom: `1px solid ${c.border}`, background: c.cardBg }}>
          {['ИМЯ', 'EMAIL', 'РОЛЬ', ''].map((h) => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em' }}>{h}</span>
          ))}
        </div>
        {members.map((m, idx) => (
          <div
            key={m.userId}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 200px 180px 60px',
              alignItems: 'center', padding: '12px 16px',
              background: c.cardBg,
              borderBottom: idx < members.length - 1 ? `1px solid ${c.border}` : 'none',
            }}
          >
            {/* Name + avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar name={m.user.name} size={28} />
              <span style={{ fontSize: 13, color: c.text }}>{m.user.name}</span>
            </div>
            {/* Email */}
            <span style={{ fontSize: 12, color: c.muted }}>{m.user.email}</span>
            {/* Role */}
            <div>
              {isOwner && m.userId !== currentUser?.id ? (
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                  style={{ background: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 6, padding: '4px 8px', fontSize: 12, color: c.text, fontFamily: '"Inter",system-ui,sans-serif', cursor: 'pointer', outline: 'none' }}
                >
                  {ROLE_OPTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              ) : (
                <span style={{
                  fontSize: 11, fontWeight: 500, borderRadius: 5, padding: '3px 8px',
                  background: m.role === 'OWNER' ? 'rgba(79,110,247,0.12)' : `${c.border}`,
                  color: m.role === 'OWNER' ? '#4F6EF7' : c.muted,
                }}>
                  {ROLE_LABEL[m.role]}
                </span>
              )}
            </div>
            {/* Remove */}
            <div style={{ textAlign: 'right' }}>
              {isOwner && m.userId !== currentUser?.id ? (
                <button onClick={() => handleRemoveMember(m.userId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 12, fontFamily: '"Inter",system-ui,sans-serif' }}>
                  Удалить
                </button>
              ) : <span style={{ color: c.label, fontSize: 12 }}>—</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWorkflows = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>Workflows</h2>
          <span style={{ fontSize: 12, color: c.muted }}>Управляйте статусами и переходами для ваших досок</span>
        </div>
        {isOwner && <PrimaryBtn onClick={() => { setWfName(''); setWfMode('BIDIRECTIONAL'); setWfModal(true); }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Создать workflow
        </PrimaryBtn>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {workflows.map((wf) => {
          const modeColor = wf.mode === 'FORWARD_ONLY' ? '#22C55E' : wf.mode === 'BIDIRECTIONAL' ? '#4F6EF7' : '#F59E0B';
          return (
            <div key={wf.id} style={{ background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>{wf.name}</span>
                    {wf.isDefault && (
                      <span style={{ fontSize: 10, fontWeight: 500, color: '#4F6EF7', background: 'rgba(79,110,247,0.12)', borderRadius: 4, padding: '2px 6px' }}>По умолчанию</span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 500, color: modeColor, background: `${modeColor}18`, borderRadius: 4, padding: '2px 7px' }}>
                      {WF_MODE_LABEL[wf.mode]}
                    </span>
                  </div>
                  {/* Status flow */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    {(wf.statuses ?? []).map((s, i) => (
                      <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: c.muted }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                          {s.name}
                        </span>
                        {i < (wf.statuses ?? []).length - 1 && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ color: c.label }}>
                            <path d="M2 5h6M6 3l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </span>
                    ))}
                    {(wf as { _count?: { boards?: number } })._count?.boards !== undefined && (
                      <span style={{ fontSize: 11, color: c.label, marginLeft: 4 }}>
                        · используют {(wf as { _count?: { boards?: number } })._count!.boards} доски
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {!wf.isDefault && isOwner && (
                    <button
                      onClick={() => handleSetDefaultWorkflow(wf.id)}
                      style={{ fontSize: 12, color: '#4F6EF7', background: 'rgba(79,110,247,0.08)', border: '1px solid rgba(79,110,247,0.2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}
                    >
                      По умолчанию
                    </button>
                  )}
                  <button
                    onClick={() => setEditingWfId(editingWfId === wf.id ? null : wf.id)}
                    style={{ fontSize: 12, color: c.text, background: c.inputBg, border: `1px solid ${c.border}`, borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}
                  >
                    Изменить
                  </button>
                  {!wf.isDefault && isOwner && (
                    <button
                      onClick={() => handleDeleteWorkflow(wf.id)}
                      style={{ fontSize: 12, color: '#EF4444', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}
                    >
                      Удалить
                    </button>
                  )}
                </div>
              </div>
              {editingWfId === wf.id && (
                <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${c.border}` }}>
                  <div style={{ paddingTop: 16 }}>
                    <WorkflowEditor workflowId={wf.id} isOwner={isOwner} onClose={() => setEditingWfId(null)} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {workflows.length === 0 && <span style={{ color: c.muted, fontSize: 13 }}>Нет workflow</span>}
      </div>
    </div>
  );

  const renderLabels = () => (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>Метки</h2>
          <span style={{ fontSize: 12, color: c.muted }}>Цветные метки для классификации задач</span>
        </div>
        {isOwner && <PrimaryBtn onClick={openCreateLabel}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Создать метку
        </PrimaryBtn>}
      </div>

      {labels.length === 0 ? (
        <span style={{ color: c.muted, fontSize: 13 }}>Меток пока нет</span>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {labels.map((label) => (
            <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: label.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: c.text }}>{label.name}</div>
                {label._count && label._count.tasks > 0 && (
                  <div style={{ fontSize: 11, color: c.muted }}>{label._count.tasks} задач</div>
                )}
              </div>
              {isOwner && (
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button onClick={() => openEditLabel(label)} style={{ fontSize: 12, color: c.muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}>Изменить</button>
                  <button onClick={() => handleDeleteLabel(label.id)} style={{ fontSize: 14, color: c.label, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistory = () => workspace ? <WorkspaceHistoryTimeline workspaceId={workspace.id} /> : null;

  const renderGeneral = () => (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif' }}>Основное</h2>
      <div style={{ marginBottom: 32, marginTop: 8, fontSize: 12, color: c.muted }}>Настройки пространства</div>
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
          <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>SLUG</div>
          <input value={workspace.slug} disabled style={{ ...inp, color: c.muted, fontFamily: 'monospace' }} />
        </div>
        {isOwner && <PrimaryBtn onClick={saveSettings} loading={saving} style={{ alignSelf: 'flex-start' }}>Сохранить</PrimaryBtn>}
      </div>

      {/* Privacy section */}
      <div style={{ maxWidth: 480, marginTop: 32, border: `1px solid ${c.border}`, borderRadius: 10, padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c.text, marginBottom: 4 }}>Приватность</div>
        <div style={{ fontSize: 12, color: c.muted, marginBottom: 16 }}>
          Приватное пространство не отображается в публичных списках. Доступ — только для добавленных участников.
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: isOwner ? 'pointer' : 'default' }}>
          <div
            onClick={() => isOwner && setIsPrivate(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, flexShrink: 0,
              background: isPrivate ? '#4F6EF7' : (mode === 'dark' ? '#1C2236' : '#D1CBF0'),
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
              {isPrivate ? 'Приватное' : 'Публичное'}
            </div>
            <div style={{ fontSize: 11, color: c.muted, marginTop: 2 }}>
              {isPrivate ? 'Видно только участникам' : 'Видно всем авторизованным пользователям'}
            </div>
          </div>
        </label>
      </div>

      {isOwner && (
        <div style={{ maxWidth: 480, marginTop: 48, border: `1px solid #EF444440`, borderRadius: 10, padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', letterSpacing: '0.04em', marginBottom: 8, textTransform: 'uppercase' }}>Опасная зона</div>
          <div style={{ fontSize: 13, color: c.muted, marginBottom: 16 }}>
            Удаление пространства необратимо. Все доски, задачи и участники будут удалены.
          </div>
          <button
            onClick={handleDeleteWorkspace}
            style={{
              background: 'transparent', border: '1px solid #EF4444', borderRadius: 8,
              color: '#EF4444', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif',
              fontSize: 13, fontWeight: 600, padding: '8px 18px',
            }}
          >
            Удалить пространство
          </button>
        </div>
      )}
    </div>
  );

  const CONTENT_MAP: Record<string, () => React.ReactNode> = {
    members: renderMembers,
    workflows: renderWorkflows,
    labels: renderLabels,
    history: renderHistory,
    general: renderGeneral,
  };

  // ─── Layout ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100%', fontFamily: '"Inter",system-ui,sans-serif', background: c.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Sidebar */}
      <div style={{ width: 230, flexShrink: 0, background: c.sidebar, borderRight: `1px solid ${c.sidebarBorder}`, padding: '24px 0', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '0 20px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: c.text, fontFamily: '"Space Grotesk",system-ui,sans-serif', letterSpacing: '-0.01em' }}>Настройки</div>
          <div style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>{workspace.name}</div>
        </div>

        {NAV.map((item) => {
          const active = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setSearchParams({ tab: item.key })}
              data-onboarding={item.key === 'members' ? 'ws-members' : item.key === 'workflows' ? 'ws-workflows' : undefined}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 20px', fontSize: 13,
                fontFamily: '"Inter",system-ui,sans-serif',
                color: active ? c.navActiveText : c.muted,
                background: active ? c.navActive : 'transparent',
                border: 'none', cursor: 'pointer',
                fontWeight: active ? 500 : 400,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { if (!active) (e.currentTarget).style.background = c.navHover; }}
              onMouseLeave={(e) => { if (!active) (e.currentTarget).style.background = 'transparent'; }}
            >
              {item.label}
            </button>
          );
        })}

        <div style={{ flex: 1 }} />

        {/* Delete workspace */}
        {isOwner && (
          <button
            onClick={handleDeleteWorkspace}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 20px', fontSize: 13, color: '#EF4444',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif',
            }}
          >
            Удалить workspace
          </button>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: '32px 40px', overflow: 'auto' }}>
        {(CONTENT_MAP[activeTab] ?? renderMembers)()}
      </div>

      {/* Workflow create modal */}
      <Modal open={wfModal} onClose={() => setWfModal(false)} title="Новый workflow">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>НАЗВАНИЕ</div>
            <input autoFocus value={wfName} onChange={(e) => setWfName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleCreateWorkflow(); }} placeholder="Например: Dev Flow" style={{ ...inp }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>РЕЖИМ</div>
            <select value={wfMode} onChange={(e) => setWfMode(e.target.value as typeof wfMode)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="FORWARD_ONLY">→ Только вперёд</option>
              <option value="BIDIRECTIONAL">⇄ В обе стороны</option>
              <option value="CUSTOM">⚙ Настраиваемый</option>
            </select>
          </div>
          <div style={{ fontSize: 12, color: c.muted, lineHeight: '18px' }}>
            Будет создан с 3 стандартными статусами. Изменить можно после создания.
          </div>
          <PrimaryBtn onClick={handleCreateWorkflow} loading={creatingWf} disabled={!wfName.trim()} style={{ width: '100%', justifyContent: 'center' }}>
            Создать workflow
          </PrimaryBtn>
        </div>
      </Modal>

      {/* Label create/edit modal */}
      <Modal open={labelModal} onClose={() => setLabelModal(false)} title={editLabelId ? 'Изменить метку' : 'Создать метку'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>НАЗВАНИЕ</div>
            <input autoFocus value={labelName} onChange={(e) => setLabelName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLabel(); }} placeholder="Название метки..." style={{ ...inp }} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: c.label, letterSpacing: '0.06em', marginBottom: 6 }}>ЦВЕТ</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} style={{ width: 40, height: 32, border: `1px solid ${c.border}`, borderRadius: 6, cursor: 'pointer', padding: 2, background: c.inputBg }} />
              <span style={{ fontSize: 12, color: c.muted, fontFamily: 'monospace' }}>{labelColor}</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: labelColor }} />
            </div>
          </div>
          <PrimaryBtn onClick={handleSaveLabel} loading={savingLabel} disabled={!labelName.trim()} style={{ width: '100%', justifyContent: 'center' }}>
            {editLabelId ? 'Сохранить' : 'Создать метку'}
          </PrimaryBtn>
        </div>
      </Modal>
    </div>
  );
}
