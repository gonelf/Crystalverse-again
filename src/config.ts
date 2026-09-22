/** Internal resolution. The canvas is scaled to fit the window. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_SPEED = 240;

/** How long the split <-> merged transition takes, in ms. */
export const MERGE_DURATION = 700;

/** Extra world-space padding kept around both players when merged. */
export const MERGE_FRAMING_MARGIN = 360;
/** Never zoom out further than this when fitting both players on screen. */
export const MERGE_MIN_ZOOM = 0.6;

export const PLAYER_COLORS = [0x4fc3f7, 0xff7043] as const;
