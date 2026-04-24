import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';

type C = Record<string, string>;
const DARK: C = { bg: '#03050F', title: '#E2E8F8', sub: '#8B95B0', btnBg: '#1C2236', btnBorder: '#2A3456', btnText: '#E2E8F8' };
const LIGHT: C = { bg: '#F5F3FF', title: '#1A1A2E', sub: '#6B7194', btnBg: '#FDFCFF', btnBorder: '#E8E5F0', btnText: '#1A1A2E' };

export default function HomePage() {
  const user = useAuthStore(s => s.user);
  const logout = useAuthStore(s => s.logout);
  const mode = useThemeStore(s => s.mode);
  const c = mode === 'dark' ? DARK : LIGHT;

  return (
    <div style={{ padding: 40, background: c.bg, minHeight: '100vh' }}>
      <h2 style={{
        fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 24, fontWeight: 700,
        color: c.title, margin: '0 0 8px',
      }}>
        FlowTask
      </h2>
      <span style={{
        fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14,
        color: c.sub, display: 'block', marginBottom: 24,
      }}>
        Добро пожаловать, {user?.name?.trim().split(/\s+/)[0] ?? 'пользователь'}!
      </span>
      <button
        onClick={logout}
        style={{
          background: c.btnBg, border: `1px solid ${c.btnBorder}`, borderRadius: 8,
          padding: '7px 16px', cursor: 'pointer',
          fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, color: c.btnText,
        }}
      >
        Выйти
      </button>
    </div>
  );
}
