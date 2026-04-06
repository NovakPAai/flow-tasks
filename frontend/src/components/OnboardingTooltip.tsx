import { useEffect, useState } from 'react';
import { useThemeStore } from '../store/theme.store';

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  step: number;
  total: number;
  title: string;
  message: string;
  target: string; // CSS selector for the element to spotlight
  onNext: () => void;
  onSkip: () => void;
}

const TOOLTIP_W = 340;
const PAD = 8; // spotlight padding around target

export default function OnboardingTooltip({ step, total, title, message, target, onNext, onSkip }: Props) {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark';
  const [rect, setRect] = useState<TargetRect | null>(null);

  // Poll for target element — it might appear after navigation
  useEffect(() => {
    let raf: number;
    let attempts = 0;

    function update() {
      const el = document.querySelector(target);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else {
        setRect(null);
        // Keep polling for up to 5s (100 × 50ms) in case we just navigated
        if (attempts < 100) {
          attempts++;
          raf = window.setTimeout(update, 50);
        }
      }
    }

    update();

    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);

    return () => {
      window.clearTimeout(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [target]);

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const cardBg      = isDark ? '#0F1320' : '#FDFCFF';
  const cardBorder  = isDark ? '#1C2236' : '#E8E5F0';
  const cardShadow  = isDark ? '0px 20px 60px #00000099' : '0px 20px 60px #1A1A2E1F';
  const title_c     = isDark ? '#E2E8F8' : '#1A1A2E';
  const muted       = isDark ? '#8B95B0' : '#6B7194';
  const trackBg     = isDark ? '#1C2236' : '#E8E5F0';
  const overlayBg   = isDark ? 'rgba(3,5,15,0.75)' : 'rgba(245,243,255,0.82)';

  const pct = ((step + 1) / total) * 100;

  // ── Tooltip card position ────────────────────────────────────────────────
  // If we have a target rect: show card below the spotlight, aligned right.
  // Fallback: fixed bottom-right corner.
  const cardStyle: React.CSSProperties = rect
    ? (() => {
        const spotBottom = rect.top + rect.height + PAD;
        const spotRight  = rect.left + rect.width + PAD;

        // Try to place card below target, aligned to right edge of spotlight
        let top  = spotBottom + 12;
        let left = Math.max(16, spotRight - TOOLTIP_W);

        // If card would overflow bottom — place it above target
        if (top + 280 > window.innerHeight) {
          top = Math.max(16, rect.top - PAD - 280 - 12);
        }
        // Clamp horizontally
        left = Math.min(left, window.innerWidth - TOOLTIP_W - 16);

        return { position: 'fixed' as const, top, left, width: TOOLTIP_W };
      })()
    : { position: 'fixed' as const, right: 24, bottom: 32, width: TOOLTIP_W };

  return (
    <>
      <style>{`
        @keyframes ob-pulse-ring {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(1.12); opacity: 0; }
          100% { transform: scale(1.12); opacity: 0; }
        }
        @keyframes ob-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Overlay / Spotlight ─────────────────────────────────────────────── */}
      {rect ? (
        // Spotlight via box-shadow: the div sits exactly over the target,
        // box-shadow covers everything else with the overlay colour.
        <div
          style={{
            position: 'fixed',
            top:    rect.top  - PAD,
            left:   rect.left - PAD,
            width:  rect.width  + PAD * 2,
            height: rect.height + PAD * 2,
            borderRadius: 10,
            boxShadow: `0 0 0 9999px ${overlayBg}`,
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {/* Pulse ring 1 */}
          <div style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 16,
            border: '2px solid #4F6EF7',
            animation: 'ob-pulse-ring 2s ease-out infinite',
            pointerEvents: 'none',
          }} />
          {/* Pulse ring 2 */}
          <div style={{
            position: 'absolute',
            inset: -16,
            borderRadius: 22,
            border: '1.5px solid #4F6EF7',
            animation: 'ob-pulse-ring 2s ease-out infinite 0.35s',
            pointerEvents: 'none',
          }} />
        </div>
      ) : (
        // Fallback: full-screen backdrop when element not found yet
        <div style={{
          position: 'fixed', inset: 0,
          background: overlayBg,
          zIndex: 1000,
          pointerEvents: 'none',
        }} />
      )}

      {/* ── Tooltip card ─────────────────────────────────────────────────── */}
      <div style={{
        ...cardStyle,
        zIndex: 1002,
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 14,
        padding: '20px',
        boxShadow: cardShadow,
        animation: 'ob-in 0.2s ease',
      }}>
        {/* Header: step badge + skip */}
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
            Пропустить всё
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
          fontSize: 16, fontWeight: 700, color: title_c,
          fontFamily: '"Space Grotesk",system-ui,sans-serif',
          marginBottom: 8, lineHeight: '20px',
        }}>
          {title}
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
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: i === step ? '#4F6EF7' : (isDark ? '#1C2236' : '#E8E5F0'),
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
