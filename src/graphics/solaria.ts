/**
 * The Solaria tileset: art by Jamie Brownhill, dropped in locally rather than
 * committed. Its licence forbids redistribution, so `public/assets/solaria/` is
 * git-ignored and the game falls back to the code-drawn dungeon art when the
 * file is not there — see "Solaria art" in the README.
 */

import Phaser from 'phaser';
import { TEXTURES } from './textures';

export const SOLARIA_TILESET = 'solaria-tiles';
/** The sheet is 28 tiles wide; tile indices below read across it. */
const SHEET_COLUMNS = 28;
const TILE = 16;
export const SOLARIA_IMAGE = 'assets/solaria/tiles.png';

/**
 * Tile indices into the 28-column sheet. Named for what they are in the vault,
 * not for what the pack calls them.
 */
export const SOLARIA_TILES = {
  // The temple, below ground.
  /** Temple floor: big flagstones, seamed on every side so they tile into a grid. */
  floor: [422],
  /** Smaller stones, for a floor that reads as laid rather than cut. */
  paved: [249],
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
  /** A round clay urn. */
  urn: 93,
  /** An altar with an offering still burning on it. */
  shrine: 360,
  /** An anvil in its frame. */
  anvil: 278,
  /** A cold hearth cut into the floor. */
  hearth: 277,
  /** A banner hung on a wall, and a dark niche cut into one. */
  banner: 9,
  niche: 277,
  /** A treasure chest. */
  chest: 61,
  /** Bones left on the floor; transparent, so it lies over one. */
  bones: 244,
  /** Pale flagstones, so a merge plaza reads apart from the floor. */
  plaza: [173],
  /** A stone plate standing proud of its socket, and sunk flush into it. */
  plateUp: 139,
  plateDown: 111,
  /** Fully transparent, so nothing is drawn and the background shows through. */
  void: 137,

  // The meadows, above ground.
  /** Grass: mostly plain, with clumps and small flowers mixed through it. */
  grass: [29, 29, 29, 29, 29, 3, 31, 95, 172],
  /** Tufts pushing through the grass; transparent, so it lies over it. */
  tufts: [17, 45, 73],
  /** A bush that blocks the way. */
  bush: 66,
  /** A 2x2 tree, the same footprint the overworld's trees have. */
  tree: [
    [10, 11],
    [38, 39],
  ],
  /** Boulders and loose stone. */
  rock: [300, 300, 328],
  /** Open water, sometimes catching the light. */
  water: [113, 113, 113, 115, 116],
} as const;

/**
 * Cuts the pieces the puzzle draws as sprites — the pressure plate, up and
 * down — out of the sheet, replacing the code-drawn ones under the same keys.
 * Everything that draws a plate keeps working, tint included; only the picture
 * changes. Does nothing when the art isn't installed.
 */
export function applySolariaPieceTextures(scene: Phaser.Scene): void {
  if (!available || !scene.textures.exists(SOLARIA_TILESET)) return;
  const sheet = scene.textures.get(SOLARIA_TILESET).getSourceImage() as CanvasImageSource;
  const cut = (key: string, tile: number) => {
    scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, TILE, TILE);
    if (!tex) return;
    const col = tile % SHEET_COLUMNS;
    const row = Math.floor(tile / SHEET_COLUMNS);
    tex.getContext().drawImage(sheet, col * TILE, row * TILE, TILE, TILE, 0, 0, TILE, TILE);
    tex.refresh();
  };
  cut(TEXTURES.plateUp, SOLARIA_TILES.plateUp);
  cut(TEXTURES.plateDown, SOLARIA_TILES.plateDown);
}

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
