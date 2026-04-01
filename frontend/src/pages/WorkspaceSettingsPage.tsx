import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Avatar, Button, ColorPicker, Form, Input, Modal,
  Popconfirm, Select, Table, Tabs, Tag, Typography, message,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import type { Label, Workflow, WorkspaceMember, WorkspaceRole } from '../types';
import * as workspacesApi from '../api/workspaces';
import * as labelsApi from '../api/labels';
import * as wfApi from '../api/workflows';
import WorkflowEditor from '../components/WorkflowEditor';
import { useWorkspaceStore } from '../store/workspace.store';
import { useAuthStore } from '../store/auth.store';

const { Title, Text } = Typography;

export default function WorkspaceSettingsPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'general';

  const { workspaces, load } = useWorkspaceStore();
  const currentUser = useAuthStore((s) => s.user);

  const workspace = workspaces.find((w) => w.slug === slug) ?? null;

  const [members, setMembers]   = useState<WorkspaceMember[]>([]);
  const [labels, setLabels]     = useState<Label[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Settings form
  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving]           = useState(false);

  // Invite
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);

  // Label form
  const [labelName, setLabelName]   = useState('');
  const [labelColor, setLabelColor] = useState('#4F6EF7');
  const [addingLabel, setAddingLabel] = useState(false);

  // Workflow modal
  const [wfModalOpen, setWfModalOpen]   = useState(false);
  const [wfName, setWfName]             = useState('');
  const [wfMode, setWfMode]             = useState<'FORWARD_ONLY' | 'BIDIRECTIONAL' | 'CUSTOM'>('BIDIRECTIONAL');
  const [creatingWf, setCreatingWf]     = useState(false);
  const [editingWfId, setEditingWfId]   = useState<string | null>(null);

  useEffect(() => {
    if (workspaces.length === 0) load();
  }, [workspaces.length, load]);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setDescription(workspace.description ?? '');
    setLoadingData(true);
    Promise.all([
      workspacesApi.listMembers(workspace.id),
      labelsApi.listLabels(workspace.id),
      wfApi.listWorkflows(workspace.id),
    ]).then(([m, l, wfs]) => {
      setMembers(m);
      setLabels(l);
      setWorkflows(wfs);
    }).catch(() => {}).finally(() => setLoadingData(false));
  }, [workspace?.id]);

  const myRole = members.find((m) => m.userId === currentUser?.id)?.role;
  const isOwner = myRole === 'OWNER';

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const saveSettings = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      await workspacesApi.updateWorkspace(workspace.id, { name, description });
      await load();
      message.success('Настройки сохранены');
    } catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const handleRoleChange = async (userId: string, role: WorkspaceRole) => {
    if (!workspace) return;
    try {
      await workspacesApi.updateMemberRole(workspace.id, userId, role);
      setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
    } catch { message.error('Не удалось изменить роль'); }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!workspace) return;
    try {
      await workspacesApi.removeMember(workspace.id, userId);
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch { message.error('Не удалось удалить участника'); }
  };

  const handleInvite = async () => {
    if (!workspace || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await workspacesApi.inviteByEmail(workspace.id, inviteEmail.trim());
      const updated = await workspacesApi.listMembers(workspace.id);
      setMembers(updated);
      setInviteEmail('');
      message.success('Участник добавлен');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось пригласить');
    } finally { setInviting(false); }
  };

  const handleAddLabel = async () => {
    if (!workspace || !labelName.trim()) return;
    setAddingLabel(true);
    try {
      const created = await labelsApi.createLabel(workspace.id, { name: labelName.trim(), color: labelColor });
      setLabels((prev) => [...prev, created]);
      setLabelName('');
      setLabelColor('#4F6EF7');
    } catch { message.error('Не удалось создать метку'); }
    finally { setAddingLabel(false); }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      await labelsApi.deleteLabel(labelId);
      setLabels((prev) => prev.filter((l) => l.id !== labelId));
    } catch { message.error('Не удалось удалить метку'); }
  };

  const handleCreateWorkflow = async () => {
    if (!workspace || !wfName.trim()) return;
    setCreatingWf(true);
    try {
      const created = await wfApi.createWorkflow(workspace.id, {
        name: wfName.trim(),
        mode: wfMode,
        statuses: [
          { name: 'To Do',       color: '#6B7280', category: 'OPEN' },
          { name: 'In Progress', color: '#4F6EF7', category: 'IN_PROGRESS' },
          { name: 'Done',        color: '#22C55E', category: 'DONE' },
        ],
      });
      setWorkflows((prev) => [...prev, created]);
      setWfModalOpen(false);
      setWfName('');
      setWfMode('BIDIRECTIONAL');
      setEditingWfId(created.id);
    } catch { message.error('Не удалось создать workflow'); }
    finally { setCreatingWf(false); }
  };

  const handleDeleteWorkflow = async (wfId: string) => {
    try {
      await wfApi.deleteWorkflow(wfId);
      setWorkflows((prev) => prev.filter((w) => w.id !== wfId));
      if (editingWfId === wfId) setEditingWfId(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      message.error(msg ?? 'Не удалось удалить workflow');
    }
  };

  // ─── Member table ─────────────────────────────────────────────────────────

  const memberColumns = [
    {
      key: 'user', title: 'Участник',
      render: (_: unknown, m: WorkspaceMember) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar size={32} style={{ background: '#4F6EF7', fontSize: 12, flexShrink: 0 }}>
            {m.user.name?.[0]?.toUpperCase()}
          </Avatar>
          <div>
            <Text style={{ color: '#E2E8F8', display: 'block', fontSize: 13 }}>{m.user.name}</Text>
            <Text style={{ color: '#4A5578', fontSize: 11 }}>{m.user.email}</Text>
          </div>
        </div>
      ),
    },
    {
      key: 'role', title: 'Роль', width: 160,
      render: (_: unknown, m: WorkspaceMember) => (
        isOwner && m.userId !== currentUser?.id ? (
          <Select
            value={m.role}
            size="small"
            style={{ width: 140 }}
            onChange={(v) => handleRoleChange(m.userId, v as WorkspaceRole)}
            options={[
              { value: 'OWNER',  label: 'Владелец' },
              { value: 'MEMBER', label: 'Участник' },
              { value: 'VIEWER', label: 'Наблюдатель' },
            ]}
          />
        ) : (
          <Tag style={{ borderRadius: 4 }}>
            {m.role === 'OWNER' ? 'Владелец' : m.role === 'MEMBER' ? 'Участник' : 'Наблюдатель'}
          </Tag>
        )
      ),
    },
    {
      key: 'actions', title: '', width: 50,
      render: (_: unknown, m: WorkspaceMember) => (
        isOwner && m.userId !== currentUser?.id ? (
          <Popconfirm title="Удалить участника?" onConfirm={() => handleRemoveMember(m.userId)} okText="Да" cancelText="Нет">
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        ) : null
      ),
    },
  ];

  if (!workspace) return null;

  // ─── Tab content ──────────────────────────────────────────────────────────

  const generalTab = (
    <div style={{ background: '#0A0E1A', borderRadius: 10, border: '1px solid #1E2640', padding: 20 }}>
      <Form layout="vertical">
        <Form.Item label={<Text style={{ color: '#8B95B0', fontSize: 12 }}>НАЗВАНИЕ</Text>} style={{ marginBottom: 16 }}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!isOwner}
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8' }}
          />
        </Form.Item>
        <Form.Item label={<Text style={{ color: '#8B95B0', fontSize: 12 }}>ОПИСАНИЕ</Text>} style={{ marginBottom: 16 }}>
          <Input.TextArea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!isOwner}
            rows={3}
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8', resize: 'none' }}
          />
        </Form.Item>
        <Form.Item label={<Text style={{ color: '#8B95B0', fontSize: 12 }}>SLUG</Text>} style={{ marginBottom: 16 }}>
          <Input
            value={workspace.slug}
            disabled
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#4A5578', fontFamily: 'monospace' }}
          />
        </Form.Item>
        {isOwner && (
          <Button type="primary" onClick={saveSettings} loading={saving} style={{ background: '#4F6EF7' }}>
            Сохранить
          </Button>
        )}
      </Form>
    </div>
  );

  const membersTab = (
    <div>
      {isOwner && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onPressEnter={handleInvite}
            placeholder="Email пользователя..."
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8' }}
            prefix={<UserAddOutlined style={{ color: '#4A5578' }} />}
          />
          <Button onClick={handleInvite} loading={inviting} icon={<PlusOutlined />} disabled={!inviteEmail.trim()} style={{ flexShrink: 0 }}>
            Пригласить
          </Button>
        </div>
      )}
      <Table
        dataSource={members}
        columns={memberColumns}
        rowKey="id"
        loading={loadingData}
        pagination={false}
        size="small"
        style={{ background: '#0A0E1A', borderRadius: 10, border: '1px solid #1E2640', overflow: 'hidden' }}
      />
      <Text style={{ color: '#4A5578', fontSize: 11, display: 'block', marginTop: 10 }}>
        {members.length} участник(ов) · {members.filter((m) => m.role === 'OWNER').length} владелец(ев) · {members.filter((m) => m.role === 'MEMBER').length} участник(ов) · {members.filter((m) => m.role === 'VIEWER').length} наблюдателей
      </Text>
    </div>
  );

  const workflowsTab = (
    <div>
      {isOwner && (
        <Button
          type="primary" icon={<PlusOutlined />}
          onClick={() => { setWfModalOpen(true); setWfName(''); setWfMode('BIDIRECTIONAL'); }}
          style={{ background: '#4F6EF7', marginBottom: 16 }}
        >
          Новый workflow
        </Button>
      )}

      {workflows.map((wf) => (
        <div key={wf.id} style={{ marginBottom: 12, background: '#0A0E1A', borderRadius: 10, border: '1px solid #1E2640', overflow: 'hidden' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}
            onClick={() => setEditingWfId(editingWfId === wf.id ? null : wf.id)}
          >
            <div style={{ flex: 1 }}>
              <Text style={{ color: '#E2E8F8', fontWeight: 600, fontSize: 14 }}>{wf.name}</Text>
              {wf.isDefault && <Tag style={{ marginLeft: 8, fontSize: 10, borderRadius: 4, background: '#4F6EF722', border: '1px solid #4F6EF755', color: '#4F6EF7' }}>По умолчанию</Tag>}
            </div>
            <Tag style={{ fontSize: 11, borderRadius: 4 }}>
              {wf.mode === 'FORWARD_ONLY' ? '→ Только вперёд' : wf.mode === 'BIDIRECTIONAL' ? '⇄ В обе стороны' : '⚙ Настраиваемый'}
            </Tag>
            <Text style={{ color: '#4A5578', fontSize: 12 }}>{(wf.statuses ?? []).length} статусов</Text>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button
                type="text" size="small" icon={<EditOutlined />}
                style={{ color: '#4A5578' }}
                onClick={(e) => { e.stopPropagation(); setEditingWfId(editingWfId === wf.id ? null : wf.id); }}
              />
              {!wf.isDefault && isOwner && (
                <Popconfirm
                  title="Удалить workflow?"
                  description="Все доски с этим workflow нельзя будет использовать."
                  onConfirm={(e) => { e?.stopPropagation(); handleDeleteWorkflow(wf.id); }}
                  okText="Удалить" cancelText="Нет"
                >
                  <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={(e) => e.stopPropagation()} />
                </Popconfirm>
              )}
            </div>
          </div>
          {editingWfId === wf.id && (
            <div style={{ padding: '0 16px 16px', borderTop: '1px solid #1E2640' }}>
              <div style={{ paddingTop: 16 }}>
                <WorkflowEditor workflowId={wf.id} isOwner={isOwner} />
              </div>
            </div>
          )}
        </div>
      ))}

      {workflows.length === 0 && (
        <Text style={{ color: '#4A5578', fontSize: 13 }}>Нет workflow</Text>
      )}

      <Modal
        open={wfModalOpen}
        title={<span style={{ color: '#E2E8F8' }}>Новый workflow</span>}
        onCancel={() => setWfModalOpen(false)}
        footer={null}
        styles={{ content: { background: '#0A0E1A' }, header: { background: '#0A0E1A', borderBottom: '1px solid #1E2640' } }}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label={<Text style={{ color: '#8B95B0', fontSize: 12 }}>НАЗВАНИЕ</Text>}>
            <Input
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              placeholder="Например: Dev Flow"
              style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8' }}
              autoFocus
            />
          </Form.Item>
          <Form.Item label={<Text style={{ color: '#8B95B0', fontSize: 12 }}>РЕЖИМ</Text>}>
            <Select
              value={wfMode}
              onChange={(v) => setWfMode(v as typeof wfMode)}
              style={{ width: '100%' }}
              options={[
                { value: 'FORWARD_ONLY',  label: '→ Только вперёд' },
                { value: 'BIDIRECTIONAL', label: '⇄ В обе стороны' },
                { value: 'CUSTOM',        label: '⚙ Настраиваемый' },
              ]}
            />
          </Form.Item>
          <Text style={{ color: '#4A5578', fontSize: 12, display: 'block', marginBottom: 16 }}>
            Будет создан с 3 стандартными статусами (To Do / In Progress / Done). Изменить можно после создания.
          </Text>
          <Button
            type="primary"
            onClick={handleCreateWorkflow}
            loading={creatingWf}
            disabled={!wfName.trim()}
            style={{ background: '#4F6EF7', width: '100%' }}
          >
            Создать
          </Button>
        </Form>
      </Modal>
    </div>
  );

  const labelsTab = (
    <div style={{ background: '#0A0E1A', borderRadius: 10, border: '1px solid #1E2640', padding: 16 }}>
      {isOwner && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <ColorPicker
            value={labelColor}
            onChange={(c: Color) => setLabelColor(c.toHexString())}
            size="small"
          />
          <Input
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            onPressEnter={handleAddLabel}
            placeholder="Название метки..."
            size="small"
            style={{ background: '#0F1320', border: '1px solid #1E2640', color: '#E2E8F8', flex: 1 }}
          />
          <Button
            size="small" onClick={handleAddLabel} loading={addingLabel}
            disabled={!labelName.trim()} icon={<PlusOutlined />}
            style={{ flexShrink: 0 }}
          >
            Добавить
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {labels.length === 0 && <Text style={{ color: '#4A5578', fontSize: 13 }}>Меток пока нет</Text>}
        {labels.map((label) => (
          <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tag
              style={{
                background: `${label.color}22`, border: `1px solid ${label.color}55`,
                color: label.color, borderRadius: 4, fontSize: 12, margin: 0,
              }}
            >
              {label.name}
              {label._count && label._count.tasks > 0 && (
                <span style={{ marginLeft: 4, opacity: 0.6 }}>({label._count.tasks})</span>
              )}
            </Tag>
            {isOwner && (
              <Popconfirm title="Удалить метку?" onConfirm={() => handleDeleteLabel(label.id)} okText="Да" cancelText="Нет">
                <Button type="text" size="small" icon={<DeleteOutlined />} style={{ color: '#4A5578', padding: 0, height: 'auto', minWidth: 'auto' }} />
              </Popconfirm>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const tabItems = [
    { key: 'general',   label: 'Основное',     children: generalTab },
    { key: 'members',   label: `Участники (${members.length})`, children: membersTab },
    { key: 'workflows', label: `Workflows (${workflows.length})`, children: workflowsTab },
    { key: 'labels',    label: `Метки (${labels.length})`,   children: labelsTab },
  ];

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#4A5578' }} />
        <div>
          <Title level={4} style={{ color: '#E2E8F8', margin: 0, fontFamily: 'Space Grotesk' }}>
            Настройки пространства
          </Title>
          <Text style={{ color: '#4A5578', fontSize: 12 }}>{workspace.name}</Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setSearchParams({ tab: key })}
        items={tabItems}
        style={{ color: '#8B95B0' }}
      />
    </div>
  );
}
