import Phaser from 'phaser';
import { TEXTURES } from '../graphics/textures';
import { TILE_SIZE } from '../levels/types';

/** A barred door that sinks into the floor while its plate group is held down. */
export class Door extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.StaticBody;

  private opened = false;
  private motion?: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    readonly col: number,
    readonly row: number,
    readonly group: string,
    color: number,
  ) {
    super(scene, (col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, TEXTURES.door);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.body.setSize(TILE_SIZE, TILE_SIZE);
    this.body.updateFromGameObject();
    this.setDepth(9).setTint(color);
  }

  get open(): boolean {
    return this.opened;
  }

  setOpen(open: boolean): void {
    if (open === this.opened) return;
    this.opened = open;
    this.body.enable = !open;
    this.motion?.stop();
    this.motion = this.scene.tweens.add({
      targets: this,
      scaleY: open ? 0.12 : 1,
      alpha: open ? 0.35 : 1,
      duration: 260,
      ease: 'Quad.InOut',
    });
  }
}
