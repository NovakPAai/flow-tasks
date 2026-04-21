import { useState, useEffect } from 'react';
import { message, Modal, Form, Input, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import * as authApi from '../api/auth';
import api from '../api/client';

// ─── Design tokens (from Paper: artboards 2-0 dark, 3-0 light) ───────────────
type LoginTheme = Record<string, string>;
const DARK_C: LoginTheme = {
  rootBg:       '#03050F',
  panelBg:      '#0F1320',
  logoText:     '#E2E8F8',
  title:        '#E2E8F8',
  subtitle:     '#8B949E',
  label:        '#C9D1D9',
  inputBg:      '#161B22',
  inputBorder:  '#30363D',
  inputIcon:    '#484F58',
  inputPh:      '#3D4D6B',
  inputText:    '#E2E8F8',
  accent:       '#4F6EF7',
  footer:       '#484F58',
  heroTitle:    '#FFFFFF',
  heroSub:      '#7C6FA8',
} as const;

const LIGHT_C: LoginTheme = {
  rootBg:       '#F5F3FF',
  panelBg:      '#FFFFFF',
  logoText:     '#1A1A2E',
  title:        '#1A1A2E',
  subtitle:     '#6B7194',
  label:        '#374151',
  inputBg:      '#F9FAFB',
  inputBorder:  '#E8E5F0',
  inputIcon:    '#9CA3AF',
  inputPh:      '#9CA3AF',
  inputText:    '#1A1A2E',
  accent:       '#4F6EF7',
  footer:       '#C4C9D4',
  heroTitle:    '#2D1B69',
  heroSub:      '#7C6FA8',
} as const;

const LOGO_GRAD = 'linear-gradient(in oklab 135deg, oklab(59.3% -0.002 -0.207) 0%, oklab(50.3% -.0006 -0.200) 100%)';

// ─── Orbital SVG panels (exact from Paper) ───────────────────────────────────
function DarkPanel() {
  return (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <svg viewBox="0 0 840 900" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ld0" cx="55%" cy="43%" r="75%">
            <stop offset="0%" stopColor="#14082E"/><stop offset="40%" stopColor="#0A0518"/><stop offset="100%" stopColor="#03020C"/>
          </radialGradient>
          <radialGradient id="ld1" cx="55%" cy="43%" r="55%">
            <stop offset="0%" stopColor="#5B21B6" stopOpacity="0.45"/>
            <stop offset="30%" stopColor="#4C1D95" stopOpacity="0.25"/>
            <stop offset="60%" stopColor="#2D1B69" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="#03020C" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ld2" cx="85%" cy="70%" r="45%">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.20"/>
            <stop offset="60%" stopColor="#1E3A8A" stopOpacity="0.05"/>
            <stop offset="100%" stopColor="#03020C" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ld3" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#A78BFA"/><stop offset="25%" stopColor="#7C3AED"/>
            <stop offset="55%" stopColor="#4C1D95"/><stop offset="80%" stopColor="#1E0759"/><stop offset="100%" stopColor="#0D0330"/>
          </radialGradient>
          <radialGradient id="ld4" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#7C3AED" stopOpacity="0"/>
            <stop offset="85%" stopColor="#8B5CF6" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="840" height="900" fill="url(#ld0)"/>
        <rect width="840" height="900" fill="url(#ld1)"/>
        <rect width="840" height="900" fill="url(#ld2)"/>
        {/* Stars */}
        <circle cx="55" cy="45" r="1.5" fill="#FFFFFF" opacity="0.85"/>
        <circle cx="180" cy="28" r="1.2" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="340" cy="52" r="1.4" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="620" cy="35" r="1.5" fill="#FFFFFF" opacity="0.75"/>
        <circle cx="720" cy="70" r="1.2" fill="#FFFFFF" opacity="0.9"/>
        <circle cx="790" cy="25" r="1" fill="#FFFFFF" opacity="0.8"/>
        <circle cx="820" cy="110" r="1.3" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="30" cy="160" r="1.1" fill="#FFFFFF" opacity="0.65"/>
        <circle cx="118" cy="215" r="1.4" fill="#C4B5FD" opacity="0.8"/>
        <circle cx="775" cy="195" r="1.2" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="835" cy="280" r="1" fill="#FFFFFF" opacity="0.75"/>
        <circle cx="62" cy="740" r="1.3" fill="#FFFFFF" opacity="0.6"/>
        <circle cx="195" cy="780" r="1.1" fill="#A5B4FC" opacity="0.7"/>
        <circle cx="760" cy="750" r="1.2" fill="#FFFFFF" opacity="0.65"/>
        <circle cx="820" cy="810" r="1" fill="#FFFFFF" opacity="0.7"/>
        <circle cx="40" cy="330" r="1" fill="#FFFFFF" opacity="0.5"/>
        <circle cx="805" cy="380" r="0.9" fill="#FFFFFF" opacity="0.55"/>
        <circle cx="830" cy="450" r="1" fill="#C4B5FD" opacity="0.45"/>
        {/* Crosshair */}
        <line x1="55" y1="41" x2="55" y2="49" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.5"/>
        <line x1="51" y1="45" x2="59" y2="45" stroke="#FFFFFF" strokeWidth="0.7" opacity="0.5"/>
        <line x1="720" y1="66" x2="720" y2="74" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.45"/>
        <line x1="716" y1="70" x2="724" y2="70" stroke="#FFFFFF" strokeWidth="0.6" opacity="0.45"/>
        {/* Orbital planet */}
        <circle cx="470" cy="385" r="115" fill="url(#ld4)"/>
        <circle cx="470" cy="385" r="88" fill="url(#ld3)"/>
        <ellipse cx="470" cy="372" rx="88" ry="12" fill="#FFFFFF08"/>
        <ellipse cx="470" cy="398" rx="88" ry="8" fill="#FFFFFF05"/>
        <circle cx="470" cy="385" r="88" fill="none" stroke="#A78BFA4D" strokeWidth="2"/>
        <circle cx="470" cy="385" r="140" fill="none" stroke="#7C3AED59"/>
        <circle cx="470" cy="385" r="210" fill="none" stroke="#6D28D940"/>
        <circle cx="470" cy="385" r="295" fill="none" stroke="#5B21B62E"/>
        <circle cx="470" cy="385" r="390" fill="none" stroke="#4C1D951F"/>
        {/* Orbital dots */}
        <circle cx="569" cy="286" r="4" fill="#A78BFA" opacity="0.9"/>
        <circle cx="569" cy="286" r="7" fill="#7C3AED" opacity="0.2"/>
        <circle cx="422" cy="516" r="3.5" fill="#C4B5FD" opacity="0.85"/>
        <circle cx="371" cy="286" r="4" fill="#DDD6FE" opacity="0.8"/>
        <circle cx="542" cy="188" r="4.5" fill="#8B5CF6" opacity="0.9"/>
        <circle cx="667" cy="457" r="3.5" fill="#A78BFA" opacity="0.8"/>
        <circle cx="288" cy="490" r="4" fill="#C4B5FD" opacity="0.85"/>
        <circle cx="737" cy="261" r="4" fill="#7C3AED" opacity="0.85"/>
        <circle cx="175" cy="385" r="4.5" fill="#A78BFA" opacity="0.8"/>
        <line x1="155" y1="118" x2="205" y2="138" stroke="#FFFFFF" opacity="0.3"/>
        <circle cx="155" cy="118" r="1.5" fill="#FFFFFF" opacity="0.55"/>
      </svg>
      <div style={{ bottom: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, left: 0, paddingBlock: '52px', paddingInline: '56px', position: 'absolute', right: 0 }}>
        <div style={{ color: '#FFFFFF', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'pre-wrap' }}>
          {'Flow\nTask'}
        </div>
        <div style={{ color: '#7C6FA8', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, lineHeight: '150%', maxWidth: 340 }}>
          Лёгкий трекер задач для вашей команды
        </div>
      </div>
    </div>
  );
}

function LightPanel() {
  return (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <svg viewBox="0 0 840 900" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ll0" cx="55%" cy="43%" r="75%">
            <stop offset="0%" stopColor="#EDE9FE"/><stop offset="40%" stopColor="#F5F3FF"/><stop offset="100%" stopColor="#FDFCFF"/>
          </radialGradient>
          <radialGradient id="ll1" cx="55%" cy="43%" r="55%">
            <stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.35"/>
            <stop offset="30%" stopColor="#A78BFA" stopOpacity="0.18"/>
            <stop offset="60%" stopColor="#DDD6FE" stopOpacity="0.08"/>
            <stop offset="100%" stopColor="#FDFCFF" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ll2" cx="85%" cy="70%" r="45%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.15"/>
            <stop offset="60%" stopColor="#FDE68A" stopOpacity="0.04"/>
            <stop offset="100%" stopColor="#FDFCFF" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ll3" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#C4B5FD"/><stop offset="25%" stopColor="#8B5CF6"/>
            <stop offset="55%" stopColor="#6D28D9"/><stop offset="80%" stopColor="#4C1D95"/><stop offset="100%" stopColor="#3B0764"/>
          </radialGradient>
          <radialGradient id="ll4" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="#8B5CF6" stopOpacity="0"/>
            <stop offset="85%" stopColor="#A78BFA" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="840" height="900" fill="url(#ll0)"/>
        <rect width="840" height="900" fill="url(#ll1)"/>
        <rect width="840" height="900" fill="url(#ll2)"/>
        {/* Stars (lavender tint) */}
        <circle cx="55" cy="45" r="1.5" fill="#A78BFA" opacity="0.5"/>
        <circle cx="180" cy="28" r="1.2" fill="#C4B5FD" opacity="0.45"/>
        <circle cx="340" cy="52" r="1.4" fill="#A78BFA" opacity="0.4"/>
        <circle cx="620" cy="35" r="1.5" fill="#DDD6FE" opacity="0.55"/>
        <circle cx="720" cy="70" r="1.2" fill="#A78BFA" opacity="0.5"/>
        <circle cx="790" cy="25" r="1" fill="#C4B5FD" opacity="0.45"/>
        <circle cx="820" cy="110" r="1.3" fill="#A78BFA" opacity="0.4"/>
        <circle cx="30" cy="160" r="1.1" fill="#DDD6FE" opacity="0.4"/>
        <circle cx="118" cy="215" r="1.4" fill="#A78BFA" opacity="0.45"/>
        <circle cx="775" cy="195" r="1.2" fill="#C4B5FD" opacity="0.4"/>
        <circle cx="40" cy="330" r="1" fill="#A78BFA" opacity="0.35"/>
        <circle cx="805" cy="380" r="0.9" fill="#C4B5FD" opacity="0.35"/>
        <circle cx="310" cy="820" r="1.4" fill="#F472B6" opacity="0.4"/>
        <circle cx="665" cy="47" r="3.5" fill="#6EE7B7" opacity="0.35"/>
        {/* Crosshair */}
        <line x1="55" y1="41" x2="55" y2="49" stroke="#A78BFA" strokeWidth="0.7" opacity="0.3"/>
        <line x1="51" y1="45" x2="59" y2="45" stroke="#A78BFA" strokeWidth="0.7" opacity="0.3"/>
        {/* Orbital planet */}
        <circle cx="470" cy="385" r="115" fill="url(#ll4)"/>
        <circle cx="470" cy="385" r="88" fill="url(#ll3)"/>
        <ellipse cx="470" cy="372" rx="88" ry="12" fill="#FFFFFF18"/>
        <ellipse cx="470" cy="398" rx="88" ry="8" fill="#FFFFFF10"/>
        <circle cx="470" cy="385" r="88" fill="none" stroke="#A78BFA60" strokeWidth="1.5"/>
        <circle cx="470" cy="385" r="140" fill="none" stroke="#8B5CF640"/>
        <circle cx="470" cy="385" r="210" fill="none" stroke="#7C3AED2E"/>
        <circle cx="470" cy="385" r="295" fill="none" stroke="#6D28D920"/>
        <circle cx="470" cy="385" r="390" fill="none" stroke="#5B21B614"/>
        {/* Orbital dots */}
        <circle cx="569" cy="286" r="4" fill="#8B5CF6" opacity="0.7"/>
        <circle cx="569" cy="286" r="7" fill="#7C3AED" opacity="0.12"/>
        <circle cx="422" cy="516" r="3.5" fill="#A78BFA" opacity="0.65"/>
        <circle cx="371" cy="286" r="4" fill="#C4B5FD" opacity="0.6"/>
        <circle cx="542" cy="188" r="4.5" fill="#7C3AED" opacity="0.55"/>
        <circle cx="667" cy="457" r="3.5" fill="#8B5CF6" opacity="0.6"/>
        <circle cx="288" cy="490" r="4" fill="#A78BFA" opacity="0.55"/>
        <circle cx="737" cy="261" r="4" fill="#6D28D9" opacity="0.5"/>
        <circle cx="175" cy="385" r="4.5" fill="#8B5CF6" opacity="0.55"/>
        <line x1="155" y1="118" x2="205" y2="138" stroke="#A78BFA" opacity="0.2"/>
        <circle cx="155" cy="118" r="1.5" fill="#A78BFA" opacity="0.4"/>
      </svg>
      <div style={{ bottom: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, left: 0, paddingBlock: '52px', paddingInline: '56px', position: 'absolute', right: 0 }}>
        <div style={{ color: '#2D1B69', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'pre-wrap' }}>
          {'Flow\nTask'}
        </div>
        <div style={{ color: '#7C6FA8', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, lineHeight: '150%', maxWidth: 340 }}>
          Лёгкий трекер задач для вашей команды
        </div>
      </div>
    </div>
  );
}

// ─── Logo icon (4 squares grid) ──────────────────────────────────────────────
function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="#FFFFFF"/>
    </svg>
  );
}

// ─── Input field (with focus state + icon + optional eye toggle) ──────────────
function InputField({
  type, value, onChange, placeholder, autoComplete,
  icon, C, showPasswordToggle,
}: {
  type: string; value: string; onChange: (v: string) => void;
  placeholder: string; autoComplete?: string;
  icon: 'email' | 'lock'; C: LoginTheme; showPasswordToggle?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const actualType = type === 'password' && showPwd ? 'text' : type;

  return (
    <div style={{
      alignItems: 'center', display: 'flex', gap: 8,
      backgroundColor: C.inputBg,
      border: `${focused ? '1.5px' : '1px'} solid ${focused ? C.accent : C.inputBorder}`,
      boxShadow: focused ? `${C.accent}1A 0px 0px 0px 3px` : 'none',
      borderRadius: 8, paddingBlock: '11px', paddingInline: '14px',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }}>
      {icon === 'email' ? (
        <svg width="14" height="14" fill="none" stroke={C.inputIcon} strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" stroke={C.inputIcon} strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      )}
      <input
        type={actualType} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder} autoComplete={autoComplete}
        style={{
          flex: 1, background: 'none', border: 'none', outline: 'none',
          color: value ? C.inputText : C.inputPh,
          fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '16px',
        }}
      />
      {showPasswordToggle && (
        <svg width="14" height="14" fill="none" stroke={C.inputIcon} strokeWidth="1.5" viewBox="0 0 24 24"
          style={{ flexShrink: 0, cursor: 'pointer' }} onClick={() => setShowPwd(v => !v)}>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { mode } = useThemeStore();
  const C = mode === 'light' ? LIGHT_C : DARK_C;
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';

  // Existing logic — preserved as-is
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailPrefix, setEmailPrefix] = useState('');
  const [registrationDomain, setRegistrationDomain] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const { login, register } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    authApi.getRegistrationDomain().then(setRegistrationDomain).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (showRegister) {
        const registerEmail = registrationDomain ? `${emailPrefix}@${registrationDomain}` : email;
        const msg = await register(registerEmail, password, name);
        message.success(msg);
        setShowRegister(false);
        setEmail('');
        setEmailPrefix('');
        setPassword('');
        setName('');
      } else {
        await login(email, password);
        navigate('/');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      message.error(error.response?.data?.error || (showRegister ? 'Ошибка регистрации' : 'Неверный email или пароль'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: C.rootBg, display: 'flex',
      fontSynthesis: 'none', MozOsxFontSmoothing: 'grayscale', overflow: 'hidden',
      WebkitFontSmoothing: 'antialiased',
      position: 'fixed', inset: 0,
    }}>
      {/* ── Left panel ── */}
      <div style={{
        alignItems: 'center', backgroundColor: C.panelBg,
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        height: '100%', justifyContent: 'center',
        padding: isMobile ? '40px 24px' : bp === 'tablet' ? '48px 40px' : '60px',
        position: 'relative',
        width: bp === 'desktop' ? '600px' : bp === 'tablet' ? '480px' : '100%',
      }}>
        {/* Logo */}
        <div style={{ alignItems: 'center', display: 'flex', gap: 12, marginBottom: 48 }}>
          <div style={{
            alignItems: 'center', backgroundImage: LOGO_GRAD,
            borderRadius: 10, display: 'flex', flexShrink: 0,
            height: 40, justifyContent: 'center', width: 40,
          }}>
            <LogoIcon/>
          </div>
          <div style={{
            color: C.logoText, flexShrink: 0,
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: 22, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: '28px',
          }}>
            FlowTask
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ boxSizing: 'border-box', maxWidth: 400, width: '100%' }}>
          <div style={{
            color: C.title, fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: '32px',
            marginBottom: 6, textAlign: 'center',
          }}>
            {showRegister ? 'Регистрация' : 'Добро пожаловать'}
          </div>
          <div style={{
            color: C.subtitle, fontFamily: '"Inter", system-ui, sans-serif',
            fontSize: 14, lineHeight: '18px', marginBottom: 32, textAlign: 'center',
          }}>
            {showRegister ? 'Создайте аккаунт FlowTask' : 'Войдите в свой аккаунт FlowTask'}
          </div>

          {/* Name field (register only) */}
          {showRegister && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
                Имя
              </div>
              <InputField type="text" value={name} onChange={setName} placeholder="Иван Петров" autoComplete="name" icon="email" C={C}/>
            </div>
          )}

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
              Email
            </div>
            {showRegister && registrationDomain ? (
              <div style={{
                display: 'flex', alignItems: 'center',
                backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`,
                borderRadius: 8, overflow: 'hidden',
              }}>
                <input
                  value={emailPrefix}
                  onChange={e => setEmailPrefix(e.target.value)}
                  placeholder="ivan.petrov"
                  autoComplete="email"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    padding: '11px 14px', fontFamily: '"Inter", system-ui, sans-serif',
                    fontSize: 14, color: C.inputText,
                  }}
                />
                <span style={{
                  padding: '11px 14px 11px 0', fontFamily: '"Inter", system-ui, sans-serif',
                  fontSize: 14, color: C.inputIcon, whiteSpace: 'nowrap', userSelect: 'none',
                }}>
                  @{registrationDomain}
                </span>
              </div>
            ) : (
              <InputField type="email" value={email} onChange={setEmail} placeholder="ivan@company.ru" autoComplete="email" icon="email" C={C}/>
            )}
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px' }}>
                Пароль
              </div>
              {!showRegister && (
                <div
                  onClick={() => { setForgotOpen(true); setForgotDone(false); setForgotEmail(email || emailPrefix ? `${emailPrefix}@${registrationDomain}` : ''); }}
                  style={{ color: C.accent, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, lineHeight: '16px', cursor: 'pointer' }}
                >
                  Забыли пароль?
                </div>
              )}
            </div>
            <InputField type="password" value={password} onChange={setPassword} placeholder="••••••••"
              autoComplete={showRegister ? 'new-password' : 'current-password'} icon="lock" C={C} showPasswordToggle/>
          </div>

          {/* Submit button */}
          <button type="submit" disabled={loading} style={{
            backgroundImage: LOGO_GRAD, borderRadius: 8, border: 'none',
            boxSizing: 'border-box', cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1, paddingBlock: '13px', paddingInline: '13px',
            width: '100%', marginBottom: 20, transition: 'opacity 0.15s',
          }}>
            <div style={{
              color: '#FFFFFF', fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '18px', textAlign: 'center',
            }}>
              {loading ? '...' : showRegister ? 'Зарегистрироваться' : 'Войти'}
            </div>
          </button>

          {/* Toggle login/register */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: C.subtitle, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13 }}>
              {showRegister ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
            </span>
            <span onClick={() => setShowRegister(v => !v)} style={{
              color: C.accent, fontFamily: '"Inter", system-ui, sans-serif',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              {showRegister ? 'Войти' : 'Зарегистрироваться'}
            </span>
          </div>
        </form>

        {/* Footer */}
        <div style={{
          bottom: 32, boxSizing: 'border-box', color: C.footer,
          fontFamily: '"Inter", system-ui, sans-serif', fontSize: 11,
          lineHeight: '14px', position: 'absolute', textAlign: 'center',
        }}>
          FlowTask · © 2026
        </div>
      </div>

      {/* ── Right orbital panel — desktop only ── */}
      {bp === 'desktop' && (mode === 'light' ? <LightPanel/> : <DarkPanel/>)}

      {/* ── Forgot password modal ── */}
      <Modal
        open={forgotOpen}
        onCancel={() => setForgotOpen(false)}
        footer={null}
        title="Сброс пароля"
        width={400}
      >
        {forgotDone ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 14, color: '#52c41a', marginBottom: 8 }}>✓ Ссылка отправлена</div>
            <div style={{ fontSize: 13, color: '#666' }}>
              Если аккаунт с таким email существует, вы получите ссылку для сброса пароля в консоли сервера (dev) или на почту (prod).
            </div>
          </div>
        ) : (
          <Form layout="vertical" onFinish={async (values: { email: string }) => {
            setForgotLoading(true);
            try {
              await api.post('/auth/forgot-password', { email: values.email });
              setForgotDone(true);
            } catch {
              message.error('Не удалось отправить запрос. Попробуйте позже.');
            } finally {
              setForgotLoading(false);
            }
          }}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Введите email' }, { type: 'email', message: 'Некорректный email' }]}
              initialValue={forgotEmail}>
              <Input placeholder="your@email.com" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={forgotLoading} block>
                Отправить ссылку
              </Button>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
