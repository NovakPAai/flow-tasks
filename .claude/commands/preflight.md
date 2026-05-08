Предпушевая проверка — полный чеклист перед отправкой кода. Аргументы: $ARGUMENTS

## Использование
```
/preflight          # полная проверка
/preflight quick    # только tsc + lint
```

## Шаги

### 1. Git status
Запусти `git status` и `git diff --stat`. СТОП если есть:
- Файлы `.env`, `*.key`, `credentials*`, `*.pem` — никогда не пушить
- Конфликтные маркеры `<<<<<<<` в любом файле
- Файлы >1MB (возможно бинарники по ошибке)

Предупреди если есть:
- `console.log` / `debugger` в `backend/src/` или `frontend/src/`
- TODO-комментарии в новых файлах

### 2. TypeScript
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```
При ошибках — показать список, предложить исправить. Нельзя пушить с TS-ошибками.

### 3. ESLint
```bash
cd backend && npm run lint
cd frontend && npm run lint
```
При ошибках — показать список. Нельзя пушить с lint errors.

### 4. RBAC static check
```bash
cd backend && npm run check:rbac
```
Проверяет что все роуты покрыты RBAC guards. Провал = неавторизованный доступ.

### 5. Prisma validate
```bash
cd backend && npx prisma validate
```
Проверяет синтаксис `schema.prisma`.
Если были изменения в схеме — также проверить `npx prisma migrate status`.

### 6. Тесты (если не `quick`)
```bash
cd backend && npm run test -- --passWithNoTests
```
Показать результат. Падающие тесты — СТОП.

### 7. GitNexus scope check
```
gitnexus_detect_changes({ scope: "staged" })
```
Убедиться что изменённые символы ожидаемые, нет случайно затронутых файлов.

### 8. Итоговый отчёт
```
✅ Git — чисто, нет секретов
✅ TypeScript — OK
✅ ESLint — OK
✅ RBAC check — OK
✅ Prisma validate — OK
✅ Tests — N passed
✅ GitNexus — scope confirmed
```
Если хоть один ❌ — не пушить до исправления.
