import { useEffect, useCallback, useState, useRef } from 'react';
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

const VISIBILITY_REFRESH_MS = 5 * 60 * 1000; // refresh token+user after 5 min hidden

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const logout = useAuthStore((s) => s.logout);
  const loadUser = useAuthStore((s) => s.loadUser);
  const mode = useThemeStore((s) => s.mode);
  const navigate = useNavigate();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARN_SECONDS);

  const handleIdle = useCallback(() => {
    setShowWarning(false);
    void logout().catch(() => {});
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

  // Refresh access token + user profile when returning to tab after >5 min away
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        const hiddenAt = hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (hiddenAt !== null && Date.now() - hiddenAt >= VISIBILITY_REFRESH_MS) {
          void loadUser().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loadUser]);

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

  const handleLogoutNow = useCallback(() => {
    setShowWarning(false);
    void logout().catch(() => {});
    navigate('/login');
  }, [logout, navigate]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: mode === 'light' ? 'var(--static-background-base)' : 'var(--static-background-base)' }}>
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

  const hasLoadedUser = useRef(false);
  useEffect(() => {
    if (hasLoadedUser.current) return;
    hasLoadedUser.current = true;
    loadUser();
  }, [loadUser]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: 'var(--brand-8)',
          colorBgContainer: 'var(--static-background-lightest)',
          colorBgElevated: 'var(--static-background-darker)',
          colorBgBase: 'var(--static-background-base)',
          colorText: 'var(--static-text-neutral-primary)',
          colorTextSecondary: 'var(--static-text-neutral-secondary)',
          colorBorder: 'var(--static-border-neutral-tertiary)',
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
