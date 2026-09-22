import {
  CRACK_CHAR,
  CRATE_CHAR,
  DOOR_CHARS,
  EXIT_CHAR,
  PLATE_CHARS,
} from '../levels';
import { puzzleColor } from '../puzzle/colors';

export interface Brush {
  char: string;
  label: string;
  /** Key that selects this brush. */
  key: string;
  /** Swatch colour in the palette, as CSS. */
  color: string;
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Every plate/door group the layout format understands. */
const GROUPS = PLATE_CHARS.length;

export const BRUSHES: Brush[] = [
  { char: '#', label: 'Wall', key: '1', color: '#3f4661' },
  { char: '.', label: 'Floor', key: '2', color: '#262b3a' },
  { char: CRACK_CHAR, label: 'Cracked floor', key: '3', color: '#333a4e' },
  { char: ' ', label: 'Void', key: '4', color: '#05070d' },
  { char: CRATE_CHAR, label: 'Crate', key: '5', color: '#8a5a2b' },
  { char: EXIT_CHAR, label: 'Exit', key: '6', color: '#ffd166' },
  { char: '1', label: 'P1 spawn', key: '7', color: '#e04848' },
  { char: '2', label: 'P2 spawn', key: '8', color: '#5a9cff' },
  // A plate and the door it opens sit next to each other, one group per row.
  ...Array.from({ length: GROUPS }, (_, i): Brush[] => {
    const plate = PLATE_CHARS[i];
    const door = DOOR_CHARS[i];
    const color = hex(puzzleColor(plate));
    return [
      { char: plate, label: `Plate ${plate}`, key: plate, color },
      { char: door, label: `Door ${door}`, key: door, color },
    ];
  }).flat(),
];

export const DEFAULT_BRUSH = BRUSHES[0].char;
/** Right-dragging rubs a tile back to plain floor. */
export const ERASE_CHAR = '.';

export function brushForKey(key: string): Brush | undefined {
  return BRUSHES.find((b) => b.key === key);
}
