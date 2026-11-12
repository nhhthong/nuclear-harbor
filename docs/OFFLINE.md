# Offline play and installation (T-17, GDD 14)

The game needs no server logic and no third-party origin. The production build ships a hand-written service worker
(`public/sw.js`, no library) that makes it playable without a network after one online load.

## Preload (first load)

1. Serve `dist/` from any static host over HTTPS or `http://localhost` (service workers need a secure context).
2. Open the game once while online and keep the tab open for a few seconds. The worker precaches every built file
   (page, the three JS chunks, manifest, icons and the G36C GLB, about 7 MB in total). `npm run offline` proves this
   automatically: it loads the build, blocks the network, reloads, and requires the game to reach `playing`.
3. From then on the game starts with the network off. Query flags such as `?autostart` work offline too.

## Install

Chromium browsers: install icon in the address bar, or menu "Install Last Stand: Nuclear Harbor". The web manifest
(`manifest.webmanifest`) sets fullscreen display, landscape, and procedurally generated icons (`npm run icons`).
Safari/Firefox: bookmark the page; offline works after the first load without installing.

## How updates work

`npm run build` writes `dist/sw.js` with a version (hash of all built files) and the precache list. When a player
opens a new deployment the browser sees a changed `sw.js`, installs it in the background, downloads only files whose
names it does not already hold (content-hashed `.js` files are reused from the old cache), activates immediately and
deletes older `nh-*` caches. The new version is used from the next page load.

Strategy: cache-first for same-origin GET requests (query string ignored), with the cached page as navigation fallback.
Cross-origin requests are not intercepted (and the game makes none; `npm run offline` asserts this).

## Clear the cache / reset

- DevTools: Application, Storage, "Clear site data" (removes cache, service worker and saved settings).
- Or only the worker: Application, Service Workers, Unregister; then Cache Storage, delete `nh-<version>`.
- Settings and best result live in LocalStorage and are unaffected by cache deletion alone.

## Development

`npm run dev` does not register the worker (production builds only), so hot reload is unaffected. To test locally:
`npm run build && npm run preview`, open http://localhost:4173/.
