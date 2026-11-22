# Feature Specification: solo boss fight, higher double jump, locked boss gates, more ammo, scorpion unstuck

**Feature**: `33-boss-solo-jump-gates-ammo` | **Created**: 2026-11-21 | **Status**: Implemented on branch `ccr-1b1f2332-o3lx35`; not played on a real GPU
**Input**: owner request 2026-11-21, five items, after real play-testing: (1) raise the double jump so a one-high container top is reachable; (2) no robots in the boss area, the boss fights the player alone ("too hard now"); revised the same day: robots stay spread around the rest of the map, only the spawn apron and the boss quay are empty, and the roster is rebalanced (hard but fair); (3) the gate into the boss quay opens only once the relay tower is active; (4) more ammo crates around the map; (5) the "mantis" robot can get stuck in the map: when stuck it must find its own way out to free space.
**Process**: written with the code by the coordinator (Spec Kit skills not run in order, as for specs 24 to 32). Checks: `[U file]` unit test, `[B]` scripted browser check (low preset, software GL), `[N]` not verified.

## Clarified assumptions (owner said "clear what is left ambiguous")
- "Mantis robot" = the large crawling STINGER-7 scorpion (`src/scorpion`): it is the only ground robot that walks by wall probes, not by the nav grid, so it is the one that wedges between containers. The nav-grid robots (including the clawing Biped) route around obstacles and are unchanged.
- "Gate into the boss" = the court/quay fence gates (`court-quay-west`, `court-quay-east`, spec 30). "Pillar" = the relay tower (the only tower), so "active" = `objectives:allActivated`.
- "Boss area" = the quay (zone D, behind the locked gates). Robots are NOT cleared from the rest of the map (owner correction); the scorpion and the call-in are untouched. The first version of this spec (destroy every robot when the tower activates) was rejected by the owner and removed.
- "Enough to jump onto a container top" = one-high (2.59 m) only; stacks of two or more stay out of reach.

## User Scenarios & Testing

### Story 1 - Double jump onto a container (P1)
1. Ground jump 0.95 m unchanged; the air jump now adds about 2.25 m (`PLAYER.airJumpSpeed` 11.6 m/s), so about 3.2 m chained near the apex; reach is at least container height + 0.4 m and below a two-high stack (5.18 m). [U `src/core/ads.test.ts`]
2. A walking player who jumps 3.6 m from the face and presses jump again 8 ticks later lands on a one-high container and stands on it. The jump window is roughly 2.7 to 4.8 m at walking speed (wider when sprinting). [U `PlayerController.test.ts`]
3. Side effect: the samurai (1.8 m) and scorpion (1.9 m) dodge clearances are now below the double jump (resolves open owner decision 3 of the 2026-11 analysis). The crescent wave is 2.9 m tall and is still dodged sideways.

### Story 2 - The boss fights alone, the roster stays around the map (P1)
1. The quay holds no roster robot and no roster drone (`ENEMY_DISTRIBUTION.D` all 0, the quay drone post moved to the court); the gate apron (spawn) stays empty. The nine robots that were in the quay moved into the yard and the court. [U `level.test.ts`, `population.test.ts`: no point of any patrol in zone D or the arena, all points walkable, all farther than 32 m from the spawn]
2. Roster (still 22 ground robots + 4 drones; 10 alive at most): yard A army 2, spot 3, duck 1, biped 3, samurai 2 (11); court B army 3, spot 3, duck 3, biped 1, samurai 1 (11). The one court samurai patrols the east end (more than 15 m from the tower ring; the scorpion keeps the tower). [U]
3. When the tower activates the whole quay is closed to robots on the nav grid (`EnemyManager.sealBossQuay`, on `objectives:allActivated`), so robots from the yard and court cannot follow the player into the fight even though the gates stay open. Robots elsewhere keep living. [U `EnemyManager.test.ts`; B `quaySealed` true after `forceActivate(1)`]
4. Balance intent: the same 22 robots and the live cap of 10 as before, but all of them are met before the tower, none during the boss. Court density is the risk (tower hold with 11 robots and the scorpion): tune `ENEMY_DISTRIBUTION` first. [N]

### Story 3 - Boss gates locked until the tower is active (P1)
1. `GATES.gates[].lockedUntilTower` is true for the two court/quay gates. While locked, touches from the player and from robots do nothing and the leaves stay a solid GATE-layer block; a hint toast "Gate locked: activate the relay tower first" shows at most every 4 s while the player stands at the gate. [U `gates.test.ts`]
2. On `objectives:allActivated` both gates unlock, swing open away from the court and stay open for the rest of the run (they do not close again); `world:gateMoved` plays the clank. Other gates are unchanged. [U; B: before -> locked/closed, after forceActivate -> unlocked/opening]
3. A respawn at the `boss-start` checkpoint keeps them open (state is not reset).

### Story 4 - More ammo (P2)
Four more ground crates: yard (-28, -9) and (-20, 5), court (-30, -35) and (28, -35); `ECONOMY.ammoCratesInZones` 12 (was 8). Supply 210 + (12 + 4) x 30 = 690 (was 570). Demand 356 hits is unchanged, so the margin at 0.65 accuracy goes from 14 to 92 hits. [U `placements.test.ts`, `damage.test.ts`]
The two quay supplies (crate and medkit, zone D) are reachable only after the tower.

### Story 5 - Scorpion unstuck (P1)
It tracks whether it wants to walk (guard to its spot, or chase) yet moves less than 1 m in 3 s of trying (time spent in skills does not count). Then: if it was stuck less than 8 s ago, or every heading is blocked within 1.8 m, it is moved to the nearest free spot (rings of 2 m up to 16 m around itself, then its guard spot; free = land, 8 wall probes clear to 3 m, no roof above); otherwise it crawls for 1.8 s along the most open of 16 headings (preferring straight back), at 0.8 x walk speed. [U `unstuck.test.ts` (pure helpers), `unstuckSim.test.ts` (headless Rapier: pocket closed towards the player, and a 4.6 m box)]

## Requirements
- **FR-001** `PLAYER.airJumpSpeed` 11.6, reach >= container + 0.4 m and < 2 x container. [U]
- **FR-002** Empty quay and spawn apron, rebalanced `ENEMY_DISTRIBUTION` and posts, `EnemyManager.sealBossQuay()` on `objectives:allActivated`. [U]
- **FR-003** `GateState.locked/held`, `GateSystem.unlockAll()`, `bumped`, toast; `GATES.gates[].lockedUntilTower`, `lockedToastEvery`. [U, B]
- **FR-004** 12 zone crates, test budget 690. [U]
- **FR-005** `StuckTracker`, `pickEscapeHeading`, `isBoxedIn` (`src/scorpion/unstuck.ts`), `SCORPION.stuck` tunables, crawl and relocate in `Scorpion.ts`. [U]
- **FR-006** Samurai fan offset and crescent aim limit moved into `SAMURAI` tunables (earlier PR #24, T011 of spec 31). [done]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, `npm test` (see tasks), `npm run build` pass.
- **SC-002** Low-preset browser check: gates locked at start, unlocked and opening after the tower, boss-solo flag set, no console errors. [B]

## Not verified
Real-GPU frame rate; feel of the new jump (the 2.7 to 4.8 m window, sprint jumps, the tower being climbable with other props); a full run with the solo boss; court density during the tower hold; the scorpion in the real yard between containers (only tested in synthetic pockets); gates locked while a robot stands at them; whether removing the quay roster makes the run too easy; sound of retiring the scorpion.
