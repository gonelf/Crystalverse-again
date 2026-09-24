import type { ExitConfig, TilesetKey } from '../levels';
import { TILESETS } from '../levels';
import type { Brush } from './brushes';
import type { Issue } from './validate';

export interface ExitRow {
  mark: string;
  config: ExitConfig | undefined;
  /** Exit marks painted in the level this exit leads to. */
  marksThere: string[];
}

export interface PanelActions {
  selectBrush(char: string): void;
  openLevel(id: string): void;
  newLevel(): void;
  setMeta(patch: { name?: string; hint?: string; tileset?: TilesetKey; sharedView?: boolean; start?: boolean }): void;
  setExit(mark: string, patch: Partial<ExitConfig>): void;
  play(): void;
  undo(): void;
  redo(): void;
  fit(): void;
  save(): void;
  copy(): void;
  download(): void;
  revert(): void;
  resize(cols: number, rows: number): void;
}

export interface PanelState {
  id: string;
  ids: string[];
  name: string;
  hint: string;
  tileset: TilesetKey;
  sharedView: boolean;
  start: boolean;
  cols: number;
  rows: number;
  brushes: Brush[];
  brush: string;
  exits: ExitRow[];
  issues: Issue[];
  dirty: boolean;
}

const CSS = `
.vault-editor {
  position: fixed; top: 0; right: 0; bottom: 0; width: 310px; z-index: 10;
  display: flex; flex-direction: column; gap: 8px; overflow-y: auto;
  padding: 14px; box-sizing: border-box;
  background: #11131c; border-left: 1px solid #2b3040;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #c9d2e6;
}
.vault-editor h1 { margin: 0; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #e8eefc; }
.vault-editor h2 { margin: 8px 0 0; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #7b85a3; }
.vault-editor .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.vault-editor button, .vault-editor select, .vault-editor input {
  font: inherit; color: #c9d2e6; background: #1b1f2c; border: 1px solid #2f3547;
  border-radius: 4px; padding: 5px 7px; box-sizing: border-box;
}
.vault-editor button { cursor: pointer; text-align: left; }
.vault-editor button:hover { background: #242a3a; }
.vault-editor button[aria-pressed="true"] { border-color: #8ad8ff; background: #1d2a36; color: #eaf6ff; }
.vault-editor .swatch { display: inline-block; width: 9px; height: 9px; margin-right: 6px; border: 1px solid #0006; vertical-align: -1px; }
.vault-editor .keycap { float: right; opacity: .5; }
.vault-editor .row { display: flex; gap: 6px; align-items: center; }
.vault-editor .row > * { min-width: 0; }
.vault-editor .row input[type="number"] { width: 52px; }
.vault-editor label.check { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.vault-editor input[type="checkbox"] { width: auto; }
.vault-editor .wide { width: 100%; }
.vault-editor .exit { border: 1px solid #2b3040; border-radius: 4px; padding: 6px; display: grid; gap: 4px; }
.vault-editor ul { margin: 0; padding-left: 16px; }
.vault-editor li { margin: 2px 0; }
.vault-editor .error { color: #ff8fa3; }
.vault-editor .warning { color: #ffd166; }
.vault-editor .ok { color: #7ce38b; }
.vault-editor .muted { color: #7b85a3; }
.vault-editor .status { min-height: 16px; }
`;

/**
 * The editor's side panel. Plain DOM over the canvas: the level picker, the
 * settings, the validation report and the exit wiring are all far easier this
 * way than in-canvas, and clicks on the panel never reach the painting surface.
 */
export class EditorPanel {
  private readonly root: HTMLDivElement;
  private readonly body: HTMLDivElement;
  private readonly statusLine: HTMLParagraphElement;
  private readonly hoverLine: HTMLParagraphElement;
  private readonly brushButtons = new Map<string, HTMLButtonElement>();

  constructor(private readonly actions: PanelActions, private readonly canSave: boolean) {
    if (!document.getElementById('vault-editor-css')) {
      const style = document.createElement('style');
      style.id = 'vault-editor-css';
      style.textContent = CSS;
      document.head.append(style);
    }
    this.root = document.createElement('div');
    this.root.className = 'vault-editor';

    const title = document.createElement('h1');
    title.textContent = 'Level editor';
    this.body = document.createElement('div');
    this.body.style.display = 'contents';
    this.hoverLine = document.createElement('p');
    this.hoverLine.className = 'muted';
    this.statusLine = document.createElement('p');
    this.statusLine.className = 'status muted';

    this.root.append(title, this.body);
    document.body.append(this.root);
  }

  /** Rebuilds the panel. Cheap enough to do on every edit, and keeps it honest. */
  render(state: PanelState): void {
    const scroll = this.root.scrollTop;
    this.brushButtons.clear();
    this.body.replaceChildren();
    const add = (...nodes: Node[]) => this.body.append(...nodes);

    add(section('Level'));
    const levelRow = document.createElement('div');
    levelRow.className = 'row';
    const picker = select(state.ids, state.id, (id) => this.actions.openLevel(id));
    picker.classList.add('wide');
    levelRow.append(picker, button('New…', () => this.actions.newLevel()));
    add(levelRow);

    add(section('Settings'));
    add(
      labelled('Name', input(state.name, (v) => this.actions.setMeta({ name: v }))),
      labelled('Hint', input(state.hint, (v) => this.actions.setMeta({ hint: v }))),
      labelled('Art', select([...TILESETS], state.tileset, (v) =>
        this.actions.setMeta({ tileset: v as TilesetKey }))),
      checkbox('Shared camera (dungeon)', state.sharedView, (v) => this.actions.setMeta({ sharedView: v })),
      checkbox('Starting level', state.start, (v) => this.actions.setMeta({ start: v })),
    );

    add(section('Checks'));
    add(issueList(state.issues));

    add(section('Exits'));
    if (!state.exits.length) {
      add(muted('Paint an X, Y or Z, then say where it leads.'));
    }
    for (const exit of state.exits) add(this.exitRow(state, exit));

    add(section('Brush'));
    for (const name of [...new Set(state.brushes.map((b) => b.section))]) {
      add(muted(name));
      const row = document.createElement('div');
      row.className = 'grid';
      for (const brush of state.brushes.filter((b) => b.section === name)) {
        row.append(this.brushButton(brush, state.brush));
      }
      add(row);
    }

    add(section('Size'));
    const size = document.createElement('div');
    size.className = 'row';
    const cols = number(state.cols);
    const rows = number(state.rows);
    size.append(muted('cols'), cols, muted('rows'), rows,
      button('Resize', () => this.actions.resize(Number(cols.value), Number(rows.value))));
    add(size);

    const tools = document.createElement('div');
    tools.className = 'grid';
    tools.append(
      button('▶ Playtest', () => this.actions.play(), 'Enter'),
      button('Fit view', () => this.actions.fit(), 'F'),
      button('Undo', () => this.actions.undo(), '⌘Z'),
      button('Redo', () => this.actions.redo(), '⇧⌘Z'),
    );
    add(tools);

    add(section('Save'));
    const save = document.createElement('div');
    save.className = 'grid';
    if (this.canSave) save.append(button('Save to file', () => this.actions.save(), 'S'));
    save.append(
      button('Copy JSON', () => this.actions.copy()),
      button('Download', () => this.actions.download()),
      button('Discard draft', () => {
        if (confirm('Throw away unsaved changes to this level?')) this.actions.revert();
      }),
    );
    add(save);
    add(muted(this.canSave
      ? 'Save writes src/levels/data — commit and push it to put the level in the game for everyone.'
      : 'No dev server here: download the JSON into src/levels/data, then commit it.'));
    add(this.statusLine, this.hoverLine);

    this.root.scrollTop = scroll;
  }

  private exitRow(state: PanelState, exit: ExitRow): HTMLElement {
    const box = document.createElement('div');
    box.className = 'exit';
    const targets = ['', ...state.ids.filter((id) => id !== undefined)];
    const arrivals = ['', ...exit.marksThere];
    box.append(
      labelled(`Exit ${exit.mark} leads to`, select(targets, exit.config?.to ?? '', (v) =>
        this.actions.setExit(exit.mark, { to: v }))),
      labelled('Label', input(exit.config?.label ?? '', (v) => this.actions.setExit(exit.mark, { label: v }))),
      labelled('Arrive at', select(arrivals, exit.config?.arriveAt ?? '', (v) =>
        this.actions.setExit(exit.mark, { arriveAt: v }), { '': 'that level’s spawn' })),
    );
    return box;
  }

  private brushButton(brush: Brush, selected: string): HTMLButtonElement {
    const el = button(brush.label, () => this.actions.selectBrush(brush.char), brush.key.trim() || '␣');
    el.prepend(swatch(brush.color));
    el.setAttribute('aria-pressed', String(brush.char === selected));
    this.brushButtons.set(brush.char, el);
    return el;
  }

  setHover(text: string): void {
    this.hoverLine.textContent = text;
  }

  setStatus(text: string, tone: 'muted' | 'ok' | 'warning' | 'error' = 'muted'): void {
    this.statusLine.textContent = text;
    this.statusLine.className = `status ${tone}`;
  }

  destroy(): void {
    this.root.remove();
  }
}

function section(title: string): HTMLHeadingElement {
  const h = document.createElement('h2');
  h.textContent = title;
  return h;
}

function muted(text: string): HTMLParagraphElement {
  const p = document.createElement('p');
  p.className = 'muted';
  p.style.margin = '2px 0';
  p.textContent = text;
  return p;
}

function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('label');
  wrap.style.display = 'grid';
  wrap.style.gap = '2px';
  const span = document.createElement('span');
  span.className = 'muted';
  span.textContent = text;
  control.classList.add('wide');
  wrap.append(span, control);
  return wrap;
}

function input(value: string, onChange: (value: string) => void): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value;
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function number(value: number): HTMLInputElement {
  const el = document.createElement('input');
  el.type = 'number';
  el.min = '3';
  el.max = '200';
  el.value = String(value);
  return el;
}

function select(
  options: readonly string[],
  value: string,
  onChange: (value: string) => void,
  labels: Record<string, string> = {},
): HTMLSelectElement {
  const el = document.createElement('select');
  for (const option of options) {
    const node = document.createElement('option');
    node.value = option;
    node.textContent = labels[option] ?? (option || '—');
    el.append(node);
  }
  el.value = value;
  el.addEventListener('change', () => onChange(el.value));
  return el;
}

function checkbox(text: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'check';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = checked;
  box.addEventListener('change', () => onChange(box.checked));
  const span = document.createElement('span');
  span.textContent = text;
  wrap.append(box, span);
  return wrap;
}

function issueList(issues: readonly Issue[]): HTMLUListElement {
  const list = document.createElement('ul');
  if (!issues.length) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = 'Looks playable.';
    list.append(li);
    return list;
  }
  for (const issue of issues) {
    const li = document.createElement('li');
    li.className = issue.level;
    li.textContent = issue.at ? `${issue.message} (${issue.at.col}, ${issue.at.row})` : issue.message;
    list.append(li);
  }
  return list;
}

function button(text: string, onClick: () => void, key?: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.append(document.createTextNode(text));
  if (key) {
    const cap = document.createElement('span');
    cap.className = 'keycap';
    cap.textContent = key;
    el.append(cap);
  }
  el.addEventListener('click', onClick);
  return el;
}

function swatch(color: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'swatch';
  el.style.background = color;
  return el;
}
