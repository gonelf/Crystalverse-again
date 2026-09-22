import Phaser from 'phaser';
import { PLAYER_COLORS, PLAYER_MAX_HP } from '../config';
import { HEART, HEART_COLOR } from '../heart';
import { LEVELS } from '../levels';
import { Minimap } from '../Minimap';
import { UI_STATE, type LevelState, type PuzzleState } from '../uiState';
import { HEALTH_EVENT, PLAYERS_MOVED_EVENT, SPLIT_PROGRESS_EVENT } from './GameScene';

const HEART_SCALE = 3;
const HEART_GAP = 4;

const MINIMAP_MARGIN = 16;

const STYLE = {
  fontFamily: 'monospace',
  fontSize: '18px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
} as const;

/**
 * Screen-space overlay: the divider, player labels, hearts, minimaps, the level
 * card with its puzzle progress, and the merge banner.
 */
export class UIScene extends Phaser.Scene {
  private divider!: Phaser.GameObjects.Rectangle;
  private labels!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private banner!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private plates!: Phaser.GameObjects.Text;
  private hearts: [Phaser.GameObjects.Image[], Phaser.GameObjects.Image[]] = [[], []];
  private minimaps: Minimap[] = [];
  private sharedView = false;

  constructor() {
    super('ui');
  }

  create(): void {
    const { width, height } = this.scale;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    this.divider = this.add.rectangle(width / 2, height / 2, 6, height, 0x000000);
    this.labels = [
      this.add.text(16, 12, 'P1  WASD, SPACE / pad 1', { ...STYLE, color: hex(PLAYER_COLORS[0]) }),
      this.add.text(width - 16, 12, 'P2  ARROWS, ENTER / pad 2', { ...STYLE, color: hex(PLAYER_COLORS[1]) })
        .setOrigin(1, 0),
    ];
    this.createHeartTextures();
    const step = HEART[0].length * HEART_SCALE + HEART_GAP;
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      this.hearts[0].push(this.add.image(16 + i * step, 40, 'heart-full').setOrigin(0));
      this.hearts[1].push(this.add.image(width - 16 - i * step, 40, 'heart-full').setOrigin(1, 0));
    }
    this.banner = this.add
      .text(width / 2, height - 44, 'LINKED', { ...STYLE, fontSize: '22px', color: '#b388ff' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.title = this.add
      .text(width / 2, 14, '', { ...STYLE, fontSize: '20px' })
      .setOrigin(0.5, 0);
    this.plates = this.add
      .text(width / 2, 40, '', { ...STYLE, fontSize: '15px', color: '#8ad8ff' })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.hint = this.add
      .text(width / 2, height - 12, '', { ...STYLE, fontSize: '13px', color: '#9aa3bd' })
      .setOrigin(0.5, 1);

    this.onLevel(this.registry.get(UI_STATE.level));
    this.onPuzzle(this.registry.get(UI_STATE.puzzle));

    const registry = this.registry.events;
    const onLevel = (_: unknown, value: LevelState) => this.onLevel(value);
    const onPuzzle = (_: unknown, value: PuzzleState | null) => this.onPuzzle(value);
    registry.on(`changedata-${UI_STATE.level}`, onLevel);
    registry.on(`changedata-${UI_STATE.puzzle}`, onPuzzle);
    this.game.events.on(SPLIT_PROGRESS_EVENT, this.onProgress, this);
    this.game.events.on(HEALTH_EVENT, this.onHealth, this);
    this.game.events.on(PLAYERS_MOVED_EVENT, this.onPlayersMoved, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      registry.off(`changedata-${UI_STATE.level}`, onLevel);
      registry.off(`changedata-${UI_STATE.puzzle}`, onPuzzle);
      this.game.events.off(SPLIT_PROGRESS_EVENT, this.onProgress, this);
      this.game.events.off(HEALTH_EVENT, this.onHealth, this);
      this.game.events.off(PLAYERS_MOVED_EVENT, this.onPlayersMoved, this);
    });
  }

  private createHeartTextures(): void {
    const draw = (key: string, fill: number, alpha: number) => {
      if (this.textures.exists(key)) return;
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
    draw('heart-full', HEART_COLOR, 1);
    draw('heart-empty', 0x3a2a2a, 0.9);
  }

  private onLevel(level?: LevelState): void {
    if (!level) return;
    this.sharedView = level.sharedView;
    this.hint.setText(level.hint);
    this.title.setText(level.name).setAlpha(1);
    // The level card announces the room, then gets out of the way.
    this.tweens.add({ targets: this.title, alpha: 0.25, delay: 2200, duration: 800 });

    this.divider.setVisible(!this.sharedView);
    if (this.sharedView) {
      // One shared camera: no divider to draw and nothing to merge into.
      this.banner.setAlpha(0);
      this.labels[0].setX(16);
      this.labels[1].setX(this.scale.width - 16);
    }
    this.buildMinimaps(level);
  }

  /** Minimaps are per level, and pointless where both players share a camera. */
  private buildMinimaps(level: LevelState): void {
    for (const map of this.minimaps) map.destroy();
    this.minimaps = [];
    if (this.sharedView) return;

    const { width, height } = this.scale;
    this.minimaps = [0, 1].map((owner) => new Minimap(this, LEVELS[level.id], owner as 0 | 1));
    const y = height - MINIMAP_MARGIN - this.minimaps[0].frameHeight;
    this.minimaps[0].setPosition(MINIMAP_MARGIN, y);
    this.minimaps[1].setPosition(width - MINIMAP_MARGIN - this.minimaps[1].frameWidth, y);
  }

  private onPuzzle(puzzle?: PuzzleState | null): void {
    if (!puzzle || puzzle.total === 0) {
      this.plates.setVisible(false);
      return;
    }
    const done = puzzle.pressed === puzzle.total;
    this.plates
      .setVisible(true)
      .setText(`PLATES ${puzzle.pressed} / ${puzzle.total}`)
      .setColor(done ? '#7ce38b' : '#8ad8ff');
  }

  private onPlayersMoved(players: readonly { x: number; y: number }[]): void {
    for (const m of this.minimaps) m.setPlayers(players);
  }

  private onHealth(hp: readonly number[]): void {
    this.hearts.forEach((row, p) =>
      row.forEach((heart, i) => heart.setTexture(i < hp[p] ? 'heart-full' : 'heart-empty')));
  }

  private onProgress(progress: number): void {
    if (this.sharedView) return;
    const { width } = this.scale;
    const e = Phaser.Math.Easing.Sine.InOut(progress);
    // The divider rides the edge of the sliding right viewport and fades out.
    this.divider.setX(width / 2 + (e * width) / 2).setAlpha(1 - e);
    // P2's hearts stay put so both players can still see their health when merged.
    this.labels[1].setX(width - 16 + (e * width) / 2);
    // Minimaps are for finding the plazas, so they fade out once merged. P2's
    // rides the sliding right viewport like its label.
    if (this.minimaps.length) {
      this.minimaps[1].setX(width - MINIMAP_MARGIN - this.minimaps[1].frameWidth + (e * width) / 2);
      for (const m of this.minimaps) m.setAlpha(1 - e);
    }
    this.banner.setAlpha(progress >= 1 ? 1 : 0);
  }
}
