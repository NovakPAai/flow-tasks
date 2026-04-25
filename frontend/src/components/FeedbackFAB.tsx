import { useState } from 'react';
import { useThemeStore } from '../store/theme.store';
import FeedbackModal from './FeedbackModal';

export default function FeedbackFAB() {
  const [open, setOpen]   = useState(false);
  const [hover, setHover] = useState(false);
  const mode = useThemeStore(s => s.mode);
  const isDark = mode !== 'light';

  const bg      = hover ? '#4060E8' : '#4F6EF7';
  const shadow  = isDark
    ? '0 4px 20px rgba(79,110,247,.45)'
    : '0 4px 16px rgba(79,110,247,.35)';

  return (
    <>
      <button
        data-testid="feedback-fab"
        onClick={() => setOpen(true)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Обратная связь"
        aria-label="Оставить обратную связь"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: bg,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: shadow,
          transition: 'background .15s, transform .12s, box-shadow .15s',
          transform: hover ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M17.5 2.5H2.5C2.04 2.5 1.67 2.87 1.67 3.33v10c0 .46.37.84.83.84h3.33v3.33L9.17 14.17h8.33c.46 0 .83-.37.83-.83v-10c0-.46-.37-.84-.83-.84Z"
            stroke="#ffffff"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <line x1="6" y1="7.5" x2="14" y2="7.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="6" y1="10.5" x2="11" y2="10.5" stroke="#ffffff" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
