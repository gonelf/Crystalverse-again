export const TILE_SIZE = 16;

/** A level's id is its file name in `src/levels/data`. */
export type LevelId = string;

/** Which tileset image the level's tile indices point into. */
export type TilesetKey = 'overworld' | 'dungeon' | 'solaria';

export interface TilePos {
  col: number;
  row: number;
}

export interface TileRect {
  col: number;
  row: number;
  cols: number;
  rows: number;
}

export type MobKind = 'green' | 'purple';

export interface MobSpawn extends TilePos {
  kind: MobKind;
}

/** A pressure plate. Every plate of a group must be held for that group's doors to open. */
export interface PlateSpec extends TilePos {
  group: string;
}

/** A crate the players push one tile at a time. Heavy enough to hold a plate down. */
export type CrateSpec = TilePos;

/** A door that opens while every plate of its group is pressed. */
export interface DoorSpec extends TilePos {
  group: string;
}

/** Both players standing inside `rect` travel to level `to`. */
export interface ExitSpec {
  /** The character that marks this exit in the layout: X, Y or Z. */
  mark: string;
  rect: TileRect;
  to: LevelId;
  label: string;
  /** Exit mark in the target level to arrive at; its spawns are used if unset. */
  arriveAt?: string;
  /** Free tiles beside this exit, where players coming in through it land. */
  arrival: TilePos[];
}

export interface LevelData {
  id: LevelId;
  name: string;
  /** One line of help shown at the bottom of the screen. */
  hint: string;
  /** Changes when the level's source does, so per-level caches can be keyed on it. */
  revision: string;
  tileset: TilesetKey;
  cols: number;
  rows: number;
  spawns: [TilePos, TilePos];
  /** Opaque floor tiles. */
  ground: number[][];
  /** Walk-over decoration drawn on top of the ground. -1 = empty. */
  decor: number[][];
  /** Everything that blocks movement. -1 = empty. */
  solid: number[][];
  /** Areas where the two viewports merge into one when both players stand inside. */
  mergeZones: TileRect[];
  /** Where mobs start and respawn. Mobs never enter merge zones. */
  mobs: MobSpawn[];
  /** True for levels the players always share a single camera in (dungeons). */
  sharedView: boolean;
  plates: PlateSpec[];
  crates: CrateSpec[];
  doors: DoorSpec[];
  exits: ExitSpec[];
}

/** Small deterministic PRNG so generated levels look the same on every run. */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inRect(col: number, row: number, r: TileRect, pad = 0): boolean {
  return (
    col >= r.col - pad && col < r.col + r.cols + pad && row >= r.row - pad && row < r.row + r.rows + pad
  );
}
