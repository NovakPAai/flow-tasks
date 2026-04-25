import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FeedbackFAB from '../components/FeedbackFAB';

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

describe('FeedbackFAB', () => {
  beforeEach(() => vi.clearAllMocks());

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
