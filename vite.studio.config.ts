// vite.studio.config.ts — the standalone Content Studio site.
//
// Run with:  npm run studio        (dev server on :5180, writes edits straight to disk)
//            npm run studio:build   (static build → dist-studio/)
//
// Deliberately separate from vite.config.ts: no PWA service worker (a dev tool shouldn't install
// one) and it mounts contentFsPlugin(), which the games app must never have. The Studio shares the
// dataset descriptors + source JSON under src/, but loads none of the games' screens/logic.
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { contentFsPlugin } from './tools/vite-content-fs';

// Serve studio.html at "/" on the dev server (the repo's index.html is the *games* app — we never
// want the Studio server to serve that). Runs before Vite's built-in html middleware.
function studioIndexPlugin(): Plugin {
  return {
    name: 'studio-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/' || req.url === '/index.html') req.url = '/studio.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [studioIndexPlugin(), react(), tailwindcss(), contentFsPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 5280: away from the games app (5173) and other local dev servers. If it's busy, Vite picks
    // the next free port and prints the URL.
    port: 5280,
    open: '/studio.html',
    // The Studio IS the editor of these files — its own autosaves must not trigger an HMR/reload
    // mid-edit. React state is authoritative during a session; a manual refresh re-reads from disk.
    watch: { ignored: ['**/src/games/**/*.json'] },
  },
  build: {
    outDir: 'dist-studio',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./studio.html', import.meta.url)),
    },
  },
});
