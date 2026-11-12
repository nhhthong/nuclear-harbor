# Last Stand: Nuclear Harbor

Browser FPS (Three.js + TypeScript + Vite + Rapier). Design: [docs/GDD.md](docs/GDD.md).

## Develop

```bash
npm install
npm run dev          # http://localhost:5173/  (add ?sandbox for the test scene, ?autostart to skip the menu)
npm run typecheck
npm test             # Vitest unit tests
npm run build
npm run smoke        # Playwright: built app boots, renders, no console errors
npm run e2e          # per-ticket browser checks in tests/e2e/
npm run check        # typecheck + test + build + smoke
npm run offline      # built game boots with the network blocked after one load
npm run leakcheck    # dispose/re-create cycles return resources to baseline
npm run bench        # 3 scenes x 3 quality presets (software GL: relative numbers only)
```

## Play offline / install

The production build (`npm run build`, served over `http://localhost` or HTTPS) registers a hand-written service worker
that precaches every built file including the weapon model. Open the game once while online and wait a few seconds
(the first load downloads about 7 MB); after that it starts with no network, and the browser offers to install it
(address bar install icon, or menu "Install Last Stand: Nuclear Harbor"). Details, updates and cache reset:
[docs/OFFLINE.md](docs/OFFLINE.md). The service worker is not registered by `npm run dev`.

## Measure on a real machine

Open the built game with `?autostart&bench=20` (add `&sandbox` for the small scene), keep the tab focused for 20 s and
copy the `BENCH {json}` line from the developer console. See [docs/PERFORMANCE.md](docs/PERFORMANCE.md).

## Documents

- [docs/GDD.md](docs/GDD.md): game design document
- [docs/REVIEW.md](docs/REVIEW.md): design review and accepted defaults
- [docs/PLAN.md](docs/PLAN.md): architecture, interfaces, conventions, waves
- [docs/tickets/](docs/tickets/README.md): work tickets
- [docs/SPECKIT.md](docs/SPECKIT.md): per-ticket Spec Kit workflow
