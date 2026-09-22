# Crystalverse

Local 2-player co-op in the browser (Phaser 4 + TypeScript + Vite).

Each player has their own half of the screen and can't see the other. When both
players stand in the same **merge zone** (the shimmering stone plazas that
bridge the river), the two viewports merge into one shared view. They split again
when either player leaves.

Each meadow has slimes that wander, chase a player who gets close and cost a
heart on contact. Players fight back with a sword. Merge zones are safe: mobs
can't enter them.

Art is ArMM1998's CC0 [Zelda-like tilesets and sprites](https://opengameart.org/content/zelda-like-tilesets-and-sprites)
pack. See `public/assets/CREDITS.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

## Controls

| Player | Move       | Attack | Gamepad                          |
|--------|------------|--------|----------------------------------|
| P1     | WASD       | Space  | 1st pad (stick / d-pad, A or X)  |
| P2     | Arrow keys | Enter  | 2nd pad (stick / d-pad, A or X)  |

Browsers only expose a gamepad after you press a button on it.

## How it works

- `src/SplitScreen.ts` holds the split/merge logic. There are two cameras. Each
  one hides the other player via `camera.ignore`. `progress` animates 0 → 1: the
  left camera widens to full screen, follows the midpoint of both players and
  zooms out to fit them, while the right camera slides away. It reverses
  smoothly if a player walks out mid-transition.
- `SplitScreen.hideFromOther(owner, ...objects)` makes anything private to one
  player, e.g. clues only P1 can see.
- `src/level.ts` generates a placeholder 80x50-tile level (two meadows, a river,
  two plaza merge zones) as `ground` / `decor` / `solid` tile layers. The tile
  indices point into `public/assets/overworld.png`, which has 40 tiles per row.
  The layers map directly onto a Tiled map: the same three layers plus an object
  layer of merge-zone rectangles.
- `src/Player.ts` handles movement, sword swings, hearts and knockback, with
  4-direction walk/idle animations from the 16x32 character sheet and attack
  animations from the same sheet cut into 32x32 frames. Only the player's feet
  collide. A player who runs out of hearts respawns at their start point.
- `src/Mob.ts` is the slime: it wanders near its spawn, chases the nearest
  player within `MOB_AGGRO_RANGE`, and gets knocked back and stunned when hit.
  Mob spawns come from `LEVEL.mobs`; killed mobs respawn after
  `MOB_RESPAWN_MS` once nobody is standing near their spawn.
- `src/scenes/UIScene.ts` draws the screen-space overlay (divider, labels,
  hearts, "LINKED" banner).
- `src/config.ts` has the tuning values (zoom, speed, merge duration, zoom
  limits, health, knockback, mob ranges). Per-kind mob stats live in `src/Mob.ts`.
