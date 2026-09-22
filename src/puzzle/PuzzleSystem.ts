import Phaser from 'phaser';
import { CRATE_PUSH_DELAY, PUZZLE_COLORS } from '../config';
import { TILE_SIZE, type LevelData } from '../levels/types';
import type { Player } from '../Player';
import { UI_STATE, type PuzzleState } from '../uiState';
import { Crate } from './Crate';
import { Door } from './Door';
import { PressurePlate } from './PressurePlate';

interface PushIntent {
  dCol: number;
  dRow: number;
  heldMs: number;
}

interface PlateGroup {
  plates: PressurePlate[];
  doors: Door[];
  satisfied: boolean;
}

/**
 * Pressure plates, crates and the doors they drive.
 *
 * Crates move on the tile grid rather than with physics: leaning into one for
 * a moment slides it a single tile, if the tile beyond is empty. That keeps
 * crates centred on plates and makes the puzzles deterministic — the same
 * shove always has the same result, for either player.
 */
export class PuzzleSystem {
  readonly crates: Crate[] = [];
  readonly plates: PressurePlate[] = [];
  readonly doors: Door[] = [];

  private readonly groups = new Map<string, PlateGroup>();
  private readonly intents: PushIntent[];
  private lastStatus = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: LevelData,
    private readonly players: readonly Player[],
  ) {
    this.intents = players.map(() => ({ dCol: 0, dRow: 0, heldMs: 0 }));

    const names = [...new Set([...level.plates, ...level.doors].map((o) => o.group))].sort();
    const colorOf = (group: string) => PUZZLE_COLORS[names.indexOf(group) % PUZZLE_COLORS.length];
    const groupOf = (name: string) => {
      const existing = this.groups.get(name);
      if (existing) return existing;
      const created: PlateGroup = { plates: [], doors: [], satisfied: false };
      this.groups.set(name, created);
      return created;
    };

    for (const spec of level.plates) {
      const plate = new PressurePlate(scene, spec.col, spec.row, spec.group, colorOf(spec.group));
      this.plates.push(plate);
      groupOf(spec.group).plates.push(plate);
    }
    for (const spec of level.doors) {
      const door = new Door(scene, spec.col, spec.row, spec.group, colorOf(spec.group));
      this.doors.push(door);
      groupOf(spec.group).doors.push(door);
    }
    for (const spec of level.crates) this.crates.push(new Crate(scene, spec.col, spec.row));
  }

  get empty(): boolean {
    return !this.plates.length && !this.crates.length && !this.doors.length;
  }

  get status(): PuzzleState {
    return { pressed: this.plates.filter((p) => p.pressed).length, total: this.plates.length };
  }

  /** Solid bodies players should collide with. */
  get obstacles(): Array<Crate | Door> {
    return [...this.crates, ...this.doors];
  }

  update(deltaMs: number): void {
    this.players.forEach((player, i) => this.updatePushIntent(player, this.intents[i], deltaMs));
    this.updatePlates();
    this.updateDoors();
    this.emitStatus();
  }

  /** True if a crate can't move onto this tile. */
  private blocked(col: number, row: number): boolean {
    if (col < 0 || row < 0 || col >= this.level.cols || row >= this.level.rows) return true;
    if (this.level.solid[row][col] !== -1) return true;
    if (this.crates.some((c) => c.occupies(col, row))) return true;
    if (this.doors.some((d) => !d.open && d.col === col && d.row === row)) return true;
    // Never shove a crate into someone.
    return this.players.some((p) => {
      const tile = this.tileOf(p);
      return tile.col === col && tile.row === row;
    });
  }

  private tileOf(player: Player): { col: number; row: number } {
    const { x, y } = player.body.center;
    return { col: Math.floor(x / TILE_SIZE), row: Math.floor(y / TILE_SIZE) };
  }

  /**
   * A crate only moves once a player has leaned on it for CRATE_PUSH_DELAY, so
   * brushing past one while running doesn't nudge it out of place.
   */
  private updatePushIntent(player: Player, intent: PushIntent, deltaMs: number): void {
    const input = player.moveInput;
    const dCol = Math.abs(input.x) > Math.abs(input.y) ? Math.sign(input.x) : 0;
    const dRow = dCol === 0 ? Math.sign(input.y) : 0;

    if (dCol === 0 && dRow === 0) {
      intent.heldMs = 0;
      intent.dCol = 0;
      intent.dRow = 0;
      return;
    }
    if (dCol !== intent.dCol || dRow !== intent.dRow) {
      intent.dCol = dCol;
      intent.dRow = dRow;
      intent.heldMs = 0;
    }

    const from = this.tileOf(player);
    const crate = this.crates.find((c) => c.occupies(from.col + dCol, from.row + dRow));
    if (!crate || crate.moving) {
      intent.heldMs = 0;
      return;
    }

    intent.heldMs += deltaMs;
    if (intent.heldMs < CRATE_PUSH_DELAY) return;
    intent.heldMs = 0;
    if (this.blocked(crate.col + dCol, crate.row + dRow)) return;
    crate.push(dCol, dRow);
  }

  private updatePlates(): void {
    const seated = new Map<Crate, number>();
    for (const plate of this.plates) {
      const crate = this.crates.find((c) => c.restsOn(plate.col, plate.row));
      const byPlayer = this.players.some((p) => {
        const tile = this.tileOf(p);
        return tile.col === plate.col && tile.row === plate.row;
      });
      plate.pressed = !!crate || byPlayer;
      if (crate) seated.set(crate, plate.glow);
    }
    // A crate parked on a plate glows, so it is obvious which ones are done.
    for (const crate of this.crates) crate.setSeated(seated.get(crate) ?? null);
  }

  private updateDoors(): void {
    for (const group of this.groups.values()) {
      const satisfied = group.plates.length > 0 && group.plates.every((p) => p.pressed);
      if (satisfied === group.satisfied) continue;
      group.satisfied = satisfied;
      for (const door of group.doors) door.setOpen(satisfied);
      if (satisfied && group.doors.length) {
        this.scene.cameras.cameras.forEach((cam) => cam.flash(180, 140, 170, 220));
      }
    }
  }

  /** Publishes plate progress for the HUD, only when it actually changes. */
  private emitStatus(): void {
    const { pressed, total } = this.status;
    const signature = `${pressed}/${total}`;
    if (signature === this.lastStatus) return;
    this.lastStatus = signature;
    this.scene.registry.set(UI_STATE.puzzle, { pressed, total } satisfies PuzzleState);
  }
}
