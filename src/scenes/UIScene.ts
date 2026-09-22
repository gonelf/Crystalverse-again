import Phaser from 'phaser';
import { PLAYER_COLORS } from '../config';
import { UI_STATE, type LevelState, type PuzzleState } from '../uiState';
import { SPLIT_PROGRESS_EVENT } from './GameScene';

const STYLE = {
  fontFamily: 'monospace',
  fontSize: '18px',
  color: '#ffffff',
  stroke: '#000000',
  strokeThickness: 4,
} as const;

/** Screen-space overlay: the divider, player labels, level card and puzzle progress. */
export class UIScene extends Phaser.Scene {
  private divider!: Phaser.GameObjects.Rectangle;
  private labels!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private banner!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private plates!: Phaser.GameObjects.Text;
  private sharedView = false;

  constructor() {
    super('ui');
  }

  create(): void {
    const { width, height } = this.scale;
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

    this.divider = this.add.rectangle(width / 2, height / 2, 6, height, 0x000000);
    this.labels = [
      this.add.text(16, 12, 'P1  WASD / pad 1', { ...STYLE, color: hex(PLAYER_COLORS[0]) }),
      this.add.text(width - 16, 12, 'P2  ARROWS / pad 2', { ...STYLE, color: hex(PLAYER_COLORS[1]) })
        .setOrigin(1, 0),
    ];
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      registry.off(`changedata-${UI_STATE.level}`, onLevel);
      registry.off(`changedata-${UI_STATE.puzzle}`, onPuzzle);
      this.game.events.off(SPLIT_PROGRESS_EVENT, this.onProgress, this);
    });
  }

  private onLevel(level?: LevelState): void {
    if (!level) return;
    this.sharedView = level.sharedView;
    this.hint.setText(level.hint);
    this.title.setText(level.name).setAlpha(1);
    // The level card announces the room, then gets out of the way.
    this.tweens.add({ targets: this.title, alpha: 0.25, delay: 2200, duration: 800 });

    if (this.sharedView) {
      // One shared camera: no divider to draw and nothing to merge into.
      this.divider.setVisible(false);
      this.banner.setAlpha(0);
      this.labels[0].setX(16);
      this.labels[1].setX(this.scale.width - 16);
    } else {
      this.divider.setVisible(true);
    }
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

  private onProgress(progress: number): void {
    if (this.sharedView) return;
    const { width } = this.scale;
    const e = Phaser.Math.Easing.Sine.InOut(progress);
    // The divider rides the edge of the sliding right viewport and fades out.
    this.divider.setX(width / 2 + (e * width) / 2).setAlpha(1 - e);
    this.labels[1].setX(width - 16 + (e * width) / 2);
    this.banner.setAlpha(progress >= 1 ? 1 : 0);
  }
}
