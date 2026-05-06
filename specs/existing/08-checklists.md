---
id: 08-checklists
type: existing
status: approved
---

# Spec: Чеклисты

## Intent
Список шагов внутри задачи с возможностью отметки выполнения.

## Scope
- Создание/удаление чеклиста (OWNER/MEMBER only)
- Добавление, обновление (title, isDone), удаление пунктов
- Прогресс-бар X/N в заголовке чеклиста
- ChecklistBlock в TaskDrawer (Details)
- Несколько чеклистов на одну задачу

## Out of Scope
- Reorder пунктов чеклиста (нет drag-n-drop — см. gap-10)
- Вложенные чеклисты
- Привязка пункта к исполнителю

## Constraints
- VIEWER: только просмотр
- Нет max items per checklist
- Нет max length на title пункта
- Нет PATCH /checklists/:id (update название чеклиста)

## Acceptance Criteria
- [ ] POST /tasks/:tid/checklists → 201
- [ ] POST /checklists/:id/items → 201, item добавлен
- [ ] PATCH /checklist-items/:id (isDone: true) → 200, прогресс-бар обновлён
- [ ] DELETE /checklists/:id → 204, все items удалены
- [ ] ChecklistBlock: Enter в поле нового item → создаёт item и фокусирует следующий
