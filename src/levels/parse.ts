import {
  CRATE_CHAR,
  DOOR_CHARS,
  EXIT_MARKS,
  MOB_CHARS,
  PLATE_CHARS,
  SPAWN_CHARS,
  revisionOf,
  type LevelFile,
} from './format';
import { effectiveTileset, FLOOR_CHAR, terrainOf, type Terrain } from './terrain';
import type {
  CrateSpec,
  DoorSpec,
  ExitSpec,
  LevelData,
  MobSpawn,
  PlateSpec,
  TilePos,
  TileRect,
} from './types';

/** Picks the same tile variant for a position every time. */
function variant(choices: readonly number[], col: number, row: number): number {
  if (choices.length === 1) return choices[0];
  const hash = (Math.imul(col + 1, 73856093) ^ Math.imul(row + 1, 19349663)) >>> 0;
  return choices[hash % choices.length];
}

function tileFrom(
  source: number[] | ((col: number, row: number) => number),
  col: number,
  row: number,
): number {
  return typeof source === 'function' ? source(col, row) : variant(source, col, row);
}

/**
 * Turns a level file into everything the game needs to build it: the three
 * tile layers, the puzzle pieces, mob spawns, merge zones and exits.
 *
 * A level being edited may be half-finished, so this never throws — the editor
 * reports what is missing, and the game falls back to something it can stand up.
 */
export function buildLevel(id: string, file: LevelFile): LevelData {
  const layout = file.layout;
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  const grid = (fill: number) => Array.from({ length: rows }, () => Array<number>(cols).fill(fill));

  const ground = grid(-1);
  const decor = grid(-1);
  const solid = grid(-1);
  const merge = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));

  const spawns: TilePos[] = [];
  const plates: PlateSpec[] = [];
  const crates: CrateSpec[] = [];
  const doors: DoorSpec[] = [];
  const mobs: MobSpawn[] = [];
  const exitTiles = new Map<string, TilePos[]>();

  const at = (col: number, row: number) => layout[row]?.[col] ?? '#';
  const floor = terrainOf(file.tileset, FLOOR_CHAR);
  const terrainAt = (col: number, row: number): Terrain | undefined =>
    terrainOf(file.tileset, at(col, row)) ?? floor;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = at(col, row);
      // Entities stand on plain floor; everything else is terrain.
      const terrain = terrainAt(col, row);
      if (!terrain) continue;

      ground[row][col] = tileFrom(terrain.ground, col, row);
      if (terrain.decor) decor[row][col] = variant(terrain.decor, col, row);
      if (terrain.mergeZone) merge[row][col] = true;
      if (terrain.solid) {
        const below = terrainAt(col, row + 1);
        const lit = terrain.solidLit !== undefined && !below?.solid && !below?.block;
        solid[row][col] = lit ? terrain.solidLit! : tileFrom(terrain.solid, col, row);
      }
      if (terrain.block) {
        terrain.block.forEach((line, dy) => line.forEach((tile, dx) => {
          if (solid[row + dy]?.[col + dx] !== undefined) solid[row + dy][col + dx] = tile;
        }));
      }

      if (SPAWN_CHARS.includes(ch)) spawns[SPAWN_CHARS.indexOf(ch)] = { col, row };
      else if (ch === CRATE_CHAR) crates.push({ col, row });
      else if (PLATE_CHARS.includes(ch)) plates.push({ col, row, group: ch });
      else if (DOOR_CHARS.includes(ch)) doors.push({ col, row, group: ch.toLowerCase() });
      else if (MOB_CHARS[ch]) mobs.push({ col, row, kind: MOB_CHARS[ch] });
      else if (EXIT_MARKS.includes(ch)) {
        const tiles = exitTiles.get(ch) ?? [];
        tiles.push({ col, row });
        exitTiles.set(ch, tiles);
      }
    }
  }

  const fallback = spawns[0] ?? firstFree(solid) ?? { col: 0, row: 0 };
  const exits: ExitSpec[] = [...exitTiles].map(([mark, tiles]) => {
    const config = file.exits?.[mark];
    return {
      mark,
      rect: bounds(tiles),
      to: config?.to ?? '',
      label: config?.label || mark,
      arriveAt: config?.arriveAt,
      arrival: [],
    };
  });
  // Where players stand when they come in through an exit: the free tiles
  // beside it, so they step out of the doorway rather than onto it.
  for (const exit of exits) exit.arrival = landingTiles(exit.rect, solid, exits);

  return {
    id,
    name: file.name || id,
    hint: file.hint ?? '',
    revision: revisionOf(file),
    tileset: effectiveTileset(file.tileset),
    cols,
    rows,
    spawns: [spawns[0] ?? fallback, spawns[1] ?? fallback],
    ground,
    decor,
    solid,
    mergeZones: mergeRects(merge),
    mobs,
    sharedView: Boolean(file.sharedView),
    plates,
    crates,
    doors,
    exits,
  };
}

function firstFree(solid: number[][]): TilePos | undefined {
  for (let row = 0; row < solid.length; row++) {
    const col = solid[row].indexOf(-1);
    if (col >= 0) return { col, row };
  }
  return undefined;
}

function bounds(tiles: readonly TilePos[]): TileRect {
  const colValues = tiles.map((t) => t.col);
  const rowValues = tiles.map((t) => t.row);
  const col = Math.min(...colValues);
  const row = Math.min(...rowValues);
  return { col, row, cols: Math.max(...colValues) - col + 1, rows: Math.max(...rowValues) - row + 1 };
}

/** Merge-zone tiles grouped into rectangles, one per painted plaza. */
function mergeRects(merge: boolean[][]): TileRect[] {
  const seen = merge.map((row) => row.map(() => false));
  const rects: TileRect[] = [];
  for (let row = 0; row < merge.length; row++) {
    for (let col = 0; col < merge[row].length; col++) {
      if (!merge[row][col] || seen[row][col]) continue;
      const zone: TilePos[] = [];
      const queue: TilePos[] = [{ col, row }];
      while (queue.length) {
        const tile = queue.pop()!;
        if (!merge[tile.row]?.[tile.col] || seen[tile.row][tile.col]) continue;
        seen[tile.row][tile.col] = true;
        zone.push(tile);
        queue.push(
          { col: tile.col + 1, row: tile.row },
          { col: tile.col - 1, row: tile.row },
          { col: tile.col, row: tile.row + 1 },
          { col: tile.col, row: tile.row - 1 },
        );
      }
      rects.push(bounds(zone));
    }
  }
  return rects;
}

/** Free tiles next to a rectangle, for two players to land on side by side. */
function landingTiles(rect: TileRect, solid: number[][], exits: readonly ExitSpec[]): TilePos[] {
  const inExit = (col: number, row: number) =>
    exits.some((e) => col >= e.rect.col && col < e.rect.col + e.rect.cols &&
      row >= e.rect.row && row < e.rect.row + e.rect.rows);
  const free = (t: TilePos) => solid[t.row]?.[t.col] === -1 && !inExit(t.col, t.row);

  const sides: TilePos[][] = [[], [], [], []];
  for (let col = rect.col; col < rect.col + rect.cols; col++) {
    sides[0].push({ col, row: rect.row + rect.rows });
    sides[1].push({ col, row: rect.row - 1 });
  }
  for (let row = rect.row; row < rect.row + rect.rows; row++) {
    sides[2].push({ col: rect.col + rect.cols, row });
    sides[3].push({ col: rect.col - 1, row });
  }

  const open = sides.map((side) => side.filter(free)).sort((a, b) => b.length - a.length);
  // Both on the widest side if it has room, otherwise wherever there is space.
  if (open[0].length >= 2) return [open[0][0], open[0][open[0].length - 1]];
  const any = open.flat();
  return any.length > 1 ? [any[0], any[any.length - 1]] : any;
}
