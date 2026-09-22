import Phaser from 'phaser';
import { PLAYER_COLORS } from './config';
import { DUNGEON_TILES } from './graphics/textures';
import { TILE_SIZE, type LevelData } from './levels';

/** Minimap pixels per level tile. */
const SCALE = 3;
const PADDING = 3;
const FRAME_COLOR = 0x000000;

const PALETTES = {
  overworld: { floor: '#3f8f3a', solid: '#24552a', water: '#2f6fb8' },
  dungeon: { floor: '#2b3040', solid: '#5a6280', water: '#05070d' },
} as const;
const ZONE_COLOR = '#9ad8ff';
const EXIT_COLOR = '#ffd166';

/** Water is the only solid tile in the 6x4 block starting at tile 16; see overworld.ts. */
function isOverworldWater(t: number): boolean {
  const col = t % 40;
  const row = Math.floor(t / 40);
  return row < 4 && col >= 16 && col < 22;
}

const isDeep = (level: LevelData, t: number) =>
  level.tileset === 'dungeon' ? t === DUNGEON_TILES.void : isOverworldWater(t);

/** Draw a level once into a shared texture: ground, obstacles, merge zones and exits. */
function ensureTerrainTexture(scene: Phaser.Scene, level: LevelData): string {
  const key = `minimap-${level.id}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, level.cols * SCALE, level.rows * SCALE)!;
  const ctx = tex.getContext();
  const palette = PALETTES[level.tileset];
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const s = level.solid[r][c];
      ctx.fillStyle = s < 0 ? palette.floor : isDeep(level, s) ? palette.water : palette.solid;
      ctx.fillRect(c * SCALE, r * SCALE, SCALE, SCALE);
    }
  }
  ctx.fillStyle = ZONE_COLOR;
  for (const z of level.mergeZones) {
    ctx.fillRect(z.col * SCALE, z.row * SCALE, z.cols * SCALE, z.rows * SCALE);
  }
  // Stairs are worth finding, so they get their own colour.
  ctx.fillStyle = EXIT_COLOR;
  for (const { rect } of level.exits) {
    ctx.fillRect(rect.col * SCALE, rect.row * SCALE, rect.cols * SCALE, rect.rows * SCALE);
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
  readonly frameWidth: number;
  readonly frameHeight: number;

  private readonly dot: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, level: LevelData, private readonly owner: 0 | 1) {
    super(scene, 0, 0);
    this.frameWidth = level.cols * SCALE + PADDING * 2;
    this.frameHeight = level.rows * SCALE + PADDING * 2;

    const frame = scene.add
      .rectangle(0, 0, this.frameWidth, this.frameHeight, FRAME_COLOR, 0.6)
      .setOrigin(0);
    const terrain = scene.add
      .image(PADDING, PADDING, ensureTerrainTexture(scene, level))
      .setOrigin(0)
      .setAlpha(0.9);
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
