# Tickets

> **Historical.** Tickets T-01..T-23 describe the first version of the game; later reworks have no ticket (see `docs/DEVIATIONS.md`, `specs/README.md`). Current state: `docs/PLAN.md` "Current state".

Plan, architecture and Definition of Done: [`docs/PLAN.md`](../PLAN.md). Workflow per ticket:
[`docs/SPECKIT.md`](../SPECKIT.md). Each ticket is the input to `speckit-specify`.

| ID | Title | Wave | Depends on | Status |
|---|---|---|---|---|
| [T-01](T-01-player-controller.md) | Player controller (movement, look, camera) | 1 | — | done |
| [T-02](T-02-weapon.md) | Weapon (shooting, reload, ammo, procedural view model) | 1 | — | done |
| [T-03](T-03-world-greybox.md) | Harbor world greybox (ground, containers, warehouse, dock, ocean, lighting) | 1 | — | done |
| [T-04](T-04-cranes-and-anchors.md) | Cranes, perches, lamp posts and grapple anchors | 1 | — | done; anchors/perches unused now |
| [T-05](T-05-enemy-framework-sphere.md) | Enemy framework and army mech (id `army`, was sphere robot) | 1 | — | done |
| [T-06](T-06-hud-menus.md) | HUD, menus and settings | 1 | — | done |
| [T-07](T-07-audio.md) | Procedural audio (Web Audio synthesis) | 1 | — | done |
| [T-08](T-08-objectives.md) | Activation towers and nuclear countdown | 1 | — | done; now 1 tower |
| [T-09](T-09-pickups.md) | Pickups: ammo crates, medkits and enemy drops | 1 | — | done |
| [T-10](T-10-vfx.md) | VFX: pooled particles and effects | 1 | — | done |
| [T-11](T-11-perf-debug.md) | Performance monitor and debug overlay | 1 | — | done |
| [T-12](T-12-grappling-hook.md) | Grappling hook | 2 | T-01 (hard). Soft: T-04/T-03 for in-level anchors (the sandbox pillar and perch are enough to build and test) | done; **grapple later REMOVED** |
| [T-13](T-13-spider-robot.md) | Spot dog (id `spot`, was spider robot; replaced by T-19) | 2 | T-05 | done |
| [T-14](T-14-charger-robot.md) | Charger robot (replaced by the Bomber Duck, T-19) | 2 | T-05 (hard). Soft: T-01 for feeling the knockback (the `PlayerState.addImpulse` contract already exists) | done |
| [T-15](T-15-boss-titan04.md) | TITAN-04 boss fight (model/cinematic replaced by T-22) | 2 | T-02 (to shoot it in play). Soft: T-04 (arena perches), T-10 (effects), T-06 (boss HUD) — all through events | done |
| [T-16](T-16-game-flow-integration.md) | Game flow, level population and vertical slice | 3 | T-01 … T-15 merged | done |
| [T-17](T-17-optimization-offline.md) | Optimisation and offline packaging | 4 | T-16 (and T-11 for measurements) | done |
| [T-18](T-18-weapon-asset-pipeline.md) | Weapon asset pipeline MDL → GLB (optional) | optional | T-02 merged (done; asset supplied, see `docs/ASSETS.md`) | done |

Wave 1 tickets are independent of each other and can all start immediately. A later wave starts
when its dependencies are merged.

## Robot refresh and later work

Brief and role mapping: [`ROBOT-REFRESH.md`](ROBOT-REFRESH.md). Status as of the last merge (no e2e was run after these merges, see `CLAUDE.md`):

| ID | Title | Status |
|---|---|---|
| T-19 | Bomber Duck (id `duck`) + Spot dog (id `spot`) | merged; typecheck + unit tests only |
| T-20 | Vanguard army mech (id `army`) | merged; typecheck + unit tests only |
| T-21 | Dinosaur semi-boss | REPLACED by the mecha scorpion STINGER-7 (`src/scorpion`); `src/dinosaur` is gone |
| T-22 | Final boss: spherical walker + landing cinematic | merged; T-22 and T-15 e2e passed before the merge, full run unverified |
| T-23 | Cleanup phase A (dead code, stale docs) and phase B (id rename, old robots removed) | done |
| (no ticket) | Reworks done directly at owner request, no Spec Kit: sunset/no rain, robot/pickup/VFX/menu upgrade, HUD + radar, scorpion, 3 samurai, stepping gaits, 72 x 122 m quay with irregular yard, area streaming, empty spawn, higher jumps, healing shelters | done; see `docs/DEVIATIONS.md` |
| next | Owner playtest on a real GPU, then follow-ups | not started |

Ticket template for new work: [`_TEMPLATE.md`](_TEMPLATE.md).
