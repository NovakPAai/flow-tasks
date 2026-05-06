---
id: gap-01-my-tasks-drawer
type: gap-fix
priority: P1
status: superseded
superseded_by: gap-11-my-tasks-accordion
---

# Spec: My Tasks — открывать TaskDrawer вместо перехода на доску

> **SUPERSEDED** — заменён на gap-11 (аккордеон). Клик по задаче теперь раскрывает
> inline-аккордеон с read-only полями; переход в полный TaskDrawer происходит через
> кнопку "Открыть" внутри аккордеона (открывает BoardPage с дровером).
> TaskDrawer и весь lazy-load контекста доски удалены из MyTasksPage.

## Intent
Клик по задаче в My Tasks должен открывать TaskDrawer прямо на странице, а не делать навигацию на доску.

## Root Cause
`MyTasksPage.tsx:319` — `onClick={() => navigate(...)` вместо открытия drawer.
Страница не подгружает statuses/members, необходимые для DrawerProps.

## Scope
- Добавить состояние `selectedTaskId` в MyTasksPage
- Подгружать statuses и members для board при открытии drawer
- Открывать TaskDrawer поверх My Tasks
- После изменения / удаления в drawer — обновить строку в списке

## Out of Scope
- Изменение URL при открытии drawer (deep link до задачи)
- Предзагрузка statuses для всех boards

## Constraints
- Данные board (statuses, members) нужны для TaskDrawer — грузить lazily при первом открытии задачи с этой доски
- Кэшировать per-boardId чтобы не делать повторный fetch для задач одной доски
- VIEWER не видит кнопки редактирования в drawer (isOwner: false)

## Acceptance Criteria
- [ ] Клик по задаче в My Tasks → drawer открывается поверх страницы
- [ ] Navigate на доску НЕ происходит
- [ ] DrawerDetails: поля редактируемы (если OWNER/MEMBER)
- [ ] Изменение title в drawer → строка в списке My Tasks обновляется
- [ ] Удаление задачи в drawer → строка исчезает из списка My Tasks
- [ ] ESC / кнопка закрытия → drawer закрывается, My Tasks остаётся
