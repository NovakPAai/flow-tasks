import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Empty, Form, Input, Modal, Typography, Spin, Tag, Tooltip, message,
} from 'antd';
import { PlusOutlined, TeamOutlined, RightOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../store/workspace.store';
import type { Workspace } from '../types';

const { Title, Text } = Typography;

const ROLE_COLOR: Record<string, string> = {
  OWNER: '#4F6EF7',
  MEMBER: '#22C55E',
  VIEWER: '#6B7280',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

export default function WorkspacesPage() {
  const navigate = useNavigate();
  const { workspaces, loading, load, create } = useWorkspaceStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ name: string; slug: string; description?: string }>();

  useEffect(() => { load(); }, [load]);

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = slugify(e.target.value);
    form.setFieldValue('slug', slug);
  };

  const onSubmit = async (values: { name: string; slug: string; description?: string }) => {
    setCreating(true);
    try {
      const ws = await create(values);
      message.success(`Workspace "${ws.name}" создан`);
      setModalOpen(false);
      form.resetFields();
      navigate(`/w/${ws.slug}`);
    } catch {
      message.error('Не удалось создать workspace');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#03050F', padding: '40px 48px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <Title level={2} style={{ margin: 0, color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
            Workspaces
          </Title>
          <Text style={{ color: '#4A5578' }}>Выберите пространство или создайте новое</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => setModalOpen(true)}
          style={{ background: '#4F6EF7', borderColor: '#4F6EF7' }}
        >
          Новый workspace
        </Button>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
          <Spin size="large" />
        </div>
      ) : workspaces.length === 0 ? (
        <Empty
          description={<Text style={{ color: '#4A5578' }}>Нет workspaces. Создайте первый!</Text>}
          style={{ paddingTop: 80 }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {workspaces.map((ws: Workspace) => (
            <WorkspaceCard key={ws.id} ws={ws} onClick={() => navigate(`/w/${ws.slug}`)} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        title={<span style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk' }}>Новый workspace</span>}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        footer={null}
        styles={{ content: { background: '#0F1320' }, header: { background: '#0F1320', borderBottom: '1px solid #1E2640' } }}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="name" label={<span style={{ color: '#8B95B0' }}>Название</span>}
            rules={[{ required: true, message: 'Обязательное поле' }, { max: 100 }]}>
            <Input placeholder="Моя команда" size="large" onChange={onNameChange} />
          </Form.Item>
          <Form.Item name="slug" label={<span style={{ color: '#8B95B0' }}>Slug (URL)</span>}
            rules={[
              { required: true, message: 'Обязательное поле' },
              { pattern: /^[a-z0-9-]+$/, message: 'Только строчные буквы, цифры, дефисы' },
              { min: 2 }, { max: 50 },
            ]}>
            <Input placeholder="my-team" size="large" prefix={<Text style={{ color: '#4A5578' }}>/w/</Text>} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ color: '#8B95B0' }}>Описание</span>}>
            <Input.TextArea placeholder="Описание workspace (необязательно)" rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setModalOpen(false); form.resetFields(); }}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={creating}>Создать</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function WorkspaceCard({ ws, onClick }: { ws: Workspace; onClick: () => void }) {
  return (
    <Card
      hoverable
      onClick={onClick}
      style={{ background: '#0F1320', border: '1px solid #1E2640', cursor: 'pointer' }}
      styles={{ body: { padding: '20px 24px' } }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text strong style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 600 }}>
              {ws.name}
            </Text>
            {ws.role && (
              <Tag
                style={{
                  background: `${ROLE_COLOR[ws.role]}22`,
                  border: `1px solid ${ROLE_COLOR[ws.role]}44`,
                  color: ROLE_COLOR[ws.role],
                  fontSize: 11,
                  lineHeight: '18px',
                }}
              >
                {ws.role}
              </Tag>
            )}
          </div>
          <Text style={{ color: '#4A5578', fontSize: 12, fontFamily: 'monospace' }}>/{ws.slug}</Text>
          {ws.description && (
            <Text style={{ color: '#8B95B0', fontSize: 13, display: 'block', marginTop: 8 }}>
              {ws.description}
            </Text>
          )}
        </div>
        <RightOutlined style={{ color: '#4A5578', marginLeft: 8, flexShrink: 0 }} />
      </div>
      {ws.memberCount !== undefined && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1E2640', display: 'flex', alignItems: 'center', gap: 6 }}>
          <TeamOutlined style={{ color: '#4A5578', fontSize: 12 }} />
          <Tooltip title="Участников">
            <Text style={{ color: '#4A5578', fontSize: 12 }}>{ws.memberCount}</Text>
          </Tooltip>
        </div>
      )}
    </Card>
  );
}
