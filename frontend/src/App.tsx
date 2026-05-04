import { useEffect, useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme, Spin } from 'antd';
import { useAuthStore } from './store/auth.store';
import { useThemeStore } from './store/theme.store';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import AppLayout from './components/AppLayout';
import OnboardingProvider from './components/OnboardingProvider';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import WorkspacesPage from './pages/WorkspacesPage';
import WorkspaceDashboardPage from './pages/WorkspaceDashboardPage';
import BoardPage from './pages/BoardPage';
import MyTasksPage from './pages/MyTasksPage';
import WorkspaceSettingsPage from './pages/WorkspaceSettingsPage';
import BoardSettingsPage from './pages/BoardSettingsPage';
import ProfilePage from './pages/ProfilePage';
import AdminUsersPage from './pages/AdminUsersPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RoadmapsPage from './pages/RoadmapsPage';
import FeedbackFAB from './components/FeedbackFAB';

const WARN_SECONDS = 60;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const mode = useThemeStore((s) => s.mode);
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARN_SECONDS);

  const handleIdle = useCallback(async () => {
    setShowWarning(false);
    try { await logout(); } catch { /* best-effort — navigate regardless */ }
    navigate('/login', { state: { timedOut: true } });
  }, [logout, navigate]);

  const handleWarn = useCallback(() => {
    setShowWarning(true);
    setCountdown(WARN_SECONDS);
  }, []);

  const handleActivityReset = useCallback(() => {
    setShowWarning(false);
  }, []);

  const resetTimer = useIdleTimeout(handleIdle, {
    onWarn: handleWarn,
    onActivityReset: handleActivityReset,
  });

  // Countdown tick while warning modal is open
  useEffect(() => {
    if (!showWarning) return;
    const tick = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(tick);
  }, [showWarning]);

  const handleStay = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  const handleLogoutNow = useCallback(async () => {
    setShowWarning(false);
    try { await logout(); } catch {}
    navigate('/login');
  }, [logout, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: mode === 'light' ? '#F5F3FF' : '#03050F' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <SessionTimeoutModal
        open={showWarning}
        countdown={countdown}
        onStay={handleStay}
        onLogout={handleLogoutNow}
      />
      <OnboardingProvider>
        <AppLayout>{children}</AppLayout>
      </OnboardingProvider>
    </>
  );
}

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser);
  const user = useAuthStore((s) => s.user);
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode !== 'light';

  useEffect(() => { loadUser(); }, [loadUser]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? {
          colorPrimary: '#4F6EF7',
          colorBgContainer: '#0F1320',
          colorBgElevated: '#161C30',
          colorBgBase: '#03050F',
          colorText: '#E2E8F8',
          colorTextSecondary: '#8B95B0',
          colorBorder: '#1E2640',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
        } : {
          colorPrimary: '#4F6EF7',
          colorBgContainer: '#FDFCFF',
          colorBgElevated: '#FFFFFF',
          colorBgBase: '#F5F3FF',
          colorText: '#1A1A2E',
          colorTextSecondary: '#6B7194',
          colorBorder: '#E8E5F0',
          fontFamily: 'Inter, sans-serif',
          borderRadius: 8,
        },
      }}
    >
      <BrowserRouter>
        <FeedbackFAB />
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/workspaces" replace /> : <LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<Navigate to="/workspaces" replace />} />
          <Route path="/workspaces" element={<PrivateRoute><WorkspacesPage /></PrivateRoute>} />
          <Route path="/w/:slug" element={<PrivateRoute><WorkspaceDashboardPage /></PrivateRoute>} />
          <Route path="/w/:slug/boards/:boardSlug" element={<PrivateRoute><BoardPage /></PrivateRoute>} />
          <Route path="/w/:slug/boards/:boardSlug/settings" element={<PrivateRoute><BoardSettingsPage /></PrivateRoute>} />
          <Route path="/w/:slug/roadmaps" element={<PrivateRoute><RoadmapsPage /></PrivateRoute>} />
          <Route path="/w/:slug/settings" element={<PrivateRoute><WorkspaceSettingsPage /></PrivateRoute>} />
          <Route path="/my-tasks" element={<PrivateRoute><MyTasksPage /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminUsersPage /></PrivateRoute>} />
          {/* Legacy — kept for now */}
          <Route path="/home" element={<PrivateRoute><HomePage /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
