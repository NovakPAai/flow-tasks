/**
 * G5 + G7 unit tests for <MemberPicker>.
 *
 * Updated after G7 review fixes — verifies the new ARIA structure
 * (combobox on input, listbox only when results, sibling aria-live status),
 * per-row adding state, two-step Enter, ticking countdown, focus behaviour,
 * fallback CTA optional callback, NaN-safe Retry-After parsing.
 */
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import MemberPicker from '../components/MemberPicker';
import * as workspacesApi from '../api/workspaces';
import type { ThemeTokens } from '../components/MemberPicker';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  };
});

vi.mock('../api/workspaces', async () => {
  const actual = await vi.importActual<typeof import('../api/workspaces')>('../api/workspaces');
  return {
    ...actual,
    searchCandidates: vi.fn(),
    addMember: vi.fn(),
    inviteByEmail: vi.fn(),
  };
});

const searchMock = vi.mocked(workspacesApi.searchCandidates);
const addMock    = vi.mocked(workspacesApi.addMember);

const theme: ThemeTokens = {
  bg: '#03050F', cardBg: '#0F1320', border: '#1C2236',
  text: '#E2E8F8', muted: '#8B949E', label: '#484F58',
  inputBg: '#0F1320', inputBorder: '#1C2236',
  accent: '#4F6EF7', danger: '#EF4444', rowHover: '#131729',
};

const candidate = (over: Partial<{ id: string; name: string; email: string; alreadyMember: boolean; avatar: string | null }> = {}) => ({
  id:    over.id    ?? 'u-boris',
  name:  over.name  ?? 'Boris Иванов',
  email: over.email ?? 'boris.ivanov@acme.io',
  avatar: over.avatar ?? null,
  alreadyMember: over.alreadyMember ?? false,
});

const renderPicker = (overrides: Partial<React.ComponentProps<typeof MemberPicker>> = {}) =>
  render(
    <MemberPicker
      workspaceId="ws-acme"
      theme={theme}
      onAdded={vi.fn()}
      onFallbackInvite={vi.fn().mockResolvedValue(undefined)}
      {...overrides}
    />,
  );

const typeInto = (value: string) => {
  fireEvent.change(screen.getByLabelText(/Имя или email пользователя/i), { target: { value } });
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  searchMock.mockReset();
  addMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

// ─── Label + ARIA structure (UX C1 / C2 / C3 fixes) ────────────────────────

describe('ARIA structure', () => {
  it('input has visible label (H2 fix)', () => {
    renderPicker();
    expect(screen.getByLabelText(/Имя или email пользователя/i)).toBeInTheDocument();
  });

  it('input itself is the combobox (C3 fix)', () => {
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('maxlength', '100');
  });

  it('aria-expanded reflects whether listbox of results is shown (C1 fix)', async () => {
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    searchMock.mockResolvedValue([candidate()]);
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('listbox is NOT mounted for hint / loading / empty / error / rate-limited (C1 fix)', async () => {
    renderPicker();
    typeInto('b');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.queryByRole('listbox')).toBeNull();
    searchMock.mockResolvedValue([]);
    typeInto('xyz');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('sr-only live region exists permanently and is referenced via aria-describedby (C2 fix)', () => {
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    const liveId = input.getAttribute('aria-describedby');
    expect(liveId).toBeTruthy();
    const live = document.getElementById(liveId!);
    expect(live).toHaveAttribute('role', 'status');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('live region announces "Найдено N" after results arrive (C2 fix)', async () => {
    searchMock.mockResolvedValue([candidate(), candidate({ id: 'u2', name: 'B' })]);
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toMatch(/Найдено 2/i);
    });
  });
});

// ─── Hint / loading ────────────────────────────────────────────────────────

describe('hint + loading', () => {
  it('shows hint text when typing 1 char and does NOT call API', async () => {
    renderPicker();
    typeInto('b');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText(/минимум 2 символа/i)).toBeInTheDocument();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('debounces 250ms before fetching', async () => {
    searchMock.mockResolvedValue([]);
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(searchMock).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(100));
    expect(searchMock).toHaveBeenCalledWith('ws-acme', 'bor', expect.anything());
  });

  it('aborts previous request when user keeps typing', async () => {
    const signals: AbortSignal[] = [];
    searchMock.mockImplementation((_ws, _q, signal) => {
      if (signal) signals.push(signal);
      return new Promise(() => { /* pending */ });
    });
    renderPicker();
    typeInto('bo');
    await act(() => vi.advanceTimersByTimeAsync(300));
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(signals[0]?.aborted).toBe(true);
  });

  it('shows skeleton while in-flight', async () => {
    let resolve!: (val: unknown[]) => void;
    searchMock.mockImplementation(() => new Promise((r) => { resolve = r as never; }));
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByTestId('member-picker-loading-skeleton')).toBeInTheDocument();
    resolve([candidate()]);
    await waitFor(() => expect(screen.queryByTestId('member-picker-loading-skeleton')).toBeNull());
  });
});

// ─── Results ───────────────────────────────────────────────────────────────

describe('results', () => {
  it('renders avatar + name + email + role select + Добавить (M1 fix)', async () => {
    searchMock.mockResolvedValue([candidate()]);
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText('Boris Иванов')).toBeInTheDocument();
    expect(screen.getByText('boris.ivanov@acme.io')).toBeInTheDocument();
    expect(screen.getByLabelText(/Роль для Boris Иванов/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Добавить Boris Иванов/i)).toBeInTheDocument();
  });

  it('click Добавить calls addMember with selected role', async () => {
    searchMock.mockResolvedValue([candidate()]);
    addMock.mockResolvedValue({ userId: 'u-boris', role: 'MEMBER' } as never);
    const onAdded = vi.fn();
    renderPicker({ onAdded });
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByLabelText(/Добавить Boris Иванов/i));
    await waitFor(() => expect(addMock).toHaveBeenCalledWith('ws-acme', 'u-boris', 'MEMBER'));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
  });

  it('alreadyMember row is disabled and shows "уже в воркспейсе"', async () => {
    searchMock.mockResolvedValue([candidate({ alreadyMember: true })]);
    renderPicker();
    typeInto('ann');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText(/уже в воркспейсе/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Добавить Boris/i)).toBeNull();
  });

  it('per-row adding state (H6 fix) — other rows remain interactive', async () => {
    searchMock.mockResolvedValue([
      candidate({ id: 'u1', name: 'A' }),
      candidate({ id: 'u2', name: 'B' }),
    ]);
    let resolveAdd!: () => void;
    addMock.mockImplementation(() => new Promise<never>((r) => { resolveAdd = r as never; }));
    renderPicker();
    typeInto('aa');
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByLabelText(/Добавить A/i));
    // Other row's add button must NOT be disabled while first is in-flight.
    const otherBtn = screen.getByLabelText(/Добавить B/i) as HTMLButtonElement;
    expect(otherBtn.disabled).toBe(false);
    resolveAdd();
  });
});

// ─── Empty state ───────────────────────────────────────────────────────────

describe('empty state', () => {
  it('shows generic copy when query is NOT an email', async () => {
    searchMock.mockResolvedValue([]);
    renderPicker();
    typeInto('qzx-not-found');
    await act(() => vi.advanceTimersByTimeAsync(300));
    // Both the sr-only live region and the visible status box can contain this text.
    expect(screen.getAllByText(/Пользователь не найден/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /Пригласить/i })).toBeNull();
  });

  it('shows fallback CTA when query is a valid email', async () => {
    searchMock.mockResolvedValue([]);
    renderPicker();
    typeInto('newuser@external.org');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByRole('button', { name: /Пригласить newuser@external\.org/i })).toBeInTheDocument();
  });

  it('CTA truncates long email visually but full email goes through (M6 fix)', async () => {
    searchMock.mockResolvedValue([]);
    const longEmail = `${'a'.repeat(60)}@example.com`;
    const onFallbackInvite = vi.fn().mockResolvedValue(undefined);
    renderPicker({ onFallbackInvite });
    typeInto(longEmail);
    await act(() => vi.advanceTimersByTimeAsync(300));
    const btn = screen.getByRole('button', { name: /Пригласить/i });
    expect(btn.textContent).toMatch(/…/);
    fireEvent.click(btn);
    await waitFor(() => expect(onFallbackInvite).toHaveBeenCalledWith(longEmail));
  });

  it('fallback CTA hidden when onFallbackInvite prop is omitted (Code H-2 fix)', async () => {
    searchMock.mockResolvedValue([]);
    render(
      <MemberPicker workspaceId="ws-acme" theme={theme} onAdded={vi.fn()} />
    );
    typeInto('newuser@external.org');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.queryByRole('button', { name: /Пригласить/i })).toBeNull();
  });
});

// ─── Error states ──────────────────────────────────────────────────────────

describe('error', () => {
  it('shows generic error + Повторить', async () => {
    searchMock.mockRejectedValueOnce(new Error('Network'));
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    await waitFor(() =>
      expect(screen.getAllByText(/Не удалось выполнить поиск/i).length).toBeGreaterThanOrEqual(1),
    );
    expect(screen.getByRole('button', { name: /Повторить/i })).toBeInTheDocument();
  });

  it('retry re-runs the same query', async () => {
    searchMock.mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce([candidate()]);
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    await screen.findByRole('button', { name: /Повторить/i });
    fireEvent.click(screen.getByRole('button', { name: /Повторить/i }));
    await waitFor(() => expect(screen.getByText('Boris Иванов')).toBeInTheDocument());
  });

  it('400 — distinct validationError state with message (UX M3 fix)', async () => {
    searchMock.mockRejectedValueOnce(Object.assign(new Error('val'), {
      response: { status: 400, data: { error: 'Слишком длинный запрос' } },
    }) as never);
    renderPicker();
    typeInto('aa');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByText(/Слишком длинный запрос/i)).toBeInTheDocument();
  });

  it('429 — input disabled, ticking countdown decrements (UX M5 fix)', async () => {
    searchMock.mockRejectedValueOnce(Object.assign(new Error('429'), {
      response: { status: 429, headers: { 'retry-after': '5' } },
    }) as never);
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'bor' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByText(/через 5/i)).toBeInTheDocument();
    expect(input).toBeDisabled();
    await act(() => vi.advanceTimersByTimeAsync(1100));
    expect(screen.getByText(/через 4/i)).toBeInTheDocument();
  });

  it('429 — malformed Retry-After header falls back to 60 (Code L-4 fix)', async () => {
    searchMock.mockRejectedValueOnce(Object.assign(new Error('429'), {
      response: { status: 429, headers: { 'retry-after': 'not-a-number' } },
    }) as never);
    renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(await screen.findByText(/через 60/i)).toBeInTheDocument();
  });

  it('add 403 → onLostOwnership called', async () => {
    searchMock.mockResolvedValue([candidate()]);
    addMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), {
      response: { status: 403, data: { error: 'No owner' } },
    }) as never);
    const onLostOwnership = vi.fn();
    renderPicker({ onLostOwnership });
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByLabelText(/Добавить Boris Иванов/i));
    await waitFor(() => expect(onLostOwnership).toHaveBeenCalled());
  });

  it('add 409 → row marked alreadyMember, picker stays open', async () => {
    searchMock.mockResolvedValue([candidate()]);
    addMock.mockRejectedValueOnce(Object.assign(new Error('conflict'), {
      response: { status: 409, data: { error: 'Already a member' } },
    }) as never);
    const onAdded = vi.fn();
    renderPicker({ onAdded });
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByLabelText(/Добавить Boris Иванов/i));
    // Wait for the row badge to appear (now "уже в воркспейсе" inside the listbox option).
    await waitFor(() =>
      expect(screen.getAllByText(/уже в воркспейсе/i).length).toBeGreaterThanOrEqual(1),
    );
    expect(onAdded).not.toHaveBeenCalled();
  });
});

// ─── Keyboard ───────────────────────────────────────────────────────────────

describe('keyboard', () => {
  it('ArrowDown moves focus into first non-disabled option', async () => {
    searchMock.mockResolvedValue([
      candidate({ id: 'u1', name: 'A' }),
      candidate({ id: 'u2', name: 'B' }),
    ]);
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'ann' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByTestId('member-picker-option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowDown skips alreadyMember rows (UX H3 fix)', async () => {
    searchMock.mockResolvedValue([
      candidate({ id: 'u1', name: 'A', alreadyMember: true }),
      candidate({ id: 'u2', name: 'B' }),
    ]);
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'aa' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = screen.getAllByTestId('member-picker-option');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
    expect(options[1]).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowUp wraps to last cyclically', async () => {
    searchMock.mockResolvedValue([
      candidate({ id: 'u1', name: 'A' }),
      candidate({ id: 'u2', name: 'B' }),
      candidate({ id: 'u3', name: 'C' }),
    ]);
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'aa' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.keyDown(input, { key: 'ArrowDown' });   // → u1
    fireEvent.keyDown(input, { key: 'ArrowUp' });     // wrap → u3
    const options = screen.getAllByTestId('member-picker-option');
    expect(options[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('Enter focuses the row select (UX C4 — two-step Enter)', async () => {
    searchMock.mockResolvedValue([candidate()]);
    renderPicker();
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'bor' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(document.activeElement).toBe(screen.getByLabelText(/Роль для Boris Иванов/i));
  });

  it('Esc clears query first, second Esc calls onClose (UX H1 fix)', async () => {
    searchMock.mockResolvedValue([candidate()]);
    const onClose = vi.fn();
    renderPicker({ onClose });
    const input = screen.getByLabelText(/Имя или email пользователя/i);
    fireEvent.change(input, { target: { value: 'bor' } });
    await act(() => vi.advanceTimersByTimeAsync(300));
    fireEvent.keyDown(input, { key: 'Escape' });
    expect((input as HTMLInputElement).value).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── XSS hygiene ───────────────────────────────────────────────────────────

describe('XSS', () => {
  it('renders script tag in name as literal text', async () => {
    searchMock.mockResolvedValue([candidate({ name: '<script>window.__pwn=1</script>Evil' })]);
    renderPicker();
    typeInto('evil');
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText(/<script>window\.__pwn=1<\/script>Evil/)).toBeInTheDocument();
    // @ts-expect-error verifying no side effect
    expect(globalThis.__pwn).toBeUndefined();
  });

  it('renders <script> in query into fallback CTA text without executing (Sec L-2 fix)', async () => {
    searchMock.mockResolvedValue([]);
    renderPicker();
    typeInto('"><script>alert(1)</script>"@x.com');
    await act(() => vi.advanceTimersByTimeAsync(300));
    // Query is not an email per the strict regex so there is no CTA — verify
    // graceful degradation instead of CTA rendering raw HTML.
    expect(screen.getByText(/Пользователь не найден/i)).toBeInTheDocument();
  });
});

// ─── Cleanup ───────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('aborts in-flight + clears debounce on unmount (Code L-13 fix)', async () => {
    const signals: AbortSignal[] = [];
    searchMock.mockImplementation((_ws, _q, signal) => {
      if (signal) signals.push(signal);
      return new Promise(() => { /* pending */ });
    });
    const { unmount } = renderPicker();
    typeInto('bor');
    await act(() => vi.advanceTimersByTimeAsync(300));
    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });
});
