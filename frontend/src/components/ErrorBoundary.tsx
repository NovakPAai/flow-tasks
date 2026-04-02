import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', background: '#03050F', flexDirection: 'column', gap: 16,
        }}>
          {/* Error icon */}
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontFamily: '"Space Grotesk",system-ui,sans-serif', fontSize: 18, fontWeight: 700,
              color: '#E2E8F8', marginBottom: 6,
            }}>
              Что-то пошло не так
            </div>
            <div style={{
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13,
              color: '#8B95B0', maxWidth: 320,
            }}>
              {this.state.error?.message ?? 'Неизвестная ошибка'}
            </div>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.href = '/';
            }}
            style={{
              background: '#4F6EF7', border: 'none', borderRadius: 8,
              padding: '8px 20px', cursor: 'pointer',
              fontFamily: '"Inter",system-ui,sans-serif', fontSize: 14, fontWeight: 500,
              color: '#fff',
            }}
          >
            На главную
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
