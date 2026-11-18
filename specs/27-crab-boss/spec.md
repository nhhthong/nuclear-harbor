# Feature Specification: Gunslinger Crab Mech final boss

**Feature**: `27-crab-boss` | **Created**: 2026-11-18 | **Status**: Implemented (not played on a real GPU)

## Summary
The final boss TITAN-04 (spherical walker, four knee weak points, then a core) is replaced by the **Gunslinger Crab Mech**: one tanky HP pool of **5800 HP** (232 hits at 25 damage), no weak points, no core stage, four skills with clear telegraphs and 3 to 4 dragonfly drones that fight beside it. Victory on death, as before.

## User Scenarios
### US1 - Fight one big machine (P1)
After the relay countdown the crab drops into the arena (landing cinematic kept), the boss bar shows one HP pool, every hit anywhere on the body counts.
- Given the boss is in the `fight` phase, when a bullet hits any collider of the crab, then the HP pool drops by 25 and the HUD bar follows.
- Given 232 hits, then the boss is destroyed, collapses and the victory flow runs.
- Given `?boss`, then it spawns after 0.4 s; `?bossphase=low` (or the old `core`) starts the fight at 20% HP.

### US2 - Four readable skills (P1)
- Carpet bombs: a line of 5 lobbed bombs towards the player plus a ring of 6 around them; each shows a ground marker for 1.2 s, then explodes (5 m, 18 damage, 35% at the edge).
- Dragonfly drones: 3 to 4 launched from the rear bay (cap 6 alive, re-release only with fewer than 2 left); they circle the player at 4 to 9 m and fire slow 3-damage bolts after a visible glow; 40 HP (two hits), no drops, die with the boss.
- 360 spin: only when the player is within 16 m; 0.8 s wind-up (crouch, glow, ground ring of 14 m), then 2.5 s of spinning; each arm sweep that touches the player does 25 damage plus knockback, once per contact; jumping above 2.4 m avoids it.
- Four-way laser: 1.5 s of thin warning lines, then four beams (cross, 1.2 m wide, 1 m high) rotating 180 degrees in 4.5 s; 10 damage every 0.25 s while touching; beams stop at containers; the player can jump over them.
- Selection is weighted by distance and cooldowns, one skill at a time with a 1.2 to 2.4 s gap; between skills the crab walks to keep a 10 to 17 m band, strafes inside it and turns slowly towards the player.

### US3 - Look (P2)
The crab is the CC-BY "Gunslinger Crab Mech v1.2" (vaportrash) with legs split at the hips and a procedural tripod gait; the drones are the CC-BY "Light Assault Mech" (Lagst, a dragonfly flyer). If a GLB fails to load, the old procedural body / a procedural flyer is used.

## Requirements
- FR-1 One HP pool (`BOSS.hp` = 5800), phases dormant -> awakening -> fight -> destroyed; invulnerable while awakening.
- FR-2 No weak point mechanic in model, colliders, HUD, audio or events: `boss:weakPoint*` and `boss:coreExposed` stay in the event catalogue but are never emitted; `boss:coreDamaged` carries every hit on the pool; `boss:spawned` has `weakPoints: 0`.
- FR-3 Skill numbers live in `src/boss/tunables.ts` (`CRAB`); selection, bomb pattern, beam angles and hit test, drone cap and spin contacts are pure and unit tested (`src/boss/skills.ts`).
- FR-4 Hit volume is Rapier primitives only (cuboids); drones are pooled kinematic ball colliders exposing `damageable` in the physics meta, so the weapon's hitscan damages them; they are not in the roster.
- FR-5 GLBs load asynchronously with a boss-local loader; the spawn waits at most 5 s; fallback bodies; everything disposed with the `boss` resource scope.
- FR-6 Ammo budget: the boss needs 232 hits; supply stays 540 rounds at 65% accuracy.

## Assumptions
- The crab is 10.4 m across and 8.4 m tall with the launcher (the brief said 11 to 12 m and about 6 m; the source proportions win). The drone is a 4.2 m wingspan flyer, not a 1.2 m body: the source's wings are ten times the body length.
- The cinematic and landing keep the old `scale` convention (harbor 0.5); crab sizes are real metres, multiplied by `scale / 0.5` in the sandbox.
- Beams are clipped against the world at 30 Hz; drones fly over containers (no avoidance).
- Out of scope: new audio assets (new skills reuse existing sounds), drones on the radar, e2e scripts (stale).
