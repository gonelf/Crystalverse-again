import Phaser from 'phaser';
import { mulberry32, TILE_SIZE } from '../levels/types';

/** Generated tileset image used by dungeon levels (one row of 16x16 tiles). */
export const DUNGEON_TILESET = 'dungeon-tiles';

/** Tile indices into DUNGEON_TILESET. */
export const DUNGEON_TILES = {
  floor: 0,
  floorWorn: 1,
  crack: 2,
  wall: 3,
  /** Wall tile with a lit cap, used where the tile below is walkable. */
  wallFace: 4,
  void: 5,
} as const;

export const TEXTURES = {
  crate: 'crate',
  plateUp: 'plate-up',
  plateDown: 'plate-down',
  door: 'door',
  stairs: 'stairs',
} as const;

type Ctx = CanvasRenderingContext2D;

function draw(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  paint: (ctx: Ctx) => void,
): void {
  if (scene.textures.exists(key)) return;
  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) return;
  const ctx = texture.getContext();
  ctx.imageSmoothingEnabled = false;
  paint(ctx);
  texture.refresh();
}

function px(ctx: Ctx, color: string, x: number, y: number, w = 1, h = 1): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

const T = TILE_SIZE;

function paintFloor(ctx: Ctx, ox: number, seed: number): void {
  px(ctx, '#262b3a', ox, 0, T, T);
  const rand = mulberry32(seed);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * T);
    const y = Math.floor(rand() * T);
    px(ctx, rand() < 0.5 ? '#2d3346' : '#20243180', ox + x, y);
  }
  // Faint tile seam so the floor reads as flagstones.
  px(ctx, '#1f2330', ox, T - 1, T, 1);
  px(ctx, '#1f2330', ox + T - 1, 0, 1, T);
  px(ctx, '#2f3547', ox, 0, T, 1);
}

function paintCrack(ctx: Ctx, ox: number): void {
  const dark = '#181b26';
  const lit = '#333a4e';
  const points: Array<[number, number]> = [
    [3, 12], [4, 11], [5, 10], [6, 10], [7, 9], [8, 8], [9, 7], [10, 7], [11, 6], [12, 5],
    [7, 11], [8, 12], [6, 7], [5, 6],
  ];
  for (const [x, y] of points) {
    px(ctx, dark, ox + x, y);
    px(ctx, lit, ox + x, y + 1);
  }
}

function paintBricks(ctx: Ctx, ox: number, base: string, mortar: string, top: string): void {
  px(ctx, base, ox, 0, T, T);
  for (let row = 0; row < 3; row++) {
    const y = row * 5 + 4;
    px(ctx, mortar, ox, y, T, 1);
    const offset = row % 2 === 0 ? 4 : 11;
    px(ctx, mortar, ox + offset, y - 4, 1, 4);
  }
  px(ctx, mortar, ox + 4, 14, 1, 2);
  px(ctx, top, ox, 0, T, 1);
}

function paintWall(ctx: Ctx, ox: number): void {
  paintBricks(ctx, ox, '#343a4d', '#1e2130', '#3d4457');
}

function paintWallFace(ctx: Ctx, ox: number): void {
  // Brick face with a lit cap on top and a shadow where it meets the floor.
  paintBricks(ctx, ox, '#3f4661', '#232739', '#4a5270');
  px(ctx, '#565e7d', ox, 0, T, 4);
  px(ctx, '#6d7699', ox, 0, T, 1);
  px(ctx, '#232739', ox, 4, T, 1);
  px(ctx, '#2c3145', ox, 9, T, 1);
  px(ctx, '#161926', ox, T - 2, T, 2);
}

function paintVoid(ctx: Ctx, ox: number): void {
  px(ctx, '#05070d', ox, 0, T, T);
}

/** The dungeon tileset: floor, worn floor, cracks, wall, lit wall face and void. */
function createDungeonTileset(scene: Phaser.Scene): void {
  const tiles = Object.keys(DUNGEON_TILES).length;
  draw(scene, DUNGEON_TILESET, tiles * T, T, (ctx) => {
    paintFloor(ctx, DUNGEON_TILES.floor * T, 11);
    paintFloor(ctx, DUNGEON_TILES.floorWorn * T, 29);
    paintCrack(ctx, DUNGEON_TILES.crack * T);
    paintWall(ctx, DUNGEON_TILES.wall * T);
    paintWallFace(ctx, DUNGEON_TILES.wallFace * T);
    paintVoid(ctx, DUNGEON_TILES.void * T);
  });
}

function createCrate(scene: Phaser.Scene): void {
  draw(scene, TEXTURES.crate, T, T, (ctx) => {
    px(ctx, '#3b240f', 0, 0, T, T);
    px(ctx, '#8a5a2b', 1, 1, T - 2, T - 2);
    px(ctx, '#a4713b', 1, 1, T - 2, 1);
    px(ctx, '#6d4520', 1, T - 2, T - 2, 1);
    // Planks and a diagonal brace.
    px(ctx, '#6d4520', 1, 4, T - 2, 1);
    px(ctx, '#6d4520', 1, 11, T - 2, 1);
    for (let i = 0; i < 6; i++) {
      px(ctx, '#6d4520', 5 + i, 5 + i);
      px(ctx, '#6d4520', 10 - i, 5 + i);
    }
    // Corner braces.
    for (const [x, y] of [[1, 1], [T - 3, 1], [1, T - 3], [T - 3, T - 3]] as const) {
      px(ctx, '#c9924b', x, y, 2, 2);
    }
  });
}

/**
 * Plates are tinted with their group colour at runtime, and a tint multiplies,
 * so the art keeps a dark socket and puts the colour in the rim and studs.
 */
function paintPlate(ctx: Ctx, pressed: boolean): void {
  const inset = pressed ? 3 : 2;
  const size = T - inset * 2;
  // Socket the plate sits in.
  px(ctx, '#181b26', 1, 1, T - 2, T - 2);
  px(ctx, '#2b3040', 2, 2, T - 4, T - 4);
  // Plate body, with a lit rim on top and a shadow underneath.
  px(ctx, pressed ? '#6e7793' : '#98a2bd', inset, inset, size, size);
  px(ctx, pressed ? '#8e99b6' : '#d4dcf0', inset, inset, size, 1);
  px(ctx, '#474e63', inset, T - inset - 1, size, 1);
  px(ctx, '#474e63', T - inset - 1, inset, 1, size);
  // Recessed centre, so a pressed plate reads as sunken rather than just dark.
  const c = pressed ? 5 : 4;
  px(ctx, '#2f3547', c, c, T - c * 2, T - c * 2);
  px(ctx, pressed ? '#b9c6e6' : '#616a85', c + 1, c + 1, T - (c + 1) * 2, T - (c + 1) * 2);
  // Corner studs.
  for (const [x, y] of [[inset, inset], [T - inset - 2, inset], [inset, T - inset - 2], [T - inset - 2, T - inset - 2]] as const) {
    px(ctx, pressed ? '#8e99b6' : '#e8eefc', x, y, 2, 2);
  }
}

function createPlates(scene: Phaser.Scene): void {
  draw(scene, TEXTURES.plateUp, T, T, (ctx) => paintPlate(ctx, false));
  draw(scene, TEXTURES.plateDown, T, T, (ctx) => paintPlate(ctx, true));
}

function createDoor(scene: Phaser.Scene): void {
  draw(scene, TEXTURES.door, T, T, (ctx) => {
    px(ctx, '#2a2f40', 0, 0, T, T);
    px(ctx, '#4a5168', 0, 0, T, 2);
    px(ctx, '#4a5168', 0, T - 2, T, 2);
    for (const x of [2, 6, 10, 13]) {
      px(ctx, '#8f97ad', x, 2, 2, T - 4);
      px(ctx, '#b6bed3', x, 2, 1, T - 4);
    }
    px(ctx, '#d8dff0', 0, 7, T, 1);
  });
}

function createStairs(scene: Phaser.Scene): void {
  draw(scene, TEXTURES.stairs, T, T, (ctx) => {
    px(ctx, '#3a3f52', 0, 0, T, T);
    px(ctx, '#0a0c14', 1, 1, T - 2, T - 2);
    px(ctx, '#6b7390', 2, 10, T - 4, 3);
    px(ctx, '#565d75', 3, 6, T - 6, 3);
    px(ctx, '#444b60', 4, 3, T - 8, 2);
  });
}

/** Builds every runtime-generated texture. Safe to call on each scene start. */
export function createGeneratedTextures(scene: Phaser.Scene): void {
  createDungeonTileset(scene);
  createCrate(scene);
  createPlates(scene);
  createDoor(scene);
  createStairs(scene);
}
