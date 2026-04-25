import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vi as vitest } from 'vitest';
import FeedbackFAB from '../components/FeedbackFAB';
import * as authStore from '../store/auth.store';
import type { User } from '../types';

// Mock FeedbackModal — тестируем только FAB, не саму модалку
vi.mock('../components/FeedbackModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="feedback-modal">
        <button data-testid="close-modal" onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('../store/theme.store', () => ({
  useThemeStore: () => 'dark',
}));

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn((sel: (s: { user: object | null }) => unknown) =>
    sel({ user: { id: '1', name: 'Test User', email: 'test@test.com' } })
  ),
}));

const useAuthStoreMock = vitest.mocked(authStore.useAuthStore);

const mockUser = { id: '1', name: 'Test', email: 'test@test.com' } as User;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAuth = (user: User | null) => (sel: (s: any) => unknown) => sel({ user });

describe('FeedbackFAB — unauthenticated', () => {
  it('does not render when user is null', () => {
    useAuthStoreMock.mockImplementation(mockAuth(null));
    render(<FeedbackFAB />);
    expect(screen.queryByTestId('feedback-fab')).not.toBeInTheDocument();
  });
});

describe('FeedbackFAB', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStoreMock.mockImplementation(mockAuth(mockUser));
  });

  it('renders floating action button', () => {
    render(<FeedbackFAB />);
    expect(screen.getByTestId('feedback-fab')).toBeInTheDocument();
  });

  it('has accessible aria-label', () => {
    render(<FeedbackFAB />);
    expect(screen.getByLabelText('Оставить обратную связь')).toBeInTheDocument();
  });

  it('is fixed-positioned for global visibility', () => {
    render(<FeedbackFAB />);
    expect(screen.getByTestId('feedback-fab')).toHaveStyle({ position: 'fixed' });
  });

  it('modal is closed initially', () => {
    render(<FeedbackFAB />);
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
  });

  it('clicking FAB opens the feedback modal', () => {
    render(<FeedbackFAB />);
    fireEvent.click(screen.getByTestId('feedback-fab'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
  });

  it('modal closes when onClose is invoked', () => {
    render(<FeedbackFAB />);
    fireEvent.click(screen.getByTestId('feedback-fab'));
    expect(screen.getByTestId('feedback-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('close-modal'));
    expect(screen.queryByTestId('feedback-modal')).not.toBeInTheDocument();
  });
});
