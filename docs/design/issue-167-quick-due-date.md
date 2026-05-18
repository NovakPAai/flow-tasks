---
id: issue-167-quick-due-date
type: enhancement
priority: P2
status: approved
---

# Design: Быстрая правка срока задачи без открытия карточки

## Intent
Дать пользователю редактировать поле `dueDate` задачи прямо с карточки/строки/чипа, не открывая TaskDrawer. Сокращает один клик и переключение контекста.

## Scope
**Frontend only.** Backend не трогается — `PATCH /api/tasks/:id` уже принимает `dueDate: string | null` (см. `backend/src/modules/tasks/tasks.dto.ts:19`), RBAC отрезает Viewer на сервере (`tasks.service.ts:512`).

## Component contract — `QuickDueDate`

Файл: `frontend/src/components/QuickDueDate.tsx`

```typescript
interface QuickDueDateProps {
  taskId: string;
  value: string | null;          // ISO date or null
  canEdit: boolean;               // false → render as read-only label
  variant?: 'badge-only' | 'badge-or-add';  // default 'badge-only'
  size?: 'sm' | 'md';             // sm = 11px font (card), md = 13px (list)
  showOverdue?: boolean;          // default true — paint red if past
  onChange?: (next: string | null) => void;  // notify parent for optimistic update
}
```

### Поведение

| `value` | `canEdit` | `variant` | Рендер |
|---------|-----------|-----------|--------|
| ISO | true  | any | clickable date-badge → клик открывает popover |
| ISO | false | any | static date-badge (no hover, no popover) |
| null | true  | `badge-only` | `null` — ничего не рендерится |
| null | true  | `badge-or-add` | hover-only кнопка «+ срок» |
| null | false | any | `null` |

### Popover

- AntD `DatePicker` в режиме `open` (controlled)
- Footer: кнопка «Очистить» → `onChange(null)` + закрывает попап
- Esc → закрытие без изменений
- Enter / выбор даты → отправляет PATCH

### API call

```typescript
await tasksApi.updateTask(taskId, { dueDate: nextValue });  // string | null
```

Optimistic update: `onChange(next)` вызывается ДО ожидания ответа, при ошибке — откат + `message.error('Не удалось обновить срок')`.

## RBAC

Caller передаёт `canEdit` (обычно `userRole !== 'VIEWER'`). Серверная защита уже есть — компонент только UX-слой.

## Click isolation

В popover-trigger используется `e.stopPropagation()` чтобы клик не пробивался к родительскому `onClick` карточки (открывающему TaskDrawer).

## Integration map

| Файл | Контекст | variant |
|------|----------|---------|
| `frontend/src/components/TaskCard.tsx` | Kanban-карточка, footer | `badge-or-add` |
| `frontend/src/components/BoardListView.tsx` | колонка «Срок» | `badge-or-add` |
| `frontend/src/pages/MyTasksPage.tsx` | список «Мои задачи» | `badge-or-add` |
| `frontend/src/components/RoadmapView.tsx` | — | **скип в этом PR**: tooltip имеет `pointer-events: none`, редактирование даты на time-bar требует drag-resize (отдельный feat) |
| `frontend/src/components/TaskDrawer.tsx` | drawer — не трогаем (там полноценная форма) | — |

## State synchronization

После успешного PATCH:
- `tasks.store.ts` уже имеет `updateTaskInStore(id, patch)` — переиспользуем
- если store не используется напрямую — `onChange` поднимается до владельца списка задач (BoardPage, MyTasksPage), который зовёт refresh / setState

## Risks

| Риск | Mitigation | Verify |
|------|-----------|--------|
| Клик по чипу открывает TaskDrawer | `stopPropagation` в обработчике trigger | Test: «клик по дате не открывает drawer» |
| Optimistic update оставляет половинное состояние при ошибке | rollback в catch + toast | Test: «error → rollback» |
| Hover-кнопка «+ срок» не скрывается на touch-устройствах | media-query `@media (hover: hover)` для отображения add-кнопки | manual smoke на mobile |
| Viewer видит «+ срок» из-за бага в `canEdit` prop | обязательная проверка `canEdit` перед рендером add-кнопки | Test: «viewer не видит +срок» |

## UX-чек-лист (WCAG AA + vercel/ux-designer)

- [x] Loading: spinner на чипе во время PATCH
- [x] Empty: «+ срок» placeholder на hover (desktop) / всегда (touch — TBD)
- [x] Error: toast + откат значения
- [x] Disabled: read-only badge для Viewer
- [x] Keyboard: Tab → Enter открывает попап, Esc закрывает
- [x] Focus visible: AntD стандартный outline
- [x] Touch target: trigger padding 4×8 → hit-zone ~24×32, при touch — 44×44 через media-query
- [x] Click isolation: stopPropagation
- [x] Screen reader: `aria-label="Изменить срок задачи"` на trigger
