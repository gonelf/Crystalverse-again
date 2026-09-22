import { BRUSHES, type Brush } from './brushes';
import type { Issue } from './validate';

export interface PanelActions {
  selectBrush(char: string): void;
  play(): void;
  undo(): void;
  redo(): void;
  fit(): void;
  save(): void;
  copy(): void;
  download(): void;
  importText(text: string): void;
  revert(): void;
  resize(cols: number, rows: number): void;
}

const CSS = `
.vault-editor {
  position: fixed; top: 0; right: 0; bottom: 0; width: 300px; z-index: 10;
  display: flex; flex-direction: column; gap: 10px; overflow-y: auto;
  padding: 14px; box-sizing: border-box;
  background: #11131c; border-left: 1px solid #2b3040;
  font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; color: #c9d2e6;
}
.vault-editor h1 { margin: 0; font-size: 14px; letter-spacing: .08em; text-transform: uppercase; color: #e8eefc; }
.vault-editor h2 { margin: 6px 0 0; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #7b85a3; }
.vault-editor .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.vault-editor button {
  font: inherit; color: #c9d2e6; background: #1b1f2c; border: 1px solid #2f3547;
  border-radius: 4px; padding: 5px 7px; cursor: pointer; text-align: left;
}
.vault-editor button:hover { background: #242a3a; }
.vault-editor button[aria-pressed="true"] { border-color: #8ad8ff; background: #1d2a36; color: #eaf6ff; }
.vault-editor .swatch { display: inline-block; width: 9px; height: 9px; margin-right: 6px; border: 1px solid #0006; vertical-align: -1px; }
.vault-editor .keycap { float: right; opacity: .5; }
.vault-editor .row { display: flex; gap: 6px; align-items: center; }
.vault-editor .row input { width: 54px; font: inherit; color: inherit; background: #1b1f2c; border: 1px solid #2f3547; border-radius: 4px; padding: 4px 6px; }
.vault-editor ul { margin: 0; padding-left: 16px; }
.vault-editor li { margin: 2px 0; }
.vault-editor .error { color: #ff8fa3; }
.vault-editor .warning { color: #ffd166; }
.vault-editor .ok { color: #7ce38b; }
.vault-editor .muted { color: #7b85a3; }
.vault-editor .status { min-height: 16px; }
`;

/**
 * The editor's side panel. Plain DOM over the canvas: buttons, the validation
 * report and the import/export box are all far easier this way than in-canvas,
 * and clicks on the panel never reach the painting surface.
 */
export class EditorPanel {
  private readonly root: HTMLDivElement;
  private readonly brushButtons = new Map<string, HTMLButtonElement>();
  private readonly issueList: HTMLUListElement;
  private readonly statusLine: HTMLParagraphElement;
  private readonly hoverLine: HTMLParagraphElement;
  private readonly colsInput: HTMLInputElement;
  private readonly rowsInput: HTMLInputElement;

  constructor(private readonly actions: PanelActions, canSave: boolean) {
    if (!document.getElementById('vault-editor-css')) {
      const style = document.createElement('style');
      style.id = 'vault-editor-css';
      style.textContent = CSS;
      document.head.append(style);
    }

    this.root = document.createElement('div');
    this.root.className = 'vault-editor';
    this.root.innerHTML = '<h1>Vault editor</h1>';

    const brushes = document.createElement('div');
    brushes.className = 'grid';
    for (const brush of BRUSHES) brushes.append(this.brushButton(brush));
    this.root.append(section('Brush'), brushes);

    this.hoverLine = document.createElement('p');
    this.hoverLine.className = 'muted';
    this.root.append(this.hoverLine);

    this.root.append(section('Checks'));
    this.issueList = document.createElement('ul');
    this.root.append(this.issueList);

    this.root.append(section('Layout'));
    const size = document.createElement('div');
    size.className = 'row';
    this.colsInput = numberInput();
    this.rowsInput = numberInput();
    size.append(label('cols'), this.colsInput, label('rows'), this.rowsInput);
    size.append(button('Resize', () => actions.resize(+this.colsInput.value, +this.rowsInput.value)));
    this.root.append(size);

    const tools = document.createElement('div');
    tools.className = 'grid';
    tools.append(
      button('▶ Playtest', actions.play, 'Enter'),
      button('Fit view', actions.fit, 'F'),
      button('Undo', actions.undo, '⌘Z'),
      button('Redo', actions.redo, '⇧⌘Z'),
    );
    this.root.append(tools);

    this.root.append(section('Save'));
    const save = document.createElement('div');
    save.className = 'grid';
    if (canSave) save.append(button('Save to file', actions.save, 'S'));
    save.append(
      button('Copy text', actions.copy),
      button('Download', actions.download),
      button('Paste…', () => {
        const text = prompt('Paste a layout:');
        if (text) actions.importText(text);
      }),
      button('Revert to file', () => {
        if (confirm('Throw away unsaved changes and reload the layout file?')) actions.revert();
      }),
    );
    this.root.append(save);

    this.statusLine = document.createElement('p');
    this.statusLine.className = 'status muted';
    this.root.append(this.statusLine);

    document.body.append(this.root);
  }

  private brushButton(brush: Brush): HTMLButtonElement {
    const el = button(brush.label, () => this.actions.selectBrush(brush.char), brush.key.trim() || '␣');
    el.prepend(swatch(brush.color));
    el.setAttribute('aria-pressed', 'false');
    el.dataset.char = brush.char;
    this.brushButtons.set(brush.char, el);
    return el;
  }

  setBrush(char: string): void {
    for (const [key, el] of this.brushButtons) el.setAttribute('aria-pressed', String(key === char));
  }

  setSize(cols: number, rows: number): void {
    this.colsInput.value = String(cols);
    this.rowsInput.value = String(rows);
  }

  setHover(text: string): void {
    this.hoverLine.textContent = text;
  }

  setStatus(text: string, tone: 'muted' | 'ok' | 'warning' | 'error' = 'muted'): void {
    this.statusLine.textContent = text;
    this.statusLine.className = `status ${tone}`;
  }

  setIssues(issues: readonly Issue[]): void {
    this.issueList.replaceChildren();
    if (!issues.length) {
      const li = document.createElement('li');
      li.className = 'ok';
      li.textContent = 'Looks playable.';
      this.issueList.append(li);
      return;
    }
    for (const issue of issues) {
      const li = document.createElement('li');
      li.className = issue.level;
      li.textContent = issue.at
        ? `${issue.message} (${issue.at.col}, ${issue.at.row})`
        : issue.message;
      this.issueList.append(li);
    }
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

function label(text: string): HTMLSpanElement {
  const el = document.createElement('span');
  el.className = 'muted';
  el.textContent = text;
  return el;
}

function numberInput(): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '3';
  input.max = '200';
  return input;
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
