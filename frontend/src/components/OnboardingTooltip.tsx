import { useThemeStore } from '../store/theme.store';

interface Props {
  step: number;
  total: number;
  message: string;
  hint: string;
  onNext: () => void;
  onSkip: () => void;
}

export default function OnboardingTooltip({ step, total, message, hint, onNext, onSkip }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';

  const cardBg      = isDark ? '#0F1320' : '#FDFCFF';
  const cardBorder  = isDark ? '#1C2236' : '#E8E5F0';
  const cardShadow  = isDark ? '0px 20px 60px #00000099' : '0px 20px 60px #1A1A2E1F';
  const trackBg     = isDark ? '#1C2236' : '#E8E5F0';
  const title       = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted       = isDark ? '#8B95B0' : '#6B7194';
  const caretBorder = isDark ? '#1C2236' : '#E8E5F0';
  const dotInactive = isDark ? '#1C2236' : '#E8E5F0';

  const pct = ((step + 1) / total) * 100;

  return (
    <>
      <style>{`
        @keyframes ob-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(79,110,247,0.5); }
          50%      { box-shadow: 0 0 0 8px rgba(79,110,247,0); }
        }
        @keyframes ob-in {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0,
        background: isDark ? 'rgba(3,5,15,0.72)' : 'rgba(245,243,255,0.80)',
        zIndex: 1000, pointerEvents: 'none',
      }} />

      {/* Tooltip card — bottom right */}
      <div style={{
        position: 'fixed', right: 24, bottom: 32,
        width: 340, zIndex: 1001,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 14,
        padding: '20px',
        boxShadow: cardShadow,
        animation: 'ob-in 0.2s ease',
      }}>
        {/* Caret arrow (top-right) */}
        <div style={{
          position: 'absolute', right: 50, top: -8,
          width: 16, height: 16,
          background: cardBg,
          borderLeft: `1px solid ${caretBorder}`,
          borderTop: `1px solid ${caretBorder}`,
          rotate: '45deg',
          transformOrigin: '0% 0%',
        }} />

        {/* Header: step badge + title + skip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: '50%',
              background: '#4F6EF7', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', fontFamily: '"Inter",system-ui,sans-serif' }}>
                {step + 1}
              </span>
            </div>
            <span style={{ fontSize: 11, color: muted, fontFamily: '"Inter",system-ui,sans-serif' }}>
              Шаг {step + 1} из {total}
            </span>
          </div>
          <button
            onClick={onSkip}
            style={{ fontSize: 11, color: muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif', padding: '2px 4px' }}
          >
            Пропустить
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: trackBg, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${pct}%`,
            background: '#4F6EF7', borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Title */}
        <div style={{
          fontSize: 16, fontWeight: 700, color: title,
          fontFamily: '"Space Grotesk",system-ui,sans-serif',
          marginBottom: 8, lineHeight: '20px',
        }}>
          {hint}
        </div>

        {/* Body */}
        <div style={{
          fontSize: 13, color: muted, lineHeight: '1.6',
          fontFamily: '"Inter",system-ui,sans-serif',
          marginBottom: 20,
        }}>
          {message}
        </div>

        {/* Footer: dots + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: i === step ? '#4F6EF7' : dotInactive,
                  animation: i === step ? 'ob-pulse 2s infinite' : 'none',
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step > 0 && (
              <button
                onClick={onSkip}
                style={{ fontSize: 13, color: muted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: '"Inter",system-ui,sans-serif' }}
              >
                Назад
              </button>
            )}
            <button
              onClick={onNext}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: '#4F6EF7', border: 'none',
                color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: '"Inter",system-ui,sans-serif',
              }}
            >
              {step + 1 < total ? 'Далее →' : 'Готово ✓'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
