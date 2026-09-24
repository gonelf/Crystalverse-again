import { PUZZLE_COLORS } from '../config';
import { PLATE_CHARS } from '../levels';

/**
 * The colour a plate group is drawn in. Keyed off the group's letter rather
 * than the order groups happen to appear, so a plate keeps its colour while a
 * level is being edited — and the editor's palette matches the game.
 */
export function puzzleColor(group: string, groupsInLevel: readonly string[] = []): number {
  const known = PLATE_CHARS.indexOf(group);
  const index = known >= 0 ? known : Math.max(0, [...groupsInLevel].sort().indexOf(group));
  return PUZZLE_COLORS[index % PUZZLE_COLORS.length];
}
