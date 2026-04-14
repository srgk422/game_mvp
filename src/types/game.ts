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
