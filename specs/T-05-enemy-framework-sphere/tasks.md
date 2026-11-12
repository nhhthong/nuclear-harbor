# Tasks: T-05

- [x] T001 Tests then code: StateMachine, AIUpdateScheduler (`src/enemies/*.test.ts`)
- [x] T002 Tests then code: NavGrid (A*, no corner cutting, smoothing) + bake (`nav/`)
- [x] T003 Tests then code: sphereBrain decision function
- [x] T004 BaseEnemy, perception, SharedAssets, EnemyDeps/EnemyFactory
- [x] T005 EnemyProjectiles pool + test
- [x] T006 SphereRobot + spider/charger stubs + factories
- [x] T007 population.ts + test
- [x] T008 EnemyManager + index.ts (events, testHooks, defend/respawn) + headless integration tests
- [x] T009 contracts/enemy-framework.md
- [x] T010 e2e `tests/e2e/T-05-enemy-framework-sphere.e2e.mjs`
- [x] T011 typecheck, test, build, smoke, e2e

Notes: nav bake measured 49 ms (harbor 160x147 cells, empty world) and 26 ms (sandbox) in headless Chromium.
`EnemyDeps` gained `shared` (SharedAssets) and `enemies` (live list) beyond the ticket's list; see contracts/enemy-framework.md.
Deviation: if the nav bake finds no ground at all (world module absent), the land is treated as open so the framework stays testable.
Foundation requests: none.
