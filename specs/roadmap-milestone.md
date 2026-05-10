# Spec: Roadmap — Milestone-маркеры для задач только с дедлайном

**Статус:** Реализовано (частично) + открытые задачи  
**Ветка:** `fix/roadmap-milestone-bars`  
**Дата:** 2026-05-08

---

## Проблема

Задачи с только `dueDate` (без `startDate`) отрисовывались как 6px вертикальная черта вместо нормального элемента на временно́й шкале. Причина: `start = end = dueDate` → `diffDays = 0` → `Math.max(6, 0 * dayPx) = 6px`.

---

## Решение (реализовано)

Задачи без `startDate` рендерятся как **ромб-маркер (milestone diamond)** в позиции `dueDate`.

### Визуальный язык таймлайна

| Элемент | Условие | Внешний вид |
|---------|---------|-------------|
| Бар | `startDate` + `dueDate` | Цветной прямоугольник от start до end |
| Milestone-ромб | только `dueDate` | Ромб ◇ в позиции дедлайна |
| Просроченный бар | `dueDate < сегодня` + статус ≠ DONE | Красный пунктирный хвост |
| Просроченный ромб | `dueDate < сегодня` + статус ≠ DONE | Красный ромб, пульсация |
| Нет дат | нет ни одной даты | Italic-текст «нет дат» |

### Параметры milestone-ромба

```
mSize:  16px (родительская задача), 14px (дочерняя)
hitbox: mSize + 16 = 32px (невидимая область для hover, облегчает попадание мышью)
clamp:  left зажат в [mSize/2, TL_W - mSize/2] — ромб не выходит за края
```

### Структура DOM (разделение transform)

```html
<!-- позиционирующий wrapper: translateY(-50%) — никогда не мутируется -->
<div style="position:absolute; top:50%; left:{clampedMx - hitbox/2}; transform:translateY(-50%); width:{hitbox}; height:{hitbox}">
  <!-- визуальный ромб: rotate(45deg) scale(1) — scale мутируется при hover -->
  <div data-mile-inner style="transform:rotate(45deg); transition:transform .12s; ...">
  </div>
</div>
```

Разделение не даёт hover-анимации (`scale`) испортить позиционирующий `translateY(-50%)`.

---

## Фиксы, вошедшие в PR #158

### Frontend (`RoadmapView.tsx`)

| # | Проблема | Severity | Статус |
|---|---------|----------|--------|
| F1 | `start=end=dueDate` → 6px черта | CRITICAL | ✅ Milestone-ромб |
| F2 | Transform isolation: scale ломал translateY | HIGH | ✅ Wrapper + inner div |
| F3 | `«нет дат»` виден только в конце скролла (`right:10`) | LOW | ✅ Перенесён на `left:10` |
| F4 | Иконка галочки в тултипе milestone — семантически неверна | HIGH | ✅ Заменена на ромб SVG |
| F5 | Child-ромб 12px — нечитаем | HIGH | ✅ Минимум 14px |
| F6 | Hitbox milestone = визуальный размер — сложно попасть | HIGH | ✅ Hitbox 32px |
| F7 | Нет подсказки как получить бар вместо ромба | MEDIUM | ✅ Hint в тултипе |
| F8 | `status.color` интерполируется в CSS без валидации (CSS injection) | MEDIUM | ✅ `safeColor()` |
| F9 | Все места с `st?.color` в строках стилей | MEDIUM | ✅ Обёрнуты `safeColor()` |
| F10 | `prefers-reduced-motion` не учитывался | MEDIUM | ✅ `@media` в `<style>` |
| F11 | Clamp: ромб мог вылезти за левый/правый край | CRITICAL | ✅ `clampedMx` |

### Backend (`boards.service.ts`)

| # | Проблема | Severity | Статус |
|---|---------|----------|--------|
| B1 | `statusHistory` возвращал все поля модели | LOW | ✅ Добавлен `select` (id, statusId, startedAt, endedAt) |
| B2 | Нет ограничения на диапазон дат → DB scan за годы | LOW | ✅ `MAX_RANGE_DAYS = 730` |

---

## Открытые задачи (backlog)

### UX / UI

| ID | Проблема | Severity | Описание |
|----|---------|----------|----------|
| U1 | Нет легенды таймлайна | CRITICAL | Пользователь не знает: ромб = дедлайн, бар = диапазон, красный хвост = просрочка. Нужна кнопка «Легенда» в toolbar с popover |
| U2 | Tooltip недоступен на touch/mobile | HIGH | `onMouseEnter` не работает на тачскринах. Нужен `onTouchStart` → показ tooltip на 2с, или `onClick` → мобильный drawer |
| U3 | 1400px без scroll affordance на мобильном | HIGH | Нет fade-градиента по правому краю, нет `scroll-snap`. Пользователь не знает что можно скроллить |
| U4 | Collision detection overlapping milestones | MEDIUM | При нескольких milestone в одну неделю ромбы перекрываются. Нужен вертикальный offset (±8px) или badge-счётчик |
| U5 | Бар без текста при `cw < 38` — немой цветной блок | MEDIUM | Нужен label над/под баром или `···` при hover |
| U6 | Keyboard navigation по строкам задач | LOW | Нет `tabIndex`, `role="button"`, `onKeyDown` |
| U7 | Keyboard shortcuts W/M/Q для zoom | LOW | Стандарт Jira/Linear |
| U8 | Loading skeleton для area баров | LOW | Сейчас при загрузке правая панель выглядит сломанной |
| U9 | Overdue tail не виден для задач с dueDate до range.start | LOW | Нужен отдельный badge просрочки по левому краю |

### Code quality

| ID | Проблема | Severity | Описание |
|----|---------|----------|----------|
| C1 | `getToday()` вызывается N раз при рендере (per row) | MEDIUM | Вычислять один раз в начале рендера и передавать в замыкание |
| C2 | `onMouseMove → setTip → re-render` на 60fps | MEDIUM | Throttle через `requestAnimationFrame`. Захватить `clientX/Y` до rAF callback |
| C3 | `isMilestone` — asymmetry: startDate-only → 6px слайвер | LOW | Задача только с startDate (без dueDate) всё ещё рендерится как 6px черта. Задокументировать или вынести в отдельный milestone-ромб |
| C4 | `isMilestone` дублируется в `BarTooltip` как `!start && end` | LOW | Передавать как prop `isMilestone: boolean` или вынести в утилиту |

### Security (hardening, не критично)

| ID | Проблема | Severity | Описание |
|----|---------|----------|----------|
| S1 | `task.title` в `title` атрибуте — длина не ограничена | LOW | Truncate до 200 символов (UX, не XSS — React escapes all) |

---

## Тест-план

### Smoke tests (вручную)

- [ ] Создать задачу только с `dueDate` → открыть roadmap → ромб в позиции дедлайна
- [ ] Создать задачу с `startDate` + `dueDate` → бар от start до end (без изменений)
- [ ] Создать задачу без дат → «нет дат» слева в строке
- [ ] Hover на ромб → scale 1.25 + tooltip «Дедлайн: X» + hint про startDate
- [ ] Milestone на краю видимого диапазона → ромб не вылезает за границы
- [ ] Milestone с `dueDate < сегодня` → красный ромб
- [ ] Проверить все zoom: неделя / месяц / квартал → ромб виден на каждом
- [ ] Светлая тема → ромб виден (не сливается с фоном)
- [ ] Тёмная тема → ромб виден

### Регрессия

- [ ] Существующие бары с `startDate + dueDate` — без изменений
- [ ] Segmented bars (история статусов) — работают корректно
- [ ] Overdue tail у баров — отображается

---

## Дизайн-решения и rationale

**Почему ромб, а не бар от createdAt?**  
Использование `createdAt` как start создаёт вводящие в заблуждение бары: задача, созданная 3 месяца назад с дедлайном завтра, показала бы трёхмесячный бар. Ромб-маркер честно отражает что у задачи есть только дедлайн — это стандарт Gantt-диаграмм (Jira, Linear, MS Project, Monday.com).

**Почему hitbox 32px при визуале 16px?**  
Стандарт touch/pointer targets — минимум 44px (Apple HIG), минимум 48px (Material Design). 32px — компромисс для desktop (не перекрывает соседние ромбы в плотных списках).

**Почему clamp ромба, а не скрытие?**  
Если задача в диапазоне по дате но ромб выходит за пиксельный край — лучше показать его прижатым к краю, чем скрыть. Пользователь видит «здесь что-то есть» и может проскроллить.
