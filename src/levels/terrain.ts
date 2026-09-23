import { DUNGEON_TILES } from '../graphics/textures';
import type { TilesetKey } from './types';

/**
 * What one layout character means on the map. Tile indices point into the
 * level's tileset, so the same character (`#` is a wall, `.` is a floor) draws
 * the right art in a dungeon or out in the meadows.
 */
export interface Terrain {
  label: string;
  /** Floor tiles; one is picked per tile, the same way every time. */
  ground: number[] | ((col: number, row: number) => number);
  /** Walk-over decoration drawn on the ground. */
  decor?: number[];
  /** Blocks movement. */
  solid?: number[] | ((col: number, row: number) => number);
  /** Solid tile used where the tile below is walkable, e.g. a lit wall face. */
  solidLit?: number;
  /** A block anchored at this tile, written into the solid layer (trees). */
  block?: number[][];
  /** Tiles the two viewports merge over, e.g. the stone plazas. */
  mergeZone?: boolean;
  /** Swatch colour in the editor palette. */
  color: string;
  /** Key that picks this brush in the editor. */
  key: string;
}

/** Tile indices into public/assets/overworld.png (40 tiles per row). */
const GRASS = [0, 0, 0, 365, 405, 407];
const FLOWERS = [482, 483, 321];
const ROCKS = [207, 208];
const BUSH = 562;
const STONE = 103;
const TREE = [
  [645, 646],
  [685, 686],
];
/** Top-left of a 6x4 block of seamless water. */
const water = (col: number, row: number) => 16 + (col % 6) + 40 * (row % 4);

const OVERWORLD_TERRAIN: Record<string, Terrain> = {
  '.': { label: 'Grass', ground: GRASS, color: '#3f8f3a', key: '1' },
  ',': { label: 'Flowers', ground: GRASS, decor: FLOWERS, color: '#7fc14a', key: '2' },
  '#': { label: 'Bush', ground: GRASS, solid: [BUSH], color: '#24552a', key: '3' },
  T: { label: 'Tree', ground: GRASS, block: TREE, color: '#1b3f22', key: '4' },
  '^': { label: 'Rock', ground: GRASS, solid: ROCKS, color: '#7a6a58', key: '5' },
  '~': { label: 'Water', ground: GRASS, solid: water, color: '#2f6fb8', key: '6' },
  '=': { label: 'Plaza (merge)', ground: [STONE], mergeZone: true, color: '#9ad8ff', key: '7' },
};

const DUNGEON_TERRAIN: Record<string, Terrain> = {
  '.': {
    label: 'Floor',
    ground: [DUNGEON_TILES.floor, DUNGEON_TILES.floor, DUNGEON_TILES.floor, DUNGEON_TILES.floorWorn],
    color: '#262b3a',
    key: '1',
  },
  ',': {
    label: 'Cracked floor',
    ground: [DUNGEON_TILES.floor],
    decor: [DUNGEON_TILES.crack],
    color: '#333a4e',
    key: '2',
  },
  '#': {
    label: 'Wall',
    ground: [DUNGEON_TILES.void],
    solid: [DUNGEON_TILES.wall],
    solidLit: DUNGEON_TILES.wallFace,
    color: '#3f4661',
    key: '3',
  },
  ' ': {
    label: 'Void',
    ground: [DUNGEON_TILES.void],
    solid: [DUNGEON_TILES.void],
    color: '#05070d',
    key: '4',
  },
  '=': {
    label: 'Plaza (merge)',
    ground: [DUNGEON_TILES.floorWorn],
    mergeZone: true,
    color: '#9ad8ff',
    key: '7',
  },
};

export const TERRAIN: Record<TilesetKey, Record<string, Terrain>> = {
  overworld: OVERWORLD_TERRAIN,
  dungeon: DUNGEON_TERRAIN,
};

/** The character a tileset uses for plain walkable ground. */
export const FLOOR_CHAR = '.';

export const TILESETS: TilesetKey[] = ['overworld', 'dungeon'];

/** Image key each tileset's tile indices point into. */
export function tilesetImage(tileset: TilesetKey): string {
  return tileset === 'dungeon' ? 'dungeon-tiles' : 'overworld';
}

export function terrainOf(tileset: TilesetKey, char: string): Terrain | undefined {
  return TERRAIN[tileset][char];
}
