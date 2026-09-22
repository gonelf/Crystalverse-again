import Phaser from 'phaser';
import { HEART_PICKUP_LIFETIME_MS } from './config';
import { HEART, HEART_COLOR } from './heart';

const TEXTURE = 'heart-pickup';

/** 1:1 world-scale heart with a dark outline so it reads on grass. */
function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const g = scene.add.graphics();
  const each = (fn: (x: number, y: number) => void) =>
    HEART.forEach((line, y) => [...line].forEach((px, x) => px === 'X' && fn(x + 1, y + 1)));
  g.fillStyle(0x1a0808, 1);
  each((x, y) => g.fillRect(x - 1, y, 3, 1).fillRect(x, y - 1, 1, 3));
  g.fillStyle(HEART_COLOR, 1);
  each((x, y) => g.fillRect(x, y, 1, 1));
  g.fillStyle(0xffffff, 1).fillRect(2, 2, 1, 1);
  g.generateTexture(TEXTURE, HEART[0].length + 2, HEART.length + 2);
  g.destroy();
}

/**
 * A heart a killed mob leaves behind. Any hurt player who walks over it gets
 * one heart back. It bobs in place, blinks near the end of its life and then
 * disappears.
 */
export class HeartPickup extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    ensureTexture(scene);
    super(scene, x, y, TEXTURE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(9);

    // Pop out of the mob, then bob.
    scene.tweens.add({
      targets: this,
      y: y - 8,
      duration: 180,
      yoyo: true,
      ease: 'Quad.Out',
      onComplete: () => {
        scene.tweens.add({ targets: this, y: y - 2, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      },
    });
    const blink = scene.time.delayedCall(HEART_PICKUP_LIFETIME_MS * 0.7, () => {
      scene.tweens.add({ targets: this, alpha: 0.2, duration: 120, yoyo: true, repeat: -1 });
    });
    const expire = scene.time.delayedCall(HEART_PICKUP_LIFETIME_MS, () => this.destroy());
    // Picked up early: stop the timers and the looping tweens with it.
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      blink.remove();
      expire.remove();
      scene.tweens.killTweensOf(this);
    });
  }
}
