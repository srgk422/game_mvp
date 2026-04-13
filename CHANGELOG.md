# Changelog

Файл ведётся вручную агентом. Каждое изменение проекта фиксируется здесь.

---

## [0.1.0] — 2026-04-13

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

## [0.2.0] — 2026-04-13

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
