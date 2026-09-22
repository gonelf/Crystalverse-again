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

type Facing = 'down' | 'right' | 'up' | 'left';

/** character.png: 17 columns of 16x32 frames, one row per facing, 4-frame walk cycle. */
const SHEET_COLUMNS = 17;
const FRAME_HEIGHT = 32;
/** Only the feet collide, so heads can overlap whatever is behind them. */
const FEET = { width: 10, height: 8, offsetX: 3, offsetY: 22 };
/** Distance from the sprite's centre down to the centre of its feet. */
const FEET_DY = FEET.offsetY + FEET.height / 2 - FRAME_HEIGHT / 2;
const FACING_ROWS: Record<Facing, number> = { down: 0, right: 1, up: 2, left: 3 };
const STICK_DEADZONE = 0.2;

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private keys: Record<Facing, Phaser.Input.Keyboard.Key>;
  private readonly move = new Phaser.Math.Vector2();
  private facing: Facing = 'down';

  /** Register the walk/idle animations for a character sheet. Call once per texture. */
  static createAnimations(scene: Phaser.Scene, texture: string): void {
    if (scene.anims.exists(`${texture}-idle-down`)) return;
    for (const [facing, row] of Object.entries(FACING_ROWS)) {
      const first = row * SHEET_COLUMNS;
      scene.anims.create({
        key: `${texture}-walk-${facing}`,
        frames: scene.anims.generateFrameNumbers(texture, { start: first, end: first + 3 }),
        frameRate: 8,
        repeat: -1,
      });
      scene.anims.create({
        key: `${texture}-idle-${facing}`,
        frames: [{ key: texture, frame: first }],
      });
    }
  }

  /** `x`/`y` is where the player's feet stand, not the centre of the sprite. */
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    texture: string,
    private readonly controls: PlayerControls,
  ) {
    super(scene, x, y - FEET_DY, texture, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(FEET.width, FEET.height).setOffset(FEET.offsetX, FEET.offsetY);
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(controls.up),
      down: kb.addKey(controls.down),
      left: kb.addKey(controls.left),
      right: kb.addKey(controls.right),
    };
  }

  /** This frame's movement input, -1..1 per axis. Zero-length while idle. */
  get moveInput(): Phaser.Math.Vector2 {
    return this.move;
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

    const moving = move.lengthSq() > 0.01;
    if (moving) {
      this.facing = Math.abs(move.x) > Math.abs(move.y)
        ? (move.x > 0 ? 'right' : 'left')
        : (move.y > 0 ? 'down' : 'up');
    }
    this.anims.play(`${this.texture.key}-${moving ? 'walk' : 'idle'}-${this.facing}`, true);
    // Draw whoever is lower on screen in front.
    this.setDepth(10 + this.y / 10000);
  }
}
