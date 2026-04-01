import { useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Avatar, Button, Dropdown, Select, Typography, Tooltip } from 'antd';
import {
  LogoutOutlined, SettingOutlined, CheckCircleOutlined,
  AppstoreOutlined, PlusOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../store/auth.store';
import { useWorkspaceStore } from '../store/workspace.store';

const { Text } = Typography;

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { workspaces, current, load, setCurrent } = useWorkspaceStore();

  useEffect(() => {
    if (workspaces.length === 0) load();
  }, [workspaces.length, load]);

  // Sync current workspace from URL slug
  const slugMatch = location.pathname.match(/^\/w\/([^/]+)/);
  const urlSlug = slugMatch?.[1];
  useEffect(() => {
    if (urlSlug && workspaces.length > 0) {
      const found = workspaces.find((w) => w.slug === urlSlug);
      if (found && found.id !== current?.id) setCurrent(found);
    }
  }, [urlSlug, workspaces, current?.id, setCurrent]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isMyTasks = location.pathname === '/my-tasks';
  const isWorkspaces = location.pathname === '/workspaces';

  const avatarMenu = {
    items: [
      {
        key: 'profile',
        label: (
          <div style={{ padding: '4px 0' }}>
            <Text style={{ color: '#E2E8F8', display: 'block', fontWeight: 600 }}>{user?.name}</Text>
            <Text style={{ color: '#4A5578', fontSize: 11 }}>{user?.email}</Text>
          </div>
        ),
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'settings',
        icon: <SettingOutlined />,
        label: 'Настройки workspace',
        disabled: !current,
        onClick: () => current && navigate(`/w/${current.slug}/settings`),
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Выйти',
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#03050F' }}>
      {/* Topbar */}
      <div style={{
        height: 52,
        background: '#060914',
        borderBottom: '1px solid #1A2035',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 12,
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <Link to="/workspaces" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: 'linear-gradient(135deg, #4F6EF7 0%, #7B5FE8 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, fontFamily: 'Space Grotesk' }}>F</span>
          </div>
          <Text style={{ color: '#E2E8F8', fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 15 }}>
            FlowTask
          </Text>
        </Link>

        <div style={{ width: 1, height: 20, background: '#1E2640', flexShrink: 0 }} />

        {/* Workspace selector */}
        {workspaces.length > 0 && (
          <Select
            value={current?.id ?? undefined}
            placeholder="Выбрать пространство"
            onChange={(id) => {
              const ws = workspaces.find((w) => w.id === id);
              if (ws) { setCurrent(ws); navigate(`/w/${ws.slug}`); }
            }}
            options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
            style={{ minWidth: 160, color: '#E2E8F8' }}
            size="small"
            variant="borderless"
          />
        )}

        {/* Current workspace boards link */}
        {current && (
          <Button
            type="text"
            size="small"
            icon={<AppstoreOutlined />}
            onClick={() => navigate(`/w/${current.slug}`)}
            style={{ color: isWorkspaces ? '#E2E8F8' : '#8B95B0' }}
          >
            Доски
          </Button>
        )}

        {/* New workspace */}
        {workspaces.length === 0 && (
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => navigate('/workspaces')}
            style={{ color: '#4A5578' }}
          >
            Создать пространство
          </Button>
        )}

        <div style={{ flex: 1 }} />

        {/* My Tasks */}
        <Tooltip title="Мои задачи">
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => navigate('/my-tasks')}
            style={{
              color: isMyTasks ? '#4F6EF7' : '#8B95B0',
              background: isMyTasks ? '#4F6EF722' : 'transparent',
              borderRadius: 6,
            }}
          >
            Мои задачи
          </Button>
        </Tooltip>

        <div style={{ width: 1, height: 20, background: '#1E2640', flexShrink: 0 }} />

        {/* Avatar / user menu */}
        <Dropdown menu={avatarMenu} trigger={['click']} placement="bottomRight">
          <Avatar
            size={28}
            src={user?.avatar}
            style={{ background: '#4F6EF7', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}
          >
            {user?.name?.[0]?.toUpperCase()}
          </Avatar>
        </Dropdown>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
