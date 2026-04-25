import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import FeedbackModal from './FeedbackModal';

// z-index below Ant Design modal (1000) but above topbar (100) and dropdowns (200)
const Z_FAB = 300;

export default function FeedbackFAB() {
  const [open, setOpen] = useState(false);
  const mode = useThemeStore(s => s.mode);
  const user = useAuthStore(s => s.user);
  const isDark = mode !== 'light';

  // Only show for authenticated users — unauthenticated pages don't have a user session
  if (!user) return null;

  const shadow = isDark
    ? '0 4px 20px rgba(79,110,247,.45)'
    : '0 4px 16px rgba(79,110,247,.35)';

  return (
    <>
      <button
        data-testid="feedback-fab"
        onClick={() => setOpen(true)}
        title="Обратная связь"
        aria-label="Оставить обратную связь"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: Z_FAB,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#4F6EF7',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: shadow,
          transition: 'filter .15s, transform .12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.12)';
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.filter = '';
          (e.currentTarget as HTMLButtonElement).style.transform = '';
        }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width="20" height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M17.5 2.5H2.5C2.04 2.5 1.67 2.87 1.67 3.33v10c0 .46.37.84.83.84h3.33v3.33L9.17 14.17h8.33c.46 0 .83-.37.83-.83v-10c0-.46-.37-.84-.83-.84Z"
            stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"
          />
          <line x1="6" y1="7.5" x2="14" y2="7.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="6" y1="10.5" x2="11" y2="10.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
