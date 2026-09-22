import Phaser from 'phaser';
import { PLAYER_COLORS } from '../config';
import { SPLIT_PROGRESS_EVENT } from './GameScene';

/** Screen-space overlay: the divider line, player labels and the merge banner. */
export class UIScene extends Phaser.Scene {
  private divider!: Phaser.GameObjects.Rectangle;
  private labels!: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private banner!: Phaser.GameObjects.Text;

  constructor() {
    super('ui');
  }

  create(): void {
    const { width, height } = this.scale;
    this.divider = this.add.rectangle(width / 2, height / 2, 6, height, 0x000000);

    const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' };
    const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
    this.labels = [
      this.add.text(16, 12, 'P1  WASD / pad 1', { ...style, color: hex(PLAYER_COLORS[0]) }),
      this.add.text(width - 16, 12, 'P2  ARROWS / pad 2', { ...style, color: hex(PLAYER_COLORS[1]) })
        .setOrigin(1, 0),
    ];
    this.banner = this.add
      .text(width / 2, height - 28, 'LINKED', { ...style, fontSize: '22px', color: '#b388ff' })
      .setOrigin(0.5)
      .setAlpha(0);

    this.game.events.on(SPLIT_PROGRESS_EVENT, this.onProgress, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off(SPLIT_PROGRESS_EVENT, this.onProgress, this);
    });
  }

  private onProgress(progress: number): void {
    const { width } = this.scale;
    const e = Phaser.Math.Easing.Sine.InOut(progress);
    // The divider rides the edge of the sliding right viewport and fades out.
    this.divider.setX(width / 2 + (e * width) / 2).setAlpha(1 - e);
    this.labels[1].setX(width - 16 + (e * width) / 2);
    this.banner.setAlpha(progress >= 1 ? 1 : 0);
  }
}
