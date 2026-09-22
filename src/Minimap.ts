import Phaser from 'phaser';
import { PLAYER_COLORS } from './config';
import { LEVEL, TILE_SIZE } from './level';

/** Minimap pixels per level tile. */
const SCALE = 3;
const PADDING = 3;
const COLORS = {
  grass: '#3f8f3a',
  solid: '#24552a',
  water: '#2f6fb8',
  plaza: '#9ad8ff',
  frame: 0x000000,
};

/** Water is the only solid tile in the 6x4 block starting at tile 16; see level.ts. */
function isWater(t: number): boolean {
  const col = t % 40;
  const row = Math.floor(t / 40);
  return row < 4 && col >= 16 && col < 22;
}

/** Draw the level once into a shared texture: ground, obstacles, water and merge zones. */
function ensureTerrainTexture(scene: Phaser.Scene): string {
  const key = 'minimap-terrain';
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, LEVEL.cols * SCALE, LEVEL.rows * SCALE)!;
  const ctx = tex.getContext();
  for (let r = 0; r < LEVEL.rows; r++) {
    for (let c = 0; c < LEVEL.cols; c++) {
      const s = LEVEL.solid[r][c];
      ctx.fillStyle = s < 0 ? COLORS.grass : isWater(s) ? COLORS.water : COLORS.solid;
      ctx.fillRect(c * SCALE, r * SCALE, SCALE, SCALE);
    }
  }
  ctx.fillStyle = COLORS.plaza;
  for (const z of LEVEL.mergeZones) {
    ctx.fillRect(z.col * SCALE, z.row * SCALE, z.cols * SCALE, z.rows * SCALE);
  }
  tex.refresh();
  return key;
}

/**
 * A small map of the whole level for one player's viewport. It only shows its
 * own player, like the split view itself, so players find each other by
 * describing where they are and heading for the plazas.
 */
export class Minimap extends Phaser.GameObjects.Container {
  static readonly width = LEVEL.cols * SCALE + PADDING * 2;
  static readonly height = LEVEL.rows * SCALE + PADDING * 2;

  private readonly dot: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly owner: 0 | 1) {
    super(scene, x, y);
    const frame = scene.add.rectangle(0, 0, Minimap.width, Minimap.height, COLORS.frame, 0.6).setOrigin(0);
    const terrain = scene.add.image(PADDING, PADDING, ensureTerrainTexture(scene)).setOrigin(0).setAlpha(0.9);
    this.dot = scene.add.rectangle(0, 0, 6, 6, PLAYER_COLORS[owner]).setStrokeStyle(1, 0xffffff);
    this.add([frame, terrain, this.dot]);
    scene.add.existing(this);
  }

  /** Move the dot to the owner's world position. `positions` holds both players. */
  setPlayers(positions: readonly { x: number; y: number }[]): void {
    const p = positions[this.owner];
    this.dot.setPosition(PADDING + (p.x / TILE_SIZE) * SCALE, PADDING + (p.y / TILE_SIZE) * SCALE);
  }
}
