import { buildDungeon, DUNGEON, DUNGEON_LAYOUT } from './dungeon';
import { loadDraft, revisionOf } from './draft';
import { OVERWORLD } from './overworld';
import type { LevelData, LevelId } from './types';

export * from './types';
export {
  buildDungeon,
  DUNGEON_LAYOUT,
  layoutToText,
  parseLayout,
  CRATE_CHAR,
  CRACK_CHAR,
  DOOR_CHARS,
  EXIT_CHAR,
  FLOOR_CHARS,
  PLATE_CHARS,
  SPAWN_CHARS,
  WALL_CHARS,
  isWallChar,
} from './dungeon';
export { clearDraft, loadDraft, saveDraft, revisionOf } from './draft';

/** The levels as they are stored in the repo, before any editor draft. */
export const LEVELS: Record<LevelId, LevelData> = {
  overworld: OVERWORLD,
  dungeon: DUNGEON,
};

export const START_LEVEL: LevelId = 'overworld';

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && value in LEVELS;
}

let drafted: LevelData | null = null;

/**
 * The level to play. The dungeon is rebuilt from the editor's draft while one
 * exists, so playtesting an edit needs no save.
 */
export function getLevel(id: LevelId): LevelData {
  if (id !== 'dungeon') return LEVELS[id];
  const draft = loadDraft();
  if (!draft) {
    drafted = null;
    return LEVELS.dungeon;
  }
  const revision = revisionOf(draft);
  if (drafted?.revision !== revision) drafted = buildDungeon(draft, revision);
  return drafted;
}

/** True while the dungeon is running from unsaved editor changes. */
export function hasDraft(): boolean {
  return loadDraft() !== null;
}
