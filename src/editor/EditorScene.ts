import Phaser from 'phaser';
import { solariaAvailable, SOLARIA_IMAGE, SOLARIA_TILESET } from '../graphics/solaria';
import { createGeneratedTextures, TEXTURES } from '../graphics/textures';
import {
  buildLevel,
  clearDraft,
  EXIT_MARKS,
  getLevelFile,
  isLevelIdSafe,
  levelIds,
  newLevel,
  saveDraft,
  savedLevelFile,
  SPAWN_CHARS,
  startLevel,
  TILE_SIZE,
  tilesetImage,
  type ExitConfig,
  type LevelData,
  type LevelFile,
  type TilesetKey,
} from '../levels';
import { puzzleColor } from '../puzzle/colors';
import { brushesFor, DEFAULT_BRUSH, ERASE_CHAR, type Brush } from './brushes';
import { EditorPanel } from './EditorPanel';
import { validateLevel, type Issue } from './validate';

const MAX_UNDO = 60;
const MIN_SIZE = 3;
const MAX_SIZE = 200;
const PAN_SPEED = 600;

/**
 * Paints any level with the art the game draws it with, so a map, its puzzles
 * and the doors between levels can be laid out, checked and playtested without
 * leaving the browser. Edits live in a draft until they are saved to the
 * level's file in `src/levels/data`.
 */
export class EditorScene extends Phaser.Scene {
  private id!: string;
  private file!: LevelFile;
  private level!: LevelData;
  private brushes: Brush[] = [];
  private brush = DEFAULT_BRUSH;
  private undoStack: LevelFile[] = [];
  private redoStack: LevelFile[] = [];

  private panel!: EditorPanel;
  private map?: Phaser.Tilemaps.Tilemap;
  private layers!: Record<'ground' | 'decor' | 'solid', Phaser.Tilemaps.TilemapLayer>;
  private entities!: Phaser.GameObjects.Group;
  private gridLines?: Phaser.GameObjects.Grid;
  private cursor!: Phaser.GameObjects.Rectangle;
  private painting: string | null = null;
  private keys!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('editor');
  }

  init(data: { levelId?: string }): void {
    this.id = data.levelId ?? levelFromQuery() ?? startLevel();
    this.undoStack = [];
    this.redoStack = [];
  }

  preload(): void {
    this.load.image('overworld', 'assets/overworld.png');
    const frame = { frameWidth: 16, frameHeight: 32 };
    this.load.spritesheet('hero', 'assets/character.png', frame);
    this.load.spritesheet('hero-p2', 'assets/character-p2.png', frame);
    this.load.spritesheet('slime', 'assets/slime.png', { frameWidth: 16, frameHeight: 16 });
    if (solariaAvailable()) this.load.image(SOLARIA_TILESET, SOLARIA_IMAGE);
  }

  create(): void {
    createGeneratedTextures(this);
    this.file = clone(getLevelFile(this.id) ?? blank());
    this.brushes = brushesFor(this.file.tileset);

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
        openLevel: (id) => this.openLevel(id),
        newLevel: () => this.createLevel(),
        setMeta: (patch) => this.setMeta(patch),
        setExit: (mark, patch) => this.setExit(mark, patch),
        play: () => this.play(),
        undo: () => this.undo(),
        redo: () => this.redo(),
        fit: () => this.fitView(),
        save: () => void this.saveToFile(),
        copy: () => void this.copyText(),
        download: () => this.download(),
        revert: () => this.revert(),
        resize: (cols, rows) => this.resize(cols, rows),
      },
      import.meta.env.DEV,
    );

    this.setupInput();
    this.refresh(false);
    this.fitView();
    const note = takeNote();
    if (note) this.panel.setStatus(note, 'ok');
    else this.panel.setStatus(this.isDirty() ? 'Unsaved draft.' : 'Matches the saved file.');

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
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.9 : 1.1), 0.2, 6));
      },
    );

    keyboard.on('keydown', (event: KeyboardEvent) => this.onKey(event));
  }

  private onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) return;
    const key = event.key;
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 'z') {
      if (event.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === 's') {
      event.preventDefault();
      void this.saveToFile();
      return;
    }
    if (key === 'Enter') return this.play();
    if (key === 'f' || key === 'F') return this.fitView();
    const brush = this.brushes.find((b) => b.key === key);
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
    this.panel.setHover(inside ? `(${col}, ${row}) "${this.file.layout[row][col]}"` : '');
  }

  private paintAt(pointer: Phaser.Input.Pointer): void {
    const { col, row } = this.tileUnder(pointer);
    if (!this.inBounds(col, row) || this.painting === null) return;
    if (this.file.layout[row][col] === this.painting) return;
    this.setTile(col, row, this.painting);
    this.refresh();
  }

  private inBounds(col: number, row: number): boolean {
    const { layout } = this.file;
    return row >= 0 && row < layout.length && col >= 0 && col < layout[0].length;
  }

  private setTile(col: number, row: number, char: string): void {
    // Spawns are unique, so painting one moves it rather than duplicating it.
    if (SPAWN_CHARS.includes(char)) this.eraseChar(char);
    const line = this.file.layout[row];
    this.file.layout[row] = line.slice(0, col) + char + line.slice(col + 1);
  }

  private eraseChar(char: string): void {
    this.file.layout = this.file.layout.map((line) => line.replaceAll(char, ERASE_CHAR));
  }

  private selectBrush(char: string): void {
    this.brush = char;
    this.refresh(false);
  }

  // --- level state ---------------------------------------------------------

  private pushUndo(): void {
    this.undoStack.push(clone(this.file));
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
  }

  private undo(): void {
    const previous = this.undoStack.pop();
    if (!previous) return;
    this.redoStack.push(clone(this.file));
    this.file = previous;
    this.buildMap();
    this.refresh();
  }

  private redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(clone(this.file));
    this.file = next;
    this.buildMap();
    this.refresh();
  }

  private setMeta(patch: Partial<LevelFile>): void {
    this.pushUndo();
    Object.assign(this.file, patch);
    if (patch.tileset) this.brushes = brushesFor(patch.tileset);
    this.refresh();
  }

  private setExit(mark: string, patch: Partial<ExitConfig>): void {
    this.pushUndo();
    const exits = { ...(this.file.exits ?? {}) };
    const current = exits[mark] ?? { to: '' };
    const next = { ...current, ...patch };
    if (!next.arriveAt) delete next.arriveAt;
    if (!next.label) delete next.label;
    exits[mark] = next;
    this.file.exits = exits;
    this.refresh();
  }

  private resize(cols: number, rows: number): void {
    const width = Phaser.Math.Clamp(Math.round(cols) || 0, MIN_SIZE, MAX_SIZE);
    const height = Phaser.Math.Clamp(Math.round(rows) || 0, MIN_SIZE, MAX_SIZE);
    const { layout } = this.file;
    if (width === layout[0].length && height === layout.length) return;
    this.pushUndo();
    // New space comes in as wall, which is what a new edge usually wants.
    const blank = '#'.repeat(width);
    this.file.layout = Array.from({ length: height }, (_, r) =>
      (layout[r] ?? blank).slice(0, width).padEnd(width, '#'));
    this.buildMap();
    this.refresh();
    this.fitView();
  }

  private openLevel(id: string): void {
    if (id === this.id) return;
    saveDraftIfDirty(this.id, this.file);
    this.scene.restart({ levelId: id });
  }

  private createLevel(): void {
    const id = prompt('New level id (lowercase, e.g. "crypt"):')?.trim().toLowerCase() ?? '';
    if (!id) return;
    if (!isLevelIdSafe(id)) {
      this.panel.setStatus('Ids are lowercase letters, numbers and dashes.', 'error');
      return;
    }
    const name = prompt('Level name:', id)?.trim() || id;
    const created = newLevel(id, name, this.file.tileset as TilesetKey);
    if (!created) {
      this.panel.setStatus(`"${id}" already exists.`, 'error');
      return;
    }
    saveDraftIfDirty(this.id, this.file);
    this.scene.restart({ levelId: id });
  }

  private revert(): void {
    clearDraft(this.id);
    const saved = savedLevelFile(this.id);
    if (!saved) {
      // A level that was never saved is gone once its draft is dropped.
      this.scene.restart({ levelId: startLevel() });
      return;
    }
    this.file = clone(saved);
    this.buildMap();
    this.refresh(false);
    this.fitView();
    this.panel.setStatus('Reloaded the saved level.', 'ok');
  }

  private isDirty(): boolean {
    return JSON.stringify(this.file) !== JSON.stringify(savedLevelFile(this.id) ?? null);
  }

  /** Rebuilds the level from the file, redraws it, and re-runs the checks. */
  private refresh(store = true): void {
    this.level = buildLevel(this.id, this.file);
    this.drawTiles();
    this.drawEntities();
    if (store) saveDraft(this.id, this.file);
    this.panel.render({
      id: this.id,
      ids: levelIds(),
      name: this.file.name,
      hint: this.file.hint ?? '',
      tileset: this.file.tileset,
      sharedView: Boolean(this.file.sharedView),
      start: Boolean(this.file.start),
      cols: this.level.cols,
      rows: this.level.rows,
      brushes: this.brushes,
      brush: this.brush,
      exits: this.exitRows(),
      issues: this.issues(),
      dirty: this.isDirty(),
    });
  }

  private exitRows() {
    const painted = [...EXIT_MARKS].filter((mark) => this.file.layout.some((row) => row.includes(mark)));
    const configured = Object.keys(this.file.exits ?? {}).filter((mark) => this.file.exits?.[mark]?.to);
    return [...new Set([...painted, ...configured])].sort().map((mark) => {
      const config = this.file.exits?.[mark];
      const target = config?.to ? getLevelFile(config.to) : undefined;
      const marksThere = [...EXIT_MARKS].filter((m) => target?.layout.some((row) => row.includes(m)));
      return { mark, config, marksThere };
    });
  }

  private issues(): Issue[] {
    return validateLevel(this.id, this.file, {
      ids: levelIds(),
      fileOf: (id) => (id === this.id ? this.file : getLevelFile(id)),
    });
  }

  // --- drawing -------------------------------------------------------------

  private buildMap(): void {
    this.map?.destroy();
    const level = buildLevel(this.id, this.file);
    this.map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width: level.cols,
      height: level.rows,
    });
    const tileset = this.map.addTilesetImage('tiles', tilesetImage(this.file.tileset), TILE_SIZE, TILE_SIZE)!;
    const layer = (name: string, depth: number) =>
      this.map!.createBlankLayer(name, tileset)!.setDepth(depth);
    this.layers = {
      ground: layer('ground', 0),
      decor: layer('decor', 1),
      solid: layer('solid', 2),
    };

    this.gridLines?.destroy();
    this.gridLines = this.add
      .grid(0, 0, level.cols * TILE_SIZE, level.rows * TILE_SIZE, TILE_SIZE, TILE_SIZE, undefined, 0, 0xffffff, 0.06)
      .setOrigin(0)
      .setDepth(40);
  }

  private drawTiles(): void {
    const put = (layer: Phaser.Tilemaps.TilemapLayer, data: number[][]) => {
      data.forEach((row, r) => row.forEach((tile, c) => {
        if (tile >= 0) layer.putTileAt(tile, c, r);
        else layer.removeTileAt(c, r);
      }));
    };
    put(this.layers.ground, this.level.ground);
    put(this.layers.decor, this.level.decor);
    put(this.layers.solid, this.level.solid);
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
      const [x, y] = at(exit.rect.col + (exit.rect.cols - 1) / 2, exit.rect.row);
      add(this.add.text(x, y - TILE_SIZE, `${exit.mark}→${exit.to || '?'}`, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: exit.to ? '#ffd166' : '#ff8fa3',
        stroke: '#05070d',
        strokeThickness: 3,
      }).setOrigin(0.5).setDepth(30));
    }
    for (const plate of this.level.plates) {
      add(this.add.image(...at(plate.col, plate.row), TEXTURES.plateUp)
        .setTint(puzzleColor(plate.group)).setDepth(6));
    }
    for (const door of this.level.doors) {
      add(this.add.image(...at(door.col, door.row), TEXTURES.door)
        .setTint(puzzleColor(door.group)).setDepth(7));
    }
    for (const crate of this.level.crates) {
      add(this.add.image(...at(crate.col, crate.row), TEXTURES.crate).setDepth(8));
    }
    for (const mob of this.level.mobs) {
      const [x, y] = at(mob.col, mob.row);
      add(this.add.image(x, y, 'slime', mob.kind === 'green' ? 0 : 4).setDepth(8));
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
    const zoom = Math.min((camera.width - 330) / width, (camera.height - 40) / height);
    camera.setZoom(Phaser.Math.Clamp(zoom, 0.2, 6));
    camera.centerOn(width / 2 + 165 / camera.zoom, height / 2);
  }

  // --- output --------------------------------------------------------------

  private play(): void {
    saveDraft(this.id, this.file);
    const blocking = this.issues().filter((i) => i.level === 'error');
    if (blocking.length) {
      this.panel.setStatus(`Can't playtest: ${blocking[0].message}`, 'error');
      return;
    }
    this.scene.start('game', { levelId: this.id });
  }

  private async saveToFile(): Promise<void> {
    if (!import.meta.env.DEV) return;
    const note = `Saved src/levels/data/${this.id}.json`;
    // Writing the file makes Vite reload the page, often before this request
    // settles, so leave the note and clear the draft up front.
    rememberNote(note);
    clearDraft(this.id);
    try {
      const response = await fetch('/__save-level', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: this.id, file: this.file }),
      });
      if (!response.ok) throw new Error(await response.text());
      this.panel.setStatus(note, 'ok');
    } catch (error) {
      forgetNote();
      saveDraft(this.id, this.file);
      this.panel.setStatus(`Save failed: ${String(error)}`, 'error');
    }
  }

  private async copyText(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.json());
      this.panel.setStatus('Level JSON copied to the clipboard.', 'ok');
    } catch {
      this.panel.setStatus('Clipboard blocked — use Download instead.', 'warning');
    }
  }

  private download(): void {
    const url = URL.createObjectURL(new Blob([this.json()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.panel.setStatus(`Downloaded ${this.id}.json — put it in src/levels/data.`, 'ok');
  }

  private json(): string {
    return `${JSON.stringify(this.file, null, 2)}\n`;
  }
}

function clone(file: LevelFile): LevelFile {
  return JSON.parse(JSON.stringify(file)) as LevelFile;
}

function blank(): LevelFile {
  return { name: 'New level', tileset: 'dungeon', layout: ['###', '#.#', '###'] };
}

function saveDraftIfDirty(id: string, file: LevelFile): void {
  if (JSON.stringify(file) !== JSON.stringify(savedLevelFile(id) ?? null)) saveDraft(id, file);
}

/** `?level=<id>` opens that level in the editor. */
function levelFromQuery(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  return new URLSearchParams(location.search).get('level') ?? undefined;
}

const NOTE_KEY = 'crystalverse.editor-note';
/** Saving can bounce the page more than once, so the note lingers this long. */
const NOTE_TTL_MS = 5000;

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
