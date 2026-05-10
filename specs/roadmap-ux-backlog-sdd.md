# SDD: Roadmap UX Backlog

## 1. Контекст и цель

Роадмап — центральный экран планирования в Flow Tasks. Текущая реализация функционально
корректна, но уступает в части UX: нет визуальных подсказок при переполнении viewport,
отсутствует keyboard-first навигация, touch-события не обрабатываются, milestone-ромбы
перекрываются при коллизии дат, доступность (a11y) не покрыта.

Цель бэклога — закрыть эти пробелы одним итерируемым блоком работ, не ломая
существующую логику рендеринга баров и milestone.

Компонент-хост: `RoadmapView` (или аналогичный корневой компонент роадмапа).
Все фичи реализуются внутри одного React-компонента или набора подкомпонентов
с минимальным добавлением state/refs.

---

## 2. Изменённые компоненты

| Компонент / файл | Изменение |
|---|---|
| `RoadmapView.tsx` | Основной хост: добавление state, refs, event-listeners |
| `RoadmapRow.tsx` | keyboard nav (tabindex, aria-expanded, onKeyDown) |
| `MilestoneMarker.tsx` | collision offset prop, touch tooltip handler |
| `TaskBar.tsx` | touch tooltip handler, overdue off-screen badge |
| `LegendPopover.tsx` | новый компонент |
| `LoadingSkeleton.tsx` | новый компонент |
| `roadmap.css` | rm-pulse анимация, fade gradient, overdue badge стили |

---

## 3. Новые фичи — дизайн каждой

### 3.1 Legend Popover

**Задача.** Показать пользователю расшифровку цветовых обозначений роадмапа.

**State.** `showLegend: boolean` — управляет видимостью popover.

**Компонент `LegendPopover`.** Рендерится условно: `{showLegend && <LegendPopover />}`.
Позиционируется `position: absolute` относительно кнопки «Легенда».

**Содержимое.**
- Строка «Задача в срок» + зелёный индикатор
- Строка «Задача просрочена» + красный индикатор
- Строка «Milestone» + ромб-иконка

**Открытие/закрытие.**
Кнопка «Легенда» вызывает `setShowLegend(prev => !prev)`.
Атрибут `aria-expanded={showLegend}` на кнопке.

**Закрытие по Escape и backdrop.**
В `useEffect` при `showLegend === true` подписываемся на `document.keydown`.
При `key === 'Escape'` вызываем `setShowLegend(false)` и возвращаем фокус на
кнопку через `legendButtonRef.current?.focus()`.

Backdrop-click: `mousedown`-обработчик на `document`; если `event.target` не
содержится внутри popover-контейнера и не является самой кнопкой — закрываем.
Оба listener'а убираются в cleanup `useEffect`.

```
useEffect(() => {
  if (!showLegend) return;
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setShowLegend(false); legendButtonRef.current?.focus(); }
  };
  const onOutside = (e: MouseEvent) => {
    if (!popoverRef.current?.contains(e.target as Node) &&
        e.target !== legendButtonRef.current) {
      setShowLegend(false);
    }
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('mousedown', onOutside);
  return () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('mousedown', onOutside);
  };
}, [showLegend]);
```

---

### 3.2 Keyboard Shortcuts

**Задача.** W / M / Q меняют zoom без мыши.

**Регистрация.**
Один `useEffect` в `RoadmapView`, подписывается на `document.addEventListener('keydown', handler)`.
Cleanup при размонтировании или изменении зависимостей.

**Логика handler.**

```
const handler = (e: KeyboardEvent) => {
  const tag = (e.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  switch (e.key.toLowerCase()) {
    case 'w': setZoom('week');    break;
    case 'm': setZoom('month');   break;
    case 'q': setZoom('quarter'); break;
  }
};
```

Проверка `tagName` гарантирует, что typing в полях ввода не перехватывается.
Дополнительно проверяем `e.isComposing` — игнорируем IME-композицию.

**Zoom-кнопки.** Каждая кнопка получает атрибут `title`:
- Неделя: `title="Неделя (W)"`
- Месяц: `title="Месяц (M)"`
- Квартал: `title="Квартал (Q)"`

---

### 3.3 Loading Skeleton

**Задача.** Показать placeholder во время загрузки данных вместо пустого экрана.

**Компонент `LoadingSkeleton`.** Принимает `rows: number = 5`.

Левая панель: 5 прямоугольников `height: 20px`, `border-radius: 4px`,
ширина варьируется (60%, 45%, 70%, 55%, 65%) — имитирует список задач.

Область баров: 5 прямоугольников с произвольным `left` offset и шириной —
имитируют бары разной длины.

**Анимация.** CSS-класс `rm-pulse`:

```css
@keyframes rm-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
.rm-pulse {
  animation: rm-pulse 1.4s ease-in-out infinite;
  background: var(--color-skeleton, #e5e7eb);
}
```

**Условный рендер.**

```tsx
if (isLoading) return <LoadingSkeleton rows={5} />;
```

---

### 3.4 Keyboard Navigation

**Задача.** Полная навигация по дереву задач без мыши.

**Атрибуты на `RoadmapRow`.**

```tsx
<div
  role="row"
  tabIndex={hasChildren ? 0 : -1}
  aria-expanded={hasChildren ? isExpanded : undefined}
  onKeyDown={hasChildren ? handleKeyDown : undefined}
>
```

`tabIndex=0` только для строк с дочерними задачами — они интерактивны.
Строки-листья не получают фокус клавиатурой.

**`handleKeyDown`.**

```tsx
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggleExpand(task.id);
  }
};
```

`e.preventDefault()` для Space предотвращает скролл страницы.

**Визуальный фокус.** CSS `[role="row"]:focus-visible { outline: 2px solid var(--color-focus); }`.

---

### 3.5 Touch Tooltip

**Задача.** На touch-устройствах hover недоступен — тап открывает tooltip с деталями.

**State.**

```ts
const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
```

**Ref для cleanup.**

```ts
const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Обработчик `onTouchStart`** (одинаков для milestone и bar):

```ts
const handleTouchStart = (e: React.TouchEvent, text: string) => {
  e.preventDefault();
  const touch = e.touches[0];
  setTip({ text, x: touch.clientX, y: touch.clientY - 40 });

  // Автоматическое скрытие через 4 секунды
  if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  touchTimerRef.current = setTimeout(() => setTip(null), 4000);

  // Скрытие при скролле (once)
  window.addEventListener('touchmove', () => setTip(null), { once: true });
};
```

**Для milestone.** `text = "Дедлайн: " + formatDate(milestone.date)`.
**Для bar.** `text = task.title`.

**Cleanup в `useEffect`.**

```ts
useEffect(() => {
  return () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };
}, []);
```

**Рендер tooltip.**

```tsx
{tip && (
  <div
    className="rm-touch-tooltip"
    style={{ left: tip.x, top: tip.y, position: 'fixed' }}
    role="tooltip"
  >
    {tip.text}
  </div>
)}
```

---

### 3.6 Milestone Collision Detection

**Задача.** Два и более ромба в одной X-позиции перекрывают друг друга — нужно
распределить их по оси Y.

**Данные.** `milestoneYOffsets: Map<taskId, number>` вычисляется при изменении
задач (`useMemo` или `useEffect` с зависимостью от `tasks`).

**Алгоритм.**

1. Собрать все milestone: `{ taskId, mx: xOf(date) }[]`.
2. Отсортировать по `mx`.
3. Сгруппировать в кластеры: смежные milestone с одинаковым `mx` → одна группа.
4. Назначить offsets по размеру группы:
   - Группа из 2: `[-7, +7]`
   - Группа из 3: `[-7, 0, +7]`
   - Группа из 4+: равномерный шаг `14 / (n-1)`, центрированный вокруг 0

```ts
const computeOffsets = (tasks: Task[]): Map<string, number> => {
  const milestones = tasks
    .filter(t => t.milestone)
    .map(t => ({ taskId: t.id, mx: xOf(t.milestone!.date) }))
    .sort((a, b) => a.mx - b.mx);

  const map = new Map<string, number>();
  let i = 0;
  while (i < milestones.length) {
    let j = i;
    while (j < milestones.length && milestones[j].mx === milestones[i].mx) j++;
    const group = milestones.slice(i, j);
    const n = group.length;
    group.forEach((m, idx) => {
      const offset = n === 1 ? 0 : -7 + (14 / (n - 1)) * idx;
      map.set(m.taskId, offset);
    });
    i = j;
  }
  return map;
};
```

**Применение.** В `MilestoneMarker` получаем `yOffset = milestoneYOffsets.get(task.id) ?? 0`
и добавляем к `cy` (SVG) или `translateY` (CSS).

---

### 3.7 Scroll Affordance

**Задача.** Сигнализировать пользователю, что содержимое продолжается за правым краем.

**Реализация.** Абсолютно позиционированный `div` поверх области баров:

```tsx
<div
  className="rm-scroll-fade"
  aria-hidden="true"
/>
```

```css
.rm-scroll-fade {
  position: absolute;
  top: 0;
  right: 0;
  width: 32px;
  height: 100%;
  background: linear-gradient(to right, transparent, var(--color-bg, #fff));
  pointer-events: none;
  z-index: 2;
}
```

`pointer-events: none` — gradient не блокирует клики на элементы под ним.
`aria-hidden="true"` — декоративный элемент, не читается скринридером.

**Условный рендер.** Gradient показывается всегда пока `scrollWidth > clientWidth`
(вычисляем через `ResizeObserver` или при изменении `zoom`/`tasks`).

---

### 3.8 Overdue Off-Screen Badge

**Задача.** Задача с просроченным дедлайном, выходящим за левый край диапазона,
должна визуально сигнализировать об этом.

**Условие.**

```ts
const overdueOffscreen = (task: Task): boolean => {
  if (!task.dueDate) return false;
  const dueX = xOf(task.dueDate);
  return task.isOverdue && dueX < 0;
};
```

`xOf` возвращает пиксельную X-координату даты в текущем viewport; значение `< 0`
означает, что дедлайн до начала видимого диапазона.

**Рендер badge.**

```tsx
{overdueOffscreen(task) && (
  <div
    className="rm-overdue-badge"
    aria-label="Задача просрочена (дедлайн вне диапазона)"
    role="img"
  />
)}
```

```css
.rm-overdue-badge {
  position: absolute;
  left: 0;
  top: 0;
  width: 4px;
  height: 100%;
  background: var(--color-overdue, #ef4444);
  border-radius: 0 2px 2px 0;
}
```

---

### 3.9 rAF throttle для mousemove

**Задача.** Обработчик `mousemove` на SVG-области запускается сотни раз в секунду
и вызывает ненужные ре-рендеры tooltip/cursor.

**Ref.**

```ts
const rafRef = useRef<number | null>(null);
```

**Throttled handler.**

```ts
const onMouseMove = (e: React.MouseEvent) => {
  if (rafRef.current !== null) return;
  rafRef.current = requestAnimationFrame(() => {
    updateTooltipPosition(e.clientX, e.clientY);
    rafRef.current = null;
  });
};
```

**Cleanup.**

```ts
useEffect(() => {
  return () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  };
}, []);
```

Это гарантирует не более одного обновления position per frame (~60fps), исключая
лишние вызовы React reconciler.

---

## 4. State & Refs

| Имя | Тип | Назначение |
|---|---|---|
| `showLegend` | `boolean` | Управляет видимостью LegendPopover |
| `tip` | `{ text, x, y } \| null` | Данные активного touch tooltip |
| `milestoneYOffsets` | `Map<string, number>` | Предвычисленные Y-смещения ромбов (collision) |
| `touchTimerRef` | `useRef<ReturnType<typeof setTimeout> \| null>` | Ссылка на таймер автоскрытия touch tooltip |
| `rafRef` | `useRef<number \| null>` | Ссылка на pending rAF для mousemove throttle |
| `legendButtonRef` | `useRef<HTMLButtonElement \| null>` | Для возврата фокуса после закрытия popover |
| `popoverRef` | `useRef<HTMLDivElement \| null>` | Для проверки outside click |

Все refs инициализируются как `null` и не вызывают ре-рендер при изменении.
`milestoneYOffsets` пересчитывается через `useMemo` при изменении `tasks`.

---

## 5. Accessibility

| Требование | Реализация |
|---|---|
| Кнопка «Легенда» | `aria-expanded`, `aria-controls="legend-popover"` |
| LegendPopover | `role="dialog"`, `id="legend-popover"`, `aria-label="Легенда роадмапа"` |
| RoadmapRow с детьми | `role="row"`, `tabIndex=0`, `aria-expanded` |
| Zoom-кнопки | `title` с kbd shortcut, `aria-pressed` для активного |
| Touch tooltip | `role="tooltip"` |
| Overdue badge | `role="img"`, `aria-label` с описанием |
| Scroll fade | `aria-hidden="true"` |
| Skeleton | `aria-busy="true"` на контейнере во время загрузки |
| Focus ring | `focus-visible` outline 2px на всех интерактивных элементах |
| Escape → возврат фокуса | focus возвращается на trigger-кнопку |

Все изменения должны проходить проверку с VoiceOver (macOS) и NVDA (Windows).

---

## 6. Performance

**rAF throttle** — единственная обязательная оптимизация в этом блоке.
Остальные фичи не добавляют высокочастотных обработчиков.

**`milestoneYOffsets` через `useMemo`** — O(n log n) вычисление выполняется только
при изменении `tasks`, не на каждом рендере.

**Touch tooltip** — `window.addEventListener('touchmove', ..., { once: true })`
автоматически снимается после первого события, не накапливается.

**LegendPopover** — рендерится условно (`{showLegend && ...}`), полностью
размонтируется при закрытии, нет скрытых DOM-узлов.

**LoadingSkeleton** — статичный JSX без вычислений, анимация — чистый CSS.

---

## 7. Ограничения и известные edge cases

| Edge case | Поведение |
|---|---|
| 4+ milestone в одной точке | Равномерный шаг, может выходить за строку при большом количестве |
| Touch tooltip + Legend одновременно | Возможно, нужна mutual exclusion — решить при ревью |
| `xOf` возвращает NaN | `overdueOffscreen` вернёт `false`, badge не отобразится |
| Скролл при open Legend | Popover не следует за позицией кнопки — требует `position: fixed` или пересмотра |
| `touchTimerRef` при быстром повторном тапе | `clearTimeout` вызывается перед установкой нового таймера — race condition отсутствует |
| IME-ввод (CJK) | `e.isComposing` check предотвращает срабатывание shortcuts при композиции |
| SSR / Next.js | `document.addEventListener` в `useEffect` — безопасно, на сервере не вызывается |
| Zoom-кнопки без hover (touch-only) | `title` attr не виден на touch, но `aria-label` доступен скринридеру |

---

## 8. Тест-план

### Unit-тесты (Jest + React Testing Library)

| Тест | Что проверяется |
|---|---|
| `computeOffsets` — группа из 2 | offsets `[-7, +7]` |
| `computeOffsets` — группа из 3 | offsets `[-7, 0, +7]` |
| `computeOffsets` — одиночный | offset `0` |
| `overdueOffscreen` — дедлайн < 0 | возвращает `true` |
| `overdueOffscreen` — дедлайн >= 0 | возвращает `false` |
| `overdueOffscreen` — нет дедлайна | возвращает `false` |
| `LegendPopover` render | содержит 3 элемента легенды |
| `LoadingSkeleton` render | содержит 5 строк с классом `rm-pulse` |

### Интеграционные тесты (RTL)

| Тест | Что проверяется |
|---|---|
| Кнопка «Легенда» → клик | `showLegend` переключается, `aria-expanded` меняется |
| Legend + Escape | popover закрывается, фокус на кнопке |
| Legend + outside click | popover закрывается |
| Keyboard W/M/Q | zoom меняется |
| Keyboard W в input | zoom не меняется |
| Enter на строке с детьми | `aria-expanded` → true |
| Space на строке с детьми | `aria-expanded` → true |
| Skeleton при `isLoading=true` | skeleton виден, реальные строки нет |
| Skeleton при `isLoading=false` | skeleton нет, реальные строки видны |

### BDD / E2E (Playwright — из .feature файла)

Все сценарии из `roadmap-ux-backlog.feature` покрываются Playwright-тестами.
Приоритет: Legend Popover, Keyboard Shortcuts, Loading Skeleton, Keyboard Navigation.
Touch-сценарии: эмуляция touch через `page.touchscreen`.
