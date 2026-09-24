import Phaser from 'phaser';
import { TEXTURES } from '../graphics/textures';
import { TILE_SIZE } from '../levels/types';

/** A floor plate that stays down while a crate or a player rests on it. */
export class PressurePlate extends Phaser.GameObjects.Image {
  /** Pale version of the group colour, for tinting whatever is holding it down. */
  readonly glow: number;
  private down = false;

  constructor(
    scene: Phaser.Scene,
    readonly col: number,
    readonly row: number,
    readonly group: string,
    readonly color: number,
  ) {
    super(scene, (col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE, TEXTURES.plateUp);
    const tinted = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff),
      Phaser.Display.Color.ValueToColor(color),
      100,
      60,
    );
    this.glow = Phaser.Display.Color.GetColor(tinted.r, tinted.g, tinted.b);
    scene.add.existing(this);
    this.setDepth(1).setTint(color);
  }

  get pressed(): boolean {
    return this.down;
  }

  set pressed(value: boolean) {
    if (value === this.down) return;
    this.down = value;
    this.setTexture(value ? TEXTURES.plateDown : TEXTURES.plateUp);
    this.setTint(value ? this.color : Phaser.Display.Color.ValueToColor(this.color).darken(30).color);
    this.scene.tweens.add({
      targets: this,
      scale: { from: value ? 1.15 : 0.9, to: 1 },
      duration: 140,
      ease: 'Quad.Out',
    });
  }
}
