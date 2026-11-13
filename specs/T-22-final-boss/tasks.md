# Tasks: Final Boss Refresh (spherical walker)

**Input**: specs/T-22-final-boss/ (spec, plan, research, data-model, quickstart)

## Phase 1: Setup

- [x] T001 Add model scale, height, cinematic, landing and weak-point mapping numbers to src/boss/tunables.ts
- [x] T002 [P] Add `finishAwakening()` to src/boss/BossModel.ts with a test in src/boss/BossModel.test.ts

## Phase 2: Foundational (pure logic, tests first)

- [x] T003 [P] Write tests then implement `pickLandingSpot` in src/boss/landing.ts and src/boss/landing.test.ts
- [x] T004 [P] Write tests then implement the cinematic timeline in src/boss/cinematic.ts and src/boss/cinematic.test.ts
- [x] T005 Update ability mapping in src/boss/BossAttacks.ts and src/boss/BossAttacks.test.ts to the four knee lights

## Phase 3: User Story 2 - Model and weak points (P1)

- [x] T006 [US2] Create shared canvas textures in src/boss/BossTextures.ts
- [x] T007 [US2] Rewrite src/boss/BossBody.ts as the reference port with merged geometry (<= 40 draws), gait, hydraulics, collapse fold
- [x] T008 [US2] Update src/boss/BossColliders.ts for knee weak points and eye core

## Phase 4: User Story 1 - Cinematic landing (P1)

- [x] T009 [US1] Create src/boss/CinematicFx.ts (letterbox bars, title card, streaks, glow, shockwave ring)
- [x] T010 [US1] Integrate landing, cinematic, input lock, invulnerability, E skip and hooks in src/boss/index.ts

## Phase 5: User Story 3 - Attacks (P2)

- [x] T011 [US3] Re-anchor cannon muzzle, missile spawn and slam raise to the new model in src/boss/index.ts

## Phase 6: Verification

- [x] T012 Update tests/e2e/T-15-boss-titan04.e2e.mjs, add tests/e2e/T-22-final-boss.e2e.mjs, adjust T-16 full-run wait
- [x] T013 Run typecheck and unit tests (done); T-22 and T-15 e2e and one screenshot round were run earlier and passed; T-16 full-run, smoke repeat and further e2e or screenshots: skipped per owner (CPU overload, T-16 full-run failed at tower-1 under load before any boss code)
