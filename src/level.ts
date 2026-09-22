export const TILE_SIZE = 16;

export interface TileRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export interface LevelData {
  cols: number;
  rows: number;
  spawns: [{ col: number; row: number }, { col: number; row: number }];
  /** Opaque floor tiles (grass, stone). */
  ground: number[][];
  /** Walk-over decoration drawn on top of the ground (flowers). -1 = empty. */
  decor: number[][];
  /** Everything that blocks movement (water, bushes, trees, rocks). -1 = empty. */
  solid: number[][];
  /** Areas where the two viewports merge into one when both players stand inside. */
  mergeZones: TileRect[];
}

/** Tile indices into public/assets/overworld.png (40 tiles per row). */
const TILES = {
  grass: [0, 0, 0, 365, 405, 407],
  flowers: [482, 483, 321],
  stone: 103,
  bush: 562,
  rocks: [207, 208],
  tree: [
    [645, 646],
    [685, 686],
  ],
  /** Top-left of a 6x4 block of seamless water. */
  water: (col: number, row: number) => 16 + (col % 6) + 40 * (row % 4),
};

const COLS = 80;
const ROWS = 50;
const RIVER = { from: 38, to: 41 };
const MERGE_ZONES: TileRect[] = [
  { col: 32, row: 6, cols: 16, rows: 8 },
  { col: 32, row: 36, cols: 16, rows: 8 },
];
const SPAWNS: LevelData['spawns'] = [
  { col: 12, row: 25 },
  { col: 67, row: 25 },
];

/** Small deterministic PRNG so the level looks the same on every run. */
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inRect(col: number, row: number, r: TileRect, pad = 0): boolean {
  return (
    col >= r.col - pad && col < r.col + r.cols + pad && row >= r.row - pad && row < r.row + r.rows + pad
  );
}

/**
 * Placeholder level: two meadows split by a river. Stone plazas bridge the
 * river and act as the merge zones, so the players only meet there.
 *
 * Swap this for a Tiled map later: the same three layers plus an object layer
 * of merge-zone rectangles.
 */
function generate(): LevelData {
  const rand = mulberry32(7);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const grid = (fill: number) => Array.from({ length: ROWS }, () => Array<number>(COLS).fill(fill));

  const ground = grid(0);
  const decor = grid(-1);
  const solid = grid(-1);

  const inPlaza = (c: number, r: number, pad = 0) => MERGE_ZONES.some((z) => inRect(c, r, z, pad));
  const nearSpawn = (c: number, r: number) =>
    SPAWNS.some((s) => Math.abs(s.col - c) < 4 && Math.abs(s.row - r) < 4);
  const isRiver = (c: number) => c >= RIVER.from && c <= RIVER.to;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ground[r][c] = pick(TILES.grass);
      if (inPlaza(c, r)) ground[r][c] = TILES.stone;
      else if (isRiver(c)) solid[r][c] = TILES.water(c, r);
      else if (c < 2 || r < 2 || c >= COLS - 2 || r >= ROWS - 2) solid[r][c] = TILES.bush;
    }
  }

  // Scatter trees, bushes, rocks and flowers, keeping spawns, plazas and the riverbank clear.
  const free = (c: number, r: number) =>
    c >= 2 && r >= 2 && c < COLS - 2 && r < ROWS - 2 &&
    solid[r][c] === -1 && !inPlaza(c, r, 2) && !nearSpawn(c, r) &&
    !(c >= RIVER.from - 1 && c <= RIVER.to + 1);

  for (let r = 2; r < ROWS - 2; r++) {
    for (let c = 2; c < COLS - 2; c++) {
      if (!free(c, r)) continue;
      const roll = rand();
      if (roll < 0.025 && free(c + 1, r) && free(c, r + 1) && free(c + 1, r + 1)) {
        TILES.tree.forEach((row, dy) => row.forEach((t, dx) => (solid[r + dy][c + dx] = t)));
      } else if (roll < 0.045) {
        solid[r][c] = TILES.bush;
      } else if (roll < 0.055) {
        solid[r][c] = pick(TILES.rocks);
      } else if (roll < 0.1) {
        decor[r][c] = pick(TILES.flowers);
      }
    }
  }

  return { cols: COLS, rows: ROWS, spawns: SPAWNS, ground, decor, solid, mergeZones: MERGE_ZONES };
}

export const LEVEL = generate();
