import { DUNGEON_TILES } from '../graphics/textures';
import layoutFile from './dungeon.layout.txt?raw';
import {
  mulberry32,
  type CrateSpec,
  type DoorSpec,
  type ExitSpec,
  type LevelData,
  type PlateSpec,
  type TilePos,
} from './types';

/**
 * The Sunken Vault is drawn as ASCII in `dungeon.layout.txt`, so it can be
 * edited by hand or with the in-game editor (`?edit`, or F2 in the vault).
 *
 *   `#` wall          `.` floor        `,` cracked floor    ` ` void
 *   `1` / `2`         player spawns    `o` pushable crate
 *   `a`..`f`          pressure plates  `A`..`F` the door each group opens
 *   `X`               way back to the overworld
 *
 * Three chambers, each locked behind a door whose plates have to be weighed
 * down. Players can hold a plate by standing on it, but they both need to get
 * through the door, so every plate ends up needing a crate on it.
 */
export const WALL_CHARS = '# ';
export const PLATE_CHARS = 'abcdef';
export const DOOR_CHARS = 'ABCDEF';
export const FLOOR_CHARS = '.,';
export const SPAWN_CHARS = '12';
export const CRATE_CHAR = 'o';
export const EXIT_CHAR = 'X';
export const CRACK_CHAR = ',';

export const isWallChar = (ch: string) => WALL_CHARS.includes(ch);

/** Splits a layout file into rows, ignoring a trailing newline. */
export function parseLayout(text: string): string[] {
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const width = Math.max(0, ...rows.map((r) => r.length));
  // Pad short rows, so a hand-edited file with trimmed trailing spaces still loads.
  return rows.map((r) => r.padEnd(width, ' '));
}

export function layoutToText(layout: readonly string[]): string {
  return `${layout.join('\n')}\n`;
}

/** The layout as it is stored in the repo. */
export const DUNGEON_LAYOUT = parseLayout(layoutFile);

export function buildDungeon(layout: readonly string[], revision = 'file'): LevelData {
  const rows = layout.length;
  const cols = layout[0]?.length ?? 0;
  const rand = mulberry32(1337);
  const grid = (fill: number) => Array.from({ length: rows }, () => Array<number>(cols).fill(fill));

  const ground = grid(DUNGEON_TILES.void);
  const decor = grid(-1);
  const solid = grid(-1);

  const spawns: TilePos[] = [];
  const plates: PlateSpec[] = [];
  const crates: CrateSpec[] = [];
  const doors: DoorSpec[] = [];
  const exitTiles: TilePos[] = [];

  const at = (col: number, row: number) => layout[row]?.[col] ?? '#';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = at(col, row);

      if (isWallChar(ch)) {
        const lit = !isWallChar(at(col, row + 1));
        solid[row][col] = ch === ' ' ? DUNGEON_TILES.void : lit ? DUNGEON_TILES.wallFace : DUNGEON_TILES.wall;
        continue;
      }

      ground[row][col] = rand() < 0.22 ? DUNGEON_TILES.floorWorn : DUNGEON_TILES.floor;
      if (ch === CRACK_CHAR) decor[row][col] = DUNGEON_TILES.crack;

      if (SPAWN_CHARS.includes(ch)) spawns[Number(ch) - 1] = { col, row };
      else if (ch === CRATE_CHAR) crates.push({ col, row });
      else if (ch === EXIT_CHAR) exitTiles.push({ col, row });
      else if (PLATE_CHARS.includes(ch)) plates.push({ col, row, group: ch });
      else if (DOOR_CHARS.includes(ch)) doors.push({ col, row, group: ch.toLowerCase() });
    }
  }

  // A layout being edited is allowed to be incomplete; the editor reports what
  // is missing. Fall back to something the game can still stand up.
  const spawn = (index: number) => spawns[index] ?? firstFloor(layout) ?? { col: 1, row: 1 };
  const exits: ExitSpec[] = exitTiles.length
    ? [{ rect: bounds(exitTiles), to: 'overworld', label: 'LEAVE' }]
    : [];

  return {
    id: 'dungeon',
    name: 'The Sunken Vault',
    hint: 'Walk into a crate to push it · weigh down every plate · R resets the vault',
    revision,
    tileset: 'dungeon',
    cols,
    rows,
    spawns: [spawn(0), spawn(1)],
    ground,
    decor,
    solid,
    mergeZones: [],
    mobs: [],
    // Dungeons are explored together: one camera, both players always in frame.
    sharedView: true,
    plates,
    crates,
    doors,
    exits,
  };
}

function firstFloor(layout: readonly string[]): TilePos | undefined {
  for (let row = 0; row < layout.length; row++) {
    const col = [...layout[row]].findIndex((ch) => !isWallChar(ch));
    if (col >= 0) return { col, row };
  }
  return undefined;
}

function bounds(tiles: TilePos[]): ExitSpec['rect'] {
  const colValues = tiles.map((t) => t.col);
  const rowValues = tiles.map((t) => t.row);
  const col = Math.min(...colValues);
  const row = Math.min(...rowValues);
  return { col, row, cols: Math.max(...colValues) - col + 1, rows: Math.max(...rowValues) - row + 1 };
}

export const DUNGEON = buildDungeon(DUNGEON_LAYOUT);
