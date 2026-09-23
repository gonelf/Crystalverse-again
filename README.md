# Crystalverse

Local 2-player co-op in the browser (Phaser 4 + TypeScript + Vite).

In the **overworld** each player has their own half of the screen and can't see
the other. When both players stand in the same **merge zone** (the shimmering
stone plazas that bridge the river), the two viewports merge into one shared
view. They split again when either player leaves.

In a **dungeon** there is no split at all: both players share one camera the
whole time, which zooms to keep them both in frame. The northern plaza has
stairs down into *The Sunken Vault*, a dungeon of crate-and-pressure-plate
puzzles. Levels are data files and the game has an editor for them, so both of
those are things you change without touching code — see **Levels** below.

Each meadow has slimes that wander, chase a player who gets close and cost a
heart on contact. Players fight back with a sword. Killed slimes sometimes
drop a heart that heals whichever hurt player picks it up. Merge zones are safe: mobs
can't enter them.

Art is ArMM1998's CC0 [Zelda-like tilesets and sprites](https://opengameart.org/content/zelda-like-tilesets-and-sprites)
pack. See `public/assets/CREDITS.md`. The dungeon is a different look — an
Aztec temple of limestone friezes, jade inlays, braziers and painted glyphs —
and its tiles, crates, plates, doors and stairs are drawn as pixel maps in code
at startup (`src/graphics/textures.ts`), so it needs no third-party art.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build into dist/
```

`?level=<id>` starts straight in a level while working on it (`?level=vault`),
and `?edit` opens the level editor.

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

## Levels

Every level is one JSON file in `src/levels/data`. The file name is the level's
id, and the file holds everything the game needs — no code changes to add one:

```json
{
  "name": "The Sunken Vault",
  "hint": "Walk into a crate to push it · weigh down every plate",
  "tileset": "dungeon",
  "sharedView": true,
  "exits": { "X": { "to": "overworld", "label": "LEAVE", "arriveAt": "X" } },
  "layout": ["####...", "#..1..#", "..."]
}
```

- `tileset` picks the art: `overworld` (grass, water, trees, plazas) or
  `dungeon` (an Aztec temple). The same layout character means the matching
  thing in either: `.` floor or grass, `#` carved wall or bush, `,` decoration
  (vines underground, flowers outdoors), `=` a plaza the viewports merge over.
  Outdoors adds `~` water, `T` tree and `^` rock; the temple adds `;` a painted
  glyph and `*` a lit brazier.
- Pieces are `1`/`2` player spawns, `o` crate, `a`..`f` plates with `A`..`F`
  as the door each group opens, `g`/`v` green and purple slimes.
- `X`, `Y`, `Z` mark exits. Each one's entry in `exits` says which level it
  leads `to`, the word shown over it, and optionally which exit mark to
  `arriveAt` in that level — leave that out to arrive at the level's own
  spawns. Players come out on the free tiles beside the exit they arrive at.
- `"start": true` marks the level the game opens on.
- `sharedView` keeps both players on one camera, which is what makes a dungeon
  a dungeon. Without it the screen splits and the `=` plazas merge it.

## The editor

`?edit`, or **F2** while playing, opens an editor for the level you're in. It
paints any level — including the starting one — with the art the game draws it
with.

- **Paint** with the left mouse button, rub back to floor with the right one.
  Pick a brush from the palette or press its key. Middle-drag or the arrow keys
  pan, the wheel zooms, `F` fits the level on screen, `⌘Z` undoes.
- **Level** picks which level to edit, and **New…** starts one from scratch.
  **Settings** set its name, hint, art, shared camera and whether the game
  opens on it.
- **Exits** wires the doors: paint an `X`, `Y` or `Z`, then choose the level it
  leads to, its label, and where in that level players arrive. That is all
  there is to joining two levels together.
- **Checks** run on every edit: missing spawns, a plate whose door is missing
  (or the reverse), an exit that leads nowhere or at a mark that isn't painted
  there, pieces walled off from P1's spawn, a gap in the outer wall, fewer
  crates than plates, no (or more than one) starting level. They report what
  would make a level unplayable and leave solvability to playtesting.
- **Playtest** drops into the level with the edit applied. Unsaved work is kept
  as a draft in the browser, so a reload keeps it and the HUD marks the run
  `DRAFT`. **Discard draft** throws it away.

### Publishing a level

Edits are yours alone until the level file is saved and committed:

1. **Save to file** (while `npm run dev` is running) writes
   `src/levels/data/<id>.json` through a small dev-server endpoint.
2. Commit that file and push it. The deployed game bundles whatever is in
   `src/levels/data`, so once the build goes out, everyone who opens the game
   plays the level.

In a built copy of the game there is no server to save to, so the editor offers
**Copy JSON** / **Download** instead: drop the file into `src/levels/data` and
commit it. (Sharing levels between players without a deploy would need a
backend to store them; nothing here talks to a server at runtime.)

## How it works

- `src/SplitScreen.ts` holds the split/merge logic. There are two cameras. Each
  one hides the other player via `camera.ignore`. `progress` animates 0 → 1: the
  left camera widens to full screen, follows the midpoint of both players and
  zooms out to fit them, while the right camera slides away. It reverses
  smoothly if a player walks out mid-transition. `{ startMerged: true }` skips
  the transition entirely, which is what dungeons use.
- `SplitScreen.hideFromOther(owner, ...objects)` makes anything private to one
  player, e.g. clues only P1 can see.
- `src/levels/` loads and builds levels. `data/*.json` are the levels
  themselves, `format.ts` describes the file, `terrain.ts` maps layout
  characters to tiles for each tileset, `parse.ts` turns a file into the
  layers, pieces, merge zones and exits the game uses, `draft.ts` keeps unsaved
  editor changes, and `index.ts` finds every level file and prefers a draft
  over the saved one.
  Every level is `ground` / `decor` / `solid` tile layers plus merge zones, mob
  spawns, exits and puzzle pieces, so it maps directly onto a Tiled map later.
- `src/puzzle/` has the crates, plates and doors; `PuzzleSystem.ts` decides when
  a crate may move and which doors are open. A group's colour comes from its
  letter (`src/puzzle/colors.ts`), so plates keep their colour while a level is
  being edited.
- `src/editor/` is the level editor: `EditorScene.ts` paints a level with the
  game's own tiles, `EditorPanel.ts` is the DOM side panel, `validate.ts` holds
  the checks, and `brushes.ts` builds the palette from the level's tileset.
  Saving posts to a tiny dev-server endpoint in `vite.config.ts`, which is the
  only thing that writes to the repo.
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
