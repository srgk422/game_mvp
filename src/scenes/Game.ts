import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus';
import { ServerEmulator } from '../core/ServerEmulator';
import { GRID_SIZE, ISO_TILE_W, ISO_TILE_H, GameState, PlayerInput, Ray } from '../types/game';

const HW = ISO_TILE_W / 2; // 32
const HH = ISO_TILE_H / 2; // 16

// The 15×15 iso grid spans (14*2)*HW = 896 px wide, (14*2)*HH = 448 px tall.
const ISO_ORIGIN_X = 640;                   // canvas center X
const ISO_ORIGIN_Y = (720 - 14 * 2 * HH) / 2; // ≈136 — vertically centers the grid

const TWEEN_DURATION = 80;
const RAY_FADE_DURATION = 600;

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
  private enemyRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private raysGraphics!: Phaser.GameObjects.Graphics;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private dKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private lastMoveTime = 0;

  private cachedRays: Ray[] = [];
  private rayFadeMs = 0;

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
  }

  // ─── Input ──────────────────────────────────────────────────────────────────

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.aKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.sKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.dKey     = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.spaceKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  private handleInput(time: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      EventBus.emit(Events.PLAYER_INPUT, { type: 'action' } satisfies PlayerInput);
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
  }

  private syncPlayer(state: GameState): void {
    const pos = toIso(state.player.x, state.player.y);
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
    const color = state.player.status === 'PARALYZED' ? 0xffff00 : 0x44aaff;
    this.playerRect.setFillStyle(color);
  }

  private syncEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      const pos = toIso(enemy.x, enemy.y);

      if (!this.enemyRects.has(enemy.id)) {
        const rect = this.add
          .rectangle(pos.x, pos.y, 22, 22, 0xff4444)
          .setDepth(pos.y);
        this.enemyRects.set(enemy.id, rect);
      } else {
        const rect = this.enemyRects.get(enemy.id)!;
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
      const to   = toIso(ray.toX,   ray.toY);
      this.raysGraphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  // ─── Static visuals ─────────────────────────────────────────────────────────

  private drawGrid(): void {
    const bg = this.add.graphics().setDepth(-2);
    bg.fillStyle(0x0d0d1a, 1);

    // Fill background diamond covering the entire grid
    const top    = toIso(0, 0);
    const right  = toIso(GRID_SIZE - 1, 0);
    const bottom = toIso(GRID_SIZE - 1, GRID_SIZE - 1);
    const left   = toIso(0, GRID_SIZE - 1);
    bg.fillPoints([
      new Phaser.Geom.Point(top.x,    top.y - HH),
      new Phaser.Geom.Point(right.x + HW, right.y),
      new Phaser.Geom.Point(bottom.x, bottom.y + HH),
      new Phaser.Geom.Point(left.x - HW,  left.y),
    ], true);

    const g = this.add.graphics().setDepth(-1);
    g.lineStyle(1, 0x222244, 1);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        const c = toIso(gx, gy);
        g.strokePoints([
          new Phaser.Geom.Point(c.x,      c.y - HH),
          new Phaser.Geom.Point(c.x + HW, c.y),
          new Phaser.Geom.Point(c.x,      c.y + HH),
          new Phaser.Geom.Point(c.x - HW, c.y),
        ], true);
      }
    }
  }

  private drawCore(): void {
    // Core occupies tiles (7,7), (8,7), (7,8), (8,8)
    // Draw as a single filled isometric quad spanning the 2×2 block
    const topLeft  = toIso(7, 7);
    const topRight = toIso(8, 7);
    const botLeft  = toIso(7, 8);
    const botRight = toIso(8, 8);

    // Outer diamond vertices of the 2×2 block
    const topVertex    = { x: topLeft.x,        y: topLeft.y - HH };
    const rightVertex  = { x: topRight.x + HW,  y: topRight.y };
    const bottomVertex = { x: botRight.x,       y: botRight.y + HH };
    const leftVertex   = { x: botLeft.x - HW,   y: botLeft.y };

    this.coreGfx = this.add.graphics().setDepth(botRight.y);

    this.coreGfx.fillStyle(0x00cc66, 1);
    this.coreGfx.fillPoints([
      new Phaser.Geom.Point(topVertex.x,    topVertex.y),
      new Phaser.Geom.Point(rightVertex.x,  rightVertex.y),
      new Phaser.Geom.Point(bottomVertex.x, bottomVertex.y),
      new Phaser.Geom.Point(leftVertex.x,   leftVertex.y),
    ], true);

    this.coreGfx.lineStyle(2, 0x00ffaa, 1);
    this.coreGfx.strokePoints([
      new Phaser.Geom.Point(topVertex.x,    topVertex.y),
      new Phaser.Geom.Point(rightVertex.x,  rightVertex.y),
      new Phaser.Geom.Point(bottomVertex.x, bottomVertex.y),
      new Phaser.Geom.Point(leftVertex.x,   leftVertex.y),
    ], true);

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
