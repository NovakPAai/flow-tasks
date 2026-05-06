---
id: gap-11-my-tasks-accordion
type: gap-feat
priority: P2
status: approved
---

# Spec: My Tasks — аккордеон с основной информацией по задаче

## Intent
Клик по задаче в разделе "Мои задачи" должен раскрывать inline-панель с ключевыми полями задачи (read-only), не уводя пользователя со страницы. Переход в полный дровер на доске — через явную кнопку "Открыть".

## BDD Scenarios

```gherkin
Feature: Аккордеон в разделе "Мои задачи"

  Background:
    Given я авторизован
    And я нахожусь в разделе "Мои задачи"

  Scenario: Клик по задаче раскрывает аккордеон
    When я кликаю на строку задачи
    Then под ней появляется панель с деталями
    And задача визуально отмечена как раскрытая

  Scenario: Повторный клик закрывает аккордеон
    Given аккордеон задачи открыт
    When я кликаю на неё повторно
    Then панель скрывается

  Scenario: Открытие новой задачи закрывает предыдущую
    Given аккордеон задачи A открыт
    When я кликаю на задачу B
    Then аккордеон B открывается, аккордеон A закрывается

  Scenario: Аккордеон показывает основную информацию
    When я открываю аккордеон
    Then вижу: описание, статус, дедлайн, исполнителя, теги

  Scenario: Поля только для чтения
    Given аккордеон открыт
    When я кликаю на любое поле
    Then поле не становится редактируемым

  Scenario: Задача без описания
    When я открываю аккордеон задачи без описания
    Then вижу плейсхолдер "Описание не добавлено"

  Scenario: Задача без дедлайна / исполнителя
    When я открываю аккордеон задачи без этих полей
    Then вижу "Не задан" / "Не назначен"

  Scenario: Длинное описание
    Given описание задачи > 500 символов
    When я открываю аккордеон
    Then текст обрезается с "..." и кнопкой "Читать далее"
    When я кликаю "Читать далее"
    Then отображается полный текст

  Scenario: Переход в дровер на доске
    Given аккордеон открыт
    When я нажимаю "Открыть"
    Then перехожу на доску с открытым дровером задачи
    And в URL есть параметры ?from=my-tasks&open=<taskId>

  Scenario: Возврат с открытым аккордеоном (явная кнопка)
    Given я перешёл на доску через "Открыть"
    When я нажимаю "← Мои задачи" в шапке доски
    Then возвращаюсь в /my-tasks
    And аккордеон исходной задачи открыт

  Scenario: Возврат через кнопку браузера "Назад"
    Given я перешёл на доску через "Открыть"
    When я нажимаю "Назад" в браузере
    Then возвращаюсь в /my-tasks
    And аккордеон исходной задачи открыт
```

## SDD Contracts

### Types (state only — MyTask already has all data fields)

```typescript
type OpenAccordionId = string | null;

interface MyTasksSearchParams {
  open?: string;   // taskId открытого аккордеона
}

// URL params при navigate на BoardPage
// ?from=my-tasks&open=<taskId>
// + navigate state: { openTaskId: taskId }  (уже читается BoardPage:196)
```

### Component

```typescript
// frontend/src/components/TaskAccordionPanel.tsx
interface TaskAccordionPanelProps {
  task: MyTask;
  colors: Record<string, string>;
  isDark: boolean;
  onOpenInBoard: () => void;
}

const DESCRIPTION_PREVIEW_LIMIT = 500;
```

### MyTasksPage state changes

```typescript
// Убрать: selectedTaskId, drawerCtx, drawerBoardId, boardCtxCache,
//         fetchingBoardIdRef, openDrawer, TaskDrawer, BoardContext,
//         boardsApi / workspacesApi / labelsApi imports

// Добавить:
const [openAccordionId, setOpenAccordionId] = useState<OpenAccordionId>(null);

// Restore from URL on mount:
const [searchParams] = useSearchParams();
useEffect(() => {
  const id = searchParams.get('open');
  if (id) setOpenAccordionId(id);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// Toggle accordion (one open at a time):
function toggleAccordion(taskId: string) {
  setOpenAccordionId(prev => prev === taskId ? null : taskId);
}

// Navigate to board with drawer + return context:
function openInBoard(task: MyTask) {
  navigate(
    `/w/${task.board.workspace.slug}/boards/${task.board.prefix.toLowerCase()}` +
    `?from=my-tasks&open=${task.id}`,
    { state: { openTaskId: task.id } }
  );
}
```

### BoardPage changes

```typescript
// Читать from + open из searchParams (уже есть useSearchParams):
const fromMyTasks = searchParams.get('from') === 'my-tasks';
const myTasksOpenId = searchParams.get('open');

// Показать кнопку "← Мои задачи" рядом с Back, когда fromMyTasks === true:
// navigate(`/my-tasks?open=${myTasksOpenId}`)
```

## Scope
- `frontend/src/components/TaskAccordionPanel.tsx` — новый компонент
- `frontend/src/pages/MyTasksPage.tsx` — замена drawer → accordion
- `frontend/src/pages/BoardPage.tsx` — кнопка "← Мои задачи" в шапке

## Out of Scope
- Редактирование полей из аккордеона
- Показ подзадач в аккордеоне
- Мобильный вариант (отличается от десктопа)

## Constraints
- MyTask уже содержит все нужные поля — новых API-запросов нет
- BoardPage уже читает `location.state.openTaskId` — используем этот механизм
- Дизайн-токены (DARK/LIGHT) передаются в панель из MyTasksPage

## Acceptance Criteria
- [ ] Клик по задаче → аккордеон (не дровер, не навигация)
- [ ] Один аккордеон открыт одновременно
- [ ] Поля read-only
- [ ] Пустые поля показывают плейсхолдеры
- [ ] Описание > 500 символов обрезается с "Читать далее"
- [ ] "Открыть" → доска + дровер открыт + URL ?from=my-tasks&open=id
- [ ] "← Мои задачи" на доске → /my-tasks?open=id → аккордеон восстановлен
- [ ] Браузерный Back при навигации из аккордеона также восстанавливает состояние
