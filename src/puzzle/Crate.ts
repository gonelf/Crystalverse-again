import Phaser from 'phaser';
import { CRATE_PUSH_DURATION } from '../config';
import { TEXTURES } from '../graphics/textures';
import { TILE_SIZE } from '../levels/types';

/**
 * A crate that slides exactly one tile at a time, so it always ends up centred
 * on a tile and can sit squarely on a pressure plate.
 *
 * The body is static: players bump into it and stop instead of shoving it
 * around with physics. `PuzzleSystem` decides when a push is allowed.
 */
export class Crate extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.StaticBody;

  col: number;
  row: number;
  private fromCol: number;
  private fromRow: number;
  private slide?: Phaser.Tweens.Tween;
  private seated: number | null = null;

  constructor(scene: Phaser.Scene, col: number, row: number) {
    super(scene, (col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, TEXTURES.crate);
    this.col = col;
    this.row = row;
    this.fromCol = col;
    this.fromRow = row;
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(TILE_SIZE, TILE_SIZE);
    this.body.updateFromGameObject();
    this.setDepth(10 + this.y / 10000);
  }

  get moving(): boolean {
    return this.slide?.isPlaying() ?? false;
  }

  /** True while any part of the crate is on this tile, mid-slide included. */
  occupies(col: number, row: number): boolean {
    if (col === this.col && row === this.row) return true;
    return this.moving && col === this.fromCol && row === this.fromRow;
  }

  /** True when the crate has come to rest on this tile — enough to hold a plate. */
  restsOn(col: number, row: number): boolean {
    return !this.moving && col === this.col && row === this.row;
  }

  /** Glows in a plate's colour while it is the thing holding that plate down. */
  setSeated(color: number | null): void {
    if (color === this.seated) return;
    this.seated = color;
    if (color === null) this.clearTint();
    else this.setTint(color);
  }

  /** Slides one tile. The caller has already checked the destination is free. */
  push(dCol: number, dRow: number): void {
    this.fromCol = this.col;
    this.fromRow = this.row;
    this.col += dCol;
    this.row += dRow;
    this.slide?.stop();
    this.slide = this.scene.tweens.add({
      targets: this,
      x: (this.col + 0.5) * TILE_SIZE,
      y: (this.row + 0.5) * TILE_SIZE,
      duration: CRATE_PUSH_DURATION,
      ease: 'Sine.Out',
      onUpdate: () => this.syncBody(),
      onComplete: () => this.syncBody(),
    });
  }

  /** A static body doesn't follow the sprite on its own. */
  private syncBody(): void {
    this.body.updateFromGameObject();
    this.setDepth(10 + this.y / 10000);
  }
}
