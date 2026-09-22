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

/** How long a crate takes to slide one tile, in ms. */
export const CRATE_PUSH_DURATION = 170;
/** How long a player must lean on a crate before it starts sliding, in ms. */
export const CRATE_PUSH_DELAY = 130;

/**
 * Dungeons keep both players on one camera, so it may zoom out further than a
 * merge does in the overworld to keep them both in frame.
 */
export const SHARED_VIEW_MIN_ZOOM = 1.4;

/** Plate / door group colours, assigned in the order groups appear in a level. */
export const PUZZLE_COLORS = [0x8ad8ff, 0xffd166, 0xb388ff, 0x7ce38b] as const;
