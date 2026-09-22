import Phaser from 'phaser';
import { PLAYER_SPEED } from './config';

export interface PlayerControls {
  up: string;
  down: string;
  left: string;
  right: string;
  /** Index of the gamepad this player uses (first connected pad is 0). */
  padIndex: number;
}

const STICK_DEADZONE = 0.2;

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private keys: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private readonly move = new Phaser.Math.Vector2();

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    private readonly controls: PlayerControls,
  ) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setCircle(this.width / 2);
    this.setCollideWorldBounds(true);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(controls.up),
      down: kb.addKey(controls.down),
      left: kb.addKey(controls.left),
      right: kb.addKey(controls.right),
    };
  }

  update(): void {
    const { move, keys } = this;
    move.set(
      Number(keys.right.isDown) - Number(keys.left.isDown),
      Number(keys.down.isDown) - Number(keys.up.isDown),
    );

    const pad = this.scene.input.gamepad?.getPad(this.controls.padIndex);
    if (pad) {
      if (pad.leftStick.length() > STICK_DEADZONE) {
        move.copy(pad.leftStick);
      } else {
        move.x += Number(pad.right) - Number(pad.left);
        move.y += Number(pad.down) - Number(pad.up);
      }
    }

    if (move.lengthSq() > 1) move.normalize();
    this.setVelocity(move.x * PLAYER_SPEED, move.y * PLAYER_SPEED);
  }
}
