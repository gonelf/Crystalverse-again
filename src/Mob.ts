import Phaser from 'phaser';
import {
  KNOCKBACK_MS,
  KNOCKBACK_SPEED,
  MOB_AGGRO_RANGE,
  MOB_LEASH,
  MOB_LOSE_RANGE,
} from './config';
import type { MobKind } from './level';

interface MobStats {
  hp: number;
  wanderSpeed: number;
  chaseSpeed: number;
  /** Row in slime.png. */
  row: number;
}

const STATS: Record<MobKind, MobStats> = {
  green: { hp: 2, wanderSpeed: 18, chaseSpeed: 42, row: 0 },
  purple: { hp: 4, wanderSpeed: 22, chaseSpeed: 56, row: 1 },
};

/** slime.png: 4 columns of 16x16 frames, one row per kind. */
const SHEET_COLUMNS = 4;

/** Anything a mob can chase. */
export interface MobTarget {
  x: number;
  y: number;
  readonly alive: boolean;
}

/**
 * A slime that wanders near its spawn, chases the nearest player that comes
 * close and hurts players on contact (see GameScene). Killed mobs are
 * deactivated rather than destroyed so GameScene can respawn them.
 */
export class Mob extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  readonly stats: MobStats;
  hp: number;

  private target: MobTarget | null = null;
  private readonly heading = new Phaser.Math.Vector2();
  private nextWanderAt = 0;
  private stunnedUntil = 0;

  static createAnimations(scene: Phaser.Scene): void {
    for (const [kind, { row }] of Object.entries(STATS)) {
      const first = row * SHEET_COLUMNS;
      scene.anims.create({
        key: `slime-${kind}`,
        frames: scene.anims.generateFrameNumbers('slime', { start: first, end: first + 3 }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  constructor(
    scene: Phaser.Scene,
    readonly home: Phaser.Math.Vector2,
    readonly kind: MobKind,
  ) {
    super(scene, home.x, home.y, 'slime', STATS[kind].row * SHEET_COLUMNS);
    this.stats = STATS[kind];
    this.hp = this.stats.hp;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(12, 7).setOffset(2, 8);
    this.setCollideWorldBounds(true);
    this.play({ key: `slime-${kind}`, startFrame: Phaser.Math.Between(0, 3) });
  }

  get alive(): boolean {
    return this.active && this.hp > 0;
  }

  /** True while reeling from a hit; stunned mobs don't hurt players. */
  get stunned(): boolean {
    return this.scene.time.now < this.stunnedUntil;
  }

  update(time: number, players: readonly MobTarget[]): void {
    if (!this.alive) return;
    this.setDepth(10 + this.y / 10000);
    if (this.stunned) {
      // Slide for the knockback, then sit dazed until the stun wears off.
      if (time > this.stunnedUntil - KNOCKBACK_MS) this.setVelocity(0, 0);
      this.nextWanderAt = 0;
      return;
    }

    this.updateTarget(players);
    if (this.target) {
      this.heading.set(this.target.x - this.x, this.target.y - this.y).normalize();
      this.setVelocity(this.heading.x * this.stats.chaseSpeed, this.heading.y * this.stats.chaseSpeed);
    } else {
      this.wander(time);
    }
    this.anims.timeScale = this.target ? 2 : 1;
    if (this.body.velocity.x !== 0) this.setFlipX(this.body.velocity.x < 0);
  }

  /** Take `damage` and get knocked away from `from`. Returns true if this killed the mob. */
  hit(damage: number, from: { x: number; y: number }): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.knockBack(from);
    this.flash();
    if (this.hp > 0) return false;
    this.die();
    return true;
  }

  /** Bring a killed mob back at its spawn point. */
  respawn(): void {
    this.hp = this.stats.hp;
    this.target = null;
    this.stunnedUntil = 0;
    this.setPosition(this.home.x, this.home.y).setAlpha(0).setScale(1).clearTint();
    this.body.reset(this.home.x, this.home.y);
    this.setActive(true).setVisible(true);
    this.body.enable = true;
    this.scene.tweens.add({ targets: this, alpha: 1, duration: 400 });
  }

  /** Pause briefly after touching a player so it doesn't hit them every frame. */
  recoil(from: { x: number; y: number }): void {
    this.knockBack(from, 0.6);
  }

  private knockBack(from: { x: number; y: number }, strength = 1): void {
    const away = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y);
    if (away.lengthSq() === 0) away.set(0, 1);
    away.normalize().scale(KNOCKBACK_SPEED * strength);
    this.setVelocity(away.x, away.y);
    this.stunnedUntil = this.scene.time.now + KNOCKBACK_MS * 2;
  }

  private flash(): void {
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.scene.time.delayedCall(90, () => this.clearTint());
  }

  private die(): void {
    this.body.enable = false;
    this.setActive(false);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scaleX: 1.8,
      scaleY: 0.3,
      duration: 220,
      ease: 'Quad.Out',
      onComplete: () => this.setVisible(false),
    });
  }

  private updateTarget(players: readonly MobTarget[]): void {
    const dist = (p: MobTarget) => Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
    if (this.target && (!this.target.alive || dist(this.target) > MOB_LOSE_RANGE)) {
      this.target = null;
    }
    if (this.target) return;
    let best = MOB_AGGRO_RANGE;
    for (const p of players) {
      const d = dist(p);
      if (p.alive && d < best) {
        best = d;
        this.target = p;
      }
    }
  }

  /** Alternate between resting and hopping in a random direction, drifting back home if too far. */
  private wander(time: number): void {
    // Bumping into something picks a new direction right away.
    if (time < this.nextWanderAt && this.body.blocked.none) return;
    this.nextWanderAt = time + Phaser.Math.Between(900, 2400);

    const fromHome = Phaser.Math.Distance.Between(this.x, this.y, this.home.x, this.home.y);
    if (fromHome > MOB_LEASH && this.body.blocked.none) {
      this.heading.set(this.home.x - this.x, this.home.y - this.y).normalize();
    } else if (Math.random() < 0.4) {
      this.heading.set(0, 0);
    } else {
      this.heading.setToPolar(Math.random() * Math.PI * 2);
    }
    this.setVelocity(this.heading.x * this.stats.wanderSpeed, this.heading.y * this.stats.wanderSpeed);
  }
}
