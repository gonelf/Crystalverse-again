import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { EditorScene } from './editor/EditorScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

// Phaser starts the first scene in the list, so `?edit` opens the vault editor.
const editing = new URLSearchParams(location.search).has('edit');

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#05060a',
  pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: false } },
  input: { gamepad: true },
  scene: editing ? [EditorScene, GameScene, UIScene] : [GameScene, UIScene, EditorScene],
});
