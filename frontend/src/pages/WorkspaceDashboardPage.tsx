import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Spin, Typography, Tag, Empty } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../store/workspace.store';
import * as workspacesApi from '../api/workspaces';

const { Title, Text } = Typography;

export default function WorkspaceDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { workspaces, current, setCurrent, loading, load } = useWorkspaceStore();

  useEffect(() => {
    if (workspaces.length === 0) load();
  }, [workspaces.length, load]);

  useEffect(() => {
    if (!slug) return;
    const found = workspaces.find((w) => w.slug === slug);
    if (found && found.id !== current?.id) {
      // Load full workspace details
      workspacesApi.getWorkspace(found.id).then(setCurrent).catch(() => null);
    }
  }, [slug, workspaces, current?.id, setCurrent]);

  if (loading || (!current && workspaces.length === 0)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#03050F' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!current) {
    return (
      <div style={{ minHeight: '100vh', background: '#03050F', padding: 48 }}>
        <Empty description={<Text style={{ color: '#8B95B0' }}>Workspace не найден</Text>} />
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button onClick={() => navigate('/workspaces')}>Назад к workspaces</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#03050F', padding: '40px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/workspaces')}
          style={{ color: '#4A5578', padding: 0, marginBottom: 12 }}
        >
          Workspaces
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
              {current.name}
            </Title>
            {current.description && (
              <Text style={{ color: '#8B95B0' }}>{current.description}</Text>
            )}
          </div>
          <Button type="primary" icon={<PlusOutlined />} style={{ background: '#4F6EF7', borderColor: '#4F6EF7' }}>
            Новая доска
          </Button>
        </div>
      </div>

      {/* Workflows summary */}
      {current.workflows && current.workflows.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <Text style={{ color: '#4A5578', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
            Workflows
          </Text>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {current.workflows.map((wf) => (
              <Tag
                key={wf.id}
                style={{
                  background: wf.isDefault ? '#4F6EF722' : '#1E2640',
                  border: `1px solid ${wf.isDefault ? '#4F6EF744' : '#2A3455'}`,
                  color: wf.isDefault ? '#4F6EF7' : '#8B95B0',
                  borderRadius: 6,
                  padding: '2px 10px',
                }}
              >
                {wf.name}
                {wf.isDefault && <span style={{ marginLeft: 4, fontSize: 10 }}>default</span>}
                <span style={{ marginLeft: 6, color: '#4A5578', fontSize: 11 }}>
                  {wf.statuses?.length ?? 0} статусов
                </span>
              </Tag>
            ))}
          </div>
        </div>
      )}

      {/* Boards placeholder */}
      <div>
        <Text style={{ color: '#4A5578', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
          Доски
        </Text>
        <div style={{
          marginTop: 12,
          border: '2px dashed #1E2640',
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <Text style={{ color: '#4A5578' }}>Доски появятся в Фазе 2</Text>
        </div>
      </div>
    </div>
  );
}
