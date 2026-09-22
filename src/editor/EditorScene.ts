import Phaser from 'phaser';
import { createGeneratedTextures, DUNGEON_TILESET, TEXTURES } from '../graphics/textures';
import {
  buildDungeon,
  clearDraft,
  DUNGEON_LAYOUT,
  layoutToText,
  loadDraft,
  parseLayout,
  saveDraft,
  TILE_SIZE,
  type LevelData,
} from '../levels';
import { puzzleColor } from '../puzzle/colors';
import { brushForKey, DEFAULT_BRUSH, ERASE_CHAR } from './brushes';
import { EditorPanel } from './EditorPanel';
import { validateLayout } from './validate';

const MAX_UNDO = 60;
const MIN_SIZE = 3;
const MAX_SIZE = 200;
const PAN_SPEED = 600;

/**
 * Paints the vault's ASCII layout with the art the game uses, so a puzzle can
 * be laid out, checked and playtested without leaving the browser. Edits live
 * in a draft until they are saved back to `dungeon.layout.txt`.
 */
export class EditorScene extends Phaser.Scene {
  private layout: string[] = [];
  private level!: LevelData;
  private brush = DEFAULT_BRUSH;
  private undoStack: string[][] = [];
  private redoStack: string[][] = [];

  private panel!: EditorPanel;
  private map!: Phaser.Tilemaps.Tilemap;
  private layers!: Record<'ground' | 'decor' | 'solid', Phaser.Tilemaps.TilemapLayer>;
  private entities!: Phaser.GameObjects.Group;
  private gridLines!: Phaser.GameObjects.Grid;
  private cursor!: Phaser.GameObjects.Rectangle;
  private painting: string | null = null;
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('editor');
  }

  preload(): void {
    this.load.image('overworld', 'assets/overworld.png');
    const frame = { frameWidth: 16, frameHeight: 32 };
    this.load.spritesheet('hero', 'assets/character.png', frame);
    this.load.spritesheet('hero-p2', 'assets/character-p2.png', frame);
  }

  create(): void {
    createGeneratedTextures(this);
    this.layout = loadDraft() ?? [...DUNGEON_LAYOUT];

    this.cameras.main.setBackgroundColor(0x0b0d14);
    this.entities = this.add.group();
    this.buildMap();

    this.cursor = this.add
      .rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(1, 0xffffff, 0.9)
      .setOrigin(0)
      .setDepth(41)
      .setVisible(false);

    this.panel = new EditorPanel(
      {
        selectBrush: (char) => this.selectBrush(char),
        play: () => this.play(),
        undo: () => this.undo(),
        redo: () => this.redo(),
        fit: () => this.fitView(),
        save: () => void this.saveToFile(),
        copy: () => void this.copyText(),
        download: () => this.download(),
        importText: (text) => this.replaceLayout(parseLayout(text)),
        revert: () => {
          clearDraft();
          this.replaceLayout([...DUNGEON_LAYOUT]);
          this.panel.setStatus('Reloaded the layout file.', 'ok');
        },
        resize: (cols, rows) => this.resize(cols, rows),
      },
      import.meta.env.DEV,
    );
    this.panel.setBrush(this.brush);

    this.setupInput();
    this.refresh();
    this.fitView();
    const saved = takeNote();
    if (saved) this.panel.setStatus(saved, 'ok');
    else this.panel.setStatus(loadDraft() ? 'Unsaved draft loaded.' : 'Matches the layout file.');

    if (import.meta.env.DEV) {
      (window as unknown as { coop: unknown }).coop = { scene: this, editor: this };
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.panel.destroy();
      this.game.canvas.oncontextmenu = null;
    });
  }

  update(_time: number, delta: number): void {
    const camera = this.cameras.main;
    const step = (PAN_SPEED * delta) / 1000 / camera.zoom;
    const { left, right, up, down } = this.keys;
    camera.scrollX += (Number(right.isDown) - Number(left.isDown)) * step;
    camera.scrollY += (Number(down.isDown) - Number(up.isDown)) * step;
  }

  // --- painting ------------------------------------------------------------

  private setupInput(): void {
    const keyboard = this.input.keyboard!;
    this.keys = {
      up: keyboard.addKey('UP'),
      down: keyboard.addKey('DOWN'),
      left: keyboard.addKey('LEFT'),
      right: keyboard.addKey('RIGHT'),
    };
    // Right-drag erases, so the canvas must not pop up a context menu.
    this.game.canvas.oncontextmenu = (event) => event.preventDefault();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      this.pushUndo();
      this.painting = p.rightButtonDown() ? ERASE_CHAR : this.brush;
      this.paintAt(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.moveCursor(p);
      if (p.middleButtonDown()) {
        const camera = this.cameras.main;
        camera.scrollX -= (p.x - p.prevPosition.x) / camera.zoom;
        camera.scrollY -= (p.y - p.prevPosition.y) / camera.zoom;
        return;
      }
      if (this.painting !== null) this.paintAt(p);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.painting = null));
    this.input.on(Phaser.Input.Events.GAME_OUT, () => (this.painting = null));
    this.input.on(
      Phaser.Input.Events.POINTER_WHEEL,
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const camera = this.cameras.main;
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.4, 6));
      },
    );

    keyboard.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    const key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
      event.shiftKey ? this.redo() : this.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 's') {
      event.preventDefault();
      void this.saveToFile();
      return;
    }
    if (key === 'Enter') return this.play();
    if (key === 'f' || key === 'F') return this.fitView();
    const brush = brushForKey(key);
    if (brush) this.selectBrush(brush.char);
  }

  private tileUnder(pointer: Phaser.Input.Pointer): { col: number; row: number } {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { col: Math.floor(world.x / TILE_SIZE), row: Math.floor(world.y / TILE_SIZE) };
  }

  private moveCursor(pointer: Phaser.Input.Pointer): void {
    const { col, row } = this.tileUnder(pointer);
    this.cursor.setPosition(col * TILE_SIZE, row * TILE_SIZE);
    const inside = this.inBounds(col, row);
    this.cursor.setVisible(inside);
    this.panel.setHover(inside ? `(${col}, ${row}) "${this.layout[row][col]}"` : '');
  }

  private paintAt(pointer: Phaser.Input.Pointer): void {
    const { col, row } = this.tileUnder(pointer);
    if (!this.inBounds(col, row) || this.painting === null) return;
    if (this.layout[row][col] === this.painting) return;
    this.setTile(col, row, this.painting);
    this.refresh();
  }

  private inBounds(col: number, row: number): boolean {
    return row >= 0 && row < this.layout.length && col >= 0 && col < this.layout[0].length;
  }

  private setTile(col: number, row: number, char: string): void {
    // Spawns and the brush that places them are unique, so move rather than duplicate.
    if (char === '1' || char === '2') this.eraseChar(char);
    const line = this.layout[row];
    this.layout[row] = line.slice(0, col) + char + line.slice(col + 1);
  }

  private eraseChar(char: string): void {
    this.layout = this.layout.map((line) => line.replaceAll(char, ERASE_CHAR));
  }

  private selectBrush(char: string): void {
    this.brush = char;
    this.panel.setBrush(char);
  }

  // --- layout state --------------------------------------------------------

  private pushUndo(): void {
    this.undoStack.push([...this.layout]);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push([...this.layout]);
    this.layout = previous;
    this.refresh();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push([...this.layout]);
    this.layout = next;
    this.refresh();
  }

  private replaceLayout(layout: string[]): void {
    if (!layout.length) return;
    this.pushUndo();
    this.layout = layout;
    this.buildMap();
    this.refresh();
    this.fitView();
  }

  private resize(cols: number, rows: number): void {
    const width = Phaser.Math.Clamp(Math.round(cols) || 0, MIN_SIZE, MAX_SIZE);
    const height = Phaser.Math.Clamp(Math.round(rows) || 0, MIN_SIZE, MAX_SIZE);
    if (width === this.layout[0].length && height === this.layout.length) return;
    // New space comes in as wall, which is what a new edge of a dungeon wants.
    const blank = '#'.repeat(width);
    const resized = Array.from({ length: height }, (_, r) =>
      (this.layout[r] ?? blank).slice(0, width).padEnd(width, '#'));
    this.replaceLayout(resized);
  }

  /** Rebuilds the level from the layout, redraws it, and re-runs the checks. */
  private refresh(): void {
    this.level = buildDungeon(this.layout, 'editor');
    this.drawTiles();
    this.drawEntities();
    this.panel.setIssues(validateLayout(this.layout));
    this.panel.setSize(this.level.cols, this.level.rows);
    saveDraft(this.layout);
  }

  // --- drawing -------------------------------------------------------------

  private buildMap(): void {
    this.map?.destroy();
    const level = buildDungeon(this.layout, 'editor');
    this.map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: level.cols,
      height: level.rows,
    });
    const tileset = this.map.addTilesetImage('tiles', DUNGEON_TILESET, TILE_SIZE, TILE_SIZE)!;
    const layer = (name: string, depth: number) =>
      this.map.createBlankLayer(name, tileset)!.setDepth(depth);
    this.layers = {
      ground: layer('ground', 0),
      decor: layer('decor', 1),
      solid: layer('solid', 2),
    };

    const width = level.cols * TILE_SIZE;
    const height = level.rows * TILE_SIZE;
    this.gridLines?.destroy();
    this.gridLines = this.add
      .grid(0, 0, width, height, TILE_SIZE, TILE_SIZE, undefined, 0, 0xffffff, 0.06)
      .setOrigin(0)
      .setDepth(40);
  }

  private drawTiles(): void {
    const { ground, decor, solid } = this.level;
    const put = (layer: Phaser.Tilemaps.TilemapLayer, data: number[][]) => {
      data.forEach((row, r) => row.forEach((tile, c) => {
        if (tile >= 0) layer.putTileAt(tile, c, r);
        else layer.removeTileAt(c, r);
      }));
    };
    put(this.layers.ground, ground);
    put(this.layers.decor, decor);
    put(this.layers.solid, solid);
  }

  private drawEntities(): void {
    this.entities.clear(true, true);
    const at = (col: number, row: number) => [(col + 0.5) * TILE_SIZE, (row + 0.5) * TILE_SIZE] as const;
    const add = (obj: Phaser.GameObjects.GameObject) => this.entities.add(obj);

    for (const exit of this.level.exits) {
      for (let r = 0; r < exit.rect.rows; r++) {
        for (let c = 0; c < exit.rect.cols; c++) {
          add(this.add.image(...at(exit.rect.col + c, exit.rect.row + r), TEXTURES.stairs).setDepth(5));
        }
      }
    }
    for (const plate of this.level.plates) {
      add(this.add.image(...at(plate.col, plate.row), TEXTURES.plateUp)
        .setTint(puzzleColor(plate.group))
        .setDepth(6));
    }
    for (const door of this.level.doors) {
      add(this.add.image(...at(door.col, door.row), TEXTURES.door)
        .setTint(puzzleColor(door.group))
        .setDepth(7));
    }
    for (const crate of this.level.crates) {
      add(this.add.image(...at(crate.col, crate.row), TEXTURES.crate).setDepth(8));
    }
    this.level.spawns.forEach((spawn, i) => {
      const [x, y] = at(spawn.col, spawn.row);
      add(this.add.image(x, y - 8, i === 0 ? 'hero' : 'hero-p2', 0).setDepth(9));
    });
  }

  private fitView(): void {
    const camera = this.cameras.main;
    const width = this.level.cols * TILE_SIZE;
    const height = this.level.rows * TILE_SIZE;
    // Leave room for the panel on the right.
    const zoom = Math.min((camera.width - 320) / width, (camera.height - 40) / height);
    camera.setZoom(Phaser.Math.Clamp(zoom, 0.4, 6));
    camera.centerOn(width / 2 + 160 / camera.zoom, height / 2);
  }

  // --- output --------------------------------------------------------------

  private play(): void {
    saveDraft(this.layout);
    const blocking = validateLayout(this.layout).filter((i) => i.level === 'error');
    if (blocking.length) {
      this.panel.setStatus(`Can't playtest: ${blocking[0].message}`, 'error');
      return;
    }
    this.scene.start('game', { levelId: 'dungeon' });
  }

  private async saveToFile(): Promise<void> {
    if (!import.meta.env.DEV) return;
    // Writing the layout file makes Vite reload the page, often before this
    // request settles, so clear the draft and leave the note up front and put
    // them back if the save turns out to have failed.
    const note = 'Saved to src/levels/dungeon.layout.txt';
    rememberNote(note);
    clearDraft();
    try {
      const response = await fetch('/__save-layout', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: layoutToText(this.layout),
      });
      if (!response.ok) throw new Error(await response.text());
      this.panel.setStatus(note, 'ok');
    } catch (error) {
      forgetNote();
      saveDraft(this.layout);
      this.panel.setStatus(`Save failed: ${String(error)}`, 'error');
    }
  }

  private async copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(layoutToText(this.layout));
      this.panel.setStatus('Layout copied to the clipboard.', 'ok');
    } catch {
      this.panel.setStatus('Clipboard blocked — use Download instead.', 'warning');
    }
  }

  private download(): void {
    const url = URL.createObjectURL(new Blob([layoutToText(this.layout)], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dungeon.layout.txt';
    link.click();
    URL.revokeObjectURL(url);
    this.panel.setStatus('Downloaded dungeon.layout.txt', 'ok');
  }
}

const NOTE_KEY = 'crystalverse.editor-note';
/** Saving can bounce the page more than once, so the note lingers this long. */
const NOTE_TTL_MS = 5000;

/** A message to carry across the reload that saving to the layout file triggers. */
function rememberNote(note: string): void {
  try {
    sessionStorage.setItem(NOTE_KEY, JSON.stringify({ note, at: Date.now() }));
  } catch {
    // The status line is a nicety; losing it is fine.
  }
}

function takeNote(): string | null {
  try {
    const raw = sessionStorage.getItem(NOTE_KEY);
    if (!raw) return null;
    const { note, at } = JSON.parse(raw) as { note: string; at: number };
    if (Date.now() - at < NOTE_TTL_MS) return note;
    sessionStorage.removeItem(NOTE_KEY);
    return null;
  } catch {
    return null;
  }
}

function forgetNote(): void {
  try {
    sessionStorage.removeItem(NOTE_KEY);
  } catch {
    // Nothing to forget.
  }
}
