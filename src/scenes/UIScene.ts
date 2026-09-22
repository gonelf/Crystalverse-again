import Phaser from 'phaser';
import { PLAYER_COLORS, PLAYER_MAX_HP } from '../config';
import { Minimap } from '../Minimap';
import { HEALTH_EVENT, PLAYERS_MOVED_EVENT, SPLIT_PROGRESS_EVENT } from './GameScene';

/** 7x6 pixel heart, drawn at HEART_SCALE. */
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const HEART_SCALE = 3;
const HEART_GAP = 4;

const MINIMAP_MARGIN = 16;

/** Screen-space overlay: the divider line, player labels, hearts, minimaps and the merge banner. */
export class UIScene extends Phaser.Scene {
  private divider!: Phaser.GameObjects.Rectangle;
  private labels!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private banner!: Phaser.GameObjects.Text;
  private hearts: [Phaser.GameObjects.Image[], Phaser.GameObjects.Image[]] = [[], []];
  private minimaps!: [Minimap, Minimap];

  constructor() {
    super('ui');
  }

  create(): void {
    const { width, height } = this.scale;
    this.divider = this.add.rectangle(width / 2, height / 2, 6, height, 0x000000);

    const style = {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    };
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    this.labels = [
      this.add.text(16, 12, 'P1  WASD, SPACE / pad 1', { ...style, color: hex(PLAYER_COLORS[0]) }),
      this.add.text(width - 16, 12, 'P2  ARROWS, ENTER / pad 2', { ...style, color: hex(PLAYER_COLORS[1]) })
        .setOrigin(1, 0),
    ];
    this.createHeartTextures();
    const step = HEART[0].length * HEART_SCALE + HEART_GAP;
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      this.hearts[0].push(this.add.image(16 + i * step, 40, 'heart-full').setOrigin(0));
      this.hearts[1].push(this.add.image(width - 16 - i * step, 40, 'heart-full').setOrigin(1, 0));
    }
    this.banner = this.add
      .text(width / 2, height - 28, 'LINKED', { ...style, fontSize: '22px', color: '#b388ff' })
      .setOrigin(0.5)
      .setAlpha(0);

    // One minimap in the bottom outer corner of each half.
    const mapY = height - MINIMAP_MARGIN - Minimap.height;
    this.minimaps = [
      new Minimap(this, MINIMAP_MARGIN, mapY, 0),
      new Minimap(this, width - MINIMAP_MARGIN - Minimap.width, mapY, 1),
    ];

    this.game.events.on(SPLIT_PROGRESS_EVENT, this.onProgress, this);
    this.game.events.on(HEALTH_EVENT, this.onHealth, this);
    this.game.events.on(PLAYERS_MOVED_EVENT, this.onPlayersMoved, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SPLIT_PROGRESS_EVENT, this.onProgress, this);
      this.game.events.off(HEALTH_EVENT, this.onHealth, this);
      this.game.events.off(PLAYERS_MOVED_EVENT, this.onPlayersMoved, this);
    });
  }

  private createHeartTextures(): void {
    const draw = (key: string, fill: number, alpha: number) => {
      const g = this.add.graphics();
      HEART.forEach((line, y) => [...line].forEach((px, x) => {
        if (px !== 'X') return;
        // 1px dark border below and right, for readability over grass.
        g.fillStyle(0x000000, 0.6).fillRect((x + 0.34) * HEART_SCALE, (y + 0.34) * HEART_SCALE, HEART_SCALE, HEART_SCALE);
        g.fillStyle(fill, alpha).fillRect(x * HEART_SCALE, y * HEART_SCALE, HEART_SCALE, HEART_SCALE);
      }));
      g.generateTexture(key, HEART[0].length * HEART_SCALE + 1, HEART.length * HEART_SCALE + 1);
      g.destroy();
    };
    draw('heart-full', 0xe83b3b, 1);
    draw('heart-empty', 0x3a2a2a, 0.9);
  }

  private onPlayersMoved(players: readonly { x: number; y: number }[]): void {
    for (const m of this.minimaps) m.setPlayers(players);
  }

  private onHealth(hp: readonly number[]): void {
    this.hearts.forEach((row, p) =>
      row.forEach((heart, i) => heart.setTexture(i < hp[p] ? 'heart-full' : 'heart-empty')));
  }

  private onProgress(progress: number): void {
    const { width } = this.scale;
    const e = Phaser.Math.Easing.Sine.InOut(progress);
    // The divider rides the edge of the sliding right viewport and fades out.
    this.divider.setX(width / 2 + (e * width) / 2).setAlpha(1 - e);
    // P2's hearts stay put so both players can still see their health when merged.
    this.labels[1].setX(width - 16 + (e * width) / 2);
    // Minimaps are for finding each other, so they fade out once merged. P2's
    // rides the sliding right viewport like its label.
    this.minimaps[1].setX(width - MINIMAP_MARGIN - Minimap.width + (e * width) / 2);
    for (const m of this.minimaps) m.setAlpha(1 - e);
    this.banner.setAlpha(progress >= 1 ? 1 : 0);
  }
}
