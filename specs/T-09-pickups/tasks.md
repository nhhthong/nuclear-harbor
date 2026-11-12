# Tasks: Pickups

- [x] T001 Local tunables `src/pickups/tunables.ts`
- [x] T002 Tests first: `logic.test.ts` (collect, shouldDrop, blink, findRestingSpot) [AC1, AC3]
- [x] T003 `logic.ts` pure functions
- [x] T004 Tests first: `placements.test.ts` (14/10/8/3 counts, zone split, land, elevated, budget vs GDD 5.4 at 50%) [AC2, AC4]
- [x] T005 `placements.ts`
- [x] T006 `visuals.ts` instanced renderer, 2 draw calls [AC5]
- [x] T007 `index.ts` module: placement on world:ready, boss supplies, collection, drops, respawn, sandbox, hooks, dispose [AC1-AC3, AC6, AC7]
- [x] T008 e2e `tests/e2e/T-09-pickups.e2e.mjs` [AC1, AC6]
- [x] T009 typecheck, test, build, smoke, e2e

AC map: AC1 logic test + e2e; AC2 placements test; AC3 logic test; AC4 placements test; AC5 visuals (2 instanced meshes, e2e checks mesh count);
AC6 e2e + code; AC7 code (no allocation in `fixedUpdate`, dispose test in e2e is manual check via scene child count).
