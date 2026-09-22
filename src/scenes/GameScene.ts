import Phaser from 'phaser';
import { MOB_AGGRO_RANGE, MOB_RESPAWN_MS, SHARED_VIEW_MIN_ZOOM } from '../config';
import { createGeneratedTextures, DUNGEON_TILESET, TEXTURES } from '../graphics/textures';
import { HeartPickup } from '../HeartPickup';
import {
  isLevelId,
  LEVELS,
  START_LEVEL,
  TILE_SIZE,
  type ExitSpec,
  type LevelData,
  type LevelId,
  type TilePos,
  type TileRect,
} from '../levels';
import { Mob } from '../Mob';
import { Player } from '../Player';
import { PuzzleSystem } from '../puzzle/PuzzleSystem';
import { SplitScreen } from '../SplitScreen';
import { UI_STATE, type LevelState } from '../uiState';

export const SPLIT_PROGRESS_EVENT = 'split-progress';
/** Emitted every frame with both players, for the minimaps. */
export const PLAYERS_MOVED_EVENT = 'players-moved';
/** Emitted with `[p1Hp, p2Hp]` whenever either player's health changes. */
export const HEALTH_EVENT = 'player-health';

const PLAYER_TEXTURES = ['hero', 'hero-p2'] as const;
const FADE_MS = 280;

export interface GameSceneData {
  levelId?: LevelId;
  /** The level the players are arriving from, so they come out of the right door. */
  from?: LevelId;
}

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private players!: [Player, Player];
  private split!: SplitScreen;
  private puzzle?: PuzzleSystem;
  private mergeZones: Phaser.Geom.Rectangle[] = [];
  private exits: Array<{ spec: ExitSpec; area: Phaser.Geom.Rectangle }> = [];
  private mobs: Mob[] = [];
  /** Invisible walls over the merge zones that keep mobs out, so plazas are safe. */
  private safeZones!: Phaser.Physics.Arcade.StaticGroup;
  private pickups!: Phaser.Physics.Arcade.Group;
  private lastHp = '';
  private travelling = false;
  private from?: LevelId;

  constructor() {
    super('game');
  }

  init(data: GameSceneData): void {
    this.level = LEVELS[data.levelId ?? levelFromQuery() ?? START_LEVEL];
    this.from = data.from;
    this.mergeZones = [];
    this.exits = [];
    this.mobs = [];
    this.puzzle = undefined;
    this.lastHp = '';
    this.travelling = false;
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
    const level = this.level;
    createGeneratedTextures(this);

    const width = level.cols * TILE_SIZE;
    const height = level.rows * TILE_SIZE;
    this.physics.world.setBounds(0, 0, width, height);

    const solid = this.buildTilemap();
    this.safeZones = this.physics.add.staticGroup();
    for (const zone of level.mergeZones) this.addMergeZone(zone);
    for (const exit of level.exits) this.addExit(exit);

    this.players = this.spawnPlayers();
    this.physics.add.collider(this.players, solid);

    if (level.plates.length || level.crates.length || level.doors.length) {
      this.puzzle = new PuzzleSystem(this, level, this.players);
      this.physics.add.collider(this.players, this.puzzle.obstacles);
    }
    this.spawnMobs(solid);

    this.split = new SplitScreen(
      this,
      this.players[0],
      this.players[1],
      new Phaser.Geom.Rectangle(0, 0, width, height),
      level.sharedView ? { startMerged: true, minZoom: SHARED_VIEW_MIN_ZOOM } : {},
    );
    this.cameras.cameras.forEach((cam) => cam.fadeIn(FADE_MS, 0, 0, 0));

    this.publishState();
    if (!this.scene.isActive('ui')) this.scene.launch('ui');

    // Crates can be pushed into a corner; R puts the room back the way it was.
    // Keys are destroyed when the scene shuts down, so this doesn't stack up.
    if (this.puzzle) {
      this.input.keyboard?.addKey('R').on('down', () => this.restartLevel(this.level.id, this.from));
    }

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
    this.puzzle?.update(delta);
    this.split.update(this.level.sharedView || this.bothInSameMergeZone(), delta);
    this.game.events.emit(SPLIT_PROGRESS_EVENT, this.split.progress);
    this.game.events.emit(PLAYERS_MOVED_EVENT, this.players);

    const hp = this.players.map((p) => p.hp);
    if (hp.join() !== this.lastHp) {
      this.lastHp = hp.join();
      this.game.events.emit(HEALTH_EVENT, hp);
    }
    this.checkExits();
  }

  private spawnMobs(solid: Phaser.Tilemaps.TilemapLayer): void {
    Mob.createAnimations(this);
    this.mobs = this.level.mobs.map(({ col, row, kind }) => new Mob(
      this,
      new Phaser.Math.Vector2((col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE),
      kind,
    ));
    this.physics.add.collider(this.mobs, solid);
    this.physics.add.collider(this.mobs, this.safeZones);
    this.physics.add.collider(this.mobs, this.mobs);
    if (this.puzzle) this.physics.add.collider(this.mobs, this.puzzle.obstacles);

    // Hearts dropped by mobs. Only a hurt player picks one up, so a player at
    // full health leaves it for their partner.
    this.pickups = this.physics.add.group();
    this.physics.add.overlap(this.players, this.pickups, (a, b) => {
      if ((a as Player).heal(1)) (b as HeartPickup).destroy();
    });
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
      if (mob.hit(1, player.feet)) {
        if (Math.random() < mob.stats.heartDropChance) {
          this.pickups.add(new HeartPickup(this, mob.x, mob.y));
        }
        this.scheduleRespawn(mob);
      }
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
    const { level } = this;
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: level.cols,
      height: level.rows,
    });
    const image = level.tileset === 'dungeon' ? DUNGEON_TILESET : 'overworld';
    const tileset = map.addTilesetImage('tiles', image, TILE_SIZE, TILE_SIZE)!;

    const layer = (name: string, data: number[][]) => {
      const l = map.createBlankLayer(name, tileset)!;
      data.forEach((row, r) => row.forEach((t, c) => t >= 0 && l.putTileAt(t, c, r)));
      return l;
    };
    layer('ground', level.ground);
    layer('decor', level.decor);
    const solid = layer('solid', level.solid);
    solid.setCollisionByExclusion([-1]);
    return solid;
  }

  private spawnPlayers(): [Player, Player] {
    for (const key of PLAYER_TEXTURES) Player.createAnimations(this, key);
    const [s1, s2] = this.spawnTiles().map(({ col, row }) => ({
      x: (col + 0.5) * TILE_SIZE,
      y: (row + 0.5) * TILE_SIZE,
    }));
    return [
      new Player(this, s1.x, s1.y, PLAYER_TEXTURES[0], {
        up: 'W', down: 'S', left: 'A', right: 'D', attack: 'SPACE', padIndex: 0,
      }),
      new Player(this, s2.x, s2.y, PLAYER_TEXTURES[1], {
        up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', attack: 'ENTER', padIndex: 1,
      }),
    ];
  }

  /** Players step back out of the door they came in through, if it has one. */
  private spawnTiles(): readonly [TilePos, TilePos] {
    const back = this.level.exits.find((e) => e.to === this.from && e.arrival);
    return back?.arrival ?? this.level.spawns;
  }

  private bothInSameMergeZone(): boolean {
    const [a, b] = this.players;
    return this.mergeZones.some((z) => z.contains(a.x, a.y) && z.contains(b.x, b.y));
  }

  private addMergeZone(t: TileRect): void {
    const r = toWorldRect(t);
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

  /** Stairs both players have to stand on together to travel to another level. */
  private addExit(spec: ExitSpec): void {
    const area = toWorldRect(spec.rect);
    this.exits.push({ spec, area });

    for (let r = 0; r < spec.rect.rows; r++) {
      for (let c = 0; c < spec.rect.cols; c++) {
        this.add
          .image((spec.rect.col + c + 0.5) * TILE_SIZE, (spec.rect.row + r + 0.5) * TILE_SIZE, TEXTURES.stairs)
          .setDepth(2);
      }
    }
    const label = this.add
      .text(area.centerX, area.top - 6, spec.label, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#d8dff0',
        stroke: '#05070d',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
    this.tweens.add({ targets: label, alpha: 0.45, duration: 900, yoyo: true, repeat: -1 });
  }

  private checkExits(): void {
    if (this.travelling) return;
    const [a, b] = this.players;
    const exit = this.exits.find(
      ({ area }) => area.contains(a.feet.x, a.feet.y) && area.contains(b.feet.x, b.feet.y),
    );
    if (exit) this.restartLevel(exit.spec.to, this.level.id);
  }

  private restartLevel(levelId: LevelId, from?: LevelId): void {
    if (this.travelling) return;
    this.travelling = true;
    this.cameras.cameras.forEach((cam) => cam.fadeOut(FADE_MS, 0, 0, 0));
    this.time.delayedCall(FADE_MS, () => {
      this.scene.restart({ levelId, from } satisfies GameSceneData);
    });
  }

  private publishState(): void {
    const { id, name, hint, sharedView } = this.level;
    this.registry.set(UI_STATE.level, { id, name, hint, sharedView } satisfies LevelState);
    this.registry.set(UI_STATE.puzzle, this.puzzle ? this.puzzle.status : null);
  }
}

function toWorldRect(t: TileRect): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(
    t.col * TILE_SIZE,
    t.row * TILE_SIZE,
    t.cols * TILE_SIZE,
    t.rows * TILE_SIZE,
  );
}

/** `?level=dungeon` jumps straight into a level while working on it. */
function levelFromQuery(): LevelId | undefined {
  if (typeof location === 'undefined') return undefined;
  const requested = new URLSearchParams(location.search).get('level');
  return isLevelId(requested) ? requested : undefined;
}
