# Feature Specification: Gunslinger Crab Mech final boss

**Feature**: `27-crab-boss` | **Created**: 2026-11-18 | **Status**: Implemented and merged (PR #15, with spec 26); not played on a real GPU
**Input**: owner request: replace TITAN-04 (spherical walker, four knee weak points, then a core) by the Gunslinger Crab Mech with one big HP pool, clear skills and dragonfly drones.
**Process**: built by a sub-agent in its own worktree in parallel with spec 26; the coordinator merged both (`321e73f`), re-based the ammo budget test (337 on the crab branch, 348 after the merge) and took the Playwright screenshots on the low preset (software GL). Written with the work, not by running the skills in order. Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, scripted screenshots), `[N]` not verified.

## Summary
One tanky HP pool of **5800 HP** (232 hits at 25 damage), no weak points, no core stage, four skills with telegraphs and 3 to 4 dragonfly drones that fight beside it. Victory on death, as before. The landing cinematic is kept.

## User Scenarios & Testing

### User Story 1 - Fight one big machine (Priority: P1)
After the relay countdown the crab drops into the arena; the boss bar shows one HP pool; every hit on any collider counts.
1. In the `fight` phase a bullet hit on any crab collider lowers the pool by 25 and the HUD bar follows. [U `src/boss/BossModel.test.ts`; HUD bar [N]]
2. 232 hits destroy it: it collapses and the victory flow runs. [U `BossModel.test.ts`, `damage.test.ts`; victory flow in a real run [N]]
3. `?boss` spawns it after 0.4 s; `?bossphase=low` (or the old `core`) starts at 20% HP. [B used for the skill screenshots]
4. Invulnerable while awakening (phases dormant -> awakening -> fight -> destroyed). [U `BossModel.test.ts`]

### User Story 2 - Four readable skills (Priority: P1)
- **Carpet bombs**: a line of 5 lobbed bombs towards the player plus a ring of 6 around them; ground marker 1.2 s, then 5 m radius, 18 damage, 35% at the edge. [U `src/boss/skills.test.ts` pattern and falloff; B]
- **Dragonfly drones**: 3 to 4 per release from the rear bay (6 alive at most, re-release only below 2); orbit the player at 4 to 9 m, slow 3-damage bolts after a 0.55 s glow; 40 HP (two hits), no drops, die with the boss, not in the roster. [U `skills.test.ts` cap and orbit; B]
- **360 spin**: only when the player is within 16 m; 0.8 s wind-up (crouch, glow, 14 m ground ring), 2.5 s spinning; each arm sweep that touches the player does 25 damage plus knockback, once per contact. A player whose feet are above `safeHeight` **1.4 m** avoids it (the double jump reaches 1.8 m; it was 2.4 m before the natural-jump change of 2026-11-19). [U `skills.test.ts` spin contacts; B]
- **Four-way laser**: 1.5 s of warning lines, then four beams (cross, 1.2 m wide, band from 0.4 to **1.3 m** above the floor) rotating 180 degrees in 4.5 s; 10 damage every 0.25 s while touching; beams stop at static geometry (30 Hz clip). A **double** jump clears a beam; a single jump (0.95 m) does not (it did before 2026-11-19). [U `skills.test.ts` angles and hit test; B]
- Selection weighted by distance and cooldowns (bombs 9 s, drones 16 s, spin 10 s, laser 14 s), one skill at a time with a 1.2 to 2.4 s gap; between skills the crab walks to keep a 10 to 17 m band, strafes inside it, turns at 0.45 rad/s. [U `skills.test.ts` selection; movement band [N]]

### User Story 3 - Look (Priority: P2)
The crab is the CC-BY "Gunslinger Crab Mech v1.2" (vaportrash), legs split at the hips, procedural tripod gait; drones are the CC-BY "Light Assault Mech" (Lagst, a dragonfly flyer). If a GLB fails to load (or `?procedural-boss`), the old procedural body and a procedural flyer are used. [U `src/boss/crabAssets.test.ts`; B]

### Edge cases (as built)
GLB failure or 5 s timeout: fallback bodies. Player standing on the boss: bombs handle it. [U `skills.test.ts`] Beams behind containers: clipped by a world raycast. [U length clip in `skills.test.ts`] Boss death with drones alive: drones die with it. Drones fly over containers (no avoidance) and the crab ignores props (only the arena disc contains it): both [N], known limits.

## Requirements
- **FR-001** One HP pool (`BOSS.hp` = 5800), phases dormant -> awakening -> fight -> destroyed. [U `BossModel.test.ts`]
- **FR-002** No weak point mechanic in model, colliders, HUD, audio or events: `boss:weakPoint*` and `boss:coreExposed` stay declared in `core/events.ts` but are never emitted; `boss:coreDamaged` carries every hit; `boss:spawned` has `weakPoints: 0`, `coreHp` 5800. `BossPhase` loses the weak-point phases (published contract change, see the plan). [U `BossModel.test.ts`; HUD/audio tolerance [N]]
- **FR-003** Skill numbers live in `src/boss/tunables.ts` (`CRAB`); selection, bomb pattern, beam angles and hit test, drone cap and spin contacts are pure (`src/boss/skills.ts`). [U `skills.test.ts`, 24 tests]
- **FR-004** Hit volume is Rapier primitives only (16 cuboids); drones are pooled kinematic ball colliders exposing `damageable` in the physics meta so the hitscan damages them. [B drones shot in the screenshots; no unit test of the physics meta [N]]
- **FR-005** GLBs load asynchronously with a boss-local loader (`crabAssets.ts`); the spawn waits at most 5 s; fallback bodies; everything disposed with the `boss` resource scope. [U `crabAssets.test.ts`; disposal [N]]
- **FR-006** Ammo budget: the boss needs 232 hits. Supply 540 then; **356 hits vs 570 supply** now (roster 116 + 4 roster drones 8 + crab 232). [U `damage.test.ts`]
- **FR-007** Dodge heights: spin `safeHeight` 1.4 m, laser `top` 1.3 m (reachable with the double jump only). [U `ads.test.ts` "dodge thresholds reachable", `skills.test.ts` "can be jumped over"; B not re-run after the change]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (ammo-budget hits 337 on the branch, 348 after the merge; 655 tests on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** Screenshots (Playwright, low preset) of the crab and of each skill. [B, done 2026-11-18]
- **SC-003** Crab 27k triangles in 9 meshes, `crab-boss.glb` 1.76 MB; drone 4.8k triangles, `dragonfly-drone.glb` 0.42 MB. [build artifacts; sizes checked 2026-11-20]

## Assumptions
- The crab is 10.4 m across and 8.4 m tall with the launcher (the brief said 11 to 12 m and about 6 m; the source proportions win). The drone is a 4.2 m wingspan flyer (the source has a 21 m wingspan on a 2 m body), its clip is not used.
- The cinematic and landing keep the old `scale` convention (harbor 0.5); crab sizes are real metres, multiplied by `scale / 0.5` in the sandbox.
- Out of scope: new audio assets (spec 32 later added boss samples), drones on the radar, e2e scripts (stale).
- Not verified: feel and balance on a real GPU, the crab among containers, drones through containers, beam clipping at 30 Hz in a real fight, spin knockback against the kinematic collider, a pale orange wash on the crab while skills telegraph (seen in screenshots, cause not found), a full boss fight start to victory.
