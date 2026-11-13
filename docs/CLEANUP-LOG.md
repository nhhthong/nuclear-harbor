# Cleanup log, T-23 Phase A

Scope: everything except `src/enemies/**`, `src/boss/**`, `src/dinosaur/**` and the enemy/boss blocks of
`src/config/tunables.ts` (Phase B handles those). Baseline: commit `6155751`.

Tools: `npx --yes knip --no-progress` (not added to package.json), `grep -rnw`, `tsc --noEmit`, `vitest run`,
`vite build`, smoke and all e2e files. Knip "unused" means no importer anywhere, tests included.

## Removals

### 1. Dead symbols (deleted)
| What | Evidence |
|---|---|
| `TMP_VEC3` in `src/core/registries.ts` | knip "Unused exports"; `grep -rnw TMP_VEC3 src tests scripts` found only the definition |
| `CONTAINER_HEIGHT` in `src/world/containerLayout.ts` | knip; grep found only the definition |
| `DOCK_EDGE_Z` in `src/config/level.ts` | knip; grep found the definition and one comment (comment now says `LAND.minZ`) |
| type `Tunables` in `src/config/tunables.ts` | knip "Unused exported types"; grep: definition only |
| type `GameEventName` in `src/core/events.ts` | knip; grep: definition only |
| interface `QualityLike` in `src/core/quality.ts` | knip; after removing `export`, `tsc` reported TS6196 "declared but never used" |
| re-export `export type { QualityPreset }` in `src/core/quality.ts` (and its then-unused import) | knip; `tsc` TS6133 after removal of the re-export confirmed the import was only for it |
| tunables `PLAYER.canJump`, `PLAYER.hpRegenPerSecond`, `PERFORMANCE.targetFps`, `PERFORMANCE.dynamicShadowLights` | script `grep -rnw <key> src tests scripts` outside `tunables.ts` returned 0 hits for every leaf key of `tunables.ts`; only these four (outside enemy/boss blocks) plus the ones in "kept" were zero. The GDD rules they documented (no jump, no regen) stay in `docs/GDD.md` |

### 2. `export` keyword dropped (symbol is used only inside its own file): 34 symbols
Knip listed them as unused exports; `grep -rnw` shows every use is in the defining file, so they stay as module
internals. Values: `BOSS_ATTACK_ORDER` (audio/eventMap), `zoneMultiplier`, `SANDBOX_SPAWN`, `parseFlags`,
`mouseButtonCode`, `DEFAULT_SETTINGS`, `readHeapMb`, `SANDBOX_TOWER`, `TOWER_HEIGHT`, `TOWER_BEAM_HEIGHT`,
`isPrecacheable`, `Layer`, `ALL_LAYERS`, `interactionGroups`, `buildBossRing`, `SANDBOX`, `coverageLine`,
`perchTower`, `defaultGlbLoader`, `sunDirection`. Types: `Vec3Like`, `FilterSpec`, `BudgetKey`, `FailReason`, `CancelReason`, `TowerVisualState`, `PlacementZone`, `Rgba`,
`ParticleLayer`, `FlashLight`, `RingSpec`, `ModelLoader`, `ContainerInstance`, `StackTop`.
Proof: `npx tsc --noEmit` clean, `vitest run` 57 files / 451 tests pass, knip then lists only enemy/boss items.

### 3. Stale documentation text (edited, not deleted)
| File | Change | Evidence |
|---|---|---|
| `docs/tickets/README.md` row T-18 | "BLOCKED until user uploads GameBanana archive" replaced by "done, asset supplied" | `assets-src/weapons/g36c/v_g36c.mdl` and `public/assets/weapons/g36c/g36c.glb` exist; T-18 e2e is green |
| `docs/PLAN.md` (Assets row, dependency graph) | "None available / blocked on user upload" replaced | same |
| `docs/tickets/T-18-weapon-asset-pipeline.md` | Interfaces, step 1 STOP condition, AC1, AC3, Notes, verify command reworded as superseded by the file's own "Update" section | `tools/asset-pipeline/convert.sh` defaults to `assets-src/.../v_g36c.mdl`, no `input/` archive needed |
| `docs/ASSETS.md` | removed the "Replaces: DesertTech MDR / SG552/MSBS" line; "foundation request" note now says it is applied | `src/weapon/index.ts:175` calls `createViewModel(res, c.flags.params)` |
| `docs/REVIEW.md` row 3 | added a "superseded" note pointing to ASSETS.md | same |
| `specs/T-18-weapon-asset-pipeline/foundation-requests.md` | marked "Status: APPLIED" (kept, specs history is protected) | same grep as above |

### 4. Files deleted
None. Every file candidate was either referenced or protected (see below).

## Candidates deliberately kept
| Candidate | Why kept |
|---|---|
| `scripts/defend-probe.mjs`, `scripts/screenshots.mjs`, `public/sw.js` (knip "unused files") | documented in `docs/PLAYTEST.md` / `docs/OFFLINE.md`; `sw.js` is the template read by `vite.config.ts` and `src/offline/register.ts`; the e2e files are run by `scripts/e2e.mjs` (knip does not know that runner) |
| All 14 PNGs in `docs/playtest/` | `md5sum` shows no duplicates; every file name is referenced in `docs/PLAYTEST.md` sections 3 and 7 (before/after pairs, `warehouse-tower1` pair, `boss-arena-2`, `harbor-yard`) |
| `specs/T-16-game-flow-integration/foundation-requests.md` | it is a copy of `docs/PLAYTEST.md` sections 1-6 (`diff` shows PLAYTEST only adds section 7), but specs history must not be deleted |
| `playwright` (knip "unlisted dependency") | `scripts/lib/harness.mjs` resolves it from a global install on purpose (header comment: never run `playwright install` here) |
| npm scripts `bench`, `leakcheck`, `offline`, `icons`, `check`, `preview` | each points at an existing script file and is documented in README / docs |
| `src/debug/index.ts` `console.log('BENCH ...')` | read by `scripts/bench.mjs` and docs/PERFORMANCE.md |
| Event `enemy:spawned` (emitted, no listener) | it is part of the enemy contract in `src/enemies/**` (Phase B) |
| `WORLD.chargerLaneMinLength`, `SPIDER_ROBOT.bodyHeight`, `BOSS.totalHeight` (zero references) | inside enemy/boss blocks or charger-lane data tied to the robot refresh; Phase B |
| All knip hits in `src/enemies/**` and `src/boss/**` (`Charger`, `createSphereRobot`, `navBoundsFor`, `yardChargers`, `otherChargers`, `SPHERE_*`, `SPIDER_BRAIN_CONFIG`, `ATTACK_KINDS`, `legHip`, `DEFAULT_BOSS_MODEL_CONFIG`, `BOSS_TOTAL_HP`, `ChargeEnd`, `Enemy*` types, `TestClock`) | excluded folders |
| `docs/GDD.md` GameBanana / DesertTech text, `docs/reference-models/**`, `specs/**`, `assets-src/**`, `public/assets/weapons/g36c/**`, `.gitignore` rule for `tools/asset-pipeline/input/` | protected by the ticket / still a valid guard |
| `tools/asset-pipeline/report.json` | written by `convert.sh`, referenced by `specs/T-18/.../view-model.md` |

## Not found
No leftover debugger statements, TODO/FIXME markers, skipped tests, or doc references to missing `src/`, `scripts/`,
`tests/`, `public/` or `tools/` paths (checked with grep and a path-existence loop over README and docs).

## Bundle size (`npm run build`, `dist/assets/*.js`)
| | before | after |
|---|---|---|
| `index-*.js` | 267,277 B | 267,204 B |
| vendor-three / vendor-rapier | 671,876 / 4,332,866 B | unchanged |
| `dist` total | 16,080 kB | 16,080 kB |

Removed code was almost all already tree-shaken; the saving is 73 bytes.

# Cleanup log, T-23 Phase B

Baseline: merge commit `5ddd769` (T-19..T-22 merged). Owner instruction: no e2e, no smoke, no screenshots were run.
Verification for this phase: `npx tsc --noEmit` clean, `npm test` 65 files / 466 tests pass, `npm run build` ok.

## Renames (EnemyType ids and everything named after them)
| Old | New | Where |
|---|---|---|
| `EnemyType` `'sphere' \| 'spider' \| 'charger'` | `'army' \| 'spot' \| 'duck'` | `src/core/types.ts`, `ENEMY_FACTORIES` keys, `TYPES` and spawn literals in `population.ts`, `Duck.ts`/`Spot.ts`/`ArmyRobot.ts` |
| `ENEMY_COUNTS.sphere/spider/charger`, `ENEMY_DISTRIBUTION` keys | `army/spot/duck` | `src/config/tunables.ts`, `src/config/level.ts` and tests |
| `?enemies=sphere,spider,charger` param values | `army,spot,duck` | `parseEnemyParam`, e2e URLs, docs/PLAN.md |
| events `charger:windup`, `charger:hitPlayer` | `duck:windup`, `duck:hitPlayer` | `src/core/events.ts`, `Duck.ts`, audio map, tests, e2e |
| audio ids `chargerWindup`, `chargerHit` | `duckWindup`, `duckHit` | `catalogue.ts`, `sounds.ts`, `eventMap.ts`, tests, T-07 e2e |
| `ENEMY_VARIANT` keys, VFX `e.type === 'charger'` | `army/spot/duck` | `src/audio/eventMap.ts`, `src/vfx/index.ts` |
| helpers `SPHERES_SPIDERS`, `yardChargers`, `otherChargers`, `YARD_NS_CHARGERS`, `sphere()`/`spider()` | `ARMY_SPOT_POSTS`, `yardDucks`, `otherDucks`, `YARD_NS_DUCKS`, `army()`/`spot()` | `src/enemies/population.ts` (+ test) |
Proof: `grep -rnE "\b(spider|charger|SPIDER_ROBOT|CHARGER_ROBOT|SPHERE_ROBOT)\b|'sphere'" src tests scripts` returns nothing
(left: THREE `sphere(...)` geometry helpers and `HemisphereLight`, which are not enemy ids). `tsc` has no stale key because
`Record<EnemyType, ...>` and the event map are typed.

## Removals
| What | Evidence |
|---|---|
| `SPIDER_ROBOT` and `CHARGER_ROBOT` blocks (and their `TUNABLES` entries) in `src/config/tunables.ts` | Only users were two ammo-budget tests (`damage.test.ts`, `placements.test.ts`); they now read `SPOT.hp` / `DUCK.hp`. `grep -rnw "SPIDER_ROBOT\|CHARGER_ROBOT" src tests` empty. No `SPHERE_ROBOT` remnant (already `ARMY_ROBOT`). The budget test value changed 432 -> 372 hits because Spot is 70 HP and Duck 60 HP, not the old 150 / 200; supply 870 still covers 744 |
| `isFrontalHit` (`src/combat/damage.ts`) and its test | Charger front shield, no longer exists; `grep -rnw isFrontalHit src` only definition and its own test |
| events `charger:chargeStarted`, `charger:stunned`; audio ids `chargerCharge`, `chargerStunned` and their routes/recipes; VFX handler and `VFX.chargerStunScale` | `grep -rn "emit('charger:" src` showed only `windup` and `hitPlayer` emitted; no emitter for the other two |
| `BOSS.bodyDiameter`, `totalHeight`, `legCount`, `weakPointRadius` (old TITAN-04 numbers) | key-usage script (`grep -rnw <key> src tests` outside definition): 0 hits each |
| `WORLD.chargerLaneMinLength` | same script: 0 hits |
| `SPOT.trotStride`, `SPOT.trotLift` (`src/enemies/spot/tunables.ts`) | same script: 0 hits |
| boss tunables `weakPointProud`, `coreDepth`, `BOSS_TOTAL_HP` | same script / knip "Unused exports": 0 hits |
| `cylY`, `torusX` (+ `TorusGeometry` import) in `src/enemies/duck/modelKit.ts` | knip; `tsc` TS6133 flagged the import after removal |
| `export { ArmyRobot }` in `src/enemies/army/index.ts`; `export type { EnemyDeps, EnemyFactory, EnemySpawn }` in `src/enemies/index.ts` | knip "Unused exports/types"; importers use `./BaseEnemy` and `./army/ArmyRobot` directly |
| stale comments (sphere/spider/charger roles, "hover height for the sphere") | grep above |
The old robot files (`SphereRobot.ts`, `sphereBrain*`, `charger/`, `spider/`) were already deleted by T-19/T-20; knip reports no unused files in `src`.

## Added
- `duck:beep` route in `src/audio/eventMap.ts`: reuses the existing `beep` recipe at the duck position (2 lines + a unit test).

## e2e and docs (textual only, not executed)
- `tests/e2e/*.mjs`: ids, URLs, event names and audio ids updated (T-05, T-07, T-13, T-14, T-16 x3, T-20). `node --check` passes on every e2e and script file. File names (`T-13-spider-robot`, `T-14-charger-robot`, `T-05-...-sphere`) kept so ticket/spec links stay valid.
- `docs/PLAN.md`, `docs/PERFORMANCE.md`, `docs/PLAYTEST.md` updated; old playtest measurements carry a note that old names mean army/spot/duck. Not touched: `docs/GDD.md`, `docs/reference-models/**`, `specs/**`, `docs/tickets/**`, `docs/REVIEW.md` (dated review snapshot).

## Kept on purpose
- `WORLD.chargerLaneWidth` (`src/config/tunables.ts`) and the lane data it measures: still used by `containerLayout.test.ts`; lanes are a world concept that the Duck placement reuses. Renaming left to a world-module owner.
- Remaining knip hits (`ATTACK_KINDS`, `landingCandidates`, `ARMY_BRAIN_CONFIG`, `DUCK_COLORS`, `SPOT_COLORS`, `navBoundsFor`, `yardDucks`, `otherDucks`, types `CinematicStage`, `PivotName`, `SalvoPhase`, `TestClock`): used inside their own file, only the `export` keyword is unneeded; not worth touching.
- Not verified: e2e, smoke, screenshots (owner instruction).
