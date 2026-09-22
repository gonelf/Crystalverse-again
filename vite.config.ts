import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any folder (itch.io, Electron, Tauri).
  base: './',
  // Phaser alone is ~1.2 MB minified.
  build: { chunkSizeWarningLimit: 2000 },
});
