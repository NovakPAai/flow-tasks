import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

interface Props {
  step: number;
  total: number;
  message: string;
  hint: string;
  onNext: () => void;
  onSkip: () => void;
}

export default function OnboardingTooltip({ step, total, message, hint, onNext, onSkip }: Props) {
  return (
    <>
      {/* Backdrop overlay — subtle darkening */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(3, 5, 15, 0.55)',
          zIndex: 1000,
          pointerEvents: 'none',
        }}
      />

      {/* Tooltip card — bottom center */}
      <div
        style={{
          position: 'fixed',
          bottom: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001,
          background: '#0F1320',
          border: '1px solid #4F6EF7',
          borderRadius: 12,
          padding: '20px 24px',
          width: 380,
          boxShadow: '0 8px 32px rgba(79,110,247,0.25), 0 2px 8px rgba(0,0,0,0.5)',
          animation: 'onboarding-in 0.25s ease',
        }}
      >
        <style>{`
          @keyframes onboarding-in {
            from { opacity: 0; transform: translateX(-50%) translateY(12px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
          }
          @keyframes onboarding-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(79,110,247,0.5); }
            50%       { box-shadow: 0 0 0 8px rgba(79,110,247,0); }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ color: '#4F6EF7', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
            ДОБРО ПОЖАЛОВАТЬ — ШАГ {step + 1}/{total}
          </span>
          <button
            onClick={onSkip}
            style={{
              background: 'none',
              border: 'none',
              color: '#4A5578',
              cursor: 'pointer',
              padding: 4,
              lineHeight: 1,
            }}
          >
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 3,
          background: '#1C2236',
          borderRadius: 2,
          marginBottom: 16,
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${((step + 1) / total) * 100}%`,
            background: 'linear-gradient(90deg, #4F6EF7, #7B9FF7)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Message */}
        <p style={{
          color: '#E2E8F8',
          fontSize: 14,
          lineHeight: 1.6,
          margin: '0 0 8px',
        }}>
          {message}
        </p>

        {/* Hint */}
        <p style={{
          color: '#4F6EF7',
          fontSize: 12,
          margin: '0 0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            display: 'inline-block',
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#4F6EF7',
            animation: 'onboarding-pulse 1.5s infinite',
          }} />
          {hint}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            type="text"
            size="small"
            onClick={onSkip}
            style={{ color: '#4A5578', fontSize: 12 }}
          >
            Пропустить всё
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={onNext}
            style={{
              background: '#4F6EF7',
              border: 'none',
              borderRadius: 6,
              padding: '0 16px',
              height: 32,
              fontSize: 13,
            }}
          >
            {step + 1 < total ? 'Далее →' : 'Готово ✓'}
          </Button>
        </div>
      </div>
    </>
  );
}
