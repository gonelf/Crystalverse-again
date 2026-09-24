import { solariaAvailable, SOLARIA_TILES } from '../graphics/solaria';
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
    label: 'Temple floor',
    ground: [DUNGEON_TILES.floor, DUNGEON_TILES.floor, DUNGEON_TILES.floor, DUNGEON_TILES.floorWorn],
    color: '#4b3f31',
    key: '1',
  },
  ',': {
    label: 'Vines',
    ground: [DUNGEON_TILES.floor],
    decor: [DUNGEON_TILES.crack],
    color: '#4f7f45',
    key: '2',
  },
  ';': {
    label: 'Painted glyph',
    ground: [DUNGEON_TILES.floor],
    decor: [DUNGEON_TILES.glyph],
    color: '#b4503a',
    key: '3',
  },
  '#': {
    label: 'Carved wall',
    ground: [DUNGEON_TILES.void],
    solid: [DUNGEON_TILES.wall],
    solidLit: DUNGEON_TILES.wallFace,
    color: '#a08864',
    key: '4',
  },
  '*': {
    label: 'Brazier',
    ground: [DUNGEON_TILES.floor],
    solid: [DUNGEON_TILES.brazier],
    color: '#ff8f3a',
    key: '5',
  },
  ' ': {
    label: 'Void',
    ground: [DUNGEON_TILES.void],
    solid: [DUNGEON_TILES.void],
    color: '#120f14',
    key: '6',
  },
  '=': {
    label: 'Plaza (merge)',
    ground: [DUNGEON_TILES.plaza],
    mergeZone: true,
    color: '#2f9e79',
    key: '7',
  },
  // The props below have richer art in the Solaria set. They are here too, with
  // the same footprint, so a level keeps its walls and floors either way.
  w: { label: 'Paved floor', ground: [DUNGEON_TILES.plaza], color: '#5c7f74', key: '8' },
  u: {
    label: 'Urn',
    ground: [DUNGEON_TILES.floor],
    solid: [DUNGEON_TILES.wall],
    color: '#b08b5a',
    key: '9',
  },
  s: {
    label: 'Shrine',
    ground: [DUNGEON_TILES.floor],
    solid: [DUNGEON_TILES.brazier],
    color: '#ffb457',
    key: '0',
  },
  n: {
    label: 'Anvil',
    ground: [DUNGEON_TILES.floor],
    solid: [DUNGEON_TILES.wall],
    color: '#8d8d99',
    key: 'j',
  },
  h: {
    label: 'Hearth',
    ground: [DUNGEON_TILES.floor],
    solid: [DUNGEON_TILES.wall],
    color: '#5a3a30',
    key: 'k',
  },
};


/** Tile indices into public/assets/solaria/tiles.png (28 tiles per row). */
const S = SOLARIA_TILES;

const SOLARIA_TERRAIN: Record<string, Terrain> = {
  '.': { label: 'Temple floor', ground: [...S.floor], color: '#d89a70', key: '1' },
  ',': {
    label: 'Vines',
    ground: [...S.floor],
    decor: [...S.vines],
    color: '#8a5a48',
    key: '2',
  },
  ';': {
    label: 'Carved disc',
    ground: [...S.floor],
    decor: [S.glyph],
    color: '#8c6d6c',
    key: '3',
  },
  '#': {
    label: 'Carved wall',
    ground: [S.void],
    solid: [...S.wall],
    solidLit: S.wallFace,
    color: '#9d5252',
    key: '4',
  },
  '*': {
    label: 'Brazier',
    ground: [...S.floor],
    solid: [S.brazier],
    color: '#ff8f3a',
    key: '5',
  },
  ' ': { label: 'Void', ground: [S.void], solid: [S.void], color: '#120f14', key: '6' },
  '=': { label: 'Plaza (merge)', ground: [...S.plaza], mergeZone: true, color: '#b4c5c1', key: '7' },
  w: { label: 'Paved floor', ground: [...S.paved], color: '#e0b48f', key: '8' },
  u: { label: 'Urn', ground: [...S.floor], solid: [S.urn], color: '#b08b5a', key: '9' },
  s: { label: 'Shrine', ground: [...S.floor], solid: [S.shrine], color: '#ffb457', key: '0' },
  n: { label: 'Anvil', ground: [...S.floor], solid: [S.anvil], color: '#8d8d99', key: 'j' },
  h: { label: 'Hearth', ground: [...S.floor], solid: [S.hearth], color: '#5a3a30', key: 'k' },
};

/**
 * The same pack above ground. Every character keeps the footprint it has in
 * `overworld`, trees included, so the meadows can switch art without a single
 * tile of collision moving.
 */
const SOLARIA_OUTDOORS_TERRAIN: Record<string, Terrain> = {
  '.': { label: 'Grass', ground: [...S.grass], color: '#2eb85c', key: '1' },
  ',': { label: 'Tufts', ground: [...S.grass], decor: [...S.tufts], color: '#7fc14a', key: '2' },
  '#': { label: 'Bush', ground: [...S.grass], solid: [S.bush], color: '#1e8b55', key: '3' },
  T: {
    label: 'Tree',
    ground: [...S.grass],
    block: S.tree.map((row) => [...row]),
    color: '#166b3f',
    key: '4',
  },
  '^': { label: 'Rock', ground: [...S.grass], solid: [...S.rock], color: '#d09a5a', key: '5' },
  '~': { label: 'Water', ground: [...S.grass], solid: [...S.water], color: '#4d9be6', key: '6' },
  '=': { label: 'Plaza (merge)', ground: [...S.plaza], mergeZone: true, color: '#b4c5c1', key: '7' },
};

export const TERRAIN: Record<TilesetKey, Record<string, Terrain>> = {
  overworld: OVERWORLD_TERRAIN,
  dungeon: DUNGEON_TERRAIN,
  solaria: SOLARIA_TERRAIN,
  'solaria-outdoors': SOLARIA_OUTDOORS_TERRAIN,
};

/** The character a tileset uses for plain walkable ground. */
export const FLOOR_CHAR = '.';

export const TILESETS: TilesetKey[] = ['overworld', 'dungeon', 'solaria', 'solaria-outdoors'];

/** What each Solaria set falls back to when its art isn't installed. */
const FALLBACK: Partial<Record<TilesetKey, TilesetKey>> = {
  solaria: 'dungeon',
  'solaria-outdoors': 'overworld',
};

/**
 * The tileset a level is actually drawn with. Solaria's art is not committed,
 * so a level asking for it falls back to the matching built-in set wherever
 * the file is missing — a build without it still runs, and because the two
 * sets share every character and footprint, it plays identically.
 */
export function effectiveTileset(tileset: TilesetKey): TilesetKey {
  return solariaAvailable() ? tileset : (FALLBACK[tileset] ?? tileset);
}

/** Image key each tileset's tile indices point into. */
export function tilesetImage(tileset: TilesetKey): string {
  switch (effectiveTileset(tileset)) {
    case 'dungeon':
      return 'dungeon-tiles';
    case 'solaria':
    case 'solaria-outdoors':
      return 'solaria-tiles';
    default:
      return 'overworld';
  }
}

export function terrainOf(tileset: TilesetKey, char: string): Terrain | undefined {
  return TERRAIN[effectiveTileset(tileset)][char];
}
