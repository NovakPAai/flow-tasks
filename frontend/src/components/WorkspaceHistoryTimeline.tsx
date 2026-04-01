import { useEffect, useState } from 'react';
import { Timeline, Avatar, Spin, Empty, Typography } from 'antd';
import {
  UserAddOutlined, UserDeleteOutlined, ThunderboltOutlined, DeleteOutlined,
  AppstoreAddOutlined, SettingOutlined, TeamOutlined,
} from '@ant-design/icons';
import type { WorkspaceEvent } from '../types';
import * as workspacesApi from '../api/workspaces';

const { Text } = Typography;

interface Props {
  workspaceId: string;
}

const ACTION_ICON: Record<string, React.ReactNode> = {
  member_added:      <UserAddOutlined style={{ color: '#34D399' }} />,
  member_removed:    <UserDeleteOutlined style={{ color: '#F87171' }} />,
  member_role_changed: <TeamOutlined style={{ color: '#FBBF24' }} />,
  workflow_created:  <ThunderboltOutlined style={{ color: '#4F6EF7' }} />,
  workflow_deleted:  <DeleteOutlined style={{ color: '#F87171' }} />,
  workspace_created: <AppstoreAddOutlined style={{ color: '#4F6EF7' }} />,
  workspace_updated: <SettingOutlined style={{ color: '#8B9DC8' }} />,
  board_created:     <AppstoreAddOutlined style={{ color: '#34D399' }} />,
  board_deleted:     <DeleteOutlined style={{ color: '#F87171' }} />,
};

const ACTION_COLOR: Record<string, string> = {
  member_added:      '#34D399',
  member_removed:    '#F87171',
  workflow_created:  '#4F6EF7',
  workflow_deleted:  '#F87171',
  workspace_created: '#4F6EF7',
  workspace_updated: '#8B9DC8',
  board_created:     '#34D399',
  board_deleted:     '#F87171',
};

function formatMessage(event: WorkspaceEvent): string {
  const meta = event.meta as Record<string, string> | undefined;
  switch (event.action) {
    case 'member_added':
      return `${event.user.name} добавил участника ${meta?.name ?? ''} (${meta?.role ?? ''})`;
    case 'member_removed':
      return `${event.user.name} удалил участника ${meta?.name ?? ''}`;
    case 'member_role_changed':
      return `${event.user.name} изменил роль ${meta?.name ?? ''} на ${meta?.role ?? ''}`;
    case 'workflow_created':
      return `${event.user.name} создал workflow «${meta?.name ?? ''}»`;
    case 'workflow_deleted':
      return `${event.user.name} удалил workflow «${meta?.name ?? ''}»`;
    case 'workspace_created':
      return `${event.user.name} создал рабочее пространство «${meta?.name ?? ''}»`;
    case 'workspace_updated':
      return `${event.user.name} обновил настройки workspace`;
    case 'board_created':
      return `${event.user.name} создал доску «${meta?.name ?? ''}»`;
    case 'board_deleted':
      return `${event.user.name} удалил доску «${meta?.name ?? ''}»`;
    default:
      return `${event.user.name}: ${event.action}`;
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function WorkspaceHistoryTimeline({ workspaceId }: Props) {
  const [events, setEvents] = useState<WorkspaceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    workspacesApi.getWorkspaceHistory(workspaceId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
        <Spin />
      </div>
    );
  }

  if (events.length === 0) {
    return <Empty description="Нет событий" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <Timeline
      style={{ paddingTop: 8 }}
      items={events.map((ev) => ({
        color: ACTION_COLOR[ev.action] ?? '#4A5578',
        dot: ACTION_ICON[ev.action],
        children: (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingBottom: 4 }}>
            <Avatar
              size={24}
              style={{ background: '#4F6EF7', fontSize: 11, flexShrink: 0, marginTop: 2 }}
            >
              {ev.user.name?.[0]?.toUpperCase()}
            </Avatar>
            <div>
              <Text style={{ color: '#C8D0E8', fontSize: 13 }}>{formatMessage(ev)}</Text>
              <br />
              <Text style={{ color: '#4A5578', fontSize: 11 }}>{formatDate(ev.createdAt)}</Text>
            </div>
          </div>
        ),
      }))}
    />
  );
}
