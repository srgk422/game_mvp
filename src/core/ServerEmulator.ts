import { EventBus, Events } from './EventBus';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Direction = 'up' | 'down' | 'left' | 'right';

export type PlayerInput =
  | { type: 'move'; dir: Direction }
  | { type: 'action' };

export interface Ray {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
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
  };
  enemies: Array<{ id: string; x: number; y: number }>;
  rays: Ray[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID_SIZE = 15;
const TICK_MS = 100;
const TIMER_DURATION = 120;
const CORE_HP_MAX = 100;
const CORE_DAMAGE = 10;
const PARALYSIS_DURATION = 5;
const LOS_RANGE = 5;
const ENEMY_MOVE_NORMAL = 5; // ticks between moves (~500 ms)
const ENEMY_MOVE_FAST = 3;   // ticks between moves at <30% core HP (~300 ms)

const CORE_TILES = [
  { x: 7, y: 7 },
  { x: 8, y: 7 },
  { x: 7, y: 8 },
  { x: 8, y: 8 },
];

const ENEMY_STARTS: Array<{ id: string; x: number; y: number }> = [
  { id: 'e0', x: 13, y: 1  },
  { id: 'e1', x: 1,  y: 13 },
  { id: 'e2', x: 13, y: 13 },
  { id: 'e3', x: 6,  y: 13 },
  { id: 'e4', x: 13, y: 6  },
];

// ─── ServerEmulator ───────────────────────────────────────────────────────────

export class ServerEmulator {
  private state: GameState;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private pendingDir: Direction | null = null;
  private pendingAction = false;
  // Stagger initial counters so enemies don't all move on the same tick
  private enemyCounters: number[] = ENEMY_STARTS.map((_, i) => i);

  constructor() {
    this.state = this.createInitialState();
  }

  start(): void {
    EventBus.on(Events.PLAYER_INPUT, this.onPlayerInput, this);
    // Broadcast initial state immediately so the scene can position entities
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
    this.state.room.timer = Math.max(0, +(this.state.room.timer - TICK_MS / 1000).toFixed(2));

    if (this.state.player.status === 'PARALYZED') {
      this.state.player.pTimer -= TICK_MS / 1000;
      if (this.state.player.pTimer <= 0) {
        this.state.player.status = 'NORMAL';
        this.state.player.pTimer = 0;
      }
    }

    // 3. Enemy movement
    this.moveEnemies();

    // 4. LOS / paralysis check (only when player is free)
    this.state.rays = [];
    if (this.state.player.status === 'NORMAL') {
      this.checkParalysis();
    }

    // 5. Win / loss conditions
    if (this.state.room.coreHP <= 0)   this.state.room.status = 'WON';
    else if (this.state.room.timer <= 0) this.state.room.status = 'LOST';

    // 6. Broadcast
    EventBus.emit(Events.SERVER_UPDATE, this.snapshot());
  }

  // ─── Private: game logic ────────────────────────────────────────────────────

  private applyMove(dir: Direction): void {
    if (this.state.player.status === 'PARALYZED') return;
    const { x, y } = this.state.player;
    const next = this.step(x, y, dir);
    if (!this.isBlocked(next.x, next.y)) {
      this.state.player.x = next.x;
      this.state.player.y = next.y;
    }
  }

  private applyAction(): void {
    if (this.state.player.status === 'PARALYZED') return;
    const { x, y } = this.state.player;
    if (this.isAdjacentToCore(x, y)) {
      this.state.room.coreHP = Math.max(0, this.state.room.coreHP - CORE_DAMAGE);
    }
    // Ally revive: not applicable in single-player MVP
  }

  private moveEnemies(): void {
    const interval =
      this.state.room.coreHP < 30 ? ENEMY_MOVE_FAST : ENEMY_MOVE_NORMAL;
    const dirs: Direction[] = ['up', 'down', 'left', 'right'];

    for (let i = 0; i < this.state.enemies.length; i++) {
      this.enemyCounters[i]++;
      if (this.enemyCounters[i] < interval) continue;
      this.enemyCounters[i] = 0;

      const e = this.state.enemies[i];
      // Fisher-Yates shuffle for random direction priority
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

  private checkParalysis(): void {
    const { x: px, y: py } = this.state.player;

    for (const enemy of this.state.enemies) {
      const dx = Math.abs(enemy.x - px);
      const dy = Math.abs(enemy.y - py);

      const sameRow = enemy.y === py && dx > 0 && dx <= LOS_RANGE;
      const sameCol = enemy.x === px && dy > 0 && dy <= LOS_RANGE;

      if ((sameRow || sameCol) && this.hasLOS(enemy.x, enemy.y, px, py)) {
        this.state.player.status = 'PARALYZED';
        this.state.player.pTimer = PARALYSIS_DURATION;
        this.state.rays.push({ fromX: enemy.x, fromY: enemy.y, toX: px, toY: py });
        return; // one hit is enough per tick
      }
    }
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
    return CORE_TILES.some(t => t.x === x && t.y === y);
  }

  private isAdjacentToCore(x: number, y: number): boolean {
    return CORE_TILES.some(t => Math.abs(t.x - x) + Math.abs(t.y - y) === 1);
  }

  private step(x: number, y: number, dir: Direction): { x: number; y: number } {
    if (dir === 'up')    return { x, y: y - 1 };
    if (dir === 'down')  return { x, y: y + 1 };
    if (dir === 'left')  return { x: x - 1, y };
    return { x: x + 1, y }; // 'right'
  }

  // ─── Private: state ─────────────────────────────────────────────────────────

  /** Deep-copy snapshot sent to the client on every tick. */
  private snapshot(): GameState {
    return JSON.parse(JSON.stringify(this.state)) as GameState;
  }

  private createInitialState(): GameState {
    return {
      room: { status: 'ACTIVE', timer: TIMER_DURATION, coreHP: CORE_HP_MAX },
      player: { x: 1, y: 7, status: 'NORMAL', pTimer: 0 },
      enemies: ENEMY_STARTS.map(e => ({ ...e })),
      rays: [],
    };
  }
}
