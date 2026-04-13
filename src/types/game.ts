// ─── Shared types & constants for the game ────────────────────────────────────

// Layout
export const GRID_SIZE = 15;
export const TILE_SIZE = 48;

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
