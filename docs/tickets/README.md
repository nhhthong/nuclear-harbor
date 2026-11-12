# Tickets

Plan, architecture and Definition of Done: [`docs/PLAN.md`](../PLAN.md). Workflow per ticket:
[`docs/SPECKIT.md`](../SPECKIT.md). Each ticket is the input to `speckit-specify`.

| ID | Title | Wave | Depends on |
|---|---|---|---|
| [T-01](T-01-player-controller.md) | Player controller (movement, look, camera) | 1 | — |
| [T-02](T-02-weapon.md) | Weapon (shooting, reload, ammo, procedural view model) | 1 | — |
| [T-03](T-03-world-greybox.md) | Harbor world greybox (ground, containers, warehouse, dock, ocean, lighting) | 1 | — |
| [T-04](T-04-cranes-and-anchors.md) | Cranes, perches, lamp posts and grapple anchors | 1 | — |
| [T-05](T-05-enemy-framework-sphere.md) | Enemy framework and sphere robot | 1 | — |
| [T-06](T-06-hud-menus.md) | HUD, menus and settings | 1 | — |
| [T-07](T-07-audio.md) | Procedural audio (Web Audio synthesis) | 1 | — |
| [T-08](T-08-objectives.md) | Activation towers and nuclear countdown | 1 | — |
| [T-09](T-09-pickups.md) | Pickups: ammo crates, medkits and enemy drops | 1 | — |
| [T-10](T-10-vfx.md) | VFX: pooled particles and effects | 1 | — |
| [T-11](T-11-perf-debug.md) | Performance monitor and debug overlay | 1 | — |
| [T-12](T-12-grappling-hook.md) | Grappling hook | 2 | T-01 (hard). Soft: T-04/T-03 for in-level anchors (the sandbox pillar and perch are enough to build and test) |
| [T-13](T-13-spider-robot.md) | Spider robot | 2 | T-05 |
| [T-14](T-14-charger-robot.md) | Charger robot (shielded rhino) | 2 | T-05 (hard). Soft: T-01 for feeling the knockback (the `PlayerState.addImpulse` contract already exists) |
| [T-15](T-15-boss-titan04.md) | TITAN-04 boss fight | 2 | T-02 (to shoot it in play). Soft: T-04 (arena perches), T-10 (effects), T-06 (boss HUD) — all through events |
| [T-16](T-16-game-flow-integration.md) | Game flow, level population and vertical slice | 3 | T-01 … T-15 merged |
| [T-17](T-17-optimization-offline.md) | Optimisation and offline packaging | 4 | T-16 (and T-11 for measurements) |
| [T-18](T-18-weapon-asset-pipeline.md) | Weapon asset pipeline MDL → GLB (optional) | optional | T-02 merged AND the user uploads the GameBanana archive (BLOCKED until then) |

Wave 1 tickets are independent of each other and can all start immediately. A later wave starts
when its dependencies are merged.
