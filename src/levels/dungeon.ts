import { DUNGEON_TILES } from '../graphics/textures';
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
 * The Sunken Vault, drawn as ASCII so the layout can be edited by hand.
 *
 *   `#` wall          `.` floor        `,` cracked floor
 *   `1` / `2`         player spawns    `o` pushable crate
 *   `a` `b` `c`       pressure plates  `A` `B` `C` the door each group opens
 *   `X`               way back to the overworld
 *
 * Three chambers, each locked behind a door whose plates have to be weighed
 * down. Players can hold a plate by standing on it, but they both need to get
 * through the door, so every plate ends up needing a crate on it.
 */
const LAYOUT = [
  '############################################',
  '#.............#..............#.............#',
  '#.............#..,...........#.............#',
  '#.......#.....#..............#.c...........#',
  '#.............#...........#..#.............#',
  '#.............#...b..........#.............#',
  '#.....o...a...#..............#....o........#',
  '#.............#..............#.............#',
  '#.............#.......o......#......#......#',
  '#....,........#..............#........######',
  '#.............#..............#........#....#',
  '#..1..........#.....####.....#........#.XXX#',
  '#.............A.....####.....B...o.c..C.XXX#',
  '#.............#.....####.....#........#.XXX#',
  '#..2..........#..............#........#....#',
  '#.............#..............#........######',
  '#.............#.......o......#......#......#',
  '#..........,..#..............#.............#',
  '#.............#..............#....o........#',
  '#.............#...b..........#.............#',
  '#.............#...........#..#.............#',
  '#.......#.....#..............#.c...........#',
  '#.............#.........,....#.............#',
  '#.............#..............#.............#',
  '#.............#..............#.............#',
  '############################################',
];

const WALLS = new Set(['#', ' ']);
const PLATE_CHARS = 'abc';
const DOOR_CHARS = 'ABC';

function build(): LevelData {
  const rows = LAYOUT.length;
  const cols = LAYOUT[0].length;
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

  const at = (col: number, row: number) => LAYOUT[row]?.[col] ?? '#';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = at(col, row);

      if (WALLS.has(ch)) {
        const lit = !WALLS.has(at(col, row + 1));
        solid[row][col] = ch === ' ' ? DUNGEON_TILES.void : lit ? DUNGEON_TILES.wallFace : DUNGEON_TILES.wall;
        continue;
      }

      ground[row][col] = rand() < 0.22 ? DUNGEON_TILES.floorWorn : DUNGEON_TILES.floor;
      if (ch === ',') decor[row][col] = DUNGEON_TILES.crack;

      if (ch === '1' || ch === '2') spawns[Number(ch) - 1] = { col, row };
      else if (ch === 'o') crates.push({ col, row });
      else if (ch === 'X') exitTiles.push({ col, row });
      else if (PLATE_CHARS.includes(ch)) plates.push({ col, row, group: ch });
      else if (DOOR_CHARS.includes(ch)) doors.push({ col, row, group: ch.toLowerCase() });
    }
  }

  if (spawns.length !== 2) throw new Error('dungeon layout needs a "1" and a "2" spawn');
  if (!exitTiles.length) throw new Error('dungeon layout needs an "X" exit');

  const exit: ExitSpec = {
    rect: bounds(exitTiles),
    to: 'overworld',
    label: 'LEAVE',
  };

  return {
    id: 'dungeon',
    name: 'The Sunken Vault',
    hint: 'Walk into a crate to push it · weigh down every plate · R resets the vault',
    tileset: 'dungeon',
    cols,
    rows,
    spawns: spawns as LevelData['spawns'],
    ground,
    decor,
    solid,
    mergeZones: [],
    // Dungeons are explored together: one camera, both players always in frame.
    sharedView: true,
    plates,
    crates,
    doors,
    exits: [exit],
  };
}

function bounds(tiles: TilePos[]): ExitSpec['rect'] {
  const colValues = tiles.map((t) => t.col);
  const rowValues = tiles.map((t) => t.row);
  const col = Math.min(...colValues);
  const row = Math.min(...rowValues);
  return { col, row, cols: Math.max(...colValues) - col + 1, rows: Math.max(...rowValues) - row + 1 };
}

export const DUNGEON = build();
