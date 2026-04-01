import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import { useAuthStore } from './store/auth.store';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import WorkspacesPage from './pages/WorkspacesPage';
import WorkspaceDashboardPage from './pages/WorkspaceDashboardPage';
import BoardPage from './pages/BoardPage';
import MyTasksPage from './pages/MyTasksPage';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#03050F' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  const user = useAuthStore((s) => s.user);

  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4F6EF7',
          colorBgContainer: '#0F1320',
          colorBgElevated: '#161C30',
          colorBgBase: '#03050F',
          colorText: '#E2E8F8',
          colorTextSecondary: '#8B95B0',
          colorBorder: '#1E2640',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/workspaces" replace /> : <LoginPage />} />
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<PrivateRoute><WorkspacesPage /></PrivateRoute>} />
          <Route path="/w/:slug" element={<PrivateRoute><WorkspaceDashboardPage /></PrivateRoute>} />
          <Route path="/w/:slug/boards/:boardId" element={<PrivateRoute><BoardPage /></PrivateRoute>} />
          <Route path="/w/:slug/settings" element={<PrivateRoute><WorkspaceSettingsPage /></PrivateRoute>} />
          <Route path="/my-tasks" element={<PrivateRoute><MyTasksPage /></PrivateRoute>} />
          {/* Legacy — kept for now */}
          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
