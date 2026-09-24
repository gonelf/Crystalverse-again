import type { LevelFile } from './format';

const PREFIX = 'crystalverse.level.';

/**
 * Unsaved editor work, per level, kept in the browser so a reload (or a
 * playtest) doesn't lose it. The files in `src/levels/data` stay the source of
 * truth: saving to one clears its draft.
 */
export function loadDraft(id: string): LevelFile | null {
  try {
    const text = localStorage.getItem(PREFIX + id);
    return text ? (JSON.parse(text) as LevelFile) : null;
  } catch {
    // Private windows, blocked site data or a corrupt draft: just no draft.
    return null;
  }
}

export function saveDraft(id: string, file: LevelFile): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(file));
  } catch {
    // Not being able to remember a draft shouldn't break the editor.
  }
}

export function clearDraft(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    // Nothing to clear.
  }
}

/** Ids of every level with unsaved changes, including levels not saved yet. */
export function draftIds(): string[] {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => key.slice(PREFIX.length));
  } catch {
    return [];
  }
}
