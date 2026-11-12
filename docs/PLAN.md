# Execution Plan — Last Stand: Nuclear Harbor

> **Tóm tắt (VI):** GDD v1.2 khả thi cho web. Nền móng (foundation) đã có sẵn trên nhánh này: dự án
> Vite + TypeScript strict, vòng lặp fixed-step, input, event bus có kiểu, Rapier, `tunables.ts`
> chứa toàn bộ số liệu GDD, hợp đồng layout bản đồ, cảnh sandbox, Vitest và smoke test. Công việc
> còn lại được chia thành 18 ticket theo 4 đợt (wave). 11 ticket của wave 1 chạy song song ngay,
> mỗi ticket sở hữu riêng một thư mục nên không xung đột khi merge. Mỗi ticket đi theo quy trình
> Spec Kit (`docs/SPECKIT.md`). Súng dùng view model procedural; pipeline MDL→GLB là ticket tùy
> chọn, chờ người dùng tải archive lên.

Inputs: [`docs/GDD.md`](GDD.md) (design spec), [`docs/REVIEW.md`](REVIEW.md) (accepted defaults),
[`docs/SPECKIT.md`](SPECKIT.md) (per-ticket workflow), `.specify/memory/constitution.md`
(non-negotiable principles).

---

## 1. Evaluation

| Area | Assessment |
|---|---|
| Scope | 4 zones, 30 robots, 1 boss, 1 weapon: feasible with primitives. Biggest volume is level content and three enemy types. |
| Main risks | (1) Grapple feel and "landing on top" of perches; (2) enemy navigation among container rows; (3) Charger edge/obstacle safety; (4) boss weak points at 22 m reachable only via perches; (5) merge conflicts between parallel workers. |
| Mitigation | (1) perch anchors carry a `landing` point, sandbox has a perch; (2) one nav grid service inside the enemies module, baked on `world:ready`; (3) pure, unit-tested charge planner; (4) perches at 8/14/20 m are part of the level contract; (5) exclusive file ownership + pre-wired module slots. |
| Assets | None available. Everything procedural. GameBanana and Blender hosts are blocked; the asset pipeline is ticket T-18, blocked on a user upload. |
| Gate | Vertical slice (GDD 15.1) is reachable after wave 2 inside `?sandbox`; T-16 turns it into a scripted end-to-end check before content is scaled to 30 robots. |

## 2. Architecture decisions

| # | Decision | Why |
|---|---|---|
| A1 | **Plain classes + module registry**, no ECS. One `GameModule` per feature folder. | 30 robots and one boss do not need ECS; plain objects are easier for parallel authors. |
| A2 | **Rapier (`@dimforge/rapier3d-compat`)** for static box colliders, the player KCC capsule and all ray queries. No rigid-body simulation of containers. | REVIEW #5, GDD 7.3/7.5. The compat build inlines WASM: no extra asset requests, works offline. |
| A3 | **Fixed 60 Hz simulation**, render every animation frame. A fixed tick = every module's `fixedUpdate` in registry order, then `physics.step`. | GDD 13.7; deterministic timers and movement. |
| A4 | **Typed EventBus** is the main integration surface; shared state lives on `GameContext` (`player`, `enemies`, `grappleAnchors`). Modules never import each other. | Lets every ticket be built and tested alone. |
| A5 | **`PlayerState` is foundation-owned data** (position, look, HP, `applyDamage`, `heal`, `addImpulse`, `externalVelocity`). The controller, grapple, weapon, enemies and pickups all meet there. | Removes the dependency of most tickets on the player controller. |
| A6 | **Damage flows through collider metadata**: a ray hit returns `ColliderMeta { damageable, hitZone, grappleable }`; the shooter calls `damageable.applyDamage(DamageInfo)`. | One mechanism for robots, Charger shield/rear, boss weak points/core, dummies. |
| A7 | **Level contract in `src/config/level.ts`**: zone rectangles, tower positions, crane sites, boss arena, spawn, enemy distribution. | Geometry and gameplay tickets can place content without seeing each other's code. |
| A8 | **`?sandbox` test scene** (foundation-owned) with containers, wall, step, grappleable pillar, perch and shootable dummies. Level modules build nothing there; gameplay modules add one fixture each. | Every ticket has an isolated, deterministic testbed; the vertical slice is assembled there first. |
| A9 | **DOM/CSS for HUD and menus** in `#ui-root`; no canvas UI. | Simple, crisp, no per-frame cost. |
| A10 | **Lighting**: one directional sun. Static shadows rendered once (`shadowMap.autoUpdate = false` + `needsUpdate` on change), a small dynamic shadow frustum around the player later (T-17). | REVIEW #4; "baked lighting" is on the cut list. |
| A11 | **No zone streaming** in v1. Everything is loaded at boot; enemies use Active / Simplified / Dormant. Re-evaluate with the T-11 monitor numbers in T-17. | GDD 13.1 makes streaming optional; content is tiny procedural geometry. |
| A12 | **Folder structure adapts GDD 12.2**: `weapon/` and `grapple/` are separate from `player/`; cranes/anchors live in `structures/`; `systems/` is split into `core/`, `physics/`, `vfx/`, `audio/`, `debug/`. `streaming/` is not created. | One owner per folder (constitution, principle V). |

## 3. Repository layout and ownership

```text
index.html, vite.config.ts, tsconfig.json, package.json      foundation
scripts/        smoke.mjs, e2e.mjs, lib/harness.mjs           foundation
tests/e2e/      T-XX-name.e2e.mjs                             one file per ticket
specs/          T-XX-name/ (Spec Kit artifacts)               one folder per ticket
docs/           GDD, REVIEW, PLAN, SPECKIT, tickets/          foundation (Tech Lead)
src/
├── main.ts, modules.ts                                       foundation
├── config/     tunables.ts (all GDD numbers), level.ts       foundation
├── core/       Game, GameLoop, Renderer, InputManager, EventBus, events, types, GameContext,
│               GameModule, GameState, PlayerState, Settings, ObjectPool, registries   foundation
├── physics/    PhysicsWorld (Rapier wrapper, CharacterBody), groups                    foundation
├── combat/     damage.ts (pure damage maths)                                           foundation
├── assets/     ResourceTracker                                                         foundation
├── sandbox/    test scene                                                              foundation
├── player/     T-01      ├── weapon/     T-02      ├── world/      T-03
├── structures/ T-04      ├── enemies/    T-05 (+ spider/ T-13, charger/ T-14)
├── ui/         T-06      ├── audio/      T-07      ├── objectives/ T-08
├── pickups/    T-09      ├── vfx/        T-10      ├── debug/      T-11
├── grapple/    T-12      ├── boss/       T-15      └── flow/       T-16
tools/asset-pipeline/     T-18 (optional)
```

Every feature folder already contains an `index.ts` placeholder exporting
`create<Name>Module(): GameModule` with a fixed module id, and `src/modules.ts` already registers
all of them in order:

`sandbox → world → structures → player → grapple → weapon → enemies → boss → objectives → pickups → vfx → audio → ui → flow → debug`

A ticket replaces the body of its placeholder; it never touches `src/modules.ts`.

### Shared files — how to extend without editing them

| Need | Do this (in your own folder) |
|---|---|
| New event | `src/<feature>/events.ts`: `declare module '@/core/events' { interface GameEvents { 'x:y': {...} } }` and import that file from your `index.ts`. The catalogue in `src/core/events.ts` already contains the events planned for every ticket; prefer those. |
| New number | Shared/GDD numbers are already in `src/config/tunables.ts`. Feature-local numbers go in `src/<feature>/tunables.ts`. |
| New shared type / foundation fix | Write `specs/T-XX-name/foundation-requests.md`, work around locally (local type, adapter), mention it in the hand-over. The Tech Lead applies it between waves. |
| Placement data | Your own file (e.g. `src/pickups/placements.ts`), derived from `src/config/level.ts`. |

## 4. Public interfaces

### 4.1 `GameContext` (`src/core/GameContext.ts`)

| Field | Type | Use |
|---|---|---|
| `scene`, `camera` | three.js | Add objects; the player module poses the camera; the weapon attaches the view model to it. |
| `renderer` | `Renderer` | `renderer.webgl.info` for diagnostics, `applyQuality`. Never create another renderer. |
| `canvas`, `uiRoot` | DOM | `uiRoot` hosts all DOM UI; add class `interactive` to elements that need pointer events. |
| `physics` | `PhysicsWorld` | `addStaticBox`, `addCollider`, `createCharacter`, `raycast`, `hasLineOfSight`, `setMeta/getMeta`, `removeCollider/removeBody`, raw `world` / `rapier`. |
| `input` | `InputManager` | `isDown(action)`, `wasPressed(action)`, `getMoveAxis()`, `consumeLookDelta()`, `rebind`, `requestPointerLock()`. |
| `events` | `EventBus<GameEvents>` | `on / once / off / emit`. |
| `settings` | `Settings` | `get/set` of `mouseSensitivity`, `masterVolume`, `quality`, `fpsCap`, `bindings` (persisted). |
| `state` | `GameStateMachine` | `current`, `is()`, `set()`; states `loading, menu, playing, paused, gameOver, victory`. |
| `player` | `PlayerState` | See 4.3. |
| `enemies` | `EnemyRegistry` | `add/remove/get/all/alive/aliveCount/inRadius`. Written by the enemies module only. |
| `grappleAnchors` | `GrappleAnchorRegistry` | `add/remove/all/inRange/nearest/coverage`. Written by structures/world (and the sandbox). |
| `resources` | `ResourceTracker` | `ctx.resources.scope('<module id>')`, `track(obj)`, `onDispose(fn)`, `dispose()`. |
| `tunables`, `flags`, `clock` | data | `flags.sandbox / autostart / debug / params`; `clock.simTime / fixedDt / frame / fixedTick`. |
| `testHooks` | `Record<string, unknown>` | Inspection hooks for browser tests and the debug overlay, one key per module id. Each module writes only its own key; gameplay code never reads another module's hooks. |

### 4.2 `GameModule` lifecycle (`src/core/GameModule.ts`)

`init(ctx)` (may be async, registry order) → `world:ready` event → per fixed tick `fixedUpdate(dt)`
(only in `playing`, before the physics step) → per frame `update(dt, alpha)` (only in `playing`) →
`dispose()`. Pause, death, respawn etc. arrive as events.

Input rule: hold state anywhere; `wasPressed` / `consumeLookDelta` only in `update()`.

### 4.3 Key types (`src/core/types.ts`, `src/core/PlayerState.ts`)

- `Damageable { id, kind, alive, applyDamage(DamageInfo): DamageResult }`
- `DamageInfo { amount, zone: HitZone, source, point?, direction? }`,
  `DamageResult { dealt, zone, killed, absorbed }`
- `HitZone = 'body' | 'critical' | 'armor' | 'weakpoint' | 'core'`
- `ColliderMeta { kind, grappleable?, damageable?, hitZone?, anchorId?, owner? }`
- `Enemy extends Damageable { type, position, state, hp, maxHp, simLevel, commandMoveTo(target) }`
- `GrappleAnchor { id, kind, position, landing?, zone? }`
- `PlayerState`: `position` (feet), `velocity`, `yaw`, `pitch`, `grounded`, `sprinting`, `hp`,
  `maxHp`, `alive`, `invulnerableFor`, `externalVelocity` (grapple override), `pendingImpulse`
  (knockback), `teleportPending`, `controlsLocked`; methods `getEyePosition`, `getLookDirection`,
  `getForward`, `getRight`, `applyDamage`, `heal`, `addImpulse`, `teleport`, `revive`.
- Pure helpers in `src/combat/damage.ts`: `resolveDamage`, `zoneMultiplier`, `isFrontalHit`,
  `shotsToKill`.
- Collision layers in `src/physics/groups.ts`: `Groups.*` for colliders, `QueryGroups.*` for rays
  (`playerShot`, `enemyShot`, `worldOnly`, `grapple`, `playerMove`, `enemyMove`).

### 4.4 Event catalogue (`src/core/events.ts`)

| Domain | Events | Producer → main consumers |
|---|---|---|
| core | `game:stateChanged`, `world:ready`, `input:pointerLockChanged`, `settings:changed` | foundation → all |
| flow | `game:over`, `game:victory`, `game:checkpoint`, `game:respawn`; requests `game:requestRespawn`, `game:requestRestart` | T-16 (checkpoint emitted by T-08, T-15; requests by T-06) → ui, audio, enemies, weapon |
| player | `player:damaged`, `player:healed`, `player:died` (emitted by `PlayerState`), `player:landed`, `player:footstep` | T-01 → ui, audio, flow |
| weapon | `weapon:fired`, `weapon:dryFire`, `weapon:reloadStarted`, `weapon:reloadFinished`, `weapon:ammoChanged`, `combat:hit`, `combat:impact`; request `weapon:grantAmmo` | T-02 → ui, audio, vfx; T-09 → T-02 |
| grapple | `grapple:fired`, `grapple:attached`, `grapple:released`, `grapple:failed`, `grapple:cooldown` | T-12 → ui, audio |
| enemies | `enemy:spawned`, `enemy:alerted`, `enemy:attacked`, `enemy:damaged`, `enemy:destroyed`, `charger:windup`, `charger:chargeStarted`, `charger:stunned`, `charger:hitPlayer` | T-05/13/14 → ui, audio, vfx, pickups |
| objectives | `tower:registered`, `tower:activationStarted`, `tower:activationProgress`, `tower:activationCancelled`, `tower:activated`, `objectives:defendStarted`, `objectives:allActivated`, `countdown:tick`, `countdown:stopped`, `countdown:expired`, `interact:prompt` | T-08 → ui, audio, enemies, boss, flow |
| pickups | `pickup:spawned`, `pickup:collected` | T-09 → ui, audio, vfx |
| boss | `boss:spawned`, `boss:phaseChanged`, `boss:weakPointDamaged`, `boss:weakPointDestroyed`, `boss:coreExposed`, `boss:coreDamaged`, `boss:attackTelegraph`, `boss:attack`, `boss:defeated` | T-15 → ui, audio, vfx, flow |
| presentation | requests `vfx:spawn`, `ui:toast` | anyone → T-10, T-06 |

### 4.5 `src/config/tunables.ts`

Sections `SIM, PLAYER, GRAPPLE, WEAPON, ECONOMY, ENEMY_COUNTS, SPHERE_ROBOT, SPIDER_ROBOT,
CHARGER_ROBOT, AI_SCHEDULING, OBJECTIVES, BOSS, PERFORMANCE, WORLD, CAMERA`. Each value is tagged
`GDD x.y` (from the spec) or `proposed` (engineering default). A unit test checks the GDD 5.4 ammo
budget (404 hits needed, 870 rounds supplied) so balance edits that break the budget fail CI.

### 4.6 Level contract (`src/config/level.ts`)

+X east, +Y up, +Z south, ground y = 0, sea north of z = −120.

| Item | Value |
|---|---|
| Land | x ∈ [−120, 120], z ∈ [−120, 100] |
| A Container Yard | x [−120, 0], z [−60, 40] |
| B Crane Zone | x [0, 120], z [−60, 40] |
| C Warehouse | x [−120, 120], z [40, 100]; building footprint x [−50, 50], z [50, 90] |
| D Dock + Control Center | x [−120, 120], z [−120, −60]; control center x [70, 100], z [−110, −85] |
| Player spawn | (0, 0, 96), facing north |
| Towers | T1 (20, 0, 62) C · T2 (−72, 0, −12) A · T3 (72, **10**, −12) B on a gantry platform · T4 (60, 0, −96) D |
| Cranes | 3 in B, 1 at the yard edge, 2 on the dock (`CRANE_SITES`) |
| Boss arena | centre (−28, 0, −90), radius 28, perches at 8 / 14 / 20 m |
| Robots per zone (sphere/spider/charger) | A 5/3/4 · B 4/3/0 · C 3/2/1 · D 2/2/1 |
| Keep-clear discs (`KEEP_CLEAR`) | spawn r 6 · boss arena r 32 · each tower r 7 · each crane site r 14. Below 9 m only the disc's owner builds inside it. |

### 4.7 Query parameters

| Parameter | Owner | Effect |
|---|---|---|
| `sandbox`, `autostart`, `debug` | foundation | Test scene / skip menu / debug overlay on. |
| `enemies=sphere,spider,charger\|none` | T-05 | Sandbox robot fixtures. |
| `countdown=<s>`, `towers=<n>` | T-08 | Countdown override / pre-activated towers. |
| `boss`, `bossphase=core` | T-15 | Spawn the boss at boot / start with the core exposed. |
| `anchors` | T-04 | Anchor and coverage debug view. |
| `colliders`, `bench=<s>` | T-11 | Collider wireframes / benchmark recorder. |
| `vfxtest`, `audiotest` | T-10, T-07 | Effect and sound review loops. |
| `viewmodel=glb` | T-18 | Converted weapon model. |

## 5. Coding conventions

- TypeScript strict; no `any`, no `@ts-ignore`. `import type` for types (`verbatimModuleSyntax`).
  Path alias `@/` = `src/`.
- Files: `PascalCase.ts` for a class, `camelCase.ts` for functions/data, `*.test.ts` next to the
  code. Module entry is always `src/<feature>/index.ts`.
- No per-frame allocation on hot paths; reuse module-level scratch vectors. Event payload vectors
  are only valid during the callback (clone to keep).
- No gameplay literals: import from `@/config/tunables` or your `tunables.ts`.
- Units are metres/seconds/radians; names of degree values end with `Deg`.
- Every module creates `const res = ctx.resources.scope(id)`, tracks what it adds to the scene and
  disposes it, unsubscribes its event handlers and removes its DOM in `dispose()`.
- Use `ObjectPool` for anything spawned repeatedly; respect the pool caps in tunables.
- Honour `ctx.flags.sandbox`: level modules return early; gameplay modules spawn one fixture.
- Debug switches are query parameters read from `ctx.flags.params` (documented in the ticket).
- `window.__NH__.game` (`ctx`, `loop`) is the handle for browser tests; do not add other globals.
- English for code, comments and docs. No model/vendor names in files or commit messages.

## 6. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest (`npm test`, Node environment) | Pure logic: damage, ammo/reload state machine, FSM transitions, countdown, activation progress, placement generators, coverage rule, charge planner, boss phase logic. Rapier works in Node (see `src/physics/PhysicsWorld.test.ts`), so controller/grapple movement can be unit-tested headless. |
| Smoke | Playwright (`npm run smoke`) | Built app boots in `/?autostart`, `/?sandbox&autostart`, `/`: no console errors, no failed requests, canvas renders, simulation advances only in `playing`. Foundation-owned. |
| Ticket e2e | Playwright (`npm run e2e [-- T-XX]`) | `tests/e2e/T-XX-name.e2e.mjs`, one per ticket, drives `window.__NH__.game` (see `T-00-foundation.e2e.mjs`). Synthetic input via `ctx.input.handleCode(code, down)` works without pointer lock. |
| Manual | `npm run dev` → `http://localhost:5173/?sandbox` | Feel checks listed in each ticket. |

Headless Chromium uses software WebGL: FPS numbers from smoke/e2e are not performance data.

## 7. Definition of Done (every ticket)

1. Spec Kit flow followed as in [`docs/SPECKIT.md`](SPECKIT.md); `specs/T-XX-name/` contains
   `spec.md`, `plan.md`, `tasks.md` with all tasks ticked, and is committed with the code.
2. Every acceptance criterion of the ticket is met and mapped to a unit test, an e2e check or a
   written manual check.
3. `npm run typecheck && npm test && npm run build && npm run smoke` passes; `npm run e2e` passes
   if the ticket has an e2e file.
4. Only files owned by the ticket were touched (`git diff --stat` shows nothing else).
5. Constitution respected: tunables in config, pooling, ResourceTracker disposal, no cross-module
   imports, no new runtime dependency, no external requests, no binary assets.
6. Works in `?sandbox` and does not break the non-sandbox boot.
7. Hand-over summary: acceptance criteria status, deviations from PLAN/REVIEW/GDD, foundation
   requests, known issues.

## 8. Milestones

| GDD milestone | Tickets | Exit check |
|---|---|---|
| M1 FPS controller, weapon, reload | foundation, T-01, T-02 (+T-06, T-07, T-10 feedback) | Move and shoot dummies in `?sandbox`. |
| M2 Harbor greybox, containers, cranes, grapple | T-03, T-04, T-12 | Walk/grapple all zones; anchor coverage rule passes. |
| M3 Robot AI + memory benchmark | T-05, T-13, T-14, T-11 | 30 robots managed; monitor numbers recorded; streaming decision (default: none). |
| M4 Towers, countdown, pickups | T-08, T-09, T-16 | Four towers → boss trigger; ammo budget test green. |
| M5 TITAN-04 | T-15 | Weak points → core → victory. |
| M6 Optimisation + offline | T-17 | 60 FPS target scene budgets, no leak across restarts, offline cache. |
| Vertical slice (15.1) | T-01, T-02, T-12, T-05, T-14, T-08, T-09, T-15 in `?sandbox` | Scripted in T-16 (`tests/e2e/T-16-*.e2e.mjs`) and played manually before scaling content. |

## 9. Tickets, waves and dependencies

| ID | Ticket | Wave | Depends on | Owns |
|---|---|---|---|---|
| T-01 | Player controller | 1 | — | `src/player/` |
| T-02 | Weapon | 1 | — | `src/weapon/` |
| T-03 | World greybox | 1 | — | `src/world/` |
| T-04 | Cranes, perches, grapple anchors | 1 | — | `src/structures/` |
| T-05 | Enemy framework + sphere robot | 1 | — | `src/enemies/` (except `spider/`, `charger/` bodies) |
| T-06 | HUD, menus, settings | 1 | — | `src/ui/` |
| T-07 | Procedural audio | 1 | — | `src/audio/` |
| T-08 | Towers + countdown | 1 | — | `src/objectives/` |
| T-09 | Pickups + drops | 1 | — | `src/pickups/` |
| T-10 | VFX | 1 | — | `src/vfx/` |
| T-11 | Perf monitor + debug overlay | 1 | — | `src/debug/` |
| T-12 | Grappling hook | 2 | T-01 (soft: T-04) | `src/grapple/` |
| T-13 | Spider robot | 2 | T-05 | `src/enemies/spider/` |
| T-14 | Charger robot | 2 | T-05 (soft: T-01) | `src/enemies/charger/` |
| T-15 | TITAN-04 boss | 2 | T-02 (soft: T-04, T-10) | `src/boss/` |
| T-16 | Game flow, population, vertical slice | 3 | T-01…T-15 | `src/flow/`, `src/enemies/population.ts`, `src/pickups/placements.ts` |
| T-17 | Optimisation + offline packaging | 4 | T-16 | cross-cutting (see ticket) |
| T-18 | Weapon asset pipeline (optional) | any | T-02 + **user upload** | `tools/asset-pipeline/`, `src/weapon/viewmodel/` |

```text
foundation ──┬─ T-01 ──┬─ T-12 ──────────────┐
             ├─ T-02 ──┼─ T-15 ──────────────┤
             ├─ T-03   │                     │
             ├─ T-04 ··┘ (soft: T-12, T-15)  │
             ├─ T-05 ──┬─ T-13 ──────────────┼─ T-16 ── T-17
             │         └─ T-14 ──────────────┤
             ├─ T-06, T-07, T-08, T-09, T-10, T-11 ─┘
             └─ (T-02) ·· T-18 optional, blocked on user upload
```

"Soft" dependency = the ticket is developed and tested against the sandbox/contract and only needs
the other ticket for full in-level verification.

Ticket documents: [`docs/tickets/`](tickets/README.md).

Wave 1 is fully parallel: no ticket in it reads another wave-1 ticket's code. Between waves the
Tech Lead merges, applies foundation requests and re-runs `npm run check`.

## 10. Deviations from REVIEW.md defaults

None of the twelve defaults is overridden. Clarifications added by this plan:

- REVIEW #2 (perches): the grapple still pulls to the anchor and releases; perch anchors add a
  `landing` point so arrival ends standing on the platform. No hanging/swinging.
- REVIEW #4: implemented as an optimisation in T-17; until then T-03 uses a single static shadow
  frustum over the play area.
- GDD 12.2 folder structure is adapted (decision A12).
- Tower 3 is placed on a 10 m gantry platform to make the "Hard" tower require the grapple.
