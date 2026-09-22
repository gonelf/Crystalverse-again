import Phaser from 'phaser';
import {
  KNOCKBACK_MS,
  KNOCKBACK_SPEED,
  PLAYER_ATTACK_MS,
  PLAYER_INVULNERABLE_MS,
  PLAYER_MAX_HP,
  PLAYER_SPEED,
} from './config';

export interface PlayerControls {
  up: string;
  down: string;
  left: string;
  right: string;
  attack: string;
  /** Index of the gamepad this player uses (first connected pad is 0). */
  padIndex: number;
}

type Facing = 'down' | 'right' | 'up' | 'left';

/** character.png: 17 columns of 16x32 frames, one row per facing, 4-frame walk cycle. */
const SHEET_COLUMNS = 17;
const FACING_ROWS: Record<Facing, number> = { down: 0, right: 1, up: 2, left: 3 };
/** The same sheet cut into 32x32 frames (8 per row): rows 4-7 hold the 4-frame sword swings. */
const ATTACK_COLUMNS = 8;
const ATTACK_ROWS: Record<Facing, number> = { down: 4, up: 5, right: 6, left: 7 };
const FACING_VECTORS: Record<Facing, [number, number]> = {
  down: [0, 1], up: [0, -1], right: [1, 0], left: [-1, 0],
};
const STICK_DEADZONE = 0.2;
/** Feet sit 22px below the top of every frame; see the body setup in the constructor. */
const FEET_Y = 22;
const FEET_SIZE = { width: 10, height: 8 };
const FRAME_HEIGHT = 32;
/** Distance from the sprite's centre down to the centre of its feet. */
const FEET_DY = FEET_Y + FEET_SIZE.height / 2 - FRAME_HEIGHT / 2;
/** Sword hitbox: a square this big, centred this far in front of the feet. */
const SWORD_SIZE = 18;
const SWORD_REACH = 13;

export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp = PLAYER_MAX_HP;

  private keys: Record<Facing | 'attack', Phaser.Input.Keyboard.Key>;
  private readonly move = new Phaser.Math.Vector2();
  private facing: Facing = 'down';
  private padAttackWasDown = false;
  private attackingUntil = 0;
  private knockedUntil = 0;
  private invulnerableUntil = 0;
  private readonly spawn: Phaser.Math.Vector2;

  /** Register the walk/idle/attack animations for a character sheet. Call once per texture. */
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
    for (const [facing, row] of Object.entries(ATTACK_ROWS)) {
      const first = row * ATTACK_COLUMNS;
      scene.anims.create({
        key: `${texture}-attack-${facing}`,
        frames: scene.anims.generateFrameNumbers(`${texture}-attack`, { start: first, end: first + 3 }),
        duration: PLAYER_ATTACK_MS,
      });
    }
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    /** Walk sheet key. The attack sheet must be loaded as `${texture}-attack`. */
    private readonly sheet: string,
    private readonly controls: PlayerControls,
  ) {
    // `x`/`y` is where the player's feet stand, not the centre of the sprite.
    super(scene, x, y - FEET_DY, sheet, 0);
    this.spawn = new Phaser.Math.Vector2(this.x, this.y);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Collide with the feet only, so heads can overlap things behind them.
    this.body.setSize(FEET_SIZE.width, FEET_SIZE.height);
    this.alignBody();
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    const kb = scene.input.keyboard!;
    this.keys = {
      up: kb.addKey(controls.up),
      down: kb.addKey(controls.down),
      left: kb.addKey(controls.left),
      right: kb.addKey(controls.right),
      attack: kb.addKey(controls.attack),
    };
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  get attacking(): boolean {
    return this.scene.time.now < this.attackingUntil;
  }

  /** Centre of the collision box at the player's feet. */
  get feet(): Phaser.Math.Vector2 {
    return this.body.center;
  }

  /** This frame's movement input, -1..1 per axis. Zero-length while idle. */
  get moveInput(): Phaser.Math.Vector2 {
    return this.move;
  }

  /**
   * Call every frame. Returns the sword hitbox on the frame a swing starts,
   * otherwise null.
   */
  update(): Phaser.Geom.Rectangle | null {
    const now = this.scene.time.now;
    this.setDepth(10 + this.y / 10000);
    this.setAlpha(now < this.invulnerableUntil && Math.floor(now / 80) % 2 === 0 ? 0.35 : 1);
    // Anything that stops the player moving also stops them leaning on a crate.
    if (!this.alive) return this.stopMoving();

    if (now < this.knockedUntil) return this.stopMoving();
    if (this.attacking) {
      this.setVelocity(0, 0);
      return this.stopMoving();
    }

    const pad = this.scene.input.gamepad?.getPad(this.controls.padIndex);
    const padAttack = Boolean(pad && (pad.A || pad.X));
    const swing = Phaser.Input.Keyboard.JustDown(this.keys.attack) || (padAttack && !this.padAttackWasDown);
    this.padAttackWasDown = padAttack;
    if (swing) return this.startAttack();

    this.readMove(pad);
    this.setVelocity(this.move.x * PLAYER_SPEED, this.move.y * PLAYER_SPEED);
    const moving = this.move.lengthSq() > 0.01;
    if (moving) {
      this.facing = Math.abs(this.move.x) > Math.abs(this.move.y)
        ? (this.move.x > 0 ? 'right' : 'left')
        : (this.move.y > 0 ? 'down' : 'up');
    }
    this.playAnim(`${this.sheet}-${moving ? 'walk' : 'idle'}-${this.facing}`);
    return null;
  }

  /**
   * Lose `damage` hearts and get knocked away from `from`. Ignored while
   * blinking after the previous hit. Returns true if the hit landed.
   */
  hurt(damage: number, from: { x: number; y: number }): boolean {
    const now = this.scene.time.now;
    if (!this.alive || now < this.invulnerableUntil) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.invulnerableUntil = now + PLAYER_INVULNERABLE_MS;
    this.knockedUntil = now + KNOCKBACK_MS;
    this.attackingUntil = 0;

    const away = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y);
    if (away.lengthSq() === 0) away.set(0, 1);
    away.normalize().scale(KNOCKBACK_SPEED);
    this.setVelocity(away.x, away.y);

    if (!this.alive) this.faint();
    return true;
  }

  /** Restore up to `amount` hearts. Returns false if already at full health (or fainted). */
  heal(amount: number): boolean {
    if (!this.alive || this.hp >= PLAYER_MAX_HP) return false;
    this.hp = Math.min(PLAYER_MAX_HP, this.hp + amount);
    return true;
  }

  private startAttack(): Phaser.Geom.Rectangle {
    this.attackingUntil = this.scene.time.now + PLAYER_ATTACK_MS;
    this.setVelocity(0, 0);
    this.playAnim(`${this.sheet}-attack-${this.facing}`);

    const [dx, dy] = FACING_VECTORS[this.facing];
    const { x, y } = this.feet;
    return new Phaser.Geom.Rectangle(
      x + dx * SWORD_REACH - SWORD_SIZE / 2,
      y + dy * SWORD_REACH - SWORD_SIZE / 2,
      SWORD_SIZE,
      SWORD_SIZE,
    );
  }

  /** Clears this frame's input, so `moveInput` never reports a stale direction. */
  private stopMoving(): null {
    this.move.set(0, 0);
    return null;
  }

  /** Out of hearts: fall over, then come back at the spawn point with full health. */
  private faint(): void {
    this.body.enable = false;
    this.setVelocity(0, 0);
    this.playAnim(`${this.sheet}-idle-down`);
    this.scene.tweens.add({
      targets: this,
      angle: 90,
      duration: 250,
      onComplete: () => {
        this.scene.time.delayedCall(900, () => {
          this.setAngle(0).setPosition(this.spawn.x, this.spawn.y);
          this.body.reset(this.spawn.x, this.spawn.y);
          this.body.enable = true;
          this.hp = PLAYER_MAX_HP;
          this.facing = 'down';
          this.invulnerableUntil = this.scene.time.now + PLAYER_INVULNERABLE_MS * 2;
        });
      },
    });
  }

  private readMove(pad: Phaser.Input.Gamepad.Gamepad | undefined): void {
    const { move, keys } = this;
    move.set(
      Number(keys.right.isDown) - Number(keys.left.isDown),
      Number(keys.down.isDown) - Number(keys.up.isDown),
    );
    if (pad) {
      if (pad.leftStick.length() > STICK_DEADZONE) {
        move.copy(pad.leftStick);
      } else {
        move.x += Number(pad.right) - Number(pad.left);
        move.y += Number(pad.down) - Number(pad.up);
      }
    }
    if (move.lengthSq() > 1) move.normalize();
  }

  private playAnim(key: string): void {
    this.anims.play(key, true);
    this.alignBody();
  }

  /**
   * Walk frames are 16px wide and attack frames 32px, both with the feet
   * centred, so re-centre the body whenever the frame width changes.
   */
  private alignBody(): void {
    this.body.setOffset((this.width - FEET_SIZE.width) / 2, FEET_Y);
  }
}
