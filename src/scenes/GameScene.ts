import Phaser from 'phaser';
import { LEVEL, TILE_SIZE, type TileRect } from '../level';
import { Player } from '../Player';
import { SplitScreen } from '../SplitScreen';

export const SPLIT_PROGRESS_EVENT = 'split-progress';

const PLAYER_TEXTURES = ['hero', 'hero-p2'] as const;

export class GameScene extends Phaser.Scene {
  private players!: [Player, Player];
  private split!: SplitScreen;
  private mergeZones: Phaser.Geom.Rectangle[] = [];

  constructor() {
    super('game');
  }

  preload(): void {
    this.load.image('overworld', 'assets/overworld.png');
    const frame = { frameWidth: 16, frameHeight: 32 };
    this.load.spritesheet('hero', 'assets/character.png', frame);
    this.load.spritesheet('hero-p2', 'assets/character-p2.png', frame);
  }

  create(): void {
    const width = LEVEL.cols * TILE_SIZE;
    const height = LEVEL.rows * TILE_SIZE;
    this.physics.world.setBounds(0, 0, width, height);

    const solid = this.buildTilemap();
    for (const z of LEVEL.mergeZones) this.addMergeZone(z);

    for (const key of PLAYER_TEXTURES) Player.createAnimations(this, key);
    const [s1, s2] = LEVEL.spawns.map(({ col, row }) => ({
      x: (col + 0.5) * TILE_SIZE,
      y: (row + 0.5) * TILE_SIZE,
    }));
    this.players = [
      new Player(this, s1.x, s1.y, PLAYER_TEXTURES[0], {
        up: 'W', down: 'S', left: 'A', right: 'D', padIndex: 0,
      }),
      new Player(this, s2.x, s2.y, PLAYER_TEXTURES[1], {
        up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', padIndex: 1,
      }),
    ];
    this.physics.add.collider(this.players, solid);

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

  update(_time: number, delta: number): void {
    for (const p of this.players) p.update();
    this.split.update(this.bothInSameMergeZone(), delta);
    this.game.events.emit(SPLIT_PROGRESS_EVENT, this.split.progress);
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
