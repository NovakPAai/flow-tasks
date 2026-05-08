import { useCallback, useEffect, useState } from 'react';
import { message } from 'antd';
import { useAuthStore } from '../store/auth.store';
import { useThemeStore } from '../store/theme.store';
import { listApiKeys, createApiKey, deleteApiKey } from '../api/integrations';
import type { ApiKeyRow, CreatedApiKey } from '../api/integrations';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  bg: 'var(--static-background-base)', cardBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--static-text-neutral-tertiary)',
  inputBg: 'var(--static-background-light)', inputBorder: 'var(--component-border-neutral-medium)', inputText: 'var(--static-text-neutral-primary)',
  accent: 'var(--brand-8)', danger: 'var(--error-8)', warning: 'var(--warning-5)',
  warnBg: 'var(--component-fill-warning-soft-default)', warnBorder: 'var(--component-border-warning-medium)',
};
const LIGHT: C = {
  bg: 'var(--static-background-base)', cardBg: 'var(--static-background-lightest)', border: 'var(--static-border-neutral-tertiary)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--static-text-neutral-tertiary)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)', inputText: 'var(--static-text-neutral-primary)',
  accent: 'var(--brand-8)', danger: 'var(--error-10)', warning: 'var(--warning-8)',
  warnBg: 'var(--component-fill-warning-soft-default)', warnBorder: 'var(--component-border-warning-medium)',
};

const INTER = '"Inter", system-ui, sans-serif';
const SPACE = '"Space Grotesk", system-ui, sans-serif';

function avatarInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── API Keys section ───────────────────────────────────────────────────────────
function ApiKeysSection({ c }: { c: C }) {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setKeys(await listApiKeys());
    } catch {
      message.error('Не удалось загрузить API-ключи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await createApiKey(trimmed);
      setRevealed(created);
      setLabel('');
      message.success('API-ключ создан');
      await load();
    } catch {
      message.error('Не удалось создать ключ');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApiKey(id);
      message.success('Ключ удалён');
      setPendingDelete(null);
      await load();
    } catch {
      message.error('Не удалось удалить ключ');
    }
  }

  async function copyKey() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      message.error('Не удалось скопировать');
    }
  }

  const inputStyle = {
    backgroundColor: c.inputBg, border: `1px solid ${c.inputBorder}`, borderRadius: 8,
    boxSizing: 'border-box' as const, color: c.inputText, fontFamily: INTER, fontSize: 13,
    lineHeight: '16px', outline: 'none', padding: '10px 14px', width: '100%',
  };

  const btnBase = {
    border: 'none', borderRadius: 8, cursor: 'pointer',
    fontFamily: INTER, fontSize: 13, fontWeight: 600,
    padding: '10px 20px', transition: 'opacity 0.15s',
  };

  return (
    <div style={{ borderTop: `1px solid ${c.border}`, marginTop: 28, paddingTop: 24 }}>
      <div style={{ color: c.label, fontFamily: INTER, fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', lineHeight: '16px', marginBottom: 16, textTransform: 'uppercase' }}>
        API-ключи
      </div>
      <div style={{ color: c.muted, fontFamily: INTER, fontSize: 13, lineHeight: '18px', marginBottom: 16 }}>
        Персональные токены для интеграций (например, Pulsar). Ключ показывается только один раз.
      </div>

      {/* Create form */}
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text" value={label} onChange={e => setLabel(e.target.value)}
          placeholder="Название ключа (например, Pulsar)"
          maxLength={64}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          type="submit"
          disabled={!label.trim() || creating}
          style={{
            ...btnBase,
            backgroundColor: label.trim() && !creating ? c.accent : `${c.accent}66`,
            color: 'var(--neutral-0)',
            cursor: label.trim() && !creating ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap',
          }}
        >
          {creating ? 'Создание...' : 'Создать ключ'}
        </button>
      </form>

      {/* Reveal-once banner */}
      {revealed && (
        <div style={{
          backgroundColor: c.warnBg, border: `1px solid ${c.warnBorder}`,
          borderRadius: 10, marginBottom: 16, padding: 16,
        }}>
          <div style={{ alignItems: 'flex-start', display: 'flex', gap: 10, marginBottom: 10 }}>
            <span style={{ color: c.warning, fontSize: 16 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontFamily: INTER, fontSize: 13, fontWeight: 600 }}>
                {revealed.label}
              </div>
              <div style={{ color: c.muted, fontFamily: INTER, fontSize: 12, marginTop: 2 }}>
                Сохраните ключ — он больше не будет показан
              </div>
            </div>
            <button
              onClick={() => setRevealed(null)}
              style={{ background: 'none', border: 'none', color: c.muted, cursor: 'pointer', fontSize: 16, padding: 0 }}
            >
              ✕
            </button>
          </div>
          <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
            <code style={{
              backgroundColor: c.inputBg, border: `1px solid ${c.inputBorder}`,
              borderRadius: 6, color: c.text, flex: 1, fontFamily: 'monospace',
              fontSize: 12, minWidth: 0, overflowWrap: 'break-word', padding: '8px 12px',
            }}>
              {revealed.key}
            </code>
            <button
              onClick={copyKey}
              style={{
                ...btnBase,
                backgroundColor: c.accent, color: 'var(--neutral-0)',
                padding: '9px 16px', whiteSpace: 'nowrap',
              }}
            >
              {copied ? '✓ Скопировано' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {loading ? (
        <div style={{ color: c.muted, fontFamily: INTER, fontSize: 13, padding: '16px 0' }}>
          Загрузка...
        </div>
      ) : keys.length === 0 ? (
        <div style={{
          border: `1px dashed ${c.border}`, borderRadius: 10,
          color: c.muted, fontFamily: INTER, fontSize: 13,
          padding: '24px', textAlign: 'center',
        }}>
          Нет API-ключей
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {keys.map(key => {
            const isPending = pendingDelete === key.id;
            return (
              <div
                key={key.id}
                style={{
                  alignItems: 'center', backgroundColor: isPending ? `${c.danger}11` : c.inputBg,
                  border: `1px solid ${isPending ? c.danger + '66' : c.border}`,
                  borderRadius: 10, display: 'flex', gap: 12, padding: '12px 16px',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: c.text, fontFamily: INTER, fontSize: 13, fontWeight: 500 }}>
                    {key.label}
                  </div>
                  <div style={{ color: c.muted, fontFamily: INTER, fontSize: 12, marginTop: 2 }}>
                    Создан {fmtDate(key.createdAt)}
                    {key.lastUsedAt && ` · Использован ${fmtDate(key.lastUsedAt)}`}
                  </div>
                </div>
                {isPending ? (
                  <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                    <span style={{ color: c.danger, fontFamily: INTER, fontSize: 12 }}>Удалить?</span>
                    <button
                      onClick={() => handleDelete(key.id)}
                      style={{ ...btnBase, backgroundColor: c.danger, color: 'var(--neutral-0)', padding: '7px 14px' }}
                    >
                      Да
                    </button>
                    <button
                      onClick={() => setPendingDelete(null)}
                      style={{ ...btnBase, backgroundColor: 'transparent', border: `1px solid ${c.border}`, color: c.muted, padding: '7px 14px' }}
                    >
                      Нет
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setPendingDelete(key.id)}
                    style={{ ...btnBase, backgroundColor: 'transparent', border: `1px solid ${c.border}`, color: c.muted, padding: '7px 14px' }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore();
  const { mode } = useThemeStore();
  const c = mode === 'light' ? LIGHT : DARK;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [emailNotifications, setEmailNotifications] = useState(user?.emailNotifications ?? true);
  const [saving, setSaving] = useState(false);

  const hasChanges = name !== (user?.name ?? '') || email !== (user?.email ?? '') || emailNotifications !== (user?.emailNotifications ?? true);

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const data: { name?: string; email?: string; emailNotifications?: boolean } = {};
      if (name !== user?.name) data.name = name;
      if (email !== user?.email) data.email = email;
      if (emailNotifications !== (user?.emailNotifications ?? true)) data.emailNotifications = emailNotifications;
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

  const createdAt = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

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
            <span style={{ color: 'var(--neutral-0)', fontFamily: INTER, fontSize: 22, fontWeight: 700 }}>
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

        {/* Email notifications toggle */}
        <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: c.label, fontFamily: INTER, fontSize: 12, fontWeight: 500, lineHeight: '16px', marginBottom: 2 }}>
              Email-уведомления
            </div>
            <div style={{ color: c.muted, fontFamily: INTER, fontSize: 12, lineHeight: '16px' }}>
              Назначение задач, комментарии, добавление в воркспейс
            </div>
          </div>
          <button
            onClick={() => setEmailNotifications(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, border: 'none',
              background: emailNotifications ? c.accent : c.inputBorder,
              position: 'relative', cursor: 'pointer', flexShrink: 0,
              transition: 'background 0.2s',
            }}
            title={emailNotifications ? 'Выключить email-уведомления' : 'Включить email-уведомления'}
          >
            <span style={{
              position: 'absolute', top: 3, left: emailNotifications ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: 'var(--neutral-0)',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          style={{
            backgroundColor: hasChanges && !saving ? c.accent : `${c.accent}66`,
            border: 'none', borderRadius: 8, color: 'var(--neutral-0)',
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

        {/* API Keys */}
        <ApiKeysSection c={c} />
      </div>
    </div>
  );
}
