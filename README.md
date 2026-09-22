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

Each meadow has slimes that wander, chase a player who gets close and cost a
heart on contact. Players fight back with a sword. Killed slimes sometimes
drop a heart that heals whichever hurt player picks it up. Merge zones are safe: mobs
can't enter them.

Art is ArMM1998's CC0 [Zelda-like tilesets and sprites](https://opengameart.org/content/zelda-like-tilesets-and-sprites)
pack. See `public/assets/CREDITS.md`. The dungeon tiles, crates, plates, doors
and stairs are drawn in code at startup (`src/graphics/textures.ts`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

`?level=dungeon` starts straight in a level while working on it, and `?edit`
opens the vault editor.

## Controls

| Player | Move       | Attack | Gamepad                          |
|--------|------------|--------|----------------------------------|
| P1     | WASD       | Space  | 1st pad (stick / d-pad, A or X)  |
| P2     | Arrow keys | Enter  | 2nd pad (stick / d-pad, A or X)  |

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

## Editing the vault

The dungeon is a grid of characters in `src/levels/dungeon.layout.txt`, so it
can be edited in any text editor — or in the game's own editor, which paints
that file with the art the game uses.

Open it with `?edit`, or press **F2** while playing. Then:

- **Paint** with the left mouse button, rub back to floor with the right one.
  Pick a brush from the palette or press its key: `1` wall, `2` floor, `5`
  crate, `a` a plate, `A` the door it opens, and so on. Middle-drag or the
  arrow keys pan, the wheel zooms, `F` fits the whole vault on screen.
- **Checks** run on every edit: missing spawns or exit, a plate whose door is
  missing (or the reverse), pieces walled off from P1's spawn, a gap in the
  outer wall, and fewer crates than plates. They never try to prove a puzzle is
  solvable — that is what playtesting is for.
- **Playtest** (`Enter`) drops straight into the vault with the edit applied.
  Unsaved work lives in a draft in the browser, so a reload keeps it and the
  HUD marks the level `DRAFT`. **R** in the vault resets the room.
- **Save to file** (dev server only) writes `dungeon.layout.txt` back to the
  repo, which is what you commit. In a built copy of the game the button is
  gone; **Copy text** and **Download** are still there. **Revert to file**
  throws the draft away.

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
  `overworld.ts` generates the placeholder 80x50-tile meadow-and-river map (its
  tile indices point into `public/assets/overworld.png`, 40 tiles per row), and
  `dungeon.ts` parses `dungeon.layout.txt` — `draft.ts` keeps unsaved editor
  changes, and `getLevel()` prefers a draft over the bundled layout.
  Every level is `ground` / `decor` / `solid` tile layers plus merge zones, mob
  spawns, exits and puzzle pieces, so it maps directly onto a Tiled map later.
- `src/puzzle/` has the crates, plates and doors; `PuzzleSystem.ts` decides when
  a crate may move and which doors are open. A group's colour comes from its
  letter (`src/puzzle/colors.ts`), so plates keep their colour while a level is
  being edited.
- `src/editor/` is the vault editor: `EditorScene.ts` paints the layout with the
  game's own tiles, `EditorPanel.ts` is the DOM side panel, `validate.ts` holds
  the checks, and `brushes.ts` the palette. Saving posts to a tiny dev-server
  endpoint in `vite.config.ts`, which is the only thing that writes to the repo.
- `src/Player.ts` handles movement, sword swings, hearts and knockback, with
  4-direction walk/idle animations from the 16x32 character sheet and attack
  animations from the same sheet cut into 32x32 frames. Only the player's feet
  collide. A player who runs out of hearts respawns at their start point.
- `src/Mob.ts` is the slime: it wanders near its spawn, chases the nearest
  player within `MOB_AGGRO_RANGE`, and gets knocked back and stunned when hit.
  Mob spawns come from the level's `mobs`; killed mobs respawn after
  `MOB_RESPAWN_MS` once nobody is standing near their spawn.
- `src/HeartPickup.ts` is the heart a killed mob may drop (`heartDropChance`
  per kind in `src/Mob.ts`). It heals one heart, is ignored by a player at
  full health, and vanishes after `HEART_PICKUP_LIFETIME_MS`.
- `src/scenes/GameScene.ts` builds a level, handles travel between levels and
  publishes HUD state; `src/scenes/UIScene.ts` draws the screen-space overlay
  (divider, labels, hearts, minimaps, level card, plate counter, "LINKED"
  banner).
- `src/Minimap.ts` draws the level once into a small texture and shows only its
  own player on it, so players can find the plazas and describe where they are
  without seeing each other. Each half gets one in its bottom outer corner; they
  fade out once the views merge, so shared-view levels have none.
- `src/config.ts` has the tuning values (zoom, speed, merge duration, zoom
  limits, health, knockback, mob ranges, crate push feel, puzzle colours).
  Per-kind mob stats live in `src/Mob.ts`.
