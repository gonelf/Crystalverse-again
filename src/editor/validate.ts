import {
  CRATE_CHAR,
  DOOR_CHARS,
  EXIT_CHAR,
  isWallChar,
  PLATE_CHARS,
  SPAWN_CHARS,
  type TilePos,
} from '../levels';

export interface Issue {
  /** An error means the layout won't play properly; a warning is worth a look. */
  level: 'error' | 'warning';
  message: string;
  /** Where to look, when the issue is about one tile. */
  at?: TilePos;
}

const countOf = (layout: readonly string[], ch: string) =>
  layout.reduce((n, row) => n + [...row].filter((c) => c === ch).length, 0);

function findAll(layout: readonly string[], match: (ch: string) => boolean): TilePos[] {
  const found: TilePos[] = [];
  layout.forEach((row, r) => [...row].forEach((ch, c) => match(ch) && found.push({ col: c, row: r })));
  return found;
}

/**
 * Everything a floodfill from P1's spawn can walk to, treating doors as open:
 * a door only blocks until its plates are held, so reachability shouldn't
 * depend on solving the puzzle first.
 */
function reachableFrom(layout: readonly string[], start: TilePos): Set<string> {
  const seen = new Set<string>();
  const queue: TilePos[] = [start];
  while (queue.length) {
    const { col, row } = queue.pop()!;
    const ch = layout[row]?.[col];
    if (ch === undefined || isWallChar(ch)) continue;
    const key = `${col},${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
  }
  return seen;
}

/**
 * Checks a layout is playable: the pieces the game needs are there, the plate
 * groups line up with their doors, and nothing is walled off. It deliberately
 * doesn't try to prove the puzzle is solvable — that's what playtesting is for.
 */
export function validateLayout(layout: readonly string[]): Issue[] {
  const issues: Issue[] = [];
  if (!layout.length || !layout[0].length) {
    return [{ level: 'error', message: 'The layout is empty.' }];
  }

  const width = layout[0].length;
  if (layout.some((row) => row.length !== width)) {
    issues.push({ level: 'error', message: 'Rows are not all the same width.' });
  }

  for (const ch of SPAWN_CHARS) {
    const n = countOf(layout, ch);
    if (n !== 1) {
      issues.push({
        level: 'error',
        message: `Needs exactly one P${ch} spawn, found ${n}.`,
      });
    }
  }
  if (!countOf(layout, EXIT_CHAR)) {
    issues.push({ level: 'error', message: 'No exit: paint some X tiles to get back out.' });
  }

  // Plates and doors of a group only mean something together.
  for (const group of PLATE_CHARS) {
    const door = DOOR_CHARS[PLATE_CHARS.indexOf(group)];
    const plates = countOf(layout, group);
    const doors = countOf(layout, door);
    if (plates && !doors) {
      issues.push({ level: 'error', message: `Plate ${group} has no ${door} door to open.` });
    }
    if (doors && !plates) {
      issues.push({ level: 'error', message: `Door ${door} has no ${group} plate to open it.` });
    }
  }

  const plates = findAll(layout, (ch) => PLATE_CHARS.includes(ch));
  const crates = findAll(layout, (ch) => ch === CRATE_CHAR);
  if (crates.length < plates.length) {
    issues.push({
      level: 'warning',
      message: `${plates.length} plates but only ${crates.length} crates: a player has to stand on the difference, so they can't both pass.`,
    });
  }

  // Anything a player can stand on at the edge lets them walk into the void.
  const lastRow = layout.length - 1;
  for (let row = 0; row < layout.length; row++) {
    for (let col = 0; col < width; col++) {
      const edge = row === 0 || col === 0 || row === lastRow || col === width - 1;
      if (edge && !isWallChar(layout[row][col])) {
        issues.push({ level: 'warning', message: 'The outer wall has a gap.', at: { col, row } });
        row = layout.length;
        break;
      }
    }
  }

  const [p1] = findAll(layout, (ch) => ch === SPAWN_CHARS[0]);
  if (p1) {
    const reachable = reachableFrom(layout, p1);
    const walled = (pos: TilePos) => !reachable.has(`${pos.col},${pos.row}`);
    const report = (what: string, positions: TilePos[]) => {
      const lost = positions.filter(walled);
      if (lost.length) {
        issues.push({
          level: 'error',
          message: `${lost.length} ${what} walled off from P1's spawn.`,
          at: lost[0],
        });
      }
    };
    report('crate(s)', crates);
    report('plate(s)', plates);
    report('exit tile(s)', findAll(layout, (ch) => ch === EXIT_CHAR));
    report('spawn(s)', findAll(layout, (ch) => ch === SPAWN_CHARS[1]));
  }

  return issues;
}
