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
