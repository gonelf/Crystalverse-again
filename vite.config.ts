import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const LAYOUT_FILE = 'src/levels/dungeon.layout.txt';
/** Wall, floor, crack, void, crate, exit, spawns, and plate/door groups a-f. */
const LAYOUT_CHARS = /^[#., o1-2XabcdefABCDEF]*$/;
const MAX_SIDE = 200;

/**
 * Lets the in-game vault editor write the layout back to the repo while
 * `npm run dev` is running. Dev only: a built game has no server to save to,
 * and falls back to copy/download.
 */
function layoutSaver(): Plugin {
  return {
    name: 'crystalverse:layout-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-layout', (req, res) => {
        const fail = (code: number, message: string) => {
          res.statusCode = code;
          res.end(message);
        };
        if (req.method !== 'POST') return fail(405, 'POST a layout');

        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk: string) => {
          body += chunk;
          if (body.length > 1_000_000) req.destroy();
        });
        req.on('end', () => {
          const rows = body.replace(/\r/g, '').split('\n').filter((row, i, all) =>
            row.length > 0 || i < all.length - 1);
          const width = rows[0]?.length ?? 0;
          if (!rows.length || rows.length > MAX_SIDE || width > MAX_SIDE) {
            return fail(400, 'Layout is empty or too big');
          }
          if (rows.some((row) => row.length !== width)) return fail(400, 'Rows differ in width');
          if (rows.some((row) => !LAYOUT_CHARS.test(row))) return fail(400, 'Unknown characters');

          const file = path.resolve(server.config.root, LAYOUT_FILE);
          writeFile(file, `${rows.join('\n')}\n`, 'utf8')
            .then(() => res.end(`Saved ${rows.length} rows to ${LAYOUT_FILE}`))
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
  plugins: [layoutSaver()],
});
