import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { buildPrecacheList, fillServiceWorker } from './src/offline/manifest.ts';

function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

/**
 * Offline packaging (T-17, GDD 14): after the bundle and public/ files are written, list every
 * built file, hash them into a version and write the final `dist/sw.js` from the hand-written
 * `public/sw.js` template. No runtime dependency, no CDN.
 */
function offlinePrecachePlugin(): Plugin {
  let outDir = 'dist';
  let rootDir = process.cwd();
  return {
    name: 'nh-offline-precache',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
      rootDir = config.root;
    },
    closeBundle() {
      const dist = path.resolve(rootDir, outDir);
      const files = walk(dist);
      const list = buildPrecacheList(files);
      const hash = createHash('sha256');
      for (const f of list) if (f !== './') hash.update(f).update(readFileSync(path.join(dist, f)));
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(path.join(dist, 'sw.js'), 'utf8');
      writeFileSync(path.join(dist, 'sw.js'), fillServiceWorker(template, version, list));
      console.log(`[offline] sw.js: version ${version}, ${list.length} precached entries`);
    },
  };
}

export default defineConfig({
  // Relative base so the build can be served from any static host / sub-path (GDD 12.1, 14).
  base: './',
  plugins: [offlinePrecachePlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    minify: 'oxc',
    cssMinify: true,
    // T-17: vendor chunks. three and Rapier (WASM embedded as base64) change rarely, so they are
    // cached/precached separately from the game code and download in parallel.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/@dimforge/')) return 'vendor-rapier';
          if (id.includes('node_modules/three/')) return 'vendor-three';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
});
