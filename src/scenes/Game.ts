import Phaser from 'phaser';
import { EventBus, Events } from '../core/EventBus';
import { ServerEmulator, GameState, PlayerInput, Ray } from '../core/ServerEmulator';

// ─── Layout constants (must match ServerEmulator) ─────────────────────────────

const GRID_SIZE = 15;
const TILE_SIZE = 48;
const GRID_PX = GRID_SIZE * TILE_SIZE; // 720 px
const OFFSET_X = (1280 - GRID_PX) / 2; // 280 px — centers grid on 1280-wide canvas
const OFFSET_Y = (720 - GRID_PX) / 2;  // 0 px  — grid fills full height

const TWEEN_DURATION = 80; // ms — slightly shorter than server tick (100 ms)
const RAY_FADE_DURATION = 600; // ms

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tileToWorld(col: number, row: number): { x: number; y: number } {
  return {
    x: OFFSET_X + col * TILE_SIZE + TILE_SIZE / 2,
    y: OFFSET_Y + row * TILE_SIZE + TILE_SIZE / 2,
  };
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export class Game extends Phaser.Scene {
  // Server
  private server!: ServerEmulator;

  // Game objects
  private playerRect!: Phaser.GameObjects.Rectangle;
  private coreRect!: Phaser.GameObjects.Rectangle;
  private enemyRects = new Map<string, Phaser.GameObjects.Rectangle>();
  private raysGraphics!: Phaser.GameObjects.Graphics;

  // Input
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wKey!: Phaser.Input.Keyboard.Key;
  private aKey!: Phaser.Input.Keyboard.Key;
  private sKey!: Phaser.Input.Keyboard.Key;
  private dKey!: Phaser.Input.Keyboard.Key;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private lastMoveTime = 0;

  // Ray fade
  private cachedRays: Ray[] = [];
  private rayFadeMs = 0;

  constructor() {
    super({ key: 'Game' });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  create(): void {
    this.drawGrid();
    this.drawCore();

    // Player starts off-screen; first SERVER_UPDATE will position it
    this.playerRect = this.add.rectangle(-TILE_SIZE, -TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x44aaff);
    this.playerRect.setDepth(2);

    this.raysGraphics = this.add.graphics().setDepth(3);

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
    // Action: fire on key-down only (no repeat)
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      EventBus.emit(Events.PLAYER_INPUT, { type: 'action' } satisfies PlayerInput);
    }

    // Movement: throttled to match server tick rate
    if (time - this.lastMoveTime < TILE_SIZE * 2) return; // ~100 ms at 60 fps

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
    const pos = tileToWorld(state.player.x, state.player.y);
    this.tweens.add({
      targets: this.playerRect,
      x: pos.x,
      y: pos.y,
      duration: TWEEN_DURATION,
      ease: 'Linear',
    });
    const color = state.player.status === 'PARALYZED' ? 0xffff00 : 0x44aaff;
    this.playerRect.setFillStyle(color);
  }

  private syncEnemies(state: GameState): void {
    for (const enemy of state.enemies) {
      const pos = tileToWorld(enemy.x, enemy.y);

      if (!this.enemyRects.has(enemy.id)) {
        // First appearance — create the game object
        const rect = this.add
          .rectangle(pos.x, pos.y, TILE_SIZE - 12, TILE_SIZE - 12, 0xff4444)
          .setDepth(2);
        this.enemyRects.set(enemy.id, rect);
      } else {
        this.tweens.add({
          targets: this.enemyRects.get(enemy.id),
          x: pos.x,
          y: pos.y,
          duration: TWEEN_DURATION,
          ease: 'Linear',
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

    this.raysGraphics.lineStyle(3, 0xffff00, alpha);
    for (const ray of this.cachedRays) {
      const from = tileToWorld(ray.fromX, ray.fromY);
      const to   = tileToWorld(ray.toX,   ray.toY);
      this.raysGraphics.lineBetween(from.x, from.y, to.x, to.y);
    }
  }

  // ─── Static visuals ─────────────────────────────────────────────────────────

  private drawGrid(): void {
    // Dark background behind the grid
    this.add
      .rectangle(OFFSET_X + GRID_PX / 2, OFFSET_Y + GRID_PX / 2, GRID_PX, GRID_PX, 0x0d0d1a)
      .setDepth(0);

    // Grid lines
    this.add
      .grid(
        OFFSET_X + GRID_PX / 2,
        OFFSET_Y + GRID_PX / 2,
        GRID_PX,
        GRID_PX,
        TILE_SIZE,
        TILE_SIZE,
        0x000000, 0,      // cell fill: transparent
        0x222244, 1,      // outline
      )
      .setDepth(1);
  }

  private drawCore(): void {
    // Core occupies tiles (7,7)–(8,8): a 2×2 block at the centre of the grid
    const cx = OFFSET_X + 7 * TILE_SIZE + TILE_SIZE;
    const cy = OFFSET_Y + 7 * TILE_SIZE + TILE_SIZE;
    const size = TILE_SIZE * 2 - 4;

    this.coreRect = this.add
      .rectangle(cx, cy, size, size, 0x00cc66)
      .setDepth(1);

    // Pulsing glow border
    this.add
      .rectangle(cx, cy, size + 4, size + 4, 0x000000, 0)
      .setStrokeStyle(2, 0x00ffaa)
      .setDepth(1);

    this.tweens.add({
      targets: this.coreRect,
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
