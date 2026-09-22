import { DUNGEON } from './dungeon';
import { OVERWORLD } from './overworld';
import type { LevelData, LevelId } from './types';

export * from './types';

export const LEVELS: Record<LevelId, LevelData> = {
  overworld: OVERWORLD,
  dungeon: DUNGEON,
};

export const START_LEVEL: LevelId = 'overworld';

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && value in LEVELS;
}
