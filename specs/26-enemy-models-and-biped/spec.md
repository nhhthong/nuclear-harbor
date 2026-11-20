# Feature Specification: Authored enemy models, the Biped, the Medium Mech Striker

**Feature**: `26-enemy-models-and-biped` | **Created**: 2026-11-18 | **Status**: Implemented and merged (PR #15, with spec 27; docs PR #16); not played on a real GPU
**Input**: owner request (Vietnamese, summarised): three robots get authored Sketchfab models and new behaviour. (1) A new infantry type, the "Biped robot", that runs at the player and leaps onto them to claw. (2) The `army` robot becomes the "Medium Mech Striker": bursts of bullets and, now and then, a telegraphed rocket with area damage. (3) The Spot dog only changes model.
**Process**: built by a sub-agent in its own worktree (`worktree-agent-acb2493e6c1abc2c3`) in parallel with the crab boss (spec 27); the coordinator merged both on the dev branch (`1949b1d`, `321e73f`), wrote the ammo budget test and the docs, took screenshots on the low preset, then PR #15 squashed to `main`. The spec was written with the work, not by running the skills in order. Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, scripted screenshots), `[N]` not verified.

## User Scenarios & Testing

### User Story 1 - The Biped (Priority: P1)
A 2.2 m infantry robot patrols its posts. When it notices the player it runs at them; from 3.5 to 13 m, with line of sight, it crouches (0.5 s, head glow), leaps to where the player stood and claws on landing, then freezes for 1.2 s.

**Acceptance**
1. HP 120 (5 hits at 25), chase speed 5.5 m/s, detection 30 m. [U `src/enemies/biped/brain.test.ts`, `damage.test.ts`]
2. The crouch is the telegraph (head glow, folded legs); the landing spot is locked at take-off and ringed on the ground, so a moving player dodges. [U `brain.test.ts` leap plan; B crouch, leap, recover and claw screenshots]
3. Landing claw: 14 damage within 2 m (and at once within 1.3 m during the flight); a player whose feet are above `clearance` **1.3 m** (double jump 1.8 m; it was 1.8 m before the natural-jump change of 2026-11-19) is missed. The landing is 0.9 m short of the locked point. [U `brain.test.ts`, headless manager tests]
4. Adjacent (2.2 m): two-claw swipe, 9 damage, 1.1 s cooldown; leap cooldown 3 s from the landing. [U `brain.test.ts`]
5. Registered like the other types (`EnemyType`, factory, population, radar small square, audio alert variant 1, `?enemies=biped`); a failed GLB falls back to a primitive humanoid. [U population and level tests; fallback [U `authored.test.ts`]]
6. The leap against a moving player in a real run was not played. [N]

### User Story 2 - Medium Mech Striker (Priority: P1)
The `army` robot keeps its id, HP 150, patrol and cover movement (band 14 to 30 m, detection 36 m, back off under 8 m) but shoots like infantry.

**Acceptance**
1. 3-round bursts (5 damage, 0.09 s apart, spread 0.03, bolts 75 m/s through pooled `EnemyProjectiles`, muzzle flash on the forearm), a burst about every 1.6 s at 8 to 35 m with line of sight. [U `src/enemies/army/attack.test.ts`; B bolts in flight]
2. Every 6 to 9 s (launch to launch; first after 3 s) a rocket: 1.1 s telegraph (pods glow, the mech stands still), then 14 damage at the centre falling to 0 at 4 m. [U `attack.test.ts`, `splash.test.ts`; B pods glowing and rockets in flight]
3. The GLB is animated by its own clips (idle, walk, run; reversed walk when backing off), clip speed tied to ground speed. [U `clipPlayer.test.ts`; B]
4. Balance: about 9 damage/s on a still player in its band (old rocket mech about 6). [N, computed, never played]

### User Story 3 - Spot dog model (Priority: P2)
"Walking Robotic Dog" model; behaviour, stats, hit zones unchanged; leg clips merged into one `walk` clip scaled to ground speed, frozen in crouch and leap, head glow red in the telegraph. [B screenshots; U `authored.test.ts` merge]

### User Story 4 - Models load together (Priority: P1)
The population starts only after all authored GLBs (samurai skin, biped, striker, spot) loaded or failed (5 s at most); a failed load falls back to that type's procedural model; `?procedural` skips the GLBs. [U `authored.test.ts`, `population.test.ts`; B all models loaded in screenshots]

## Requirements
- **FR-001** `EnemyType` gains `'biped'`. `ENEMY_COUNTS`: army 5, spot 6, duck 4, biped 4, samurai 3, total 22 (the 4 roster drones of spec 29 are counted apart). `ENEMY_DISTRIBUTION` (army, spot, duck, biped, samurai) **after spec 29**: A 2,2,1,2,1; B 2,2,1,0,0; C empty; D 1,2,2,2,2 (spec 26 shipped A 3,3,2,2,2; B 1,1,1,0,0; D 1,2,1,2,1). [U `src/config/level.test.ts`, `population.test.ts`]
- **FR-002** Models built offline by `tools/asset-pipeline/enemies_sf.py` (Blender 4.0): metres, feet on y = 0, facing -Z, at most 8k triangles each (7.6k to 7.9k), 512 px JPEG; shipped `public/assets/enemies/{biped,striker,spot}.glb` = 0.90, 0.92, 0.93 MB (2.76 MB together; limits 1.2 MB each, 3.5 MB together). CC-BY 4.0, credited in `src/ui/credits.ts`, `CREDITS.md`, `docs/ASSETS.md`. [U shipped-GLB checks in `authored.test.ts`: sizes, triangles, clips, feet on the ground]
- **FR-003** One `AnimationMixer` per robot (`ClipPlayer`), node tree cloned with `SkeletonUtils.clone`, updated from `animate(dt)` of active robots only, disposed with the robot. The biped's run/crouch/leap/claw clips are authored in the Blender script. [U `clipPlayer.test.ts`, `authored.test.ts`; B]
- **FR-004** Numbers in `src/enemies/biped/tunables.ts` (`BIPED`), `src/enemies/army/tunables.ts` (`STRIKER`), `ARMY_ROBOT`; pure logic in `biped/brain.ts` and `army/attack.ts`. [U]
- **FR-005** No per-frame allocation in steady state; glow cues are one material per robot and a shared unit sphere. [N, review only]
- **FR-006** Biped behaviour as in User Story 1. [U, B]
- **FR-007** Striker behaviour as in User Story 2. [U, B]
- **FR-008** Spot is a model swap only. [B; no test of "unchanged"]
- **FR-009** Loading gate and fallbacks as in User Story 4. [U, B]
- **FR-010** Ammo budget: the roster needs 116 hits at 25 damage (army 6, spot 3, duck 3, biped 5, samurai 12 each); 348 with the crab (232) when spec 27 merged and supply 540; **356 vs 570 now** with the 4 roster drones (spec 29). [U `damage.test.ts`]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (test count at merge not recorded; 655 on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** Screenshots show the three robots upright, textured, on the ground, animated; biped crouching and leaping; striker pods glowing. [B, done on the low preset; Blender renders of mid-animation frames also checked]

## Assumptions
- The striker's bullets are slow bolts (75 m/s), not hitscan, so a moving player can dodge some.
- The biped lands 0.9 m short of the locked point so the camera does not end up inside the model.
- At spec time no audio assets were added (`enemyShot` per bullet and rocket, `enemyAlert` variant 1 for the biped); spec 32 later replaced these with recorded samples.
- The Blender 4.0 glTF exporter mis-writes some imported translation tracks: the script rewrites the striker pelvis track.
- Not verified: frame rate with 10 live skinned robots on a real GPU, balance of striker and biped damage, foot sliding at every speed, smoke/e2e (skipped, owner policy).
