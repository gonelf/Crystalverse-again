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

export const PLAYER_MAX_HP = 5;
/** How long a player blinks and can't be hurt again after a hit, in ms. */
export const PLAYER_INVULNERABLE_MS = 1000;
/** How long a sword swing lasts; the player can't move meanwhile. */
export const PLAYER_ATTACK_MS = 260;
/** Knockback speed for anything that gets hit, in px/s. */
export const KNOCKBACK_SPEED = 220;
export const KNOCKBACK_MS = 160;

/** Mobs notice a player within this distance (px) and give up past MOB_LOSE_RANGE. */
export const MOB_AGGRO_RANGE = 80;
export const MOB_LOSE_RANGE = 130;
/** Wandering mobs stay roughly this close (px) to where they spawned. */
export const MOB_LEASH = 72;
/** A killed mob comes back at its spawn after this long, once no player is nearby. */
export const MOB_RESPAWN_MS = 12000;
