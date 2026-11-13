---

description: "Task list for T-21 Dinosaur semi-boss"
---

# Tasks: Dinosaur semi-boss (T-21)

**Input**: `specs/T-21-dinosaur/` (plan.md, spec.md, research.md, data-model.md, quickstart.md)

## Phase 1: Setup

- [x] T001 Create `src/dinosaur/tunables.ts` with every number (HP, size, trigger radius, leash, skill timings, damages, radii, cooldowns, drops)
- [x] T002 [P] Create `src/dinosaur/events.ts` (`dino:*` events by declaration merging)

## Phase 2: Foundational (pure logic, tests first)

- [x] T003 [P] Write `src/dinosaur/guards.test.ts` then `src/dinosaur/guards.ts` (seeded RNG, `?seed=` parse, `pickGuardTowers` 2 distinct of 4, deterministic)
- [x] T004 [P] Write `src/dinosaur/brain.test.ts` then `src/dinosaur/brain.ts` (`chooseSkill` by distance/cooldown, cooldown ticking, telegraph >= 0.8 s invariant)
- [x] T005 [P] Write `src/dinosaur/combat.test.ts` then `src/dinosaur/combat.ts` (stomp falloff, tail-ring hit with vertical clearance, ram body hit, leap arc)

## Phase 3: User Story 1 - Meet a guardian (P1)

**Independent test**: seeded run spawns only at the 2 chosen towers once, on first approach within 35 m.

- [x] T006 [US1] Create `src/dinosaur/DinoModel.ts` (reference port, merged geometry, vertex-coloured armour + glow, animated legs/tail/jaw, 13 draw calls, shared geometry/materials, scaled to 9 m)
- [x] T007 [US1] Create `src/dinosaur/Dinosaur.ts` (Damageable, Rapier hit volumes with head = critical, guard/spawning states, spawn-in effect)
- [x] T008 [US1] Create `src/dinosaur/index.ts` module (seed pick, proximity spawn, roar + camera shake, test hooks, dispose) and register it in `src/modules.ts`

## Phase 4: User Story 2 - Fight it (P1)

**Independent test**: each skill telegraphs >= 0.8 s then deals the tunable damage within the tunable radius.

- [x] T009 [US2] Add chase, wall probing, leash and the three skills (ram, tail spin, leap stomp) with telegraph decals and events to `src/dinosaur/Dinosaur.ts`

## Phase 5: User Story 3 - Reward (P2)

- [x] T010 [US3] Create `src/dinosaur/drops.ts` (bounded ammo + medkit pickups, collection, events) and call it from the death path

## Phase 6: Polish and verification

- [x] T011 Write `specs/T-21-dinosaur/foundation-requests.md` (guaranteed pickup drop request, shake service, audio, seed param)
- [x] T012 Write `tests/e2e/T-21-dinosaur.e2e.mjs` (written; the harbor-seed part passed in an earlier run, the fight part did not finish. NOT fully verified, see hand-over)
- [x] T013 Run typecheck and unit tests of `src/dinosaur` (green); full `npm test`, build, smoke and the other e2e files: skipped per owner instruction (CPU overload)
- [x] T014 Playwright screenshots: skipped per owner instruction (one early inspection of the model was done before the stop: red armour, orange core/knee glow, toothed head, spiked tail read as the reference)
- [x] T015 Save `speckit-analyze` output in `specs/T-21-dinosaur/analyze.md` and commit
