import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Empty, Form, Input, Modal, Spin, Typography, Tag, message, Tooltip,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '../store/workspace.store';
import type { Board } from '../types';
import * as workspacesApi from '../api/workspaces';
import * as boardsApi from '../api/boards';

const { Title, Text } = Typography;

export default function WorkspaceDashboardPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { workspaces, current, setCurrent, loading: wsLoading, load } = useWorkspaceStore();

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ name: string; prefix: string; description?: string }>();

  // Load workspace
  useEffect(() => {
    if (workspaces.length === 0) load();
  }, [workspaces.length, load]);

  useEffect(() => {
    if (!slug) return;
    const found = workspaces.find((w) => w.slug === slug);
    if (found && found.id !== current?.id) {
      workspacesApi.getWorkspace(found.id).then(setCurrent).catch(() => null);
    }
  }, [slug, workspaces, current?.id, setCurrent]);

  // Load boards
  useEffect(() => {
    if (!current) return;
    setBoardsLoading(true);
    boardsApi.listBoards(current.id)
      .then(setBoards)
      .catch(() => message.error('Не удалось загрузить доски'))
      .finally(() => setBoardsLoading(false));
  }, [current?.id]);

  const onCreateBoard = async (values: { name: string; prefix: string; description?: string }) => {
    if (!current) return;
    setCreating(true);
    try {
      const board = await boardsApi.createBoard(current.id, {
        ...values,
        prefix: values.prefix.toUpperCase(),
      });
      setBoards((prev) => [...prev, board]);
      message.success(`Доска "${board.name}" создана`);
      setCreateOpen(false);
      form.resetFields();
      navigate(`/w/${slug}/boards/${board.id}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      message.error(err?.response?.data?.error ?? 'Не удалось создать доску');
    } finally {
      setCreating(false);
    }
  };

  if (wsLoading || (!current && workspaces.length === 0)) {
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
          <Button onClick={() => navigate('/workspaces')}>Назад</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#03050F', padding: '40px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/workspaces')}
          style={{ color: '#4A5578', padding: 0, marginBottom: 12 }}>
          Workspaces
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Title level={2} style={{ margin: 0, color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 700 }}>
              {current.name}
            </Title>
            {current.description && <Text style={{ color: '#8B95B0' }}>{current.description}</Text>}
          </div>
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#4F6EF7', borderColor: '#4F6EF7' }}
            onClick={() => setCreateOpen(true)}>
            Новая доска
          </Button>
        </div>
      </div>

      {/* Boards */}
      {boardsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}><Spin /></div>
      ) : boards.length === 0 ? (
        <div style={{
          border: '2px dashed #1E2640', borderRadius: 12,
          padding: '64px 24px', textAlign: 'center',
        }}>
          <TableOutlined style={{ fontSize: 32, color: '#4A5578', marginBottom: 12, display: 'block' }} />
          <Text style={{ color: '#4A5578', display: 'block', marginBottom: 16 }}>
            Нет досок. Создайте первую!
          </Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Создать доску
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {boards.map((board) => (
            <BoardCard key={board.id} board={board}
              onClick={() => navigate(`/w/${slug}/boards/${board.id}`)} />
          ))}
        </div>
      )}

      {/* Create board modal */}
      <Modal
        title={<span style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk' }}>Новая доска</span>}
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        footer={null}
        styles={{ content: { background: '#0F1320' }, header: { background: '#0F1320', borderBottom: '1px solid #1E2640' } }}
      >
        <Form form={form} layout="vertical" onFinish={onCreateBoard} style={{ marginTop: 16 }}>
          <Form.Item name="name" label={<span style={{ color: '#8B95B0' }}>Название</span>}
            rules={[{ required: true }, { max: 100 }]}>
            <Input placeholder="Frontend, Backend, Design..." size="large" />
          </Form.Item>
          <Form.Item name="prefix" label={<span style={{ color: '#8B95B0' }}>Префикс задач</span>}
            rules={[
              { required: true },
              { pattern: /^[A-Z0-9]+$/i, message: 'Только буквы и цифры' },
              { min: 2 }, { max: 8 },
            ]}>
            <Input placeholder="DEV, OPS, FRONT..." size="large"
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => form.setFieldValue('prefix', e.target.value.toUpperCase())} />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ color: '#8B95B0' }}>Описание</span>}>
            <Input.TextArea placeholder="Описание доски (необязательно)" rows={2} />
          </Form.Item>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => { setCreateOpen(false); form.resetFields(); }}>Отмена</Button>
            <Button type="primary" htmlType="submit" loading={creating}>Создать</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}

function BoardCard({ board, onClick }: { board: Board; onClick: () => void }) {
  const taskCount = board._count?.tasks ?? 0;
  const statuses = board.workflow?.statuses ?? [];

  return (
    <Card hoverable onClick={onClick}
      style={{ background: '#0F1320', border: '1px solid #1E2640', cursor: 'pointer' }}
      styles={{ body: { padding: '20px 24px' } }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 600 }}>
            {board.name}
          </Text>
          <Tag style={{
            marginLeft: 8, background: '#4F6EF722', border: '1px solid #4F6EF744',
            color: '#4F6EF7', fontSize: 10, fontFamily: 'monospace',
          }}>
            {board.prefix}
          </Tag>
        </div>
      </div>

      {board.description && (
        <Text style={{ color: '#8B95B0', fontSize: 12, display: 'block', marginBottom: 12 }}>
          {board.description}
        </Text>
      )}

      {/* Workflow statuses */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
        {statuses.map((s) => (
          <Tooltip key={s.id} title={s.name}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: s.color,
              display: 'inline-block', cursor: 'default',
            }} />
          </Tooltip>
        ))}
      </div>

      <Text style={{ color: '#4A5578', fontSize: 12 }}>
        {taskCount} {taskCount === 1 ? 'задача' : taskCount < 5 ? 'задачи' : 'задач'}
      </Text>
    </Card>
  );
}
