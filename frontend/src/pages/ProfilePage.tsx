import { useState } from 'react';
import { message } from 'antd';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  bg: '#03050F', cardBg: '#0F1320', border: '#1C2236',
  text: '#E2E8F8', muted: '#8B949E', label: '#8B95B0',
  inputBg: '#161B22', inputBorder: '#30363D', inputText: '#E2E8F8',
  accent: '#4F6EF7',
};
const LIGHT: C = {
  bg: '#F5F3FF', cardBg: '#FDFCFF', border: '#E8E5F0',
  text: '#1A1A2E', muted: '#6B7194', label: '#6B7194',
  inputBg: '#F9FAFB', inputBorder: '#E8E5F0', inputText: '#1A1A2E',
  accent: '#4F6EF7',
};

const INTER = '"Inter", system-ui, sans-serif';
const SPACE = '"Space Grotesk", system-ui, sans-serif';

function avatarInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const { mode } = useThemeStore();
  const c = mode === 'light' ? LIGHT : DARK;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);

  const hasChanges = name !== (user?.name ?? '') || email !== (user?.email ?? '');

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const data: { name?: string; email?: string } = {};
      if (name !== user?.name) data.name = name;
      if (email !== user?.email) data.email = email;
      await updateProfile(data);
      message.success('Профиль обновлён');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      message.error(error.response?.data?.error || 'Не удалось обновить профиль');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div style={{ backgroundColor: c.bg, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', flex: 1, gap: 32, paddingBlock: '48px', paddingInline: '80px', minHeight: '100%' }}>
      {/* Header */}
      <div>
        <div style={{ color: c.muted, fontFamily: INTER, fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', lineHeight: '16px', marginBottom: 8, textTransform: 'uppercase' }}>
          Настройки
        </div>
        <div style={{ color: c.text, fontFamily: SPACE, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '34px' }}>
          Профиль
        </div>
      </div>

      {/* Card */}
      <div style={{ backgroundColor: c.cardBg, border: `1px solid ${c.border}`, borderRadius: 16, maxWidth: 560, padding: 32 }}>
        {/* Avatar */}
        <div style={{ alignItems: 'center', display: 'flex', gap: 20, marginBottom: 32 }}>
          <div style={{
            alignItems: 'center', backgroundColor: c.accent, borderRadius: '50%',
            display: 'flex', flexShrink: 0, height: 64, justifyContent: 'center', width: 64,
          }}>
            <span style={{ color: '#FFFFFF', fontFamily: INTER, fontSize: 22, fontWeight: 700 }}>
              {avatarInitials(name || user.name)}
            </span>
          </div>
          <div>
            <div style={{ color: c.text, fontFamily: INTER, fontSize: 16, fontWeight: 600, lineHeight: '22px' }}>
              {name || user.name}
            </div>
            <div style={{ color: c.muted, fontFamily: INTER, fontSize: 13, lineHeight: '18px', marginTop: 2 }}>
              {email || user.email}
            </div>
          </div>
        </div>

        {/* Name field */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: c.label, display: 'block', fontFamily: INTER, fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
            Имя
          </label>
          <input
            type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Фамилия Имя"
            style={{
              backgroundColor: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 8,
              boxSizing: 'border-box', color: c.inputText, fontFamily: INTER, fontSize: 13,
              lineHeight: '16px', outline: 'none', padding: '11px 14px', width: '100%',
            }}
          />
        </div>

        {/* Email field */}
        <div style={{ marginBottom: 28 }}>
          <label style={{ color: c.label, display: 'block', fontFamily: INTER, fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 6 }}>
            Email
          </label>
          <input
            type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            style={{
              backgroundColor: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 8,
              boxSizing: 'border-box', color: c.inputText, fontFamily: INTER, fontSize: 13,
              lineHeight: '16px', outline: 'none', padding: '11px 14px', width: '100%',
            }}
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            backgroundColor: hasChanges && !saving ? c.accent : `${c.accent}66`,
            border: 'none', borderRadius: 8, color: '#FFFFFF',
            cursor: hasChanges && !saving ? 'pointer' : 'not-allowed',
            fontFamily: INTER, fontSize: 13, fontWeight: 600,
            padding: '10px 24px', transition: 'background-color 0.15s',
          }}
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>

        {/* Account info */}
        <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 28, paddingTop: 20 }}>
          <div style={{ color: c.label, fontFamily: INTER, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', lineHeight: '16px', marginBottom: 12, textTransform: 'uppercase' }}>
            Информация об аккаунте
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: c.muted, fontFamily: INTER, fontSize: 13 }}>Дата регистрации</span>
              <span style={{ color: c.text, fontFamily: INTER, fontSize: 13, fontWeight: 500 }}>{createdAt}</span>
            </div>
            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: c.muted, fontFamily: INTER, fontSize: 13 }}>Количество входов</span>
              <span style={{ color: c.text, fontFamily: INTER, fontSize: 13, fontWeight: 500 }}>{user.loginCount ?? 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
