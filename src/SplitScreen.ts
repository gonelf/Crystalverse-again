import Phaser from 'phaser';
import { BASE_ZOOM, MERGE_DURATION, MERGE_FRAMING_MARGIN, MERGE_MIN_ZOOM } from './config';

type GameObject = Phaser.GameObjects.GameObject;
type Camera = Phaser.Cameras.Scene2D.Camera;

/** Show or hide a game object on a single camera. */
function setVisibleOn(camera: Camera, obj: GameObject, visible: boolean): void {
  if (visible) obj.cameraFilter &= ~camera.id;
  else obj.cameraFilter |= camera.id;
}

/**
 * Two-player split screen that can merge into one shared view.
 *
 * - Split: the left camera follows P1, the right camera follows P2, and each
 *   camera hides the other player (and anything registered with `hideFromOther`).
 * - Merged: the left camera widens to fill the screen, follows the midpoint of
 *   both players and zooms out (down to MERGE_MIN_ZOOM) to fit them. The right
 *   camera slides away.
 *
 * `progress` runs from 0 (split) to 1 (merged) and can reverse mid-transition,
 * so walking back out of a merge zone halfway through the animation is smooth.
 */
export class SplitScreen {
  readonly left: Camera;
  readonly right: Camera;
  /** 0 = fully split, 1 = fully merged. */
  progress = 0;

  private readonly focus: Phaser.GameObjects.Zone;
  private readonly privateObjects: [GameObject[], GameObject[]] = [[], []];
  private othersVisibleOnLeft = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly p1: Phaser.GameObjects.Components.Transform & GameObject,
    private readonly p2: Phaser.GameObjects.Components.Transform & GameObject,
    worldBounds: Phaser.Geom.Rectangle,
  ) {
    const { width, height } = scene.scale;
    this.focus = scene.add.zone(p1.x, p1.y, 1, 1);

    this.left = scene.cameras.main.setViewport(0, 0, width / 2, height);
    this.right = scene.cameras.add(width / 2, 0, width / 2, height, false, 'right');

    for (const cam of [this.left, this.right]) {
      cam.setBounds(worldBounds.x, worldBounds.y, worldBounds.width, worldBounds.height);
      cam.setBackgroundColor(0x0b0d14).setZoom(BASE_ZOOM);
    }
    this.left.startFollow(this.focus, true, 0.15, 0.15);
    this.right.startFollow(p2, true, 0.15, 0.15);

    this.hideFromOther(0, p1);
    this.hideFromOther(1, p2);
  }

  get merged(): boolean {
    return this.progress >= 1;
  }

  /** The camera currently showing player `owner` (0 or 1). */
  cameraOf(owner: 0 | 1): Camera {
    return owner === 0 || this.merged ? this.left : this.right;
  }

  /**
   * Register objects that only one player may see while split, e.g. that
   * player's avatar, private clues or hidden paths. `owner` is 0 (left) or 1 (right).
   */
  hideFromOther(owner: 0 | 1, ...objects: GameObject[]): void {
    this.privateObjects[owner].push(...objects);
    const other = owner === 0 ? this.right : this.left;
    // P2's objects become visible on the left camera while merging.
    const visible = owner === 1 && this.othersVisibleOnLeft;
    for (const obj of objects) setVisibleOn(other, obj, visible);
  }

  /** Call every frame. `wantMerged` is true while both players share a merge zone. */
  update(wantMerged: boolean, deltaMs: number): void {
    const step = deltaMs / MERGE_DURATION;
    this.progress = Phaser.Math.Clamp(this.progress + (wantMerged ? step : -step), 0, 1);
    const e = Phaser.Math.Easing.Sine.InOut(this.progress);

    this.layoutViewports(e);
    this.setOthersVisibleOnLeft(this.progress > 0);
    this.updateFocus(e);
  }

  private layoutViewports(e: number): void {
    const { width, height } = this.scene.scale;
    const half = width / 2;
    const leftWidth = Math.round(half + e * half);
    this.left.setViewport(0, 0, leftWidth, height);
    // Keep the right camera at half width and slide it off screen, so its
    // framing of P2 doesn't squash while it leaves.
    this.right.setViewport(leftWidth, 0, half, height);
    this.right.setVisible(e < 1);
  }

  private setOthersVisibleOnLeft(visible: boolean): void {
    if (visible === this.othersVisibleOnLeft) return;
    this.othersVisibleOnLeft = visible;
    for (const obj of this.privateObjects[1]) setVisibleOn(this.left, obj, visible);
  }

  private updateFocus(e: number): void {
    const { p1, p2, left } = this;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    this.focus.setPosition(
      Phaser.Math.Linear(p1.x, midX, e),
      Phaser.Math.Linear(p1.y, midY, e),
    );

    const { width, height } = this.scene.scale;
    const fit = Math.min(
      width / (Math.abs(p1.x - p2.x) + MERGE_FRAMING_MARGIN),
      height / (Math.abs(p1.y - p2.y) + MERGE_FRAMING_MARGIN),
    );
    const mergedZoom = Phaser.Math.Clamp(fit, MERGE_MIN_ZOOM, BASE_ZOOM);
    left.setZoom(Phaser.Math.Linear(BASE_ZOOM, mergedZoom, e));
  }
}
