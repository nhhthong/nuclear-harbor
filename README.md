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
```

## Documents

- [docs/GDD.md](docs/GDD.md): game design document
- [docs/REVIEW.md](docs/REVIEW.md): design review and accepted defaults
- [docs/PLAN.md](docs/PLAN.md): architecture, interfaces, conventions, waves
- [docs/tickets/](docs/tickets/README.md): work tickets
- [docs/SPECKIT.md](docs/SPECKIT.md): per-ticket Spec Kit workflow
