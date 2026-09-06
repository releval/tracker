import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // The more specific subpath must come first so it matches before the base entry.
      '@releval/tracker/react': path.resolve(__dirname, '../../src/tracker/dist/react.mjs'),
      '@releval/tracker': path.resolve(__dirname, '../../src/tracker/dist/releval-tracker.mjs')
    }
  }
});
