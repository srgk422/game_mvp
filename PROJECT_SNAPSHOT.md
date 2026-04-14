# Project Snapshot

_Generated: 2026-04-14 00:16_

## File tree

```
.
├── scripts
│   └── snapshot.mjs
├── src
│   ├── components
│   │   ├── GameCanvas.tsx
│   │   └── HUD.tsx
│   ├── core
│   │   ├── EventBus.ts
│   │   └── ServerEmulator.ts
│   ├── scenes
│   │   ├── Boot.ts
│   │   └── Game.ts
│   ├── types
│   │   └── game.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .gitignore
├── CHANGELOG.md
├── index.html
├── MECHANICS_CONTEXT.md
├── package-lock.json
├── package.json
├── PROJECT_SNAPSHOT.md
├── README.md
├── TODO.md
├── tsconfig.json
└── vite.config.ts
```

## File contents

### `CHANGELOG.md`

```md
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
```

### `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Game</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        background: #000;
        overflow: hidden;
      }
      @keyframes pulse {
        from { opacity: 1; }
        to { opacity: 0.4; }
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### `MECHANICS_CONTEXT.md`

```md
# Техническое задание: MVP Stage 5 "The Core"

## 1. Общий обзор (Context)
Проект представляет собой мультиплеерный хоррор.
**Цель:** Игроки должны уничтожить био-механическое Ядро (физическое воплощение ИИ, главный антагонист) в центре зала, избегая лучей паралича от 5 Сталкеров.

## 2. Архитектура "Authoritative Mock Server"
Проект использует паттерн **Server-as-Source-of-Truth**. 
* **ServerEmulator.ts:** Класс-симулятор бэкенда. Хранит мастер-состояние (GameState), обсчитывает логику по тикам (10 Гц) и рассылает обновления.
* **Frontend (Phaser/React):** "Глупый" клиент. Только отправляет запросы на действия (Move, Interact) и отрисовывает состояние, полученное от сервера.

### Контракт обмена данными (Event Bus)
1.  `SERVER_UPDATE`: Каждые 100мс сервер рассылает полный объект `GameState`.
2.  `PLAYER_INPUT`: Фронтенд посылает намерения (клавиши WASD, Space).

## 3. Игровая механика

### Система координат и Поле
* **Сетка (Grid):** 15x15 клеток. Размер тайла: `48px`.
* **Ядро (The Core):** Занимает центр (тайлы `7,7` – `8,8`). Непроходимый объект.

### Сущность: Игрок (Player)
* **Состояния:**
    * `NORMAL`: Свободное перемещение.
    * `PARALYZED`: Ввод заблокирован. Визуал: желтый цвет/эффект заморозки. Длительность: 5 сек.
* **Взаимодействие (Interact):**
    * Если рядом с Ядром: Наносит урон Ядру.
    * Если рядом с парализованным напарником: Снимает статус паралича мгновенно.

### Сущность: Сталкеры (AI)
* **Количество:** 5 независимых копий.
* **Поведение:** Случайное перемещение по сетке или патрулирование.
* **Атака (Raycast):** Если игрок оказывается на одной линии (X или Y) со Сталкером в радиусе 5 клеток и нет препятствий — игрок парализуется.

### Условия победы и поражения
* **Таймер:** 120 секунд. Уменьшается в реальном времени.
* **Здоровье Ядра:** 100%. Уменьшается при взаимодействии игроков.
* **Динамическая сложность:** При HP Ядра < 30% скорость движения Сталкеров увеличивается на 50%.

## 4. Требования к реализации (Implementation Details)

### ServerEmulator.ts
```typescript
interface GameState {
  room: { status: 'ACTIVE' | 'WON' | 'LOST'; timer: number; coreHP: number; };
  player: { x: number; y: number; status: 'NORMAL' | 'PARALYZED'; pTimer: number; };
  enemies: Array<{ id: string; x: number; y: number; }>;
}
```
* Метод `tick()`: Обсчитывает коллизии, LOS (Line of Sight) для лучей и уменьшает таймеры.
* Методы `requestMove(dir)` и `requestAction()`: Валидируют возможность действия.

### Phaser Scene (Game.ts)
* **Отрисовка:** Сетка (Add.grid), Игрок (Rectangle/Sprite), Враги (Triangle/Sprite).
* **Синхронизация:** При получении `SERVER_UPDATE` использовать `this.tweens.add` для плавного перемещения объектов к новым координатам (интерполяция).
* **Эффекты:** Линии (Graphics) для отображения лучей паралича в момент срабатывания.

### React UI (App.tsx)
* Отображение прогресс-баров HP Ядра и Таймера.
* Overlay-сообщения "VICTORY" или "CONNECTION LOST (TIME OUT)".

---

### Как запустить выполнение:
Передай этот файл агенту и скажи:
> *"Используй спецификации из этого файла для реализации `src/core/ServerEmulator.ts` и обновления `src/scenes/Game.ts`. Начни с создания эмулятора и базовой отрисовки сетки и сущностей."*
```

### `package.json`

```json
{
  "name": "game",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "snapshot": "node scripts/snapshot.mjs"
  },
  "dependencies": {
    "phaser": "^3.88.2",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0"
  }
}
```

### `README.md`

```md
# game_mvp
```

### `scripts/snapshot.mjs`

```js
/**
 * npm run snapshot
 *
 * Generates PROJECT_SNAPSHOT.md — a single file with the full project tree
 * and source contents, ready to share with a planning agent.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT  = path.join(ROOT, 'PROJECT_SNAPSHOT.md');

// ─── Config ───────────────────────────────────────────────────────────────────

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', '.git', '.cursor',
]);

/** Files included in the "full content" section */
const CONTENT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.json',
  '.html', '.css', '.md',
]);

/** Files always excluded from content (too large / not useful) */
const CONTENT_EXCLUDE = new Set([
  'package-lock.json',
  'PROJECT_SNAPSHOT.md',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walk(dir, prefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => !IGNORE_DIRS.has(e.name))
    .sort((a, b) => {
      // directories first, then files
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const lines = [];
  entries.forEach((entry, i) => {
    const isLast      = i === entries.length - 1;
    const connector   = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    lines.push(`${prefix}${connector}${entry.name}`);
    if (entry.isDirectory()) {
      lines.push(...walk(path.join(dir, entry.name), prefix + childPrefix));
    }
  });
  return lines;
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, files);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONTENT_EXTENSIONS.has(ext) && !CONTENT_EXCLUDE.has(entry.name)) {
        files.push(full);
      }
    }
  }
  return files;
}

function langTag(file) {
  const ext = path.extname(file).toLowerCase();
  return { '.ts': 'ts', '.tsx': 'tsx', '.js': 'js', '.mjs': 'js',
           '.json': 'json', '.html': 'html', '.css': 'css', '.md': 'md' }[ext] ?? '';
}

// ─── Build output ─────────────────────────────────────────────────────────────

const date = new Date().toISOString().slice(0, 16).replace('T', ' ');

const sections = [];

sections.push(`# Project Snapshot\n\n_Generated: ${date}_\n`);

// File tree
sections.push('## File tree\n\n```\n.' + '\n' + walk(ROOT).join('\n') + '\n```\n');

// File contents
sections.push('## File contents\n');
for (const file of collectFiles(ROOT)) {
  const rel  = path.relative(ROOT, file).replace(/\\/g, '/');
  const body = fs.readFileSync(file, 'utf8').trimEnd();
  sections.push(`### \`${rel}\`\n\n\`\`\`${langTag(file)}\n${body}\n\`\`\`\n`);
}

fs.writeFileSync(OUT, sections.join('\n'), 'utf8');
console.log(`✓ PROJECT_SNAPSHOT.md written (${(fs.statSync(OUT).size / 1024).toFixed(1)} KB)`);
```

### `src/App.tsx`

```tsx
import { useEffect, useState } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import { EventBus, Events } from './core/EventBus';
import type { GameState } from './types/game';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    const handler = (state: GameState) => setGameState(state);
    EventBus.on(Events.SERVER_UPDATE, handler);
    return () => {
      EventBus.off(Events.SERVER_UPDATE, handler);
    };
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
    }}>
      <GameCanvas />
      <HUD state={gameState} />
    </div>
  );
}
```

### `src/components/GameCanvas.tsx`

```tsx
import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { Boot } from '../scenes/Boot';
import { Game } from '../scenes/Game';

export default function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 1280,
      height: 720,
      backgroundColor: '#1a1a2e',
      parent: containerRef.current ?? undefined,
      scene: [Boot, Game],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);

    return () => {
      game.destroy(true);
    };
  }, []);

  return <div ref={containerRef} />;
}
```

### `src/components/HUD.tsx`

```tsx
import type { GameState } from '../types/game';

interface HUDProps {
  state: GameState | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HUD({ state }: HUDProps) {
  if (!state) return null;

  const { status, timer, coreHP } = state.room;
  const isParalyzed = state.player.status === 'PARALYZED';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      fontFamily: 'monospace',
      color: '#fff',
    }}>
      {/* Paralysis warning */}
      {isParalyzed && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -80%)',
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#ffff00',
          textShadow: '0 0 20px #ffff00, 0 0 40px rgba(255,255,0,0.4)',
          animation: 'pulse 0.6s ease-in-out infinite alternate',
          whiteSpace: 'nowrap',
        }}>
          SYSTEM FAILURE: PARALYZED
        </div>
      )}

      {/* Top bar: timer + core HP */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 24px',
      }}>
        {/* Timer */}
        <div style={{ fontSize: '20px' }}>
          <span style={{ opacity: 0.6 }}>TIME </span>
          <span style={{ color: timer <= 30 ? '#ff4444' : '#fff' }}>
            {formatTime(timer)}
          </span>
        </div>

        {/* Core HP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px', opacity: 0.6 }}>CORE</span>
          <div style={{
            width: '160px',
            height: '16px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${coreHP}%`,
              height: '100%',
              background: coreHP > 30
                ? 'linear-gradient(90deg, #00cc66, #00ffaa)'
                : 'linear-gradient(90deg, #ff4444, #ffaa00)',
              transition: 'width 0.15s ease',
            }} />
          </div>
          <span style={{ fontSize: '16px', minWidth: '40px' }}>{coreHP}%</span>
        </div>
      </div>

      {/* End-game overlay */}
      {status !== 'ACTIVE' && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
        }}>
          <div style={{
            fontSize: '56px',
            fontWeight: 'bold',
            color: status === 'WON' ? '#00ffaa' : '#ff4444',
            textShadow: `0 0 30px ${status === 'WON' ? '#00ffaa' : '#ff4444'}`,
          }}>
            {status === 'WON' ? 'VICTORY' : 'CONNECTION LOST (TIME OUT)'}
          </div>
        </div>
      )}
    </div>
  );
}
```

### `src/core/EventBus.ts`

```ts
import Phaser from 'phaser';

export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  SERVER_UPDATE: 'SERVER_UPDATE',
  PLAYER_INPUT: 'PLAYER_INPUT',
} as const;
```

### `src/core/ServerEmulator.ts`

```ts
import { EventBus, Events } from './EventBus';
import {
  GRID_SIZE,
  Direction,
  PlayerInput,
  GameState,
  EnemyData,
  StalkerState,
} from '../types/game';

export type { Direction, PlayerInput, GameState, EnemyData, StalkerState };
export type { Ray } from '../types/game';

// ─── Constants ────────────────────────────────────────────────────────────────

const TICK_MS = 100;
const TIMER_DURATION = 120;
const CORE_HP_MAX = 100;
const CORE_DAMAGE = 10;
const PARALYSIS_DURATION = 5;
const LOS_RANGE = 5;
const ENEMY_MOVE_NORMAL = 5;  // ticks between moves (~500 ms) — PATROL
const ENEMY_MOVE_FAST = 3;    // ticks between moves at <30% core HP (~300 ms)
const CHASE_INTERVAL = 3;     // ticks between moves in CHASE mode (~300 ms)

const CHASE_RANGE = 5;
const ATTACK_RANGE = 2;

const KNOCKBACK_DIST = 2;
const INVULN_DURATION = 2;    // seconds after paralysis ends

const CORE_TILES = [
  { x: 7, y: 7 },
  { x: 8, y: 7 },
  { x: 7, y: 8 },
  { x: 8, y: 8 },
];

const ENEMY_STARTS: Array<{ id: string; x: number; y: number }> = [
  { id: 'e0', x: 13, y: 1 },
  { id: 'e1', x: 1, y: 13 },
  { id: 'e2', x: 13, y: 13 },
  { id: 'e3', x: 6, y: 13 },
  { id: 'e4', x: 13, y: 6 },
];

// ─── ServerEmulator ───────────────────────────────────────────────────────────

export class ServerEmulator {
  private state: GameState;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private pendingDir: Direction | null = null;
  private pendingAction = false;
  private enemyCounters: number[] = ENEMY_STARTS.map((_, i) => i);

  constructor() {
    this.state = this.createInitialState();
  }

  start(): void {
    EventBus.on(Events.PLAYER_INPUT, this.onPlayerInput, this);
    EventBus.emit(Events.SERVER_UPDATE, this.snapshot());
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.tickHandle !== null) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    EventBus.off(Events.PLAYER_INPUT, this.onPlayerInput, this);
  }

  // ─── Private: input ─────────────────────────────────────────────────────────

  private onPlayerInput(input: PlayerInput): void {
    if (input.type === 'move') this.pendingDir = input.dir;
    if (input.type === 'action') this.pendingAction = true;
  }

  // ─── Private: tick ──────────────────────────────────────────────────────────

  private tick(): void {
    if (this.state.room.status !== 'ACTIVE') return;

    this.state.coreHit = false;

    // 1. Player input
    if (this.pendingDir !== null) {
      this.applyMove(this.pendingDir);
      this.pendingDir = null;
    }
    if (this.pendingAction) {
      this.applyAction();
      this.pendingAction = false;
    }

    // 2. Timers
    this.state.room.timer = Math.max(
      0,
      +(this.state.room.timer - TICK_MS / 1000).toFixed(2),
    );

    if (this.state.player.status === 'PARALYZED') {
      this.state.player.pTimer -= TICK_MS / 1000;
      if (this.state.player.pTimer <= 0) {
        this.state.player.status = 'NORMAL';
        this.state.player.pTimer = 0;
        this.state.player.isInvulnerable = true;
        this.state.player.iTimer = INVULN_DURATION;
      }
    }

    if (this.state.player.isInvulnerable) {
      this.state.player.iTimer -= TICK_MS / 1000;
      if (this.state.player.iTimer <= 0) {
        this.state.player.isInvulnerable = false;
        this.state.player.iTimer = 0;
      }
    }

    // 3. Enemy FSM + movement
    this.updateEnemyFSM();
    this.moveEnemies();

    // 4. LOS / paralysis check
    this.state.rays = [];
    if (
      this.state.player.status === 'NORMAL' &&
      !this.state.player.isInvulnerable
    ) {
      this.checkParalysis();
    }

    // 5. Win / loss conditions
    if (this.state.room.coreHP <= 0) this.state.room.status = 'WON';
    else if (this.state.room.timer <= 0) this.state.room.status = 'LOST';

    // 6. Broadcast
    EventBus.emit(Events.SERVER_UPDATE, this.snapshot());
  }

  // ─── Private: game logic ────────────────────────────────────────────────────

  private applyMove(dir: Direction): void {
    if (this.state.player.status === 'PARALYZED') return;
    const { x, y } = this.state.player;
    const next = this.playerStep(x, y, dir);
    if (!this.isBlocked(next.x, next.y)) {
      this.state.player.x = next.x;
      this.state.player.y = next.y;
    }
  }

  private applyAction(): void {
    if (this.state.player.status === 'PARALYZED') return;
    const { x, y } = this.state.player;
    if (this.isAdjacentToCore(x, y)) {
      this.state.room.coreHP = Math.max(
        0,
        this.state.room.coreHP - CORE_DAMAGE,
      );
      this.state.coreHit = true;
    }
  }

  // ─── Enemy FSM ──────────────────────────────────────────────────────────────

  private playerIsProtected(): boolean {
    return (
      this.state.player.status === 'PARALYZED' ||
      this.state.player.isInvulnerable
    );
  }

  private updateEnemyFSM(): void {
    const { x: px, y: py } = this.state.player;
    const isProtected = this.playerIsProtected();

    for (const e of this.state.enemies) {
      if (isProtected) {
        e.state = 'PATROL';
        continue;
      }

      const dist = Math.abs(e.x - px) + Math.abs(e.y - py);

      const sameRow = e.y === py;
      const sameCol = e.x === px;
      const dx = Math.abs(e.x - px);
      const dy = Math.abs(e.y - py);
      const inAttackRange =
        (sameRow && dx > 0 && dx <= ATTACK_RANGE) ||
        (sameCol && dy > 0 && dy <= ATTACK_RANGE);

      if (inAttackRange && this.hasLOS(e.x, e.y, px, py)) {
        e.state = 'ATTACK';
      } else if (dist <= CHASE_RANGE) {
        e.state = 'CHASE';
      } else {
        e.state = 'PATROL';
      }
    }
  }

  private moveEnemies(): void {
    const patrolInterval =
      this.state.room.coreHP < 30 ? ENEMY_MOVE_FAST : ENEMY_MOVE_NORMAL;
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];

    for (let i = 0; i < this.state.enemies.length; i++) {
      const e = this.state.enemies[i];

      if (e.state === 'ATTACK') continue;

      const interval = e.state === 'CHASE' ? CHASE_INTERVAL : patrolInterval;

      this.enemyCounters[i]++;
      if (this.enemyCounters[i] < interval) continue;
      this.enemyCounters[i] = 0;

      if (e.state === 'CHASE') {
        this.moveTowardsPlayer(e);
      } else {
        const shuffled = [...dirs];
        for (let j = shuffled.length - 1; j > 0; j--) {
          const k = Math.floor(Math.random() * (j + 1));
          [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
        }
        for (const dir of shuffled) {
          const next = this.step(e.x, e.y, dir);
          if (!this.isBlocked(next.x, next.y)) {
            e.x = next.x;
            e.y = next.y;
            break;
          }
        }
      }
    }
  }

  private moveTowardsPlayer(e: EnemyData): void {
    const { x: px, y: py } = this.state.player;
    const dx = px - e.x;
    const dy = py - e.y;

    const candidates: Array<{ x: number; y: number }> = [];

    if (Math.abs(dx) >= Math.abs(dy)) {
      candidates.push({ x: e.x + Math.sign(dx), y: e.y });
      if (dy !== 0) candidates.push({ x: e.x, y: e.y + Math.sign(dy) });
    } else {
      candidates.push({ x: e.x, y: e.y + Math.sign(dy) });
      if (dx !== 0) candidates.push({ x: e.x + Math.sign(dx), y: e.y });
    }

    for (const c of candidates) {
      if (!this.isBlocked(c.x, c.y)) {
        e.x = c.x;
        e.y = c.y;
        return;
      }
    }
  }

  // ─── Paralysis + Knockback ──────────────────────────────────────────────────

  private checkParalysis(): void {
    const { x: px, y: py } = this.state.player;

    for (const enemy of this.state.enemies) {
      if (enemy.state !== 'ATTACK') continue;

      const dx = Math.abs(enemy.x - px);
      const dy = Math.abs(enemy.y - py);

      const sameRow = enemy.y === py && dx > 0 && dx <= ATTACK_RANGE;
      const sameCol = enemy.x === px && dy > 0 && dy <= ATTACK_RANGE;

      if ((sameRow || sameCol) && this.hasLOS(enemy.x, enemy.y, px, py)) {
        this.state.player.status = 'PARALYZED';
        this.state.player.pTimer = PARALYSIS_DURATION;
        this.state.rays.push({
          fromX: enemy.x,
          fromY: enemy.y,
          toX: px,
          toY: py,
        });

        this.applyKnockback(enemy.x, enemy.y);

        enemy.state = 'PATROL';

        return;
      }
    }
  }

  private applyKnockback(ex: number, ey: number): void {
    const p = this.state.player;
    const dx = p.x - ex;
    const dy = p.y - ey;

    let dirX = 0;
    let dirY = 0;

    if (dx !== 0) dirX = Math.sign(dx);
    if (dy !== 0) dirY = Math.sign(dy);

    if (dirX === 0 && dirY === 0) dirX = 1;

    let finalX = p.x;
    let finalY = p.y;

    for (let step = 1; step <= KNOCKBACK_DIST; step++) {
      const nx = p.x + dirX * step;
      const ny = p.y + dirY * step;
      if (this.isBlocked(nx, ny)) break;
      finalX = nx;
      finalY = ny;
    }

    p.x = finalX;
    p.y = finalY;
  }

  // ─── Private: spatial helpers ───────────────────────────────────────────────

  /** Walk the axis between two aligned points; returns false if a core tile blocks the path. */
  private hasLOS(ex: number, ey: number, px: number, py: number): boolean {
    if (ey === py) {
      const [minX, maxX] = ex < px ? [ex, px] : [px, ex];
      for (let x = minX + 1; x < maxX; x++) {
        if (this.isCoreTile(x, ey)) return false;
      }
      return true;
    }
    if (ex === px) {
      const [minY, maxY] = ey < py ? [ey, py] : [py, ey];
      for (let y = minY + 1; y < maxY; y++) {
        if (this.isCoreTile(ex, y)) return false;
      }
      return true;
    }
    return false;
  }

  private isBlocked(x: number, y: number): boolean {
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return true;
    return this.isCoreTile(x, y);
  }

  private isCoreTile(x: number, y: number): boolean {
    return CORE_TILES.some((t) => t.x === x && t.y === y);
  }

  private isAdjacentToCore(x: number, y: number): boolean {
    return CORE_TILES.some((t) => Math.abs(t.x - x) + Math.abs(t.y - y) === 1);
  }

  /** Screen-aligned diagonal step for the player (iso projection). */
  private playerStep(
    x: number,
    y: number,
    dir: Direction,
  ): { x: number; y: number } {
    if (dir === 'up') return { x: x - 1, y: y - 1 };
    if (dir === 'down') return { x: x + 1, y: y + 1 };
    if (dir === 'left') return { x: x - 1, y: y + 1 };
    return { x: x + 1, y: y - 1 }; // 'right'
  }

  /** Cardinal step used for enemy AI movement. */
  private step(
    x: number,
    y: number,
    dir: Direction,
  ): { x: number; y: number } {
    if (dir === 'up') return { x, y: y - 1 };
    if (dir === 'down') return { x, y: y + 1 };
    if (dir === 'left') return { x: x - 1, y };
    return { x: x + 1, y }; // 'right'
  }

  // ─── Private: state ─────────────────────────────────────────────────────────

  private snapshot(): GameState {
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  private createInitialState(): GameState {
    return {
      room: { status: 'ACTIVE', timer: TIMER_DURATION, coreHP: CORE_HP_MAX },
      player: {
        x: 1,
        y: 7,
        status: 'NORMAL',
        pTimer: 0,
        isInvulnerable: false,
        iTimer: 0,
      },
      enemies: ENEMY_STARTS.map((e) => ({
        ...e,
        state: 'PATROL' as StalkerState,
      })),
      rays: [],
      coreHit: false,
    };
  }
}
```

### `src/main.tsx`

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const root = document.getElementById('root')!;
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

### `src/scenes/Boot.ts`

```ts
import Phaser from 'phaser';

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'Boot' });
  }

  preload(): void {
    // load global assets here
  }

  create(): void {
    this.scene.start('Game');
  }
}
```

### `src/scenes/Game.ts`

```ts
import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus';
import { ServerEmulator } from '../core/ServerEmulator';
import {
  GRID_SIZE,
  ISO_TILE_W,
  ISO_TILE_H,
  GameState,
  PlayerInput,
  Ray,
} from '../types/game';

const HW = ISO_TILE_W / 2; // 32
const HH = ISO_TILE_H / 2; // 16

const ISO_ORIGIN_X = 640;
const ISO_ORIGIN_Y = (720 - 14 * 2 * HH) / 2;

const TWEEN_DURATION = 80;
const RAY_FADE_DURATION = 600;
const KNOCKBACK_TWEEN_DURATION = 120;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(gx: number, gy: number): { x: number; y: number } {
  return {
    x: (gx - gy) * HW + ISO_ORIGIN_X,
    y: (gx + gy) * HH + ISO_ORIGIN_Y,
  };
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class Game extends Phaser.Scene {
  private server!: ServerEmulator;

  private playerRect!: Phaser.GameObjects.Rectangle;
  private coreGfx!: Phaser.GameObjects.Graphics;
  private coreFlashGfx!: Phaser.GameObjects.Graphics;
  private enemyRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private raysGraphics!: Phaser.GameObjects.Graphics;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private dKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private eKey!: Phaser.Input.Keyboard.Key;
  private lastMoveTime = 0;

  private cachedRays: Ray[] = [];
  private rayFadeMs = 0;

  private lastPlayerPos = { x: 0, y: 0 };
  private isKnockbackAnimating = false;
  private isPlayerInvulnerable = false;
  private blinkTimer = 0;

  constructor() {
    super({ key: 'Game' });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.drawGrid();
    this.drawCore();

    this.playerRect = this.add.rectangle(-100, -100, 24, 24, 0x44aaff);
    this.playerRect.setDepth(0);

    this.raysGraphics = this.add.graphics().setDepth(1000);

    this.setupInput();

    EventBus.on(Events.SERVER_UPDATE, this.onServerUpdate, this);
    this.server = new ServerEmulator();
    this.server.start();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(time: number, delta: number): void {
    this.handleInput(time);
    this.drawRays(delta);
    this.updateBlink(delta);
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.eKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private handleInput(time: number): void {
    if (
      Phaser.Input.Keyboard.JustDown(this.spaceKey) ||
      Phaser.Input.Keyboard.JustDown(this.eKey)
    ) {
      EventBus.emit(Events.PLAYER_INPUT, {
        type: 'action',
      } satisfies PlayerInput);
    }

    if (time - this.lastMoveTime < 100) return;

    let dir: PlayerInput | null = null;

    if (this.wKey.isDown || this.cursors.up.isDown)
      dir = { type: 'move', dir: 'up' };
    else if (this.sKey.isDown || this.cursors.down.isDown)
      dir = { type: 'move', dir: 'down' };
    else if (this.aKey.isDown || this.cursors.left.isDown)
      dir = { type: 'move', dir: 'left' };
    else if (this.dKey.isDown || this.cursors.right.isDown)
      dir = { type: 'move', dir: 'right' };

    if (dir) {
      EventBus.emit(Events.PLAYER_INPUT, dir);
      this.lastMoveTime = time;
    }
  }

  // ─── SERVER_UPDATE handler ──────────────────────────────────────────────────

  private onServerUpdate(state: GameState): void {
    this.syncPlayer(state);
    this.syncEnemies(state);
    this.cacheRays(state);

    if (state.coreHit) {
      this.playCoreHitVFX();
    }
  }

  private syncPlayer(state: GameState): void {
    const pos = toIso(state.player.x, state.player.y);

    const movedFar =
      Math.abs(state.player.x - this.lastPlayerPos.x) > 1 ||
      Math.abs(state.player.y - this.lastPlayerPos.y) > 1;

    this.lastPlayerPos.x = state.player.x;
    this.lastPlayerPos.y = state.player.y;

    if (movedFar && !this.isKnockbackAnimating) {
      this.isKnockbackAnimating = true;
      this.tweens.killTweensOf(this.playerRect);
      this.tweens.add({
        targets: this.playerRect,
        x: pos.x,
        y: pos.y,
        duration: KNOCKBACK_TWEEN_DURATION,
        ease: 'Power2',
        onComplete: () => {
          this.playerRect.setDepth(pos.y);
          this.isKnockbackAnimating = false;
        },
      });
    } else if (!this.isKnockbackAnimating) {
      this.tweens.add({
        targets: this.playerRect,
        x: pos.x,
        y: pos.y,
        duration: TWEEN_DURATION,
        ease: 'Linear',
        onComplete: () => {
          this.playerRect.setDepth(pos.y);
        },
      });
    }

    if (state.player.status === 'PARALYZED') {
      this.playerRect.setFillStyle(0xffff00);
      this.playerRect.setAlpha(1);
      this.blinkTimer = 0;
    } else if (state.player.isInvulnerable) {
      this.playerRect.setFillStyle(0x44aaff);
    } else {
      this.playerRect.setFillStyle(0x44aaff);
      this.playerRect.setAlpha(1);
      this.blinkTimer = 0;
    }
  }

  private updateBlink(delta: number): void {
    if (this.isPlayerInvulnerable) {
      this.blinkTimer += delta;
      const blinkCycle = 150;
      this.playerRect.setAlpha(
        Math.floor(this.blinkTimer / blinkCycle) % 2 === 0 ? 1 : 0.2,
      );
    }
  }

  private syncEnemies(state: GameState): void {
    this.isPlayerInvulnerable = state.player.isInvulnerable;

    for (const enemy of state.enemies) {
      const pos = toIso(enemy.x, enemy.y);

      let color = 0xff4444;
      if (enemy.state === 'CHASE') color = 0xff8800;
      else if (enemy.state === 'ATTACK') color = 0xff0000;

      if (!this.enemyRects.has(enemy.id)) {
        const rect = this.add
          .rectangle(pos.x, pos.y, 22, 22, color)
          .setDepth(pos.y);
        this.enemyRects.set(enemy.id, rect);
      } else {
        const rect = this.enemyRects.get(enemy.id)!;
        rect.setFillStyle(color);
        this.tweens.add({
          targets: rect,
          x: pos.x,
          y: pos.y,
          duration: TWEEN_DURATION,
          ease: 'Linear',
          onComplete: () => {
            rect.setDepth(pos.y);
          },
        });
      }
    }
  }

  private cacheRays(state: GameState): void {
    if (state.rays.length > 0) {
      this.cachedRays = state.rays;
      this.rayFadeMs = RAY_FADE_DURATION;
    }
  }

  // ─── Ray rendering (per-frame fade) ─────────────────────────────────────────

  private drawRays(delta: number): void {
    this.raysGraphics.clear();
    if (this.rayFadeMs <= 0 || this.cachedRays.length === 0) return;

    this.rayFadeMs -= delta;
    const alpha = Math.max(0, this.rayFadeMs / RAY_FADE_DURATION) * 0.9;

    this.raysGraphics.lineStyle(3, 0xff0000, alpha);
    for (const ray of this.cachedRays) {
      const from = toIso(ray.fromX, ray.fromY);
      const to = toIso(ray.toX, ray.toY);
      this.raysGraphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  // ─── Core Attack VFX ────────────────────────────────────────────────────────

  private playCoreHitVFX(): void {
    if (this.coreFlashGfx) {
      this.coreFlashGfx.clear();
    } else {
      this.coreFlashGfx = this.add.graphics();
    }

    const topLeft = toIso(7, 7);
    const topRight = toIso(8, 7);
    const botLeft = toIso(7, 8);
    const botRight = toIso(8, 8);

    const topVertex = { x: topLeft.x, y: topLeft.y - HH };
    const rightVertex = { x: topRight.x + HW, y: topRight.y };
    const bottomVertex = { x: botRight.x, y: botRight.y + HH };
    const leftVertex = { x: botLeft.x - HW, y: botLeft.y };

    this.coreFlashGfx.setDepth(botRight.y + 1);
    this.coreFlashGfx.setAlpha(0.8);
    this.coreFlashGfx.fillStyle(0xffffff, 1);
    this.coreFlashGfx.fillPoints(
      [
        new Phaser.Geom.Point(topVertex.x, topVertex.y),
        new Phaser.Geom.Point(rightVertex.x, rightVertex.y),
        new Phaser.Geom.Point(bottomVertex.x, bottomVertex.y),
        new Phaser.Geom.Point(leftVertex.x, leftVertex.y),
      ],
      true,
    );

    this.tweens.add({
      targets: this.coreFlashGfx,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.coreFlashGfx.clear();
      },
    });

    const originalX = this.coreGfx.x;
    const originalY = this.coreGfx.y;
    this.tweens.add({
      targets: this.coreGfx,
      x: originalX + Phaser.Math.Between(-3, 3),
      y: originalY + Phaser.Math.Between(-2, 2),
      duration: 40,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.coreGfx.setPosition(originalX, originalY);
      },
    });
  }

  // ─── Static visuals ─────────────────────────────────────────────────────────

  private drawGrid(): void {
    const bg = this.add.graphics().setDepth(-2);
    bg.fillStyle(0x0d0d1a, 1);

    const top = toIso(0, 0);
    const right = toIso(GRID_SIZE - 1, 0);
    const bottom = toIso(GRID_SIZE - 1, GRID_SIZE - 1);
    const left = toIso(0, GRID_SIZE - 1);
    bg.fillPoints(
      [
        new Phaser.Geom.Point(top.x, top.y - HH),
        new Phaser.Geom.Point(right.x + HW, right.y),
        new Phaser.Geom.Point(bottom.x, bottom.y + HH),
        new Phaser.Geom.Point(left.x - HW, left.y),
      ],
      true,
    );

    const g = this.add.graphics().setDepth(-1);
    g.lineStyle(1, 0x222244, 1);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const c = toIso(gx, gy);
        g.strokePoints(
          [
            new Phaser.Geom.Point(c.x, c.y - HH),
            new Phaser.Geom.Point(c.x + HW, c.y),
            new Phaser.Geom.Point(c.x, c.y + HH),
            new Phaser.Geom.Point(c.x - HW, c.y),
          ],
          true,
        );
      }
    }
  }

  private drawCore(): void {
    const topLeft = toIso(7, 7);
    const topRight = toIso(8, 7);
    const botLeft = toIso(7, 8);
    const botRight = toIso(8, 8);

    const topVertex = { x: topLeft.x, y: topLeft.y - HH };
    const rightVertex = { x: topRight.x + HW, y: topRight.y };
    const bottomVertex = { x: botRight.x, y: botRight.y + HH };
    const leftVertex = { x: botLeft.x - HW, y: botLeft.y };

    this.coreGfx = this.add.graphics().setDepth(botRight.y);

    this.coreGfx.fillStyle(0x00cc66, 1);
    this.coreGfx.fillPoints(
      [
        new Phaser.Geom.Point(topVertex.x, topVertex.y),
        new Phaser.Geom.Point(rightVertex.x, rightVertex.y),
        new Phaser.Geom.Point(bottomVertex.x, bottomVertex.y),
        new Phaser.Geom.Point(leftVertex.x, leftVertex.y),
      ],
      true,
    );

    this.coreGfx.lineStyle(2, 0x00ffaa, 1);
    this.coreGfx.strokePoints(
      [
        new Phaser.Geom.Point(topVertex.x, topVertex.y),
        new Phaser.Geom.Point(rightVertex.x, rightVertex.y),
        new Phaser.Geom.Point(bottomVertex.x, bottomVertex.y),
        new Phaser.Geom.Point(leftVertex.x, leftVertex.y),
      ],
      true,
    );

    this.tweens.add({
      targets: this.coreGfx,
      alpha: 0.6,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut',
    });
  }

  // ─── Cleanup ────────────────────────────────────────────────────────────────

  private cleanup(): void {
    this.server.stop();
    EventBus.off(Events.SERVER_UPDATE, this.onServerUpdate, this);
  }
}
```

### `src/types/game.ts`

```ts
// ─── Shared types & constants for the game ────────────────────────────────────

// Layout
export const GRID_SIZE = 15;
export const TILE_SIZE = 48;

// Isometric tile dimensions (2:1 diamond)
export const ISO_TILE_W = 64;
export const ISO_TILE_H = 32;

// Directions
export type Direction = 'up' | 'down' | 'left' | 'right';

// Client → Server
export type PlayerInput =
  | { type: 'move'; dir: Direction }
  | { type: 'action' };

// Server → Client
export interface Ray {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export type StalkerState = 'PATROL' | 'CHASE' | 'ATTACK';

export interface EnemyData {
  id: string;
  x: number;
  y: number;
  state: StalkerState;
}

export interface GameState {
  room: {
    status: 'ACTIVE' | 'WON' | 'LOST';
    timer: number;
    coreHP: number;
  };
  player: {
    x: number;
    y: number;
    status: 'NORMAL' | 'PARALYZED';
    pTimer: number;
    isInvulnerable: boolean;
    iTimer: number;
  };
  enemies: EnemyData[];
  rays: Ray[];
  coreHit: boolean;
}
```

### `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />
```

### `TODO.md`

```md
# TODO

- [ ] Перевести git hooks с `.git/hooks/` на `husky` — чтобы хуки (pre-push snapshot) были частью репозитория
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src"]
}
```

### `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
```
