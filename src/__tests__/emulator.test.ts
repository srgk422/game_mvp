import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Mock EventBus ────────────────────────────────────────────────────────────
// EventBus.ts imports Phaser, which requires browser globals unavailable in
// a Node test environment. We replace the entire module with a minimal
// Node EventEmitter wrapper that honours the same on/off/emit + ctx API.

vi.mock('../core/EventBus', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events') as typeof import('events');
  const emitter = new EventEmitter();
  emitter.setMaxListeners(100);

  // Track original-cb → bound-cb so off() can remove the correct listener.
  // eslint-disable-next-line @typescript-eslint/ban-types
  const handlers = new Map<Function, Function>();

  return {
    EventBus: {
      // eslint-disable-next-line @typescript-eslint/ban-types
      on(event: string, cb: Function, ctx?: object): void {
        const bound = ctx ? cb.bind(ctx) : cb;
        handlers.set(cb, bound);
        emitter.on(event, bound as (...args: unknown[]) => void);
      },
      // eslint-disable-next-line @typescript-eslint/ban-types
      off(event: string, cb: Function): void {
        const bound = handlers.get(cb) ?? cb;
        emitter.off(event, bound as (...args: unknown[]) => void);
        handlers.delete(cb);
      },
      emit(event: string, ...args: unknown[]): void {
        emitter.emit(event, ...args);
      },
    },
    Events: {
      SERVER_UPDATE: 'SERVER_UPDATE',
      PLAYER_INPUT: 'PLAYER_INPUT',
    },
  };
});

// Imports come after vi.mock — vitest hoists the mock automatically.
import { ServerEmulator } from '../core/ServerEmulator';
import { EventBus, Events } from '../core/EventBus';
import { SERVER } from '../types/game';
import type { GameState } from '../types/game';

// ─── Test helpers ─────────────────────────────────────────────────────────────

let server: ServerEmulator;

/**
 * Returns a live reference to ServerEmulator's internal state.
 * Mutations here take effect on the next tick.
 */
function raw(): GameState {
  return (server as unknown as { state: GameState }).state;
}

/** Advance the simulation by exactly one server tick (100 ms). */
function tick(): void {
  vi.advanceTimersByTime(SERVER.TICK_MS);
}

function move(dir: 'up' | 'down' | 'left' | 'right'): void {
  EventBus.emit(Events.PLAYER_INPUT, { type: 'move', dir });
}

function action(): void {
  EventBus.emit(Events.PLAYER_INPUT, { type: 'action' });
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();
  server = new ServerEmulator();
  server.start();
});

afterEach(() => {
  server.stop();
  vi.useRealTimers();
});

// ─── 1. Movement & Isometric Logic ───────────────────────────────────────────

describe('Movement & Isometric Logic (Screen-Aligned)', () => {
  beforeEach(() => {
    // Open centre tile — no core, no boundary in any direction
    raw().player.x = 5;
    raw().player.y = 5;
  });

  it('W / up  → x−1, y−1  (iso screen-up)', () => {
    move('up');
    tick();
    expect(raw().player).toMatchObject({ x: 4, y: 4 });
  });

  it('S / down → x+1, y+1  (iso screen-down)', () => {
    move('down');
    tick();
    expect(raw().player).toMatchObject({ x: 6, y: 6 });
  });

  it('A / left → x−1, y+1  (iso screen-left)', () => {
    move('left');
    tick();
    expect(raw().player).toMatchObject({ x: 4, y: 6 });
  });

  it('D / right → x+1, y−1  (iso screen-right)', () => {
    move('right');
    tick();
    expect(raw().player).toMatchObject({ x: 6, y: 4 });
  });
});

// ─── 2. Collisions ───────────────────────────────────────────────────────────

describe('Collisions', () => {
  it('blocks movement into a Core tile', () => {
    // playerStep(6, 8, 'right') = (7, 7) — first Core tile
    raw().player.x = 6;
    raw().player.y = 8;
    move('right');
    tick();
    expect(raw().player).toMatchObject({ x: 6, y: 8 });
  });

  it('blocks movement past the top-left grid boundary', () => {
    // playerStep(0, 0, 'up') = (−1, −1) — out of bounds
    raw().player.x = 0;
    raw().player.y = 0;
    move('up');
    tick();
    expect(raw().player).toMatchObject({ x: 0, y: 0 });
  });

  it('blocks movement past the bottom-right grid boundary', () => {
    // playerStep(14, 14, 'down') = (15, 15) — out of bounds
    raw().player.x = 14;
    raw().player.y = 14;
    move('down');
    tick();
    expect(raw().player).toMatchObject({ x: 14, y: 14 });
  });
});

// ─── 3. Combat — LOS & Rays ──────────────────────────────────────────────────

describe('Combat — LOS & Rays', () => {
  it('generates a paralysis ray when stalker is on the same row within attack range', () => {
    // Player (3,5), enemy (5,5): same row y=5, dx=2=ATTACK_RANGE, LOS clear
    raw().player.x = 3;
    raw().player.y = 5;
    raw().enemies[0].x = 5;
    raw().enemies[0].y = 5;

    tick();

    expect(raw().rays).toHaveLength(1);
    expect(raw().rays[0]).toMatchObject({
      fromX: 5, fromY: 5,
      toX: 3,  toY: 5,
    });
    expect(raw().player.status).toBe('PARALYZED');
  });

  it('hasLOS returns false when a Core tile lies between two points on the same row', () => {
    // Row y=7 has Core tiles at x=7 and x=8.
    // A ray from x=5 to x=10 passes through x=7 → blocked.
    // Tested directly on the private method since ATTACK_RANGE=2 makes it
    // geometrically impossible for a blocking tile to appear between valid
    // player/enemy positions at combat range.
    type HasLOS = (ex: number, ey: number, px: number, py: number) => boolean;
    const hasLOS = (
      (server as unknown as { hasLOS: HasLOS }).hasLOS
    ).bind(server);

    expect(hasLOS(5, 7, 10, 7)).toBe(false); // Core at x=7 blocks
    expect(hasLOS(9, 7, 14, 7)).toBe(true);  // Nothing between x=9 and x=14
    expect(hasLOS(5, 7, 6,  7)).toBe(true);  // Adjacent tiles — no tile in between
  });

  it('does not generate a ray when stalker is on a diagonal (not same row/col)', () => {
    // Enemy (4,3), player (5,5): not aligned → CHASE state, never ATTACK
    raw().player.x = 5;
    raw().player.y = 5;
    raw().enemies[0].x = 4;
    raw().enemies[0].y = 3;

    tick();

    expect(raw().rays).toHaveLength(0);
    expect(raw().player.status).toBe('NORMAL');
  });
});

// ─── 4. Stun-Lock Protection ─────────────────────────────────────────────────

describe('Stun-Lock Protection', () => {
  it('sets player status to PARALYZED and records pTimer after a stalker attack', () => {
    raw().player.x = 3;
    raw().player.y = 5;
    raw().enemies[0].x = 5;
    raw().enemies[0].y = 5; // same row, dx=2

    tick();

    expect(raw().player.status).toBe('PARALYZED');
    expect(raw().player.pTimer).toBe(SERVER.PARALYSIS_DURATION);
  });

  it('knocks the player away from the attacking stalker', () => {
    // Enemy (5,3), player (5,5): same column, dy=2=ATTACK_RANGE.
    // Knockback direction: +y (player moves further from enemy).
    raw().player.x = 5;
    raw().player.y = 5;
    raw().enemies[0].x = 5;
    raw().enemies[0].y = 3;
    const beforeY = raw().player.y;

    tick();

    // After 2-tile knockback: player.y = 5 + 1 + 1 = 7
    expect(raw().player.y).toBeGreaterThan(beforeY);
  });

  it('transitions PARALYZED → NORMAL + isInvulnerable when pTimer expires', () => {
    raw().player.status = 'PARALYZED';
    raw().player.pTimer = 0.05; // < TICK_MS / 1000 (0.1 s) → expires on next tick

    tick();

    expect(raw().player.status).toBe('NORMAL');
    expect(raw().player.isInvulnerable).toBe(true);
    expect(raw().player.iTimer).toBe(SERVER.INVULN_DURATION);
  });

  it('clears isInvulnerable when iTimer expires', () => {
    raw().player.isInvulnerable = true;
    raw().player.iTimer = 0.05; // < 0.1 s → expires on next tick

    tick();

    expect(raw().player.isInvulnerable).toBe(false);
    expect(raw().player.iTimer).toBe(0);
  });

  it('forces all stalkers to PATROL while player is PARALYZED (anti-dogpiling)', () => {
    // Enemy placed close enough to normally trigger CHASE/ATTACK
    raw().player.x = 5;
    raw().player.y = 5;
    raw().player.status = 'PARALYZED';
    raw().player.pTimer = 3;
    raw().enemies[0].x = 7;
    raw().enemies[0].y = 5; // same row, dx=2 — would be ATTACK if player weren't paralyzed

    tick();

    expect(raw().enemies[0].state).toBe('PATROL');
  });
});

// ─── 5. Core Attack ───────────────────────────────────────────────────────────

describe('Core Attack', () => {
  it('reduces coreHP by CORE_DAMAGE when player acts adjacent to Core', () => {
    // (6,7) is adjacent to Core tile (7,7): Manhattan distance = 1
    raw().player.x = 6;
    raw().player.y = 7;

    action();
    tick();

    expect(raw().room.coreHP).toBe(SERVER.CORE_HP_MAX - SERVER.CORE_DAMAGE);
    expect(raw().coreHit).toBe(true);
  });

  it('does not reduce coreHP when player is not adjacent to Core', () => {
    raw().player.x = 5;
    raw().player.y = 5;

    action();
    tick();

    expect(raw().room.coreHP).toBe(SERVER.CORE_HP_MAX);
    expect(raw().coreHit).toBe(false);
  });

  it('does not reduce coreHP when player is PARALYZED', () => {
    raw().player.x = 6;
    raw().player.y = 7;
    raw().player.status = 'PARALYZED';
    raw().player.pTimer = 3;

    action();
    tick();

    expect(raw().room.coreHP).toBe(SERVER.CORE_HP_MAX);
  });
});
