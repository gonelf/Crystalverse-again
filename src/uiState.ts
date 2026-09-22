import type { LevelId } from './levels';

/** Registry keys the game scene publishes for the HUD to read. */
export const UI_STATE = {
  level: 'ui-level',
  puzzle: 'ui-puzzle',
} as const;

export interface LevelState {
  id: LevelId;
  name: string;
  hint: string;
  sharedView: boolean;
}

export interface PuzzleState {
  pressed: number;
  total: number;
}
