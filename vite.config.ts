import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const LEVEL_DIR = 'src/levels/data';
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_SIDE = 200;

interface LevelFile {
  name?: unknown;
  tileset?: unknown;
  layout?: unknown;
}

/** Rejects anything that isn't a level the game could load. */
function problemWith(file: LevelFile): string | null {
  if (!file || typeof file !== 'object') return 'Not a level';
  if (typeof file.name !== 'string') return 'Missing name';
  if (file.tileset !== 'overworld' && file.tileset !== 'dungeon') return 'Unknown tileset';
  const layout = file.layout;
  if (!Array.isArray(layout) || !layout.length) return 'Missing layout';
  if (layout.length > MAX_SIDE) return 'Too many rows';
  const width = typeof layout[0] === 'string' ? layout[0].length : -1;
  if (width < 1 || width > MAX_SIDE) return 'Bad row width';
  if (layout.some((row) => typeof row !== 'string' || row.length !== width)) {
    return 'Rows differ in width';
  }
  return null;
}

/**
 * Lets the in-game editor write a level back to the repo while `npm run dev`
 * is running. Dev only: a built game has no server to save to, and falls back
 * to copy/download.
 */
function levelSaver(): Plugin {
  return {
    name: 'crystalverse:level-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-level', (req, res) => {
        const fail = (code: number, message: string) => {
          res.statusCode = code;
          res.end(message);
        };
        if (req.method !== 'POST') return fail(405, 'POST a level');

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 4_000_000) req.destroy();
        });
        req.on('end', () => {
          let payload: { id?: unknown; file?: LevelFile };
          try {
            payload = JSON.parse(body) as { id?: unknown; file?: LevelFile };
          } catch {
            return fail(400, 'Body is not JSON');
          }
          const id = payload.id;
          if (typeof id !== 'string' || !ID.test(id)) return fail(400, 'Bad level id');
          const problem = payload.file ? problemWith(payload.file) : 'Missing level';
          if (problem) return fail(400, problem);

          const file = path.resolve(server.config.root, LEVEL_DIR, `${id}.json`);
          writeFile(file, `${JSON.stringify(payload.file, null, 2)}\n`, 'utf8')
            .then(() => res.end(`Saved ${LEVEL_DIR}/${id}.json`))
            .catch((error: unknown) => fail(500, String(error)));
        });
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths so the build runs from any folder (itch.io, Electron, Tauri).
  base: './',
  // Phaser alone is ~1.2 MB minified.
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [levelSaver()],
});
