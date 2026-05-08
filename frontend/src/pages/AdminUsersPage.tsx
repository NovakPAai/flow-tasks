import { useEffect, useState } from 'react';
import { message, Modal } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useThemeStore } from '../store/theme.store';
import { useAuthStore } from '../store/auth.store';
import { useBreakpoint } from '../utils/useBreakpoint';
import type { AdminUser, RegistrationRequest } from '../types';
import * as adminApi from '../api/admin';

// ── Design tokens ──────────────────────────────────────────────────────────────
type C = Record<string, string>;
const DARK: C = {
  bg: 'var(--static-background-base)', sidebar: 'var(--static-background-base)', sidebarBorder: 'var(--static-border-neutral-tertiary)',
  border: 'var(--static-border-neutral-tertiary)', cardBg: 'var(--static-background-lightest)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--neutral-8)',
  inputBg: 'var(--static-background-lightest)', inputBorder: 'var(--static-border-neutral-tertiary)',
  navActive: 'var(--component-fill-brand-soft-hover)', navActiveText: 'var(--brand-8)',
  navHover: 'var(--component-fill-neutral-ghost-hover)',
  rowHover: 'var(--static-background-light)',
};
const LIGHT: C = {
  bg: 'var(--static-background-base)', sidebar: 'var(--static-background-lightest)', sidebarBorder: 'var(--static-border-neutral-tertiary)',
  border: 'var(--static-border-neutral-tertiary)', cardBg: 'var(--static-background-lightest)',
  text: 'var(--static-text-neutral-primary)', muted: 'var(--static-text-neutral-tertiary)', label: 'var(--neutral-6)',
  inputBg: 'var(--static-background-base)', inputBorder: 'var(--static-border-neutral-tertiary)',
  navActive: 'var(--component-fill-brand-soft-default)', navActiveText: 'var(--brand-8)',
  navHover: 'var(--component-fill-neutral-ghost-hover)',
  rowHover: 'var(--static-background-light)',
};

const AVATAR_COLORS = ['var(--brand-8)', 'var(--brand-gold-8)', 'var(--success-8)', 'var(--warning-6)', 'var(--brand-7)', 'var(--error-10)', 'var(--info-8)'];
function avatarColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }
function avatarInitials(name: string) { return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{ fontSize: size * 0.38, fontWeight: 700, color: 'var(--neutral-0)', fontFamily: '"Inter",system-ui,sans-serif' }}>
        {avatarInitials(name)}
      </span>
    </div>
  );
}

function PrimaryBtn({ children, onClick, disabled, loading, style }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; loading?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 500,
      background: disabled || loading ? 'var(--component-disable-fill)' : 'var(--brand-8)',
      color: 'var(--neutral-0)', border: 'none', borderRadius: 8,
      padding: '8px 16px', cursor: disabled || loading ? 'not-allowed' : 'pointer',
      transition: 'opacity .15s', ...style,
    }}>
      {loading ? 'Загрузка...' : children}
    </button>
  );
}

function DangerBtn({ children, onClick, disabled, loading, style }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; loading?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 500,
      background: 'transparent',
      color: 'var(--error-10)', border: '1px solid var(--component-border-negative-medium)', borderRadius: 8,
      padding: '6px 14px', cursor: disabled || loading ? 'not-allowed' : 'pointer',
      transition: 'opacity .15s', opacity: disabled || loading ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}

function SuccessBtn({ children, onClick, disabled, loading, style }: {
  children: React.ReactNode; onClick?: () => void;
  disabled?: boolean; loading?: boolean; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontFamily: '"Inter",system-ui,sans-serif', fontSize: 13, fontWeight: 500,
      background: 'transparent',
      color: 'var(--success-8)', border: '1px solid var(--component-border-positive-medium)', borderRadius: 8,
      padding: '6px 14px', cursor: disabled || loading ? 'not-allowed' : 'pointer',
      transition: 'opacity .15s', opacity: disabled || loading ? 0.5 : 1, ...style,
    }}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    PENDING:  { label: 'Ожидает', bg: 'var(--component-fill-warning-soft-hover)', color: 'var(--warning-6)' },
    APPROVED: { label: 'Одобрена', bg: 'var(--component-fill-positive-soft-default)',  color: 'var(--success-8)' },
    REJECTED: { label: 'Отклонена', bg: 'var(--component-fill-negative-soft-hover)', color: 'var(--error-10)' },
  }[status] ?? { label: status, bg: 'var(--component-fill-neutral-soft-default)', color: 'var(--static-text-neutral-tertiary)' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      fontFamily: '"Inter",system-ui,sans-serif',
      background: cfg.bg, color: cfg.color,
    }}>{cfg.label}</span>
  );
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type Tab = 'users' | 'create' | 'requests';

// ── Main component ──────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const { mode } = useThemeStore();
  const bp        = useBreakpoint();
  const isMobile  = bp === 'mobile';
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const C = mode === 'dark' ? DARK : LIGHT;

  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Create user form
  const [createName, setCreateName] = useState('');
  const [createPrefix, setCreatePrefix] = useState('');
  const [creating, setCreating] = useState(false);

  // Password modal
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [createdEmail, setCreatedEmail] = useState('');

  // Review action
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.isSuperadmin) {
      navigate('/workspaces');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'requests') loadRequests();
  }, [tab]);

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      setUsers(await adminApi.listUsers());
    } catch {
      message.error('Не удалось загрузить пользователей');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadRequests() {
    setLoadingRequests(true);
    try {
      setRequests(await adminApi.listRegistrationRequests());
    } catch {
      message.error('Не удалось загрузить заявки');
    } finally {
      setLoadingRequests(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim() || !createPrefix.trim()) return;
    setCreating(true);
    try {
      const { user: newUser, generatedPassword: pwd } = await adminApi.createUser(createName.trim(), createPrefix.trim());
      setCreatedEmail(newUser.email);
      setGeneratedPassword(pwd);
      setPasswordModalOpen(true);
      setCreateName('');
      setCreatePrefix('');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      message.error(e.response?.data?.error || 'Ошибка создания пользователя');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleSuperadmin(u: AdminUser) {
    if (u.id === user?.id) { message.warning('Нельзя изменить свою роль'); return; }
    setTogglingId(u.id);
    try {
      const updated = await adminApi.setUserSuperadmin(u.id, !u.isSuperadmin);
      setUsers(prev => prev.map(p => p.id === updated.id ? { ...p, isSuperadmin: updated.isSuperadmin } : p));
      message.success(updated.isSuperadmin ? `${u.name} назначен суперадминистратором` : `${u.name} снят с роли суперадминистратора`);
    } catch {
      message.error('Ошибка изменения роли');
    } finally {
      setTogglingId(null);
    }
  }

  async function handleReview(id: string, action: 'approve' | 'reject') {
    setReviewingId(id);
    try {
      await adminApi.reviewRegistrationRequest(id, action);
      message.success(action === 'approve' ? 'Заявка одобрена' : 'Заявка отклонена');
      setRequests((prev) => prev.map((r) =>
        r.id === id ? { ...r, status: action === 'approve' ? 'APPROVED' : 'REJECTED' } : r
      ));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      message.error(e.response?.data?.error || 'Ошибка обработки заявки');
    } finally {
      setReviewingId(null);
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'users',    label: 'Пользователи' },
    { key: 'create',   label: 'Создать' },
    { key: 'requests', label: 'Заявки' },
  ];

  const font: React.CSSProperties = { fontFamily: '"Inter",system-ui,sans-serif' };

  return (
    <div style={{ background: C.bg, minHeight: '100vh', ...font }}>
      <div style={{ padding: isMobile ? '20px 16px' : '40px 32px' }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 4 }}>
            Управление пользователями
          </div>
          <div style={{ fontSize: 13, color: C.muted }}>
            Доступно только суперадминистратору
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: `1px solid ${C.border}`, paddingBottom: 0 }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', marginBottom: -1,
              fontSize: 13, fontWeight: tab === t.key ? 600 : 400,
              color: tab === t.key ? 'var(--brand-8)' : C.muted,
              borderBottom: tab === t.key ? '2px solid var(--brand-8)' : '2px solid transparent',
              transition: 'color .15s',
              ...font,
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Пользователи ── */}
        {tab === 'users' && (
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {loadingUsers ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>Загрузка...</div>
            ) : users.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>Пользователей нет</div>
            ) : (
              <div style={{ minWidth: 780 }}>
                {/* Header row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 180px 48px 48px 48px 52px 52px 110px 130px',
                  padding: '10px 20px', borderBottom: `1px solid ${C.border}`,
                  fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  <span>Пользователь</span>
                  <span>Email</span>
                  <span>Входов</span>
                  <span title="Спейсы">Спейсы</span>
                  <span title="Доски">Доски</span>
                  <span title="Задачи">Задачи</span>
                  <span title="Участники спейсов">Участн.</span>
                  <span>Активность</span>
                  <span>Роль</span>
                </div>
                {users.map((u, i) => (
                  <div key={u.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 180px 48px 48px 48px 52px 52px 110px 130px',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: i < users.length - 1 ? `1px solid ${C.border}` : 'none',
                    background: hoveredRow === u.id ? C.rowHover : 'transparent',
                    transition: 'background .1s',
                  }}
                    onMouseEnter={() => setHoveredRow(u.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar name={u.name} size={30} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.name}
                        </div>
                        <div style={{ fontSize: 11, color: C.label, marginTop: 2 }}>
                          создан {formatDate(u.createdAt)}
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                    <span style={{ fontSize: 13, color: C.text }}>{u.loginCount}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{u.stats?.workspaces ?? '—'}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{u.stats?.boards ?? '—'}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{u.stats?.tasks ?? '—'}</span>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{u.stats?.members ?? '—'}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>{formatDate(u.lastLoginAt)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {u.isSuperadmin && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--component-fill-brand-soft-hover)', color: 'var(--brand-8)' }}>
                          Суперадмин
                        </span>
                      )}
                      {u.id !== user?.id && (
                        <button
                          onClick={() => handleToggleSuperadmin(u)}
                          disabled={togglingId === u.id}
                          style={{
                            fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                            background: 'transparent', border: `1px solid ${u.isSuperadmin ? 'var(--component-border-negative-medium)' : 'var(--component-border-brand-medium)'}`,
                            color: u.isSuperadmin ? 'var(--error-10)' : 'var(--brand-8)', opacity: togglingId === u.id ? 0.5 : 1,
                            ...font,
                          }}
                        >
                          {u.isSuperadmin ? 'Снять' : 'Назначить'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Создать ── */}
        {tab === 'create' && (
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 28, maxWidth: 440 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 20 }}>
              Новый пользователь
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 6 }}>
                  Имя
                </label>
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Иван Иванов"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    background: C.inputBg, border: `1px solid ${C.inputBorder}`,
                    color: C.text, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {/* Email prefix */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: C.muted, marginBottom: 6 }}>
                  Email-префикс
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: `1px solid ${C.inputBorder}`, borderRadius: 8, overflow: 'hidden', background: C.inputBg }}>
                  <input
                    value={createPrefix}
                    onChange={(e) => setCreatePrefix(e.target.value)}
                    placeholder="ivan.ivanov"
                    style={{
                      flex: 1, padding: '8px 12px', fontSize: 13,
                      background: 'transparent', border: 'none',
                      color: C.text, outline: 'none',
                    }}
                  />
                  <span style={{
                    padding: '8px 12px', fontSize: 13, color: C.muted,
                    background: mode === 'dark' ? 'var(--component-fill-neutral-ghost-hover)' : 'var(--component-fill-neutral-ghost-hover)',
                    borderLeft: `1px solid ${C.inputBorder}`, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}>
                    @flowtask.dev
                  </span>
                </div>
              </div>
              <div style={{ paddingTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <PrimaryBtn
                  disabled={!createName.trim() || !createPrefix.trim()}
                  loading={creating}
                >
                  Создать пользователя
                </PrimaryBtn>
                <span style={{ fontSize: 12, color: C.muted }}>Пароль будет сгенерирован автоматически</span>
              </div>
            </form>
          </div>
        )}

        {/* ── Tab: Заявки ── */}
        {tab === 'requests' && (
          <div style={{ background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12 }}>
            {loadingRequests ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>Загрузка...</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: C.muted, fontSize: 14 }}>Заявок нет</div>
            ) : (
              <>
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 220px 90px 130px 160px',
                  padding: '10px 20px', borderBottom: `1px solid ${C.border}`,
                  fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>
                  <span>Имя</span>
                  <span>Email</span>
                  <span>Статус</span>
                  <span>Дата заявки</span>
                  <span></span>
                </div>
                {requests.map((r, i) => (
                  <div key={r.id} style={{
                    display: 'grid', gridTemplateColumns: '1fr 220px 90px 130px 160px',
                    padding: '12px 20px', alignItems: 'center',
                    borderBottom: i < requests.length - 1 ? `1px solid ${C.border}` : 'none',
                    transition: 'background .1s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.rowHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <Avatar name={r.name} size={28} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.name}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email}</span>
                    <StatusBadge status={r.status} />
                    <span style={{ fontSize: 12, color: C.muted }}>{formatDate(r.createdAt)}</span>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      {r.status === 'PENDING' && (
                        <>
                          <SuccessBtn
                            onClick={() => handleReview(r.id, 'approve')}
                            loading={reviewingId === r.id}
                            disabled={reviewingId !== null && reviewingId !== r.id}
                          >
                            Одобрить
                          </SuccessBtn>
                          <DangerBtn
                            onClick={() => handleReview(r.id, 'reject')}
                            loading={reviewingId === r.id}
                            disabled={reviewingId !== null && reviewingId !== r.id}
                          >
                            Отклонить
                          </DangerBtn>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Generated password modal */}
      <Modal
        open={passwordModalOpen}
        onCancel={() => setPasswordModalOpen(false)}
        footer={null}
        centered
        title={null}
        width={420}
        styles={{
          content: { background: mode === 'dark' ? 'var(--static-background-lightest)' : 'var(--static-background-lightest)', borderRadius: 12, padding: 28 },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{ ...font }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: mode === 'dark' ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)', marginBottom: 8 }}>
            Пользователь создан
          </div>
          <div style={{ fontSize: 13, color: mode === 'dark' ? 'var(--static-text-neutral-tertiary)' : 'var(--static-text-neutral-tertiary)', marginBottom: 20 }}>
            Передайте данные для входа сотруднику. Пароль показывается <strong style={{ color: 'var(--warning-6)' }}>только один раз</strong>.
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: mode === 'dark' ? 'var(--neutral-8)' : 'var(--neutral-6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Email</div>
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 13,
              background: mode === 'dark' ? 'var(--static-background-light)' : 'var(--static-background-base)',
              color: mode === 'dark' ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)',
              border: `1px solid ${mode === 'dark' ? 'var(--component-border-neutral-medium)' : 'var(--static-border-neutral-tertiary)'}`,
            }}>
              {createdEmail}
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: mode === 'dark' ? 'var(--neutral-8)' : 'var(--neutral-6)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Пароль</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                fontFamily: '"Menlo","Consolas","Monaco",monospace',
                background: mode === 'dark' ? 'var(--static-background-light)' : 'var(--static-background-base)',
                color: mode === 'dark' ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)',
                border: `1px solid ${mode === 'dark' ? 'var(--component-border-neutral-medium)' : 'var(--static-border-neutral-tertiary)'}`,
                letterSpacing: '0.08em',
              }}>
                {generatedPassword}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword).then(() => {
                    message.success('Скопировано');
                  });
                }}
                style={{
                  padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                  background: 'var(--brand-8)', color: 'var(--neutral-0)', border: 'none', cursor: 'pointer',
                  flexShrink: 0, ...font,
                }}
              >
                Копировать
              </button>
            </div>
          </div>

          <button
            onClick={() => setPasswordModalOpen(false)}
            style={{
              width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: mode === 'dark' ? 'var(--component-fill-neutral-soft-default)' : 'var(--component-fill-neutral-soft-default)',
              color: mode === 'dark' ? 'var(--static-text-neutral-primary)' : 'var(--static-text-neutral-primary)',
              border: `1px solid ${mode === 'dark' ? 'var(--static-border-neutral-tertiary)' : 'var(--static-border-neutral-tertiary)'}`,
              cursor: 'pointer', ...font,
            }}
          >
            Готово
          </button>
        </div>
      </Modal>
    </div>
  );
}
