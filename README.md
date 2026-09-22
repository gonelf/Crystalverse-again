# Crystalverse

Local 2-player co-op in the browser (Phaser 4 + TypeScript + Vite).

Each player has their own half of the screen and can't see the other. When both
players stand in the same **merge zone** (the shimmering stone plazas that
bridge the river), the two viewports merge into one shared view. They split again
when either player leaves.

Art is ArMM1998's CC0 [Zelda-like tilesets and sprites](https://opengameart.org/content/zelda-like-tilesets-and-sprites)
pack. See `public/assets/CREDITS.md`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

## Controls

| Player | Keyboard   | Gamepad                 |
|--------|------------|-------------------------|
| P1     | WASD       | 1st pad (stick / d-pad) |
| P2     | Arrow keys | 2nd pad (stick / d-pad) |

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
- `src/Player.ts` handles movement plus 4-direction walk/idle animations from
  the 16x32 character sheet. Only the player's feet collide.
- `src/scenes/UIScene.ts` draws the screen-space overlay (divider, labels,
  "LINKED" banner).
- `src/config.ts` has the tuning values (zoom, speed, merge duration, zoom limits).
