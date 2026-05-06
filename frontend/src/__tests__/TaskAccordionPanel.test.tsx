import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TaskAccordionPanel from '../components/TaskAccordionPanel';
import type { MyTask } from '../api/tasks';

const DARK = {
  bg: '#03050F', rowBg: '#0F1320', border: '#1C2236', borderHover: '#4F6EF7',
  text: '#E2E8F8', muted: '#8B949E', key: '#484F58',
  chipBg: '#1C2236', chipText: '#8B949E',
  chipActive: 'rgba(79,110,247,0.12)', chipActiveText: '#4F6EF7',
  chipOverdue: 'rgba(239,68,68,0.12)', chipOverdueText: '#EF4444',
  searchBg: '#0F1320', searchBorder: '#1C2236',
  wsBg: '#0A0D1A', sectionBorder: '#1C2236',
};

function makeTask(overrides: Partial<MyTask> = {}): MyTask {
  return {
    id: 'cltest1234567890',
    boardId: 'board1',
    statusId: 'status1',
    title: 'Тестовая задача',
    description: 'Описание задачи',
    priority: 'MEDIUM',
    dueDate: '2099-12-31',
    assigneeId: 'user1',
    creatorId: 'user1',
    orderIndex: 0,
    issueKey: 'TEST-1',
    issueNumber: 1,
    depth: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    status: { id: 'status1', name: 'В работе', color: '#4F6EF7', category: 'IN_PROGRESS' },
    assignee: { id: 'user1', name: 'Иван Иванов', avatar: undefined },
    labels: [],
    board: {
      id: 'board1',
      name: 'Тест доска',
      prefix: 'TEST',
      workspace: { id: 'ws1', name: 'Тест воркспейс', slug: 'test-ws' },
    },
    ...overrides,
  } as MyTask;
}

const defaultProps = {
  id: 'accordion-cltest1234567890',
  colors: DARK,
  isDark: true,
  bp: 'desktop' as const,
  now: new Date('2026-05-01'),
  onOpenInBoard: vi.fn(),
};

describe('TaskAccordionPanel — отображение полей', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('показывает описание задачи', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask()} />);
    expect(screen.getByText('Описание задачи')).toBeInTheDocument();
  });

  it('показывает плейсхолдер когда описание отсутствует', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ description: undefined })} />);
    expect(screen.getByText('Описание не добавлено')).toBeInTheDocument();
  });

  it('показывает имя исполнителя', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask()} />);
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
  });

  it('показывает плейсхолдер когда исполнитель не назначен', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ assigneeId: undefined, assignee: undefined })} />);
    expect(screen.getByText('Не назначен')).toBeInTheDocument();
  });

  it('показывает плейсхолдер когда дедлайн не задан', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ dueDate: undefined })} />);
    expect(screen.getByText('Не указан')).toBeInTheDocument();
  });

  it('показывает плейсхолдер когда теги отсутствуют', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ labels: [] })} />);
    expect(screen.getByText('Нет тегов')).toBeInTheDocument();
  });

  it('НЕ показывает статус на десктопе (он есть в строке списка)', () => {
    render(<TaskAccordionPanel {...defaultProps} bp="desktop" task={makeTask()} />);
    expect(screen.queryByText('В работе')).not.toBeInTheDocument();
  });

  it('показывает статус на мобильном', () => {
    render(<TaskAccordionPanel {...defaultProps} bp="mobile" task={makeTask()} />);
    expect(screen.getByText('В работе')).toBeInTheDocument();
  });
});

describe('TaskAccordionPanel — просроченные задачи', () => {
  it('показывает "Просрочено" когда дедлайн в прошлом', () => {
    const pastDate = '2020-01-01';
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ dueDate: pastDate })} />);
    expect(screen.getByText(/просрочено/i)).toBeInTheDocument();
  });

  it('НЕ показывает "Просрочено" для выполненных задач', () => {
    const pastDate = '2020-01-01';
    render(<TaskAccordionPanel
      {...defaultProps}
      task={makeTask({
        dueDate: pastDate,
        status: { id: 's1', name: 'Готово', color: '#22C55E', category: 'DONE' },
      })}
    />);
    expect(screen.queryByText(/просрочено/i)).not.toBeInTheDocument();
  });
});

describe('TaskAccordionPanel — длинное описание', () => {
  const longDescription = 'А'.repeat(600);

  it('обрезает описание длиннее 500 символов', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ description: longDescription })} />);
    expect(screen.getByText(/\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Читать далее' })).toBeInTheDocument();
  });

  it('раскрывает полный текст по клику на "Читать далее"', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ description: longDescription })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Читать далее' }));
    expect(screen.queryByText(/\.\.\.$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Свернуть' })).toBeInTheDocument();
  });

  it('кнопка "Читать далее" имеет aria-expanded=false изначально', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ description: longDescription })} />);
    expect(screen.getByRole('button', { name: 'Читать далее' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('кнопка "Свернуть" имеет aria-expanded=true после раскрытия', () => {
    render(<TaskAccordionPanel {...defaultProps} task={makeTask({ description: longDescription })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Читать далее' }));
    expect(screen.getByRole('button', { name: 'Свернуть' })).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('TaskAccordionPanel — кнопка "Открыть"', () => {
  it('вызывает onOpenInBoard с задачей при клике', () => {
    const onOpen = vi.fn();
    const task = makeTask();
    render(<TaskAccordionPanel {...defaultProps} task={task} onOpenInBoard={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /открыть/i }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(task);
  });
});

describe('TaskAccordionPanel — безопасность avatar', () => {
  it('рендерит img для https avatar URL', () => {
    const task = makeTask({ assignee: { id: 'u1', name: 'Test', avatar: 'https://cdn.example.com/avatar.jpg' } });
    const { container } = render(<TaskAccordionPanel {...defaultProps} task={task} />);
    // alt="" → role="presentation"; проверяем через DOM напрямую
    expect(container.querySelector('img[src="https://cdn.example.com/avatar.jpg"]')).toBeInTheDocument();
  });

  it('НЕ рендерит img для javascript: URL — показывает инициалы', () => {
    const task = makeTask({ assignee: { id: 'u1', name: 'Test', avatar: 'javascript:alert(1)' } });
    const { container } = render(<TaskAccordionPanel {...defaultProps} task={task} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('НЕ рендерит img для data: URL — показывает инициалы', () => {
    const task = makeTask({ assignee: { id: 'u1', name: 'Test', avatar: 'data:text/html,<script>alert(1)</script>' } });
    const { container } = render(<TaskAccordionPanel {...defaultProps} task={task} />);
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });
});

describe('TaskAccordionPanel — стоп-пропагация кликов', () => {
  it('клик внутри панели не всплывает наружу', () => {
    const outerClick = vi.fn();
    render(
      <div onClick={outerClick}>
        <TaskAccordionPanel {...defaultProps} task={makeTask()} />
      </div>,
    );
    fireEvent.click(screen.getByText('Описание задачи'));
    expect(outerClick).not.toHaveBeenCalled();
  });
});
