# Feature Specification: Authored enemy models, the Biped, the Medium Mech Striker

**Feature**: `26-enemy-models-and-biped` | **Created**: 2026-11-18 | **Status**: Implemented (not playtested on a real GPU)
**Input**: owner request (Vietnamese, summarised): three robots get authored Sketchfab models and new behaviour. (1) A new infantry type, the "Biped robot", that runs at the player and leaps onto them to claw. (2) The `army` robot becomes the "Medium Mech Striker": bursts of bullets and, now and then, a telegraphed rocket with area damage. (3) The Spot dog only changes model.

## User Scenarios & Testing

### User Story 1 - The Biped (Priority: P1)
A 2.2 m infantry robot patrols its posts. When it notices the player it runs at them (5.5 m/s); from 3.5 to 13 m, with line of sight, it crouches (0.5 s, head glow), leaps to where the player stood and claws on landing, then freezes for 1.2 s.

**Acceptance**
1. HP 120 (5 hits at 25), chase speed 5.5 m/s, detection 30 m.
2. The crouch is the telegraph: head glow ramps up, the legs fold; the landing spot is locked at take-off, a ring marks it, so a moving player dodges.
3. Landing claw: 14 damage within 2 m (and at once when the player is within 1.3 m during the flight); a player whose feet are above 1.8 m (double jump) is missed. The landing is 0.9 m short of the locked point, never inside the player.
4. Adjacent (2.2 m): quick two-claw swipe, 9 damage, 1.1 s cooldown. Leap cooldown 3 s from the landing.
5. Registered like the other types (`EnemyType`, factory, population, radar, audio variant, `?enemies=biped`); the GLB failing to load falls back to a primitive humanoid.

### User Story 2 - Medium Mech Striker (Priority: P1)
The `army` robot keeps its id, HP 150, patrol and cover movement (advance, strafe, back off under 8 m) but shoots like infantry.

**Acceptance**
1. 3-round bursts (5 damage each, 0.09 s apart, small spread, muzzle flash, visible tracer), a burst about every 1.6 s at 8 to 35 m with line of sight; pooled bolts (`EnemyProjectiles`).
2. Every 6 to 9 s (launch to launch) a rocket: 1.1 s telegraph (the rocket pods glow, the mech stands still), then a rocket with 14 damage at the centre falling linearly to 0 at 4 m.
3. The authored GLB is animated by its own clips (idle, walk, run; reversed walk when backing off), feet planted by scaling the clip speed to the ground speed.

### User Story 3 - Spot dog model (Priority: P2)
The dog uses "Walking Robotic Dog"; behaviour, stats and hit zones are unchanged.

### User Story 4 - Models load together (Priority: P1)
The population starts only after all authored GLBs (samurai, biped, striker, spot) have loaded or failed (5 s at most); a failed load falls back to that type's procedural model.

## Requirements
- **FR-001** `EnemyType` gains `'biped'`. `ENEMY_COUNTS`: army 5, spot 6, duck 4, biped 4, samurai 3, total 22. `ENEMY_DISTRIBUTION` (army, spot, duck, biped, samurai): A 3,3,2,2,2; B 1,1,1,0,0; C all 0; D 1,2,1,2,1.
- **FR-002** Models are built offline by `tools/asset-pipeline/enemies_sf.py` (Blender 4.0): stray bases removed, metres, feet on y = 0, facing -Z, at most 8k triangles each, 512 px JPEG, each GLB at most 1.2 MB, 3.5 MB together. Output `public/assets/enemies/{biped,striker,spot}.glb`. CC-BY 4.0: credits in `src/ui/credits.ts` and `docs/ASSETS.md`.
- **FR-003** Animation: one `AnimationMixer` per robot (`ClipPlayer`), the node tree cloned with `SkeletonUtils.clone` (own skeleton, shared geometry and materials), updated from the robot's `animate(dt)`, disposed with the robot. The biped has no run/leap/claw in its source: those clips are authored in the Blender script.
- **FR-004** Gameplay numbers live in `src/enemies/biped/tunables.ts`, `src/enemies/army/tunables.ts` (`STRIKER`) and `ARMY_ROBOT`; pure logic (`biped/brain.ts`, `army/attack.ts`) is unit-tested.
- **FR-005** No per-frame allocation in steady state; glow cues are one material per robot and a shared unit sphere.

## Success Criteria
- `npx tsc --noEmit`, unit tests and build pass; GLB sizes and triangle counts are asserted by tests.
- Scripted screenshots show the three robots upright, textured, on the ground, animated, the biped crouching and leaping and the striker with its pods glowing.

## Assumptions
- Ammo budget: the roster now needs 116 hits (was 99 + samurai); with the boss at 240 the total is 356 and the budget inequality assumes the boss rework (232, 348 in all).
- The striker's bullets are slow-ish bolts (75 m/s) rather than hitscan, so a moving player can dodge some of them.
- The biped lands 0.9 m short of the locked point so that the camera does not end up inside the model.
- No audio assets were added: the existing `enemyShot` sound plays per bullet and rocket, `enemyAlert` (variant 1) when the biped notices the player.
