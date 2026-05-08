import { useState, useEffect, useMemo } from 'react';
import { message, Modal, Form, Input, Button } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { useBreakpoint, useResponsiveValue } from '../utils/useBreakpoint';
import * as authApi from '../api/auth';
import api from '../api/client';

// ─── Transliteration: Cyrillic → Latin for email auto-fill ───────────────────
const CYR_MAP: Record<string, string> = {
  а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',
  к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
  х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',
};
function transliterate(s: string): string {
  return s.toLowerCase().split('').map(c => CYR_MAP[c] ?? (/[a-z0-9]/.test(c) ? c : '')).join('');
}
function buildEmailPrefix(first: string, last: string): string {
  const f = transliterate(first.trim());
  const l = transliterate(last.trim());
  if (f && l) return `${f}.${l}`;
  return f || l;
}

// ─── Design tokens (from Paper: artboards 2-0 dark, 3-0 light) ───────────────
type LoginTheme = Record<string, string>;
const DARK_C: LoginTheme = {
  rootBg:       'var(--static-background-base)',
  panelBg:      'var(--static-background-lightest)',
  logoText:     'var(--static-text-neutral-primary)',
  title:        'var(--static-text-neutral-primary)',
  subtitle:     'var(--static-text-neutral-tertiary)',
  label:        'var(--static-text-neutral-secondary)',
  inputBg:      'var(--static-background-light)',
  inputBorder:  'var(--component-border-neutral-medium)',
  inputIcon:    'var(--neutral-8)',
  inputPh:      'var(--neutral-8)',
  inputText:    'var(--static-text-neutral-primary)',
  accent:       'var(--brand-8)',
  footer:       'var(--neutral-8)',
  heroTitle:    'var(--neutral-0)',
  heroSub:      'var(--static-text-neutral-tertiary)',
} as const;

const LIGHT_C: LoginTheme = {
  rootBg:       'var(--static-background-base)',
  panelBg:      'var(--neutral-0)',
  logoText:     'var(--static-text-neutral-primary)',
  title:        'var(--static-text-neutral-primary)',
  subtitle:     'var(--static-text-neutral-tertiary)',
  label:        'var(--static-text-neutral-secondary)',
  inputBg:      'var(--static-background-lightest)',
  inputBorder:  'var(--static-border-neutral-tertiary)',
  inputIcon:    'var(--neutral-8)',
  inputPh:      'var(--neutral-8)',
  inputText:    'var(--static-text-neutral-primary)',
  accent:       'var(--brand-8)',
  footer:       'var(--static-text-neutral-secondary)',
  heroTitle:    'var(--static-text-neutral-primary)',
  heroSub:      'var(--static-text-neutral-tertiary)',
} as const;

// ─── Orbital SVG panels (exact from Paper) ───────────────────────────────────
function DarkPanel() {
  return (
    <div style={{ flex: 1, height: '100%', overflow: 'hidden', position: 'relative', minHeight: '100vh' }}>
      <svg viewBox="0 0 840 900" xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="ld0" cx="55%" cy="43%" r="75%">
            <stop offset="0%" stopColor="var(--neutral-13)"/><stop offset="40%" stopColor="var(--neutral-12)"/><stop offset="100%" stopColor="var(--neutral-13)"/>
          </radialGradient>
          <radialGradient id="ld1" cx="55%" cy="43%" r="55%">
            <stop offset="0%" stopColor="var(--brand-gold-8)" stopOpacity="0.45"/>
            <stop offset="30%" stopColor="var(--brand-gold-9)" stopOpacity="0.25"/>
            <stop offset="60%" stopColor="var(--static-text-neutral-primary)" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="var(--neutral-13)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ld2" cx="85%" cy="70%" r="45%">
            <stop offset="0%" stopColor="var(--info-10)" stopOpacity="0.20"/>
            <stop offset="60%" stopColor="var(--info-10)" stopOpacity="0.05"/>
            <stop offset="100%" stopColor="var(--neutral-13)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ld3" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="var(--brand-gold-7)"/><stop offset="25%" stopColor="var(--brand-gold-9)"/>
            <stop offset="55%" stopColor="var(--brand-gold-9)"/><stop offset="80%" stopColor="var(--brand-gold-10)"/><stop offset="100%" stopColor="var(--brand-gold-11)"/>
          </radialGradient>
          <radialGradient id="ld4" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="var(--brand-gold-9)" stopOpacity="0"/>
            <stop offset="85%" stopColor="var(--brand-gold-8)" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="var(--brand-gold-9)" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="840" height="900" fill="url(#ld0)"/>
        <rect width="840" height="900" fill="url(#ld1)"/>
        <rect width="840" height="900" fill="url(#ld2)"/>
        {/* Stars */}
        <circle cx="55" cy="45" r="1.5" fill="var(--neutral-0)" opacity="0.85"/>
        <circle cx="180" cy="28" r="1.2" fill="var(--neutral-0)" opacity="0.8"/>
        <circle cx="340" cy="52" r="1.4" fill="var(--neutral-0)" opacity="0.7"/>
        <circle cx="620" cy="35" r="1.5" fill="var(--neutral-0)" opacity="0.75"/>
        <circle cx="720" cy="70" r="1.2" fill="var(--neutral-0)" opacity="0.9"/>
        <circle cx="790" cy="25" r="1" fill="var(--neutral-0)" opacity="0.8"/>
        <circle cx="820" cy="110" r="1.3" fill="var(--neutral-0)" opacity="0.7"/>
        <circle cx="30" cy="160" r="1.1" fill="var(--neutral-0)" opacity="0.65"/>
        <circle cx="118" cy="215" r="1.4" fill="var(--brand-gold-6)" opacity="0.8"/>
        <circle cx="775" cy="195" r="1.2" fill="var(--neutral-0)" opacity="0.7"/>
        <circle cx="835" cy="280" r="1" fill="var(--neutral-0)" opacity="0.75"/>
        <circle cx="62" cy="740" r="1.3" fill="var(--neutral-0)" opacity="0.6"/>
        <circle cx="195" cy="780" r="1.1" fill="var(--info-6)" opacity="0.7"/>
        <circle cx="760" cy="750" r="1.2" fill="var(--neutral-0)" opacity="0.65"/>
        <circle cx="820" cy="810" r="1" fill="var(--neutral-0)" opacity="0.7"/>
        <circle cx="40" cy="330" r="1" fill="var(--neutral-0)" opacity="0.5"/>
        <circle cx="805" cy="380" r="0.9" fill="var(--neutral-0)" opacity="0.55"/>
        <circle cx="830" cy="450" r="1" fill="var(--brand-gold-6)" opacity="0.45"/>
        {/* Crosshair */}
        <line x1="55" y1="41" x2="55" y2="49" stroke="var(--neutral-0)" strokeWidth="0.7" opacity="0.5"/>
        <line x1="51" y1="45" x2="59" y2="45" stroke="var(--neutral-0)" strokeWidth="0.7" opacity="0.5"/>
        <line x1="720" y1="66" x2="720" y2="74" stroke="var(--neutral-0)" strokeWidth="0.6" opacity="0.45"/>
        <line x1="716" y1="70" x2="724" y2="70" stroke="var(--neutral-0)" strokeWidth="0.6" opacity="0.45"/>
        {/* Orbital planet */}
        <circle cx="470" cy="385" r="115" fill="url(#ld4)"/>
        <circle cx="470" cy="385" r="88" fill="url(#ld3)"/>
        <ellipse cx="470" cy="372" rx="88" ry="12" fill="var(--neutral-0)" opacity="0.08"/>
        <ellipse cx="470" cy="398" rx="88" ry="8" fill="var(--neutral-0)" opacity="0.05"/>
        <circle cx="470" cy="385" r="88" fill="none" stroke="var(--brand-gold-7)" strokeWidth="2" opacity="0.3"/>
        <circle cx="470" cy="385" r="140" fill="none" stroke="var(--brand-gold-9)" opacity="0.35"/>
        <circle cx="470" cy="385" r="210" fill="none" stroke="var(--brand-gold-8)" opacity="0.25"/>
        <circle cx="470" cy="385" r="295" fill="none" stroke="var(--brand-gold-8)" opacity="0.18"/>
        <circle cx="470" cy="385" r="390" fill="none" stroke="var(--brand-gold-9)" opacity="0.12"/>
        {/* Orbital dots */}
        <circle cx="569" cy="286" r="4" fill="var(--brand-gold-7)" opacity="0.9"/>
        <circle cx="569" cy="286" r="7" fill="var(--brand-gold-9)" opacity="0.2"/>
        <circle cx="422" cy="516" r="3.5" fill="var(--brand-gold-6)" opacity="0.85"/>
        <circle cx="371" cy="286" r="4" fill="var(--brand-gold-4)" opacity="0.8"/>
        <circle cx="542" cy="188" r="4.5" fill="var(--brand-gold-8)" opacity="0.9"/>
        <circle cx="667" cy="457" r="3.5" fill="var(--brand-gold-7)" opacity="0.8"/>
        <circle cx="288" cy="490" r="4" fill="var(--brand-gold-6)" opacity="0.85"/>
        <circle cx="737" cy="261" r="4" fill="var(--brand-gold-9)" opacity="0.85"/>
        <circle cx="175" cy="385" r="4.5" fill="var(--brand-gold-7)" opacity="0.8"/>
        <line x1="155" y1="118" x2="205" y2="138" stroke="var(--neutral-0)" opacity="0.3"/>
        <circle cx="155" cy="118" r="1.5" fill="var(--neutral-0)" opacity="0.55"/>
      </svg>
      <div style={{ bottom: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, left: 0, paddingBlock: '52px', paddingInline: '56px', position: 'absolute', right: 0 }}>
        <div style={{ color: 'var(--neutral-0)', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'pre-wrap' }}>
          {'Flow\nTask'}
        </div>
        <div style={{ color: 'var(--static-text-neutral-tertiary)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, lineHeight: '150%', maxWidth: 340 }}>
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
            <stop offset="0%" stopColor="var(--component-fill-brand-soft-default)"/><stop offset="40%" stopColor="var(--static-background-base)"/><stop offset="100%" stopColor="var(--static-background-lightest)"/>
          </radialGradient>
          <radialGradient id="ll1" cx="55%" cy="43%" r="55%">
            <stop offset="0%" stopColor="var(--brand-gold-6)" stopOpacity="0.35"/>
            <stop offset="30%" stopColor="var(--brand-gold-7)" stopOpacity="0.18"/>
            <stop offset="60%" stopColor="var(--brand-gold-4)" stopOpacity="0.08"/>
            <stop offset="100%" stopColor="var(--static-background-lightest)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ll2" cx="85%" cy="70%" r="45%">
            <stop offset="0%" stopColor="var(--component-border-warning-medium)" stopOpacity="0.15"/>
            <stop offset="60%" stopColor="var(--component-border-warning-medium)" stopOpacity="0.04"/>
            <stop offset="100%" stopColor="var(--static-background-lightest)" stopOpacity="0"/>
          </radialGradient>
          <radialGradient id="ll3" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="var(--brand-gold-6)"/><stop offset="25%" stopColor="var(--brand-gold-8)"/>
            <stop offset="55%" stopColor="var(--brand-gold-8)"/><stop offset="80%" stopColor="var(--brand-gold-9)"/><stop offset="100%" stopColor="var(--brand-gold-12)"/>
          </radialGradient>
          <radialGradient id="ll4" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="var(--brand-gold-8)" stopOpacity="0"/>
            <stop offset="85%" stopColor="var(--brand-gold-7)" stopOpacity="0.25"/>
            <stop offset="100%" stopColor="var(--brand-gold-8)" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="840" height="900" fill="url(#ll0)"/>
        <rect width="840" height="900" fill="url(#ll1)"/>
        <rect width="840" height="900" fill="url(#ll2)"/>
        {/* Stars (lavender tint) */}
        <circle cx="55" cy="45" r="1.5" fill="var(--brand-gold-7)" opacity="0.5"/>
        <circle cx="180" cy="28" r="1.2" fill="var(--brand-gold-6)" opacity="0.45"/>
        <circle cx="340" cy="52" r="1.4" fill="var(--brand-gold-7)" opacity="0.4"/>
        <circle cx="620" cy="35" r="1.5" fill="var(--brand-gold-4)" opacity="0.55"/>
        <circle cx="720" cy="70" r="1.2" fill="var(--brand-gold-7)" opacity="0.5"/>
        <circle cx="790" cy="25" r="1" fill="var(--brand-gold-6)" opacity="0.45"/>
        <circle cx="820" cy="110" r="1.3" fill="var(--brand-gold-7)" opacity="0.4"/>
        <circle cx="30" cy="160" r="1.1" fill="var(--brand-gold-4)" opacity="0.4"/>
        <circle cx="118" cy="215" r="1.4" fill="var(--brand-gold-7)" opacity="0.45"/>
        <circle cx="775" cy="195" r="1.2" fill="var(--brand-gold-6)" opacity="0.4"/>
        <circle cx="40" cy="330" r="1" fill="var(--brand-gold-7)" opacity="0.35"/>
        <circle cx="805" cy="380" r="0.9" fill="var(--brand-gold-6)" opacity="0.35"/>
        <circle cx="310" cy="820" r="1.4" fill="var(--brand-6)" opacity="0.4"/>
        <circle cx="665" cy="47" r="3.5" fill="var(--success-6)" opacity="0.35"/>
        {/* Crosshair */}
        <line x1="55" y1="41" x2="55" y2="49" stroke="var(--brand-gold-7)" strokeWidth="0.7" opacity="0.3"/>
        <line x1="51" y1="45" x2="59" y2="45" stroke="var(--brand-gold-7)" strokeWidth="0.7" opacity="0.3"/>
        {/* Orbital planet */}
        <circle cx="470" cy="385" r="115" fill="url(#ll4)"/>
        <circle cx="470" cy="385" r="88" fill="url(#ll3)"/>
        <ellipse cx="470" cy="372" rx="88" ry="12" fill="var(--neutral-0)" opacity="0.09"/>
        <ellipse cx="470" cy="398" rx="88" ry="8" fill="var(--neutral-0)" opacity="0.06"/>
        <circle cx="470" cy="385" r="88" fill="none" stroke="var(--brand-gold-7)" strokeWidth="1.5" opacity="0.38"/>
        <circle cx="470" cy="385" r="140" fill="none" stroke="var(--brand-gold-8)" opacity="0.25"/>
        <circle cx="470" cy="385" r="210" fill="none" stroke="var(--brand-gold-9)" opacity="0.18"/>
        <circle cx="470" cy="385" r="295" fill="none" stroke="var(--brand-gold-8)" opacity="0.12"/>
        <circle cx="470" cy="385" r="390" fill="none" stroke="var(--brand-gold-8)" opacity="0.08"/>
        {/* Orbital dots */}
        <circle cx="569" cy="286" r="4" fill="var(--brand-gold-8)" opacity="0.7"/>
        <circle cx="569" cy="286" r="7" fill="var(--brand-gold-9)" opacity="0.12"/>
        <circle cx="422" cy="516" r="3.5" fill="var(--brand-gold-7)" opacity="0.65"/>
        <circle cx="371" cy="286" r="4" fill="var(--brand-gold-6)" opacity="0.6"/>
        <circle cx="542" cy="188" r="4.5" fill="var(--brand-gold-9)" opacity="0.55"/>
        <circle cx="667" cy="457" r="3.5" fill="var(--brand-gold-8)" opacity="0.6"/>
        <circle cx="288" cy="490" r="4" fill="var(--brand-gold-7)" opacity="0.55"/>
        <circle cx="737" cy="261" r="4" fill="var(--brand-gold-8)" opacity="0.5"/>
        <circle cx="175" cy="385" r="4.5" fill="var(--brand-gold-8)" opacity="0.55"/>
        <line x1="155" y1="118" x2="205" y2="138" stroke="var(--brand-gold-7)" opacity="0.2"/>
        <circle cx="155" cy="118" r="1.5" fill="var(--brand-gold-7)" opacity="0.4"/>
      </svg>
      <div style={{ bottom: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 8, left: 0, paddingBlock: '52px', paddingInline: '56px', position: 'absolute', right: 0 }}>
        <div style={{ color: 'var(--static-text-neutral-primary)', fontFamily: '"Space Grotesk", system-ui, sans-serif', fontSize: 64, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, whiteSpace: 'pre-wrap' }}>
          {'Flow\nTask'}
        </div>
        <div style={{ color: 'var(--static-text-neutral-tertiary)', fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, lineHeight: '150%', maxWidth: 340 }}>
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
      <rect x="2" y="2" width="6" height="6" rx="1.5" fill="var(--neutral-0)"/>
      <rect x="10" y="2" width="6" height="6" rx="1.5" fill="var(--neutral-0)"/>
      <rect x="2" y="10" width="6" height="6" rx="1.5" fill="var(--neutral-0)"/>
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="var(--neutral-0)"/>
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
  icon: 'email' | 'lock' | 'person'; C: LoginTheme; showPasswordToggle?: boolean;
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
      ) : icon === 'person' ? (
        <svg width="14" height="14" fill="none" stroke={C.inputIcon} strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="7" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>
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
  const panelWidth   = useResponsiveValue('100%', '480px', '600px');
  const panelPadding = useResponsiveValue('40px 24px', '48px 40px', '60px');

  // Existing logic — preserved as-is
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [registrationDomain, setRegistrationDomain] = useState('flowtask.dev');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<{ enabled: boolean; provider: string | null; ssoOnly: boolean } | null>(null);
  const { login, register } = useAuthStore();
  const emailPrefix = useMemo(() => buildEmailPrefix(firstName, lastName), [firstName, lastName]);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if ((location.state as { timedOut?: boolean } | null)?.timedOut) {
      message.warning('Время сессии истекло. Войдите снова.');
      // Clear the flag so Back/Forward navigation doesn't replay the toast.
      navigate(location.pathname, { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  useEffect(() => {
    authApi.getRegistrationDomain().then(setRegistrationDomain).catch(() => {});
    authApi.getSsoStatus().then(setSsoStatus).catch(() => {});
  }, []);

  // Handle SSO return: the backend sets a refreshToken cookie and redirects here.
  // We call /auth/refresh to exchange it for an access token — no token in the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('error') === 'sso_failed') {
      message.error('Ошибка SSO-аутентификации. Попробуйте ещё раз.');
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    if (!params.get('sso_return')) return;

    window.history.replaceState(null, '', window.location.pathname);
    useAuthStore.getState().loadUser().then(() => navigate('/'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (showRegister) {
        if (registrationDomain && !emailPrefix) {
          message.error('Не удалось сформировать email из указанного имени');
          setLoading(false);
          return;
        }
        const registerEmail = registrationDomain ? `${emailPrefix}@${registrationDomain}` : email;
        const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
        const msg = await register(registerEmail, password, fullName);
        message.success(msg);
        setShowRegister(false);
        setEmail('');
        setFirstName('');
        setLastName('');
        setPassword('');
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
        padding: panelPadding,
        position: 'relative',
        width: panelWidth,
      }}>
        {/* Logo */}
        <div style={{ alignItems: 'center', display: 'flex', gap: 12, marginBottom: 48 }}>
          <div style={{
            alignItems: 'center', background: 'var(--component-fill-brand-solid-default)',
            borderRadius: 12, display: 'flex', flexShrink: 0,
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

          {/* First + Last name (register only) */}
          {showRegister && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
                    Имя
                  </div>
                  <InputField type="text" value={firstName} onChange={setFirstName} placeholder="Иван" autoComplete="given-name" icon="person" C={C}/>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
                    Фамилия
                  </div>
                  <InputField type="text" value={lastName} onChange={setLastName} placeholder="Петров" autoComplete="family-name" icon="person" C={C}/>
                </div>
              </div>

              {/* Auto-filled email preview */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 4 }}>
                  Email
                </div>
                <div style={{ fontSize: 11, color: C.muted, fontFamily: '"Inter", system-ui, sans-serif', marginBottom: 6 }}>
                  Генерируется из имени и фамилии
                </div>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  backgroundColor: C.inputBg, border: `1px solid ${C.inputBorder}`,
                  borderRadius: 8, paddingBlock: '11px', paddingInline: '14px',
                  opacity: emailPrefix ? 1 : 0.5,
                }}>
                  <svg width="14" height="14" fill="none" stroke={C.inputIcon} strokeWidth="1.5" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/>
                  </svg>
                  <input
                    type="email"
                    readOnly
                    aria-label="Email (заполняется автоматически)"
                    value={emailPrefix ? `${emailPrefix}@${registrationDomain}` : ''}
                    placeholder={`имя.фамилия@${registrationDomain}`}
                    style={{
                      flex: 1, background: 'none', border: 'none', outline: 'none', cursor: 'default',
                      color: emailPrefix ? C.inputText : C.inputPh,
                      fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13, lineHeight: '16px',
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Email — shown for login OR registration without domain */}
          {(!showRegister || !registrationDomain) && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: C.label, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
              Email
            </div>
            <InputField type="email" value={email} onChange={setEmail} placeholder="ivan@company.ru" autoComplete="email" icon="email" C={C}/>
          </div>
          )}

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
          <button type="submit" disabled={loading || (showRegister && (!firstName.trim() || !lastName.trim() || !emailPrefix || (!registrationDomain && !email.trim())))} className="sigma-btn sigma-btn-brand-solid" style={{
            minHeight: 44,
            paddingBlock: 13,
            paddingInline: 13,
            width: '100%',
            marginBottom: 20,
          }}>
            <div style={{
              color: 'currentColor', fontFamily: '"Space Grotesk", system-ui, sans-serif',
              fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', lineHeight: '18px', textAlign: 'center',
            }}>
              {loading ? '...' : showRegister ? 'Отправить заявку' : 'Войти'}
            </div>
          </button>

          {/* SSO button — only on the login tab, only when SSO is configured */}
          {!showRegister && ssoStatus?.enabled && (
            <>
              <div style={{
                alignItems: 'center', display: 'flex', gap: 10, marginBottom: 20,
              }}>
                <div style={{ flex: 1, height: 1, backgroundColor: C.inputBorder }} />
                <span style={{ color: C.muted, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 12 }}>или</span>
                <div style={{ flex: 1, height: 1, backgroundColor: C.inputBorder }} />
              </div>
              <a
                href={`/api/auth/sso/login?returnUrl=${encodeURIComponent('/')}`}
                style={{
                  alignItems: 'center', backgroundColor: C.inputBg,
                  border: `1px solid ${C.inputBorder}`, borderRadius: 8, boxSizing: 'border-box',
                  color: C.title, cursor: 'pointer', display: 'flex',
                  fontFamily: '"Inter", system-ui, sans-serif', fontSize: 14, fontWeight: 500,
                  gap: 10, justifyContent: 'center', marginBottom: 20,
                  paddingBlock: '12px', paddingInline: '16px',
                  textDecoration: 'none', transition: 'border-color 0.15s',
                  width: '100%',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Войти через {ssoStatus.provider === 'keycloak' ? 'Keycloak' : ssoStatus.provider === 'avanpost' ? 'Avanpost' : 'SSO'}
              </a>
            </>
          )}

          {/* Toggle login/register */}
          <div style={{ textAlign: 'center' }}>
            <span style={{ color: C.subtitle, fontFamily: '"Inter", system-ui, sans-serif', fontSize: 13 }}>
              {showRegister ? 'Уже есть аккаунт? ' : 'Нет аккаунта? '}
            </span>
            <span onClick={() => { setShowRegister(v => !v); setFirstName(''); setLastName(''); setEmail(''); setPassword(''); }} style={{
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
            <div style={{ fontSize: 14, color: 'var(--success-8)', marginBottom: 8 }}>✓ Ссылка отправлена</div>
            <div style={{ fontSize: 13, color: 'var(--static-text-neutral-tertiary)' }}>
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
