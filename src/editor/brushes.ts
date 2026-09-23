import {
  CRATE_CHAR,
  DOOR_CHARS,
  EXIT_MARKS,
  MOB_CHARS,
  PLATE_CHARS,
  SPAWN_CHARS,
  TERRAIN,
  type TilesetKey,
} from '../levels';
import { puzzleColor } from '../puzzle/colors';

export interface Brush {
  char: string;
  label: string;
  /** Key that picks this brush in the editor. */
  key: string;
  /** Swatch colour in the palette, as CSS. */
  color: string;
  section: 'Terrain' | 'Pieces' | 'Puzzle' | 'Exits';
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Whatever the level's tileset can paint, plus the pieces every level shares. */
export function brushesFor(tileset: TilesetKey): Brush[] {
  const terrain: Brush[] = Object.entries(TERRAIN[tileset]).map(([char, t]) => ({
    char,
    label: t.label,
    key: t.key,
    color: t.color,
    section: 'Terrain',
  }));

  const pieces: Brush[] = [
    { char: SPAWN_CHARS[0], label: 'P1 spawn', key: 'p', color: '#e04848', section: 'Pieces' },
    { char: SPAWN_CHARS[1], label: 'P2 spawn', key: 'q', color: '#5a9cff', section: 'Pieces' },
    { char: CRATE_CHAR, label: 'Crate', key: 'o', color: '#8a5a2b', section: 'Pieces' },
    ...Object.entries(MOB_CHARS).map(([char, kind]): Brush => ({
      char,
      label: `${kind[0].toUpperCase()}${kind.slice(1)} slime`,
      key: char,
      color: kind === 'green' ? '#69c06a' : '#a879d8',
      section: 'Pieces',
    })),
  ];

  // A plate and the door it opens sit next to each other, one group per row.
  const puzzle: Brush[] = [...PLATE_CHARS].flatMap((plate, i): Brush[] => {
    const door = DOOR_CHARS[i];
    const color = hex(puzzleColor(plate));
    return [
      { char: plate, label: `Plate ${plate}`, key: plate, color, section: 'Puzzle' },
      { char: door, label: `Door ${door}`, key: door, color, section: 'Puzzle' },
    ];
  });

  const exits: Brush[] = [...EXIT_MARKS].map((mark): Brush => ({
    char: mark,
    label: `Exit ${mark}`,
    key: mark.toLowerCase(),
    color: '#ffd166',
    section: 'Exits',
  }));

  return [...terrain, ...pieces, ...puzzle, ...exits];
}

/** Right-dragging rubs a tile back to plain floor. */
export const ERASE_CHAR = '.';
export const DEFAULT_BRUSH = '#';
