import { DUNGEON_LAYOUT, layoutToText, parseLayout } from './dungeon';

const DRAFT_KEY = 'crystalverse.dungeon-draft';

/**
 * Unsaved editor work, kept in the browser so a reload (or a playtest) doesn't
 * lose it. The layout file in the repo stays the source of truth: saving to it
 * clears the draft.
 */
export function loadDraft(): string[] | null {
  try {
    const text = localStorage.getItem(DRAFT_KEY);
    return text ? parseLayout(text) : null;
  } catch {
    // Private windows and blocked site data just mean no draft.
    return null;
  }
}

export function saveDraft(layout: readonly string[]): void {
  try {
    if (layoutToText(layout) === layoutToText(DUNGEON_LAYOUT)) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, layoutToText(layout));
  } catch {
    // Not being able to remember a draft shouldn't break the editor.
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Short stable id for a layout, used to key caches built from it. */
export function revisionOf(layout: readonly string[]): string {
  let hash = 0x811c9dc5;
  const text = layoutToText(layout);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}
