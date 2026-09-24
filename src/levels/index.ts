import { clearDraft, draftIds, loadDraft, saveDraft } from './draft';
import { blankLevel, isLevelIdSafe, type LevelFile } from './format';
import { buildLevel } from './parse';
import type { LevelData, LevelId } from './types';

export * from './types';
export * from './format';
export * from './terrain';
export { clearDraft, draftIds, loadDraft, saveDraft } from './draft';
export { buildLevel } from './parse';

/** Every level file in src/levels/data, keyed by file name. */
const bundled = Object.fromEntries(
  Object.entries(
    import.meta.glob('./data/*.json', { eager: true, import: 'default' }) as Record<string, LevelFile>,
  ).map(([path, file]) => [path.replace(/^.*\/(.+)\.json$/, '$1'), file]),
);

const cache = new Map<string, LevelData>();

/** Ids of every level the game knows about, saved or still a draft. */
export function levelIds(): LevelId[] {
  return [...new Set([...Object.keys(bundled), ...draftIds()])].sort();
}

export function hasLevel(id: string): boolean {
  return levelIds().includes(id);
}

export function isLevelId(value: unknown): value is LevelId {
  return typeof value === 'string' && hasLevel(value);
}

/** A level as it will be played: its draft if one exists, else the saved file. */
export function getLevelFile(id: LevelId): LevelFile | undefined {
  return loadDraft(id) ?? bundled[id];
}

/** The level as it is stored in the repo, ignoring any draft. */
export function savedLevelFile(id: LevelId): LevelFile | undefined {
  return bundled[id];
}

export function hasDraft(id: LevelId): boolean {
  return loadDraft(id) !== null;
}

/** Builds a level, reusing the last build while its contents are unchanged. */
export function getLevel(id: LevelId): LevelData {
  const file = getLevelFile(id) ?? blankLevel(id, 'dungeon');
  const built = buildLevel(id, file);
  const cached = cache.get(id);
  if (cached?.revision === built.revision) return cached;
  cache.set(id, built);
  return built;
}

/** The level the game opens on. */
export function startLevel(): LevelId {
  const ids = levelIds();
  return ids.find((id) => getLevelFile(id)?.start) ?? ids[0] ?? 'overworld';
}

export function newLevel(id: string, name: string, tileset: LevelData['tileset']): LevelFile | null {
  if (!isLevelIdSafe(id) || hasLevel(id)) return null;
  const file = blankLevel(name || id, tileset);
  saveDraft(id, file);
  return file;
}

export { clearDraft as clearLevelDraft, saveDraft as saveLevelDraft };
