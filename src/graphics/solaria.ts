/**
 * The Solaria tileset: art by Jamie Brownhill, dropped in locally rather than
 * committed. Its licence forbids redistribution, so `public/assets/solaria/` is
 * git-ignored and the game falls back to the code-drawn dungeon art when the
 * file is not there — see "Solaria art" in the README.
 */

export const SOLARIA_TILESET = 'solaria-tiles';
export const SOLARIA_IMAGE = 'assets/solaria/tiles.png';

/**
 * Tile indices into the 28-column sheet. Named for what they are in the vault,
 * not for what the pack calls them.
 */
export const SOLARIA_TILES = {
  /** Plain tan temple floor, chipped here and there. */
  floor: [393, 393, 393, 393, 393, 393, 393, 424],
  /** Roots pushing through a crack; transparent, so it lies over a floor. */
  vines: [243, 271],
  /** A carved stone disc set into the floor. */
  glyph: 129,
  /** Terracotta brick, seen from above. */
  wall: [106, 107, 108],
  /** The same brick with its base in shadow, where the tile below is walkable. */
  wallFace: 163,
  /** A lit brazier on a stand. */
  brazier: 275,
  /** Pale flagstones, so a merge plaza reads apart from the floor. */
  plaza: [173],
  /** Fully transparent, so nothing is drawn and the background shows through. */
  void: 137,
} as const;

let available = false;

/** True once the art has been found; decided at startup, before any level builds. */
export function solariaAvailable(): boolean {
  return available;
}

export function setSolariaAvailable(value: boolean): void {
  available = value;
}

/** Asks the server for the art without downloading it. */
export async function probeSolaria(): Promise<boolean> {
  try {
    const res = await fetch(SOLARIA_IMAGE, { method: 'HEAD' });
    setSolariaAvailable(res.ok && !!res.headers.get('content-type')?.startsWith('image/'));
  } catch {
    setSolariaAvailable(false);
  }
  return available;
}
