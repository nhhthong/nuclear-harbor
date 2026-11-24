# Feature Specification: boss phase two (claw grab and claw quake), no spin, no boss-quay shelters, dragonfly drops

**Feature**: `34-boss-phase-two-and-drops` | **Created**: 2026-11-24 | **Status**: Implemented on branch `ccr-1b1f2332-o3lx35`; not played on a real GPU
**Input**: owner request 2026-11-24: (1) shot-down dragonflies drop ammo or health; (2) remove the healing container in the boss area, so nobody hides and shoots the boss; (3) remove the boss's spin skill (it looks bad); (4) two new skills, only below 50% boss HP: the claws grab the player, lift them into the air and slam them down for huge damage; and the claws pound the ground in time, each pound sending a shockwave outward from the centre, one second apart so the player can jump over each.
**Process**: written with the code by the coordinator (Spec Kit skills not run in order). Checks: `[U file]` unit test, `[B]` scripted browser check (software GL, the default medium preset; the camera screenshots later used the low preset at 640x360), `[N]` not verified.

## Clarified assumptions
- "Healing container in the boss area" = the two safe containers (`SHELTERS` `quay-east`, `quay-west`, zone D; standing inside heals 12 HP/s and robots cannot enter). The medkit crates were NOT changed (a first edit that removed them was reverted).
- "Dragonflies" = the boss's drones and the four roster drones (`type: 'drone'`).
- The claws are the boss's two gun arms (no separate claw model): they raise, lunge and slam by arm rotation, a glow and effects. A claw mesh would be a model task.
- "Below 50%" = boss HP share strictly under 0.5.

## User Scenarios & Testing

### Story 1 - Shot-down dragonflies drop supplies (P1)
A dragonfly destroyed by the player's fire drops a pickup where it fell: a medkit with a chance that grows as the player's HP falls (never above 90% HP, at most 85%), otherwise ammo. Roster drones always drop; the boss's drones with 70% chance. 15 ammo or 20 HP (`ECONOMY.droneDrop*`). Drops use extra pool slots and do not count towards the per-zone enemy drop cap; the old 10% roster ammo drop is skipped for drones. Boss drones killed by the boss dying or a respawn do not drop. [U `logic.test.ts` (kind, chance); events: `enemy:destroyed` type `drone`, new `boss:droneDestroyed`; B [N: no drop collected in a browser run]]

### Story 2 - No hiding place at the boss (P1)
`SHELTERS` loses `quay-east` and `quay-west`: no safe container in zone D, none within the arena radius + 10 m (the three left are in the yard and the court). [U `shelters.test.ts`]

### Story 3 - No spin (P1)
The skill, its tunables (`CRAB.spin`), its logic (`spinRate`, `sweepContact`, `SweepTracker`), the `body-spin` attack id and its audio and vfx routes are gone. The boss's skills are bombs, drones and the four-way laser, plus the two claw skills in phase two. [U `skills.test.ts`]

### Story 4 - Claw grab (phase two, P1)
Eligible below 50% HP with the player 4 to 24 m away (cooldown 18 s, weight 4). Telegraph 1.2 s: arms rise, glow, ring on the boss; the lunge target follows the player for 0.8 s, then it is frozen and the landing spot is marked for the last 0.4 s. Lunge 0.5 s to the frozen point (at most 20 m). The claws close on the player if within 3.4 m of the claw point (7 m in front of the body) and below 1.3 m: stepping aside or jumping dodges it. Grabbed: controls locked, lifted 9 m in 0.9 s, held 0.4 s, slammed down in 0.22 s for 70 damage (not a one-shot from full health), 0.8 s of protection afterwards, then 1.2 s of recovery (a miss: 1.6 s). The player is released on the slam, a respawn or the boss's death. [U `skills.test.ts` (claw point, lunge, connect rule, carry profile); B (see tasks)]

### Story 5 - Claw quake (phase two, P1)
Eligible below 50% HP with the player within 34 m (cooldown 15 s, weight 3.5). Telegraph 1 s (pulsing ring). Then four pounds, exactly 1 s apart, each sends an expanding ring from the body centre at 13 m/s up to 32 m (visual ring plus damage band 2.2 m wide). A ring hurts a player standing on the ground (feet below 0.9 m) once, when it reaches them: 24 damage and a small knockback; a jump (single jump is enough) clears it. [U `skills.test.ts` (`QuakeWaves`: once per ring, airborne safe, 4 rings = 4 hits if never jumped, scaling); B]

## Requirements
- **FR-001** `droneDropKind`, `droneDrops`, `ECONOMY.droneDrop*`, pickups wiring, `boss:droneDestroyed`, `Drones.onShotDown`. [U logic; wiring N]
- **FR-002** No shelter in zone D. [U]
- **FR-003** Spin removed everywhere. [U, tsc]
- **FR-004** Skills `grab` (`claw-grab`) and `quake` (`claw-quake`), `inPhaseTwo`, `CRAB.grab`, `CRAB.quake`, `CRAB.phase2`. [U]
- **FR-005** Boss module: lunge, carry (player teleported along the claw point each step, controls locked), slam damage, quake pounds and rings (`BossEffects.launchRing`), arm animation (`BodyAnim.claw`). [B; carry and ring feel N]
- **FR-006** Audio and vfx routes for the two attack ids (`bossSlam`; dust and telegraph ring). [U route tests]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass.
- **SC-002** Browser check (default medium preset): below 50% HP `force('grab')` runs telegraph, lunge, then carry or recover, with the player lifted and then damaged on a hit; `force('quake')` fires four pounds one second apart with live rings. [B]

## Not verified
Real-GPU look and frame rate of the rings and the lift; the feel of the dodge windows (sidestep and jump for the grab, jump timing for the rings); balance of 70 and 24 damage against the drone heals; the camera while carried (controls are locked, the camera does not follow the lift); whether the shelters' absence leaves another hiding place (containers on the quay can still be used as cover); no claw model (arms rotate).
