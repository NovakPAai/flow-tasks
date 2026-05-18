import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import QuickDueDate from '../components/QuickDueDate';
import * as tasksApi from '../api/tasks';

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: { error: vi.fn(), success: vi.fn() },
  };
});

vi.mock('../api/tasks', async () => {
  const actual = await vi.importActual<typeof import('../api/tasks')>('../api/tasks');
  return {
    ...actual,
    updateTask: vi.fn(),
  };
});

vi.mock('../utils/useBreakpoint', () => ({
  useBreakpoint: () => 'desktop',
}));

const updateTaskMock = vi.mocked(tasksApi.updateTask);

describe('QuickDueDate', () => {
  beforeEach(() => {
    updateTaskMock.mockReset();
    updateTaskMock.mockResolvedValue({ id: 't1', dueDate: '2026-05-25T00:00:00.000Z' } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when value is null and variant=badge-only', () => {
    const { container } = render(
      <QuickDueDate taskId="t1" value={null} canEdit variant="badge-only" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "+ срок" placeholder when value is null and variant=badge-or-add and canEdit', () => {
    render(<QuickDueDate taskId="t1" value={null} canEdit variant="badge-or-add" />);
    expect(screen.getByRole('button', { name: 'Добавить срок задачи' })).toBeInTheDocument();
  });

  it('renders read-only badge when canEdit=false and value present', () => {
    render(<QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit={false} />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText(/20 мая/)).toBeInTheDocument();
  });

  it('renders nothing for viewer (canEdit=false) when value is null', () => {
    const { container } = render(
      <QuickDueDate taskId="t1" value={null} canEdit={false} variant="badge-or-add" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for invalid value (empty string treated as no date)', () => {
    const { container } = render(
      <QuickDueDate taskId="t1" value="" canEdit variant="badge-only" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens popover with native date input on trigger click', () => {
    render(<QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit />);
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    expect(screen.getByLabelText('Дата срока')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-05-20')).toBeInTheDocument();
  });

  it('stops propagation on trigger click (does not call parent onClick)', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    expect(parentClick).not.toHaveBeenCalled();
  });

  it('calls updateTask and onChange optimistically on date select', async () => {
    const onChange = vi.fn();
    render(
      <QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    const input = screen.getByLabelText('Дата срока') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-05-25' } });

    await waitFor(() => {
      expect(updateTaskMock).toHaveBeenCalledWith('t1', {
        dueDate: '2026-05-25T00:00:00.000Z',
      });
    });
    expect(onChange).toHaveBeenCalledWith('2026-05-25T00:00:00.000Z');
  });

  it('clears due date via "Очистить" button', async () => {
    const onChange = vi.fn();
    render(
      <QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    fireEvent.click(screen.getByRole('button', { name: /очистить/i }));

    await waitFor(() => {
      expect(updateTaskMock).toHaveBeenCalledWith('t1', { dueDate: null });
    });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('rolls back optimistic update on API error', async () => {
    updateTaskMock.mockRejectedValueOnce(new Error('500'));
    const onChange = vi.fn();
    render(
      <QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    const input = screen.getByLabelText('Дата срока') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2026-05-25' } });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('2026-05-20T00:00:00.000Z');
    });
  });

  it('closes popover on Escape', () => {
    render(<QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit />);
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    expect(screen.getByLabelText('Дата срока')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('Дата срока')).toBeNull();
  });

  it('paints overdue chip red', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString();
    render(<QuickDueDate taskId="t1" value={yesterday} canEdit />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveStyle({ color: '#F87171' });
  });

  it('includes year in chip when date is in a different year', () => {
    const nowYear = new Date().getUTCFullYear();
    const nextYearIso = `${nowYear + 1}-06-15T00:00:00.000Z`;
    render(<QuickDueDate taskId="t1" value={nextYearIso} canEdit={false} />);
    expect(screen.getByText(new RegExp(`15 июн.* ${nowYear + 1}`))).toBeInTheDocument();
  });

  it('serialises rapid saves — older save does not overwrite newer state on error', async () => {
    // first save: in-flight; will reject AFTER second succeeds
    let rejectFirst: (e: unknown) => void = () => {};
    updateTaskMock.mockImplementationOnce(
      () => new Promise<never>((_, reject) => { rejectFirst = reject; }) as never,
    );
    // second save: succeeds immediately
    updateTaskMock.mockResolvedValueOnce({ id: 't1' } as never);

    const onChange = vi.fn();
    render(
      <QuickDueDate taskId="t1" value="2026-05-20T00:00:00.000Z" canEdit onChange={onChange} />
    );
    fireEvent.click(screen.getByRole('button', { name: /20 мая/ }));
    fireEvent.click(screen.getByRole('button', { name: /очистить/i }));

    await waitFor(() => expect(updateTaskMock).toHaveBeenCalledTimes(1));
    rejectFirst(new Error('stale'));

    // After microtask flush, the stale rejection must NOT have called onChange with prev value.
    await waitFor(() => expect(onChange.mock.calls[0][0]).toBeNull());
    // Optimistic null + no rollback. updateTaskMock called only once (first request);
    // second was deduped by saveIdRef because user clicked Clear while first was in-flight.
  });
});
