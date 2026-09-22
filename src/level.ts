export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LevelData {
  width: number;
  height: number;
  spawns: [{ x: number; y: number }, { x: number; y: number }];
  walls: Rect[];
  /** Areas where the two viewports merge into one when both players stand inside. */
  mergeZones: Rect[];
}

const W = 2400;
const H = 1600;
const T = 40; // wall thickness
const MID = W / 2;

/**
 * Placeholder level: two mirrored halves separated by a wall. The wall only
 * opens into the two shared rooms (merge zones), so the players are apart
 * until they meet in one of them.
 *
 * Swap this for a Tiled map later: draw walls on a collision layer and merge
 * zones as rectangles on an object layer.
 */
export const LEVEL: LevelData = {
  width: W,
  height: H,
  spawns: [
    { x: 300, y: 800 },
    { x: W - 300, y: 800 },
  ],
  walls: [
    // Outer border
    { x: 0, y: 0, w: W, h: T },
    { x: 0, y: H - T, w: W, h: T },
    { x: 0, y: 0, w: T, h: H },
    { x: W - T, y: 0, w: T, h: H },

    // Central divider, with gaps into the shared rooms at y 280-520 and 1080-1320
    { x: MID - T / 2, y: 0, w: T, h: 280 },
    { x: MID - T / 2, y: 520, w: T, h: 560 },
    { x: MID - T / 2, y: 1320, w: T, h: 280 },

    // Left half obstacles
    { x: 400, y: 300, w: 400, h: T },
    { x: 700, y: 600, w: T, h: 500 },
    { x: 250, y: 1200, w: 500, h: T },

    // Right half obstacles (mirrored)
    { x: W - 800, y: 300, w: 400, h: T },
    { x: W - 700 - T, y: 600, w: T, h: 500 },
    { x: W - 750, y: 1200, w: 500, h: T },
  ],
  mergeZones: [
    { x: MID - 240, y: 240, w: 480, h: 320 },
    { x: MID - 240, y: 1040, w: 480, h: 320 },
  ],
};
