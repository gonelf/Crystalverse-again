/** Internal resolution. The canvas is scaled to fit the window. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Assets are 16px pixel art; each half-screen shows about 13x15 tiles at this zoom. */
export const BASE_ZOOM = 3;

export const PLAYER_SPEED = 80;

/** How long the split <-> merged transition takes, in ms. */
export const MERGE_DURATION = 700;

/** Extra world-space padding kept around both players when merged. */
export const MERGE_FRAMING_MARGIN = 120;
/** Never zoom out further than this when fitting both players on screen. */
export const MERGE_MIN_ZOOM = 1.5;

export const PLAYER_COLORS = [0xe04848, 0x5a9cff] as const;
