import Phaser from 'phaser';
import { mulberry32, TILE_SIZE } from '../levels/types';

/** Generated tileset image used by dungeon levels (one row of 16x16 tiles). */
export const DUNGEON_TILESET = 'dungeon-tiles';

/** Tile indices into DUNGEON_TILESET. */
export const DUNGEON_TILES = {
  floor: 0,
  floorWorn: 1,
  /** Vines and cracks, drawn over the floor. */
  crack: 2,
  wall: 3,
  /** Wall tile with a carved frieze, used where the tile below is walkable. */
  wallFace: 4,
  void: 5,
  /** A lit brazier. Blocks movement. */
  brazier: 6,
  /** A painted glyph, drawn over the floor. */
  glyph: 7,
  /** Jade-inlaid plaza, for merge zones underground. */
  plaza: 8,
} as const;

export const TEXTURES = {
  crate: 'crate',
  plateUp: 'plate-up',
  plateDown: 'plate-down',
  door: 'door',
  stairs: 'stairs',
} as const;

/**
 * An Aztec temple palette: sun-bleached limestone, painted terracotta friezes,
 * jade and gold inlays, and the dark polished floor of a buried vault.
 *
 * Tiles are written as pixel maps so the carving reads at 16x16, where a
 * procedural line tends to turn to mush. `.` leaves a pixel transparent.
 */
const P: Record<string, string> = {
  C: '#e6d3ae', // lit limestone
  c: '#cbb68f',
  L: '#a08864', // limestone
  l: '#7e6749',
  x: '#5d4b36', // carved groove
  D: '#241d16', // deep shadow
  R: '#b4503a', // painted terracotta
  r: '#87392a',
  j: '#2f9e79', // jade
  J: '#5fc8a3',
  g: '#e0b24c', // gold
  G: '#a87c2c',
  f: '#3b3128', // temple floor
  F: '#463a2d',
  s: '#2d251c',
  n: '#191410', // void
  N: '#221b24',
  v: '#3f6a38', // vine
  V: '#5f9a4e',
  W: '#7cc267',
  o: '#ff8f3a', // fire
  O: '#ffd98a',
  _: '#00000055', // soft shadow
};

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

/** Paints a pixel map. Each character is a colour in `P`; `.` is transparent. */
function stamp(ctx: Ctx, ox: number, oy: number, rows: readonly string[]): void {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const color = P[ch];
    if (color) px(ctx, color, ox + x, oy + y);
  }));
}

const T = TILE_SIZE;

/** Dark slabs, so limestone walls and gold inlays read against them. */
const FLOOR = [
  'FFFFFFFFFFFFFFFs',
  'ffffffffffffffFs',
  'ffffffffffffffFs',
  'ffffFfffffffffFs',
  'ffffffffffffffFs',
  'ffffffffffsfffFs',
  'ffffffffffffffFs',
  'ffFfffffffffffFs',
  'ffffffffffffffFs',
  'ffffffffffffffFs',
  'fffffffsffffffFs',
  'ffffffffffffffFs',
  'ffffffffffffffFs',
  'ffffffffffFfffFs',
  'ffffffffffffffFs',
  'ssssssssssssssss',
];

/** The same slab, chipped: rare enough that the floor doesn't look printed. */
const FLOOR_WORN = [
  'FFFFFFFFFFFFFFFs',
  'ffffffffffffffFs',
  'fffffffffsfffffs',
  'ffffffffsfffffFs',
  'fffffffsffffffFs',
  'ffffffsfffffffFs',
  'fffffsffffffffFs',
  'ffffsFfffffffffs',
  'fffsffffffffffFs',
  'ffffffffffffffFs',
  'ffffffffffFfffFs',
  'ffsfffffffffffFs',
  'fffffffffffffffs',
  'ffffffffffffffFs',
  'ffffffffffffffFs',
  'ssssssssssssssss',
];

/** A crack in the slabs, with leaves pushing through it. */
const VINES = [
  '................',
  '................',
  '.............vW.',
  '............vVW.',
  '...........sVv..',
  '..........s.....',
  '.........s......',
  '........sW......',
  '.......svVW.....',
  '......s.vW......',
  '.....s..........',
  '....sW..........',
  '...svV..........',
  '..s.vW..........',
  '..s.............',
  '................',
];

/** A painted sun glyph, for marking a room's floor. */
const GLYPH = [
  '................',
  '................',
  '................',
  '......rrrr......',
  '.....rRRRRr.....',
  '....rRRRRRRr....',
  '...rRRRggRRRr...',
  '...rRRgGGgRRr...',
  '...rRRgGGgRRr...',
  '...rRRRggRRRr...',
  '....rRRRRRRr....',
  '.....rRRRRr.....',
  '......rrrr......',
  '................',
  '................',
  '................',
];

/** Dressed stone: the body of a wall, seen above its carved face. */
const WALL = [
  'llllllllllllllll',
  'LLLLLLLLLLLLLLLL',
  'LLLLLlLLLLLLlLLL',
  'LLLLLlLLLLLLlLLL',
  'LLLLLlLLLLLLlLLL',
  'LLLLLlLLLLLLlLLL',
  'llllllllllllllll',
  'xxxxxxxxxxxxxxxx',
  'LLLLLLLLLLLLLLLL',
  'LLlLLLLLLlLLLLLL',
  'LLlLLLLLLlLLLLLL',
  'LLlLLLLLLlLLLLLL',
  'LLlLLLLLLlLLLLLL',
  'llllllllllllllll',
  'xxxxxxxxxxxxxxxx',
  'DDDDDDDDDDDDDDDD',
];

/** The carved face of a wall: lit cap, painted band, stepped-fret frieze. */
const WALL_FACE = [
  'CCCCCCCCCCCCCCCC',
  'CCCCCCCCCCCCCCCC',
  'cccccccccccccccc',
  'cccccccccccccccc',
  'llllllllllllllll',
  'RRRRRRRRRRRRRRRR',
  'rrrrrrrrrrrrrrrr',
  'LLLLLLLLLLLLLLLL',
  'LCCCCxLLLCCCCxLL',
  'LCxxCxLLLCxxCxLL',
  'LCxLLxLLLCxLLxLL',
  'LCxxxxLLLCxxxxLL',
  'LCCCCCLLLCCCCCLL',
  'llllllllllllllll',
  'jjlljjlljjlljjll',
  'DDDDDDDDDDDDDDDD',
];

/** Nothing: the rock the vault was cut out of. */
const VOID = [
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnNnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnNnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnNnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnNnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
  'nnnNnnnnnnnnnnnn',
  'nnnnnnnnnnnnnnnn',
];

/** A lit brazier on a stone pedestal. Blocks the way. */
const BRAZIER = [
  '................',
  '.......o........',
  '......oOo.......',
  '.....oOOOo......',
  '.....oOOOo......',
  '....ooOOOoo.....',
  '....gooooog.....',
  '...CLLLLLLLC....',
  '...xLjLLjLLx....',
  '...xLLLLLLLx....',
  '....xxxxxxx.....',
  '......LLL.......',
  '......xLx.......',
  '.....CLLLC......',
  '.....xxxxx......',
  '......DDD.......',
];

/** Jade-inlaid stone, where the two views merge underground. */
const PLAZA = [
  'CCCCCCCCCCCCCCCl',
  'CLLLLLLLLLLLLLCl',
  'CLjjjjjjjjjjjLCl',
  'CLjJJJJJJJJJjLCl',
  'CLjJLLLLLLLJjLCl',
  'CLjJLxxxxxLJjLCl',
  'CLjJLxgggxLJjLCl',
  'CLjJLxgGgxLJjLCl',
  'CLjJLxgggxLJjLCl',
  'CLjJLxxxxxLJjLCl',
  'CLjJLLLLLLLJjLCl',
  'CLjJJJJJJJJJjLCl',
  'CLjjjjjjjjjjjLCl',
  'CLLLLLLLLLLLLLCl',
  'CCCCCCCCCCCCCCCl',
  'llllllllllllllll',
];

/** The dungeon tileset: temple floors, carved walls, braziers and glyphs. */
function createDungeonTileset(scene: Phaser.Scene): void {
  const tiles: Array<[number, readonly string[]]> = [
    [DUNGEON_TILES.floor, FLOOR],
    [DUNGEON_TILES.floorWorn, FLOOR_WORN],
    [DUNGEON_TILES.crack, VINES],
    [DUNGEON_TILES.wall, WALL],
    [DUNGEON_TILES.wallFace, WALL_FACE],
    [DUNGEON_TILES.void, VOID],
    [DUNGEON_TILES.brazier, BRAZIER],
    [DUNGEON_TILES.glyph, GLYPH],
    [DUNGEON_TILES.plaza, PLAZA],
  ];
  draw(scene, DUNGEON_TILESET, tiles.length * T, T, (ctx) => {
    for (const [index, rows] of tiles) stamp(ctx, index * T, 0, rows);
  });
}

/** The crate is a carved push-stone with a jade inlay and gold studs. */
const CRATE = [
  'xxxxxxxxxxxxxxxx',
  'xgCCCCCCCCCCCCgx',
  'xGCLLLLLLLLLLCGx',
  'xCLxxxxxxxxxxLCx',
  'xCLxLLLLLLLLxLCx',
  'xCLxLjjjjjjLxLCx',
  'xCLxLjJJJJjLxLCx',
  'xCLxLjJggJjLxLCx',
  'xCLxLjJggJjLxLCx',
  'xCLxLjJJJJjLxLCx',
  'xCLxLjjjjjjLxLCx',
  'xCLxLLLLLLLLxLCx',
  'xCLxxxxxxxxxxLCx',
  'xGLllllllllllLGx',
  'xxxxxxxxxxxxxxxx',
  '._____________._',
];

/** A sun-stone plate, raised and pressed. Tinted with its group's colour. */
const PLATE_UP = [
  'DDDDDDDDDDDDDDDD',
  'DssssssssssssssD',
  'DsCCCCCCCCCCCCsD',
  'DsCLLLLLLLLLLCsD',
  'DsCLxxxxxxxxLCsD',
  'DsCLxCCCCCCxLCsD',
  'DsCLxCxxxxCxLCsD',
  'DsCLxCxCCxCxLCsD',
  'DsCLxCxCCxCxLCsD',
  'DsCLxCxxxxCxLCsD',
  'DsCLxCCCCCCxLCsD',
  'DsCLxxxxxxxxLCsD',
  'DsCLLLLLLLLLLCsD',
  'DsCCCCCCCCCCCCsD',
  'DssssssssssssssD',
  'DDDDDDDDDDDDDDDD',
];

const PLATE_DOWN = [
  'DDDDDDDDDDDDDDDD',
  'DssssssssssssssD',
  'DssssssssssssssD',
  'DssCCCCCCCCCCssD',
  'DssCllllllllCssD',
  'DssClxxxxxxlCssD',
  'DssClxCCCCxlCssD',
  'DssClxCCCCxlCssD',
  'DssClxCCCCxlCssD',
  'DssClxxxxxxlCssD',
  'DssCllllllllCssD',
  'DssCCCCCCCCCCssD',
  'DssssssssssssssD',
  'DssssssssssssssD',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
];

/** A carved slab with a serpent's eye; it sinks into the floor when it opens. */
const DOOR = [
  'xxxxxxxxxxxxxxxx',
  'xCCCCCCCCCCCCCCx',
  'xLLLLLLLLLLLLLLx',
  'xCCxLCCxLCCxLCCx',
  'xCxxLCxxLCxxLCxx',
  'xLLLLLLLLLLLLLLx',
  'xLLLLCCCCCCLLLLx',
  'xLLLCxggggxCLLLx',
  'xLLLCxgGGgxCLLLx',
  'xLLLCxggggxCLLLx',
  'xLLLLCCCCCCLLLLx',
  'xLLLLLLLLLLLLLLx',
  'xCCxLCCxLCCxLCCx',
  'xCxxLCxxLCxxLCxx',
  'xllllllllllllllx',
  'xxxxxxxxxxxxxxxx',
];

/** Steps down into the temple, framed by carved stone. */
const STAIRS = [
  'xxxxxxxxxxxxxxxx',
  'xnnnnnnnnnnnnnnx',
  'xnnnnnnnnnnnnnnx',
  'xlCCCCCCCCCCCClx',
  'xlLLLLLLLLLLLLlx',
  'xnnnnnnnnnnnnnnx',
  'xlCCCCCCCCCCCClx',
  'xlLLLLLLLLLLLLlx',
  'xnnnnnnnnnnnnnnx',
  'xlCCCCCCCCCCCClx',
  'xlLLLLLLLLLLLLlx',
  'xnnnnnnnnnnnnnnx',
  'xlCCCCCCCCCCCClx',
  'xlLLLLLLLLLLLLlx',
  'xljjlllllllljjlx',
  'xxxxxxxxxxxxxxxx',
];

function createObjects(scene: Phaser.Scene): void {
  draw(scene, TEXTURES.crate, T, T, (ctx) => stamp(ctx, 0, 0, CRATE));
  draw(scene, TEXTURES.plateUp, T, T, (ctx) => stamp(ctx, 0, 0, PLATE_UP));
  draw(scene, TEXTURES.plateDown, T, T, (ctx) => stamp(ctx, 0, 0, PLATE_DOWN));
  draw(scene, TEXTURES.door, T, T, (ctx) => stamp(ctx, 0, 0, DOOR));
  draw(scene, TEXTURES.stairs, T, T, (ctx) => stamp(ctx, 0, 0, STAIRS));
}

/** Builds every runtime-generated texture. Safe to call on each scene start. */
export function createGeneratedTextures(scene: Phaser.Scene): void {
  createDungeonTileset(scene);
  createObjects(scene);
}
