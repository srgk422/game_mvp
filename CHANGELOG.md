# Changelog

Файл ведётся вручную агентом. Каждое изменение проекта фиксируется здесь.

---

## [0.1.0] — 2026-04-13 (`main`)

### Инициализация проекта

**Стек:** Vite 5 · React 18 · TypeScript 5 · Phaser 3.88

**Добавлены файлы:**

| Файл | Назначение |
|---|---|
| `package.json` | Зависимости: phaser, react, react-dom, vite, typescript, @vitejs/plugin-react |
| `tsconfig.json` | target ES2020, moduleResolution bundler, jsx react-jsx, strict mode |
| `vite.config.ts` | React plugin, dev-сервер на порту 8080, base `./` |
| `index.html` | Точка входа HTML, `<div id="root">`, подключает `/src/main.tsx` |
| `src/main.tsx` | ReactDOM.createRoot → рендер `<App>` в StrictMode |
| `src/App.tsx` | Корневой React-компонент, fullscreen-контейнер для `<GameCanvas>` |
| `src/components/GameCanvas.tsx` | React-компонент: монтирует `Phaser.Game` через `useRef`/`useEffect`, корректно уничтожает при размонтировании |
| `src/scenes/Boot.ts` | Phaser-сцена Boot: preload ассетов → `scene.start('Game')` |
| `src/scenes/Game.ts` | Phaser-сцена Game: приветственный текст по центру канваса |
| `src/vite-env.d.ts` | Vite client types |

**Архитектурные решения:**
- React управляет UI-оболочкой (меню, HUD, оверлеи — будущие слои)
- Phaser монтируется внутрь React-компонента `GameCanvas` как `parent`-контейнер
- Разрешение канваса: 1280×720, масштабирование `FIT` + `CENTER_BOTH`
- Renderer: `Phaser.AUTO` (WebGL с fallback на Canvas)
- Сцены: `Boot` → `Game` (цепочка будет расширяться)

---

## [0.2.0] — 2026-04-13 (`main`)

### MVP Stage 5 "The Core" — эмулятор сервера и базовая отрисовка

Реализованы по спецификации `MECHANICS_CONTEXT.md`.

**Добавлены файлы:**

| Файл | Назначение |
|---|---|
| `src/core/EventBus.ts` | Singleton `Phaser.Events.EventEmitter`; константы `Events.SERVER_UPDATE` и `Events.PLAYER_INPUT` |
| `src/core/ServerEmulator.ts` | Авторитативный mock-сервер: хранит `GameState`, тикает 10 Гц, рассылает обновления |

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/scenes/Game.ts` | Полный рефактор: сетка 15×15 / 48 px, Core, Player, Enemies, tweens, ray-fade |

**Архитектура ServerEmulator:**
- Тик 100 мс (`setInterval`): обрабатывает ввод → уменьшает таймеры → двигает врагов → проверяет LOS → проверяет условия победы/поражения → `EventBus.emit(SERVER_UPDATE)`
- `requestMove(dir)` — валидирует движение (границы сетки + Core-тайлы непроходимы)
- `requestAction()` — наносит 10% урона Core если игрок стоит вплотную
- LOS raycast: проверка по одной оси (X или Y), радиус 5 тайлов, Core блокирует луч
- Динамическая сложность: при `coreHP < 30%` интервал движения врагов сокращается с 5 до 3 тиков (~500 мс → ~300 мс)

**Архитектура Game.ts:**
- Сетка центрируется: `OFFSET_X = (1280 - 720) / 2 = 280 px`, `OFFSET_Y = 0`
- Утилита `tileToWorld(col, row)` → центр тайла в мировых координатах
- Игрок: синий Rectangle 40×40 → жёлтый при `PARALYZED`
- Враги: красные Rectangle 36×36, создаются лениво при первом SERVER_UPDATE
- Core: зелёный Rectangle 2×2 тайла с пульсирующим alpha-твином
- Лучи паралича: `Graphics.lineBetween`, fade-out за 600 мс в `update()`
- Ввод: WASD + стрелки (движение, throttle 100 мс) + Space (действие, `JustDown`)

---

## [0.3.0] — 2026-04-13 (`feature/first-heartbeat`)

### "Первое сердцебиение" — типы, HUD, интеграция React ↔ Server

**Добавлены файлы:**

| Файл | Назначение |
|---|---|
| `src/types/game.ts` | Общие типы (`GameState`, `PlayerInput`, `Direction`, `Ray`) и константы (`GRID_SIZE`, `TILE_SIZE`), используемые сервером и клиентом |
| `src/components/HUD.tsx` | React HUD поверх канваса: таймер `MM:SS`, прогресс-бар HP ядра, оверлеи VICTORY / LOST |

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/core/ServerEmulator.ts` | Типы вынесены в `types/game.ts`, ре-экспорт для обратной совместимости |
| `src/scenes/Game.ts` | Импорт типов и констант из `types/game.ts` вместо дублирования |
| `src/App.tsx` | Подписка на `SERVER_UPDATE` через `useEffect`/`useState`, проброс `GameState` в `<HUD>` |

**Архитектурные решения:**
- Типы вынесены в `src/types/game.ts` — единый источник для сервера, Phaser-сцены и React UI
- HUD: `position: absolute` + `pointer-events: none` — отображается поверх канваса, не перехватывает клики
- Таймер мигает красным при `<= 30` секунд, HP-бар меняет цвет при `<= 30%`
- Оверлей конца игры: полупрозрачный `rgba(0,0,0,0.7)` фон + крупный текст с `text-shadow`
- Поток данных: `ServerEmulator` → `EventBus(SERVER_UPDATE)` → `App.tsx(useState)` → `HUD(props)`

---

## [0.3.1] — 2026-04-14 (`main`)

### Stalker Rays — предупреждение о параличе в HUD

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/components/HUD.tsx` | Добавлен пульсирующий текст `SYSTEM FAILURE: PARALYZED` по центру экрана при `player.status === 'PARALYZED'` |
| `index.html` | Добавлен `@keyframes pulse` для анимации предупреждения |

**Примечание:** Вся серверная логика лучей (LOS, паралич 5 сек, блокировка движения) и визуализация в Phaser (жёлтые лучи с fade-out, смена цвета игрока) были реализованы ранее в `[0.2.0]`.

---

## [0.4.0] — 2026-04-14 (`feature/isometric`)

### Изометрическая проекция + Screen-Aligned управление

Переход с плоского top-down вида на изометрию 2:1 (ромбы 64×32 px).

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/types/game.ts` | Добавлены константы `ISO_TILE_W = 64`, `ISO_TILE_H = 32` |
| `src/scenes/Game.ts` | Полный рефактор рендеринга: `tileToWorld()` → `toIso()`, сетка из ромбов, Core как изометрический 2×2 блок, depth sorting по экранному Y, лучи паралича — красные |
| `src/core/ServerEmulator.ts` | Новый метод `playerStep()` — диагональное движение по логической сетке (W: x-1,y-1; S: x+1,y+1; A: x-1,y+1; D: x+1,y-1); `applyMove()` теперь использует `playerStep()`, враги по-прежнему двигаются кардинально через `step()` |

**Архитектурные решения:**
- Изометрическая проекция: `toIso(gx, gy)` = `((gx-gy)*32 + 640, (gx+gy)*16 + 136)`, центрирована на канвасе 1280×720
- Сетка 15×15 ромбов рисуется через `Graphics.strokePoints`, фон — общий ромб
- Core (тайлы 7,7–8,8) — единый заполненный изометрический четырёхугольник с пульсацией и обводкой
- Depth sorting: `sprite.depth = screenY` после каждого tween, обеспечивает правильное перекрытие
- Лучи паралича изменены с жёлтых (`0xffff00`) на красные (`0xff0000`)
- Управление Screen-Aligned: WASD двигает игрока по диагоналям логической сетки, визуально это выглядит как движение по экранным осям
- Доступность Core: при диагональном движении игрок может достичь прилегающих тайлов (9,7), (8,6), (6,8), (7,9) для взаимодействия

---

## [0.5.0] — 2026-04-14 (`main`)

### Активный ИИ преследования + система защиты от stun-lock

Реализована полная модель поведения Сталкеров (FSM) и три уровня защиты игрока от бесконечного паралича.

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/types/game.ts` | Добавлены типы `StalkerState`, `EnemyData`; расширены `player` (`isInvulnerable`, `iTimer`) и `enemies` (`.state`); добавлено поле `coreHit` в `GameState` |
| `src/core/ServerEmulator.ts` | FSM сталкеров (PATROL→CHASE→ATTACK), Knockback на 2 клетки, I-Frames после паралича, Anti-Dogpiling, chase pathfinding |
| `src/scenes/Game.ts` | Анимация knockback (быстрый tween), мигание игрока при неуязвимости, VFX удара по ядру (белая вспышка + тряска), цветовая индикация состояний сталкеров, клавиша E для атаки |

**Stalker FSM:**
- **PATROL** (серв. цвет: красный): случайное движение, интервал 500мс (300мс при HP<30%)
- **CHASE** (серв. цвет: оранжевый): сближение с игроком раз в 300мс, активируется при Manhattan distance ≤ 5
- **ATTACK** (серв. цвет: ярко-красный): луч паралича при нахождении на одной линии (X или Y) и дистанции ≤ 2 с LOS; после атаки сталкер сразу возвращается в PATROL

**Защита от stun-lock (3 уровня):**
1. **Knockback**: при попадании луча игрок отбрасывается на 2 клетки от сталкера (с проверкой коллизий ядра и границ); в Phaser — быстрый tween с `Power2` easing (120мс)
2. **I-Frames**: после окончания паралича (5 сек) игрок получает `isInvulnerable` на 2 секунды; визуально — мигание спрайта (150мс цикл)
3. **Anti-Dogpiling**: если игрок `PARALYZED` или `isInvulnerable`, все сталкеры переходят в `PATROL` и не преследуют

**Визуализация и VFX:**
- Лучи паралича: красные линии через `toIso()` с fade-out
- Удар по ядру (Space/E): белая вспышка поверх ядра с fade-out (200мс) + тряска Graphics (40мс × 3)
- Depth sorting: `depth = screenY` для всех объектов (игрок, враги, ядро)
- Ядро блокирует LOS для сталкеров (уже было, сохранено)

---

## [0.5.1] — 2026-04-14 (`main`)

### Code Cleanup & Architectural Alignment — рефакторинг без изменения поведения

**Изменены файлы:**

| Файл | Что изменилось |
|---|---|
| `src/types/game.ts` | Добавлен экспортируемый объект `SERVER` — все игровые константы симуляции вынесены из `ServerEmulator.ts` в единый конфиг |
| `src/core/ServerEmulator.ts` | Декомпозиция `tick()`: выделены `processPlayerInput()`, `updateRoomTimer()`, `handleStatusEffects()`, `updateStalkers()`, `processCombat()`, `checkWinLoss()`; `checkParalysis()` переименована в `processCombat()` с early returns; `if/else if/else` в `updateEnemyFSM()` заменён на `continue`-цепочку; все магические числа заменены ссылками на `SERVER.*` |
| `src/scenes/Game.ts` | Добавлены константные объекты `VFX` и `COLORS`; `drawRays()` → `drawStalkerRays()`; `playCoreHitVFX()` → `applyCoreVFX()`; `updateBlink()` → `tickInvulnerabilityBlink()`; визуальная логика игрока вынесена из `syncPlayer()` в `updatePlayerVisuals(state)` |

**Соглашения:**
- `SERVER` в `types/game.ts` — единый источник истины для всех численных параметров симуляции
- `VFX` / `COLORS` в `Game.ts` — именованные константы для всех magic-numbers рендеринга и цветов
- `tick()` в `ServerEmulator` теперь читается как линейная последовательность шагов без вложенности
- Изометрия (`toIso()`), Screen-Aligned управление (`playerStep()`/`step()`), depth sorting (`setDepth(pos.y)`) — не затронуты

---