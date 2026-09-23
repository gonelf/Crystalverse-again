import {
  CRATE_CHAR,
  DOOR_CHARS,
  EXIT_MARKS,
  PLATE_CHARS,
  SPAWN_CHARS,
  terrainOf,
  type LevelFile,
  type TilePos,
} from '../levels';

export interface Issue {
  /** An error means the level won't play properly; a warning is worth a look. */
  level: 'error' | 'warning';
  message: string;
  /** Where to look, when the issue is about one tile. */
  at?: TilePos;
}

/** What the checks need to know about the other levels an exit can point at. */
export interface LevelLookup {
  ids: string[];
  fileOf(id: string): LevelFile | undefined;
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
function reachableFrom(file: LevelFile, start: TilePos): Set<string> {
  const blocked = (col: number, row: number) => {
    const ch = file.layout[row]?.[col];
    if (ch === undefined) return true;
    const terrain = terrainOf(file.tileset, ch);
    return Boolean(terrain?.solid ?? terrain?.block);
  };
  const seen = new Set<string>();
  const queue: TilePos[] = [start];
  while (queue.length) {
    const { col, row } = queue.pop()!;
    if (blocked(col, row)) continue;
    const key = `${col},${row}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ col: col + 1, row }, { col: col - 1, row }, { col, row: row + 1 }, { col, row: row - 1 });
  }
  return seen;
}

/**
 * Checks a level is playable: the pieces the game needs are there, the plate
 * groups line up with their doors, the exits lead somewhere real, and nothing
 * is walled off. It deliberately doesn't try to prove a puzzle is solvable —
 * that's what playtesting is for.
 */
export function validateLevel(id: string, file: LevelFile, levels: LevelLookup): Issue[] {
  const issues: Issue[] = [];
  const layout = file.layout;
  if (!layout.length || !layout[0].length) {
    return [{ level: 'error', message: 'The level is empty.' }];
  }

  const width = layout[0].length;
  if (layout.some((row) => row.length !== width)) {
    issues.push({ level: 'error', message: 'Rows are not all the same width.' });
  }

  for (const ch of SPAWN_CHARS) {
    const n = countOf(layout, ch);
    if (n !== 1) issues.push({ level: 'error', message: `Needs exactly one P${ch} spawn, found ${n}.` });
  }

  // Plates and doors of a group only mean something together.
  for (const group of PLATE_CHARS) {
    const door = DOOR_CHARS[PLATE_CHARS.indexOf(group)];
    const plates = countOf(layout, group);
    const doors = countOf(layout, door);
    if (plates && !doors) issues.push({ level: 'error', message: `Plate ${group} has no ${door} door to open.` });
    if (doors && !plates) issues.push({ level: 'error', message: `Door ${door} has no ${group} plate to open it.` });
  }

  const plates = findAll(layout, (ch) => PLATE_CHARS.includes(ch));
  const crates = findAll(layout, (ch) => ch === CRATE_CHAR);
  if (crates.length < plates.length) {
    issues.push({
      level: 'warning',
      message: `${plates.length} plates but only ${crates.length} crates: a player has to stand on the difference, so they can't both pass.`,
    });
  }

  // Exits: painted marks need somewhere to lead, and configured ones need a mark.
  const painted = [...EXIT_MARKS].filter((mark) => countOf(layout, mark) > 0);
  for (const mark of painted) {
    const exit = file.exits?.[mark];
    if (!exit?.to) {
      issues.push({ level: 'error', message: `Exit ${mark} doesn't lead anywhere yet.` });
      continue;
    }
    if (!levels.ids.includes(exit.to)) {
      issues.push({ level: 'error', message: `Exit ${mark} leads to "${exit.to}", which is not a level.` });
      continue;
    }
    if (exit.arriveAt) {
      const target = levels.fileOf(exit.to);
      const has = target?.layout.some((row) => row.includes(exit.arriveAt!));
      if (!has) {
        issues.push({
          level: 'error',
          message: `Exit ${mark} arrives at ${exit.to}'s exit ${exit.arriveAt}, which isn't painted there.`,
        });
      }
    }
  }
  for (const mark of Object.keys(file.exits ?? {})) {
    if (!painted.includes(mark) && file.exits?.[mark]?.to) {
      issues.push({ level: 'warning', message: `Exit ${mark} leads somewhere but isn't painted on the map.` });
    }
  }
  if (!painted.length && levels.ids.length > 1) {
    issues.push({ level: 'warning', message: 'No exit: players can only leave by restarting.' });
  }

  // Anything a player can stand on at the edge lets them walk into the void.
  const edgeGap = findAll(layout, () => true).find(({ col, row }) => {
    const onEdge = row === 0 || col === 0 || row === layout.length - 1 || col === width - 1;
    if (!onEdge) return false;
    const terrain = terrainOf(file.tileset, layout[row][col]);
    return !(terrain?.solid ?? terrain?.block);
  });
  if (edgeGap) issues.push({ level: 'warning', message: 'The outer wall has a gap.', at: edgeGap });

  const [p1] = findAll(layout, (ch) => ch === SPAWN_CHARS[0]);
  if (p1) {
    const reachable = reachableFrom(file, p1);
    const walled = (pos: TilePos) => !reachable.has(`${pos.col},${pos.row}`);
    const report = (what: string, positions: TilePos[]) => {
      const lost = positions.filter(walled);
      if (lost.length) {
        issues.push({ level: 'error', message: `${lost.length} ${what} walled off from P1's spawn.`, at: lost[0] });
      }
    };
    report('crate(s)', crates);
    report('plate(s)', plates);
    report('exit tile(s)', findAll(layout, (ch) => EXIT_MARKS.includes(ch)));
    report('spawn(s)', findAll(layout, (ch) => ch === SPAWN_CHARS[1]));
  }

  const starts = levels.ids.filter((other) => levels.fileOf(other)?.start);
  if (!starts.length) {
    issues.push({ level: 'warning', message: 'No level is marked as the starting level.' });
  } else if (starts.length > 1) {
    issues.push({
      level: 'warning',
      message: `More than one starting level: ${starts.join(', ')}. The game opens the first.`,
    });
  }
  void id;

  return issues;
}
