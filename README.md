# Crystalverse

Local 2-player co-op in the browser (Phaser 4 + TypeScript + Vite).

In the **overworld** each player has their own half of the screen and can't see
the other. When both players stand in the same **merge zone** (the shimmering
stone plazas that bridge the river), the two viewports merge into one shared
view. They split again when either player leaves.

In a **dungeon** there is no split at all: both players share one camera the
whole time, which zooms to keep them both in frame. The northern plaza has
stairs down into *The Sunken Vault*, a dungeon of crate-and-pressure-plate
puzzles.

Art is ArMM1998's CC0 [Zelda-like tilesets and sprites](https://opengameart.org/content/zelda-like-tilesets-and-sprites)
pack. See `public/assets/CREDITS.md`. The dungeon tiles, crates, plates, doors
and stairs are drawn in code at startup (`src/graphics/textures.ts`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

`?level=dungeon` starts straight in a level while working on it.

## Controls

| Player | Keyboard   | Gamepad                 |
|--------|------------|-------------------------|
| P1     | WASD       | 1st pad (stick / d-pad) |
| P2     | Arrow keys | 2nd pad (stick / d-pad) |

Browsers only expose a gamepad after you press a button on it.

Both players have to stand on the stairs together to travel between levels. In
a dungeon, **R** resets the level if a crate ends up somewhere unhelpful.

## Puzzles

- Walking into a crate for a moment slides it exactly one tile, if the tile
  beyond is clear. Crates move on the grid rather than with physics, so a shove
  always lands the same way and a crate always ends up centred on a tile.
- A **pressure plate** stays down while a crate or a player rests on it. Every
  plate of a colour has to be held for the door of that colour to open.
- Standing on a plate holds it, but both players need to get through the door,
  so each plate ends up wanting a crate on it. A crate that is holding a plate
  down glows in the plate's colour, and the HUD counts the plates.

## How it works

- `src/SplitScreen.ts` holds the split/merge logic. There are two cameras. Each
  one hides the other player via `camera.ignore`. `progress` animates 0 → 1: the
  left camera widens to full screen, follows the midpoint of both players and
  zooms out to fit them, while the right camera slides away. It reverses
  smoothly if a player walks out mid-transition. `{ startMerged: true }` skips
  the transition entirely, which is what dungeons use.
- `SplitScreen.hideFromOther(owner, ...objects)` makes anything private to one
  player, e.g. clues only P1 can see.
- `src/levels/` holds the level data. `types.ts` has the shared shape,
  `overworld.ts` generates the placeholder 80x50 meadow-and-river map, and
  `dungeon.ts` parses an ASCII layout — edit the strings to redesign the vault.
  Every level is `ground` / `decor` / `solid` tile layers plus merge zones,
  exits and puzzle pieces, so it maps directly onto a Tiled map later.
- `src/puzzle/` has the crates, plates and doors; `PuzzleSystem.ts` decides when
  a crate may move and which doors are open.
- `src/Player.ts` handles movement plus 4-direction walk/idle animations from
  the 16x32 character sheet. Only the player's feet collide.
- `src/scenes/GameScene.ts` builds a level, handles travel between levels and
  publishes HUD state; `src/scenes/UIScene.ts` draws the screen-space overlay
  (divider, labels, level card, plate counter, "LINKED" banner).
- `src/config.ts` has the tuning values (zoom, speed, merge duration, zoom
  limits, crate push feel, puzzle colours).
