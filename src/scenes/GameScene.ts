import Phaser from 'phaser';
import { PLAYER_COLORS } from '../config';
import { LEVEL, type Rect } from '../level';
import { Player } from '../Player';
import { SplitScreen } from '../SplitScreen';

export const SPLIT_PROGRESS_EVENT = 'split-progress';

export class GameScene extends Phaser.Scene {
  private players!: [Player, Player];
  private split!: SplitScreen;
  private mergeZones: Phaser.Geom.Rectangle[] = [];

  constructor() {
    super('game');
  }

  create(): void {
    const { width, height } = LEVEL;
    this.physics.world.setBounds(0, 0, width, height);

    this.drawFloor();
    this.createPlayerTextures();

    const walls = this.physics.add.staticGroup();
    for (const r of LEVEL.walls) {
      walls.add(this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0x2a2f45));
    }

    for (const r of LEVEL.mergeZones) this.addMergeZone(r);

    const [s1, s2] = LEVEL.spawns;
    this.players = [
      new Player(this, s1.x, s1.y, 'player0', {
        up: 'W', down: 'S', left: 'A', right: 'D', padIndex: 0,
      }),
      new Player(this, s2.x, s2.y, 'player1', {
        up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', padIndex: 1,
      }),
    ];
    this.physics.add.collider(this.players, walls);

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

  private bothInSameMergeZone(): boolean {
    const [a, b] = this.players;
    return this.mergeZones.some((z) => z.contains(a.x, a.y) && z.contains(b.x, b.y));
  }

  private addMergeZone(r: Rect): void {
    this.mergeZones.push(new Phaser.Geom.Rectangle(r.x, r.y, r.w, r.h));
    const zone = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xb388ff, 0.12);
    zone.setStrokeStyle(4, 0xb388ff, 0.8);
    this.tweens.add({
      targets: zone,
      fillAlpha: 0.25,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }

  /** Tinted grid per half, so each viewport has its own look. */
  private drawFloor(): void {
    const { width, height } = LEVEL;
    const g = this.add.graphics();
    g.fillStyle(0x10182a).fillRect(0, 0, width / 2, height);
    g.fillStyle(0x2a1414).fillRect(width / 2, 0, width / 2, height);
    g.lineStyle(1, 0xffffff, 0.06);
    for (let x = 0; x <= width; x += 80) g.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 80) g.lineBetween(0, y, width, y);
  }

  private createPlayerTextures(): void {
    const size = 40;
    PLAYER_COLORS.forEach((color, i) => {
      const g = this.make.graphics({}, false);
      g.fillStyle(color).fillCircle(size / 2, size / 2, size / 2);
      g.fillStyle(0xffffff, 0.8).fillCircle(size / 2 + 8, size / 2 - 6, 5);
      g.generateTexture(`player${i}`, size, size);
      g.destroy();
    });
  }
}
