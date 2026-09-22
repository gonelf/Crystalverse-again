import Phaser from 'phaser';
import { MOB_AGGRO_RANGE, MOB_RESPAWN_MS } from '../config';
import { LEVEL, TILE_SIZE, type TileRect } from '../level';
import { Mob } from '../Mob';
import { Player } from '../Player';
import { SplitScreen } from '../SplitScreen';

export const SPLIT_PROGRESS_EVENT = 'split-progress';
/** Emitted with `[p1Hp, p2Hp]` whenever either player's health changes. */
export const HEALTH_EVENT = 'player-health';

const PLAYER_TEXTURES = ['hero', 'hero-p2'] as const;

export class GameScene extends Phaser.Scene {
  private players!: [Player, Player];
  private split!: SplitScreen;
  private mergeZones: Phaser.Geom.Rectangle[] = [];
  private mobs: Mob[] = [];
  /** Invisible walls over the merge zones that keep mobs out, so plazas are safe. */
  private safeZones!: Phaser.Physics.Arcade.StaticGroup;
  private lastHp = '';

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.image('overworld', 'assets/overworld.png');
    const frame = { frameWidth: 16, frameHeight: 32 };
    this.load.spritesheet('hero', 'assets/character.png', frame);
    this.load.spritesheet('hero-p2', 'assets/character-p2.png', frame);
    const attackFrame = { frameWidth: 32, frameHeight: 32 };
    this.load.spritesheet('hero-attack', 'assets/character.png', attackFrame);
    this.load.spritesheet('hero-p2-attack', 'assets/character-p2.png', attackFrame);
    this.load.spritesheet('slime', 'assets/slime.png', { frameWidth: 16, frameHeight: 16 });
  }

  create(): void {
    const width = LEVEL.cols * TILE_SIZE;
    const height = LEVEL.rows * TILE_SIZE;
    this.physics.world.setBounds(0, 0, width, height);

    const solid = this.buildTilemap();
    this.safeZones = this.physics.add.staticGroup();
    for (const z of LEVEL.mergeZones) this.addMergeZone(z);

    for (const key of PLAYER_TEXTURES) Player.createAnimations(this, key);
    const [s1, s2] = LEVEL.spawns.map(({ col, row }) => ({
      x: (col + 0.5) * TILE_SIZE,
      y: (row + 0.5) * TILE_SIZE,
    }));
    this.players = [
      new Player(this, s1.x, s1.y, PLAYER_TEXTURES[0], {
        up: 'W', down: 'S', left: 'A', right: 'D', attack: 'SPACE', padIndex: 0,
      }),
      new Player(this, s2.x, s2.y, PLAYER_TEXTURES[1], {
        up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', attack: 'ENTER', padIndex: 1,
      }),
    ];
    this.physics.add.collider(this.players, solid);
    this.spawnMobs(solid);

    this.split = new SplitScreen(
      this,
      this.players[0],
      this.players[1],
      new Phaser.Geom.Rectangle(0, 0, width, height),
    );

    this.scene.launch('ui');

    if (import.meta.env.DEV) {
      (window as unknown as { coop: unknown }).coop = { scene: this, split: this.split };
    }
  }

  update(time: number, delta: number): void {
    this.players.forEach((p, i) => {
      const swing = p.update();
      if (swing) this.swordHits(p, swing, i as 0 | 1);
    });
    for (const m of this.mobs) m.update(time, this.players);
    this.split.update(this.bothInSameMergeZone(), delta);
    this.game.events.emit(SPLIT_PROGRESS_EVENT, this.split.progress);

    const hp = this.players.map((p) => p.hp);
    if (hp.join() !== this.lastHp) {
      this.lastHp = hp.join();
      this.game.events.emit(HEALTH_EVENT, hp);
    }
  }

  private spawnMobs(solid: Phaser.Tilemaps.TilemapLayer): void {
    Mob.createAnimations(this);
    this.mobs = LEVEL.mobs.map(({ col, row, kind }) => new Mob(
      this,
      new Phaser.Math.Vector2((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE),
      kind,
    ));
    this.physics.add.collider(this.mobs, solid);
    this.physics.add.collider(this.mobs, this.safeZones);
    this.physics.add.collider(this.mobs, this.mobs);
    this.physics.add.overlap(this.players, this.mobs, (a, b) => {
      const player = a as Player;
      const mob = b as Mob;
      if (!mob.alive || mob.stunned) return;
      const index = this.players.indexOf(player) as 0 | 1;
      if (player.hurt(1, mob)) {
        mob.recoil(player);
        this.split.cameraOf(index).shake(120, 0.004);
      }
    });
  }

  private swordHits(player: Player, swing: Phaser.Geom.Rectangle, index: 0 | 1): void {
    for (const mob of this.mobs) {
      const { x, y, width, height } = mob.body;
      if (!mob.alive || !Phaser.Geom.Rectangle.Overlaps(swing, new Phaser.Geom.Rectangle(x, y, width, height))) {
        continue;
      }
      if (mob.hit(1, player.feet)) this.scheduleRespawn(mob);
      this.split.cameraOf(index).shake(60, 0.002);
    }
  }

  /** Respawn a killed mob after a while, waiting until no player is standing near its spawn. */
  private scheduleRespawn(mob: Mob): void {
    this.time.delayedCall(MOB_RESPAWN_MS, () => {
      const crowded = this.players.some((p) =>
        Phaser.Math.Distance.Between(p.x, p.y, mob.home.x, mob.home.y) < MOB_AGGRO_RANGE * 2);
      if (crowded) this.scheduleRespawn(mob);
      else mob.respawn();
    });
  }

  /** Builds the ground, decor and solid layers and returns the collidable one. */
  private buildTilemap(): Phaser.Tilemaps.TilemapLayer {
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: LEVEL.cols,
      height: LEVEL.rows,
    });
    const tileset = map.addTilesetImage('overworld')!;

    const layer = (name: string, data: number[][]) => {
      const l = map.createBlankLayer(name, tileset)!;
      data.forEach((row, r) => row.forEach((t, c) => t >= 0 && l.putTileAt(t, c, r)));
      return l;
    };
    layer('ground', LEVEL.ground);
    layer('decor', LEVEL.decor);
    const solid = layer('solid', LEVEL.solid);
    solid.setCollisionByExclusion([-1]);
    return solid;
  }

  private bothInSameMergeZone(): boolean {
    const [a, b] = this.players;
    return this.mergeZones.some((z) => z.contains(a.x, a.y) && z.contains(b.x, b.y));
  }

  private addMergeZone(t: TileRect): void {
    const r = new Phaser.Geom.Rectangle(
      t.col * TILE_SIZE,
      t.row * TILE_SIZE,
      t.cols * TILE_SIZE,
      t.rows * TILE_SIZE,
    );
    this.mergeZones.push(r);
    const wall = this.add.zone(r.centerX, r.centerY, r.width, r.height);
    this.safeZones.add(wall);
    // A faint shimmer over the stone plaza so players can tell it's special.
    const glow = this.add.rectangle(r.centerX, r.centerY, r.width, r.height, 0x9ad8ff, 0.05);
    glow.setStrokeStyle(1, 0x9ad8ff, 0.6).setDepth(5);
    this.tweens.add({
      targets: glow,
      fillAlpha: 0.18,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }
}
