import type { MobKind, TilesetKey } from './types';

/**
 * The level file format. Every level is one JSON file in `src/levels/data`,
 * holding its settings and a grid of characters:
 *
 *   terrain      per tileset, see `terrain.ts` — `.` floor/grass, `#` wall/bush,
 *                `,` decoration, `=` merge-zone plaza, `~` water, `T` tree,
 *                `^` rock, ` ` void
 *   `1` `2`      player spawns
 *   `o`          pushable crate
 *   `a`..`f`     pressure plates, `A`..`F` the door each group opens
 *   `g` `v`      green / purple slime
 *   `X` `Y` `Z`  exits; where each one leads is set in `exits`
 *
 * Anything the game needs to know about a level lives here, so a level can be
 * added or changed without touching any code.
 */
export interface LevelFile {
  name: string;
  /** One line of help shown at the bottom of the screen. */
  hint?: string;
  tileset: TilesetKey;
  /** True for levels both players share one camera in (dungeons). */
  sharedView?: boolean;
  /** The level the game opens on. Exactly one level should set it. */
  start?: boolean;
  /** Where each exit mark in the layout leads. */
  exits?: Record<string, ExitConfig>;
  layout: string[];
}

export interface ExitConfig {
  /** Id of the level this exit leads to. */
  to: string;
  /** Word shown over the exit. */
  label?: string;
  /** Exit mark in the target level to arrive at; its spawns are used if unset. */
  arriveAt?: string;
}

export const SPAWN_CHARS = '12';
export const CRATE_CHAR = 'o';
export const PLATE_CHARS = 'abcdef';
export const DOOR_CHARS = 'ABCDEF';
export const EXIT_MARKS = 'XYZ';
export const MOB_CHARS: Record<string, MobKind> = { g: 'green', v: 'purple' };

/** Characters that place something on top of the floor rather than terrain. */
export const ENTITY_CHARS =
  SPAWN_CHARS + CRATE_CHAR + PLATE_CHARS + DOOR_CHARS + EXIT_MARKS + Object.keys(MOB_CHARS).join('');

export const isEntityChar = (ch: string) => ENTITY_CHARS.includes(ch);

/** Splits layout text into rows, padding them to the same width. */
export function parseLayout(text: string): string[] {
  const rows = text.replace(/\r/g, '').split('\n');
  while (rows.length && rows[rows.length - 1].trim() === '') rows.pop();
  const width = Math.max(0, ...rows.map((r) => r.length));
  return rows.map((r) => r.padEnd(width, ' '));
}

export function layoutToText(layout: readonly string[]): string {
  return `${layout.join('\n')}\n`;
}

/** Ids are file names, so keep them to something safe and readable. */
export function isLevelIdSafe(id: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
}

/** Short stable id for a level's contents, used to key caches built from it. */
export function revisionOf(file: LevelFile): string {
  let hash = 0x811c9dc5;
  const text = JSON.stringify(file);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function emptyLayout(cols: number, rows: number): string[] {
  const inner = `#${'.'.repeat(Math.max(0, cols - 2))}#`;
  const wall = '#'.repeat(cols);
  return Array.from({ length: rows }, (_, r) => (r === 0 || r === rows - 1 ? wall : inner));
}

/** A blank level, ready to be painted. */
export function blankLevel(name: string, tileset: TilesetKey): LevelFile {
  const layout = emptyLayout(30, 20);
  const place = (row: number, col: number, ch: string) => {
    layout[row] = layout[row].slice(0, col) + ch + layout[row].slice(col + 1);
  };
  place(9, 3, '1');
  place(11, 3, '2');
  return { name, tileset, hint: '', sharedView: tileset === 'dungeon', layout, exits: {} };
}
