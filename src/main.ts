import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';
import { EditorScene } from './editor/EditorScene';
import { probeSolaria } from './graphics/solaria';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';

// Phaser starts the first scene in the list, so `?edit` opens the vault editor.
const editing = new URLSearchParams(location.search).has('edit');

// Settled before the first level is built, so a level drawn with art that is
// not installed falls back to the code-drawn tiles instead of loading nothing.
await probeSolaria();

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
