# Research (T-21)

- **Decision**: dinosaur is its own `Damageable` (kind `enemy`), not an `Enemy` in `ctx.enemies`. Rationale: `EnemyType` is a closed shared union, and population totals/T-16 count `ctx.enemies`; the weapon only needs `ColliderMeta.damageable`. Alternative: add `'dino'` to `EnemyType` (shared file edit, risks totals).
- **Decision**: own events `dino:spawned/roar/telegraph/attack/stunned/defeated`; roar carries a `shake` amount. Rationale: `boss:*` and `enemy:*` events have HUD/flow consumers that would misread a semi-boss.
- **Decision**: camera shake = small decaying offset added to `ctx.camera` after the player module poses it (registry order places dinosaur after player). No shared shake service exists.
- **Decision**: drops are the module's own bounded pickups (3 ammo crates = ECONOMY.ammoCrateAmount each... see tunables, 1 medkit) collected by distance, granting via `weapon:grantAmmo` and `player.heal`, announced with `pickup:spawned/collected`. Rationale: the pickups module only drops 15 ammo at random on `enemy:destroyed`; a guaranteed drop needs a foundation request (recorded).
- **Decision**: model uses one vertex-coloured armour material + one emissive glow material; animated parts (2 legs, 3 tail groups, jaw) are separate merged meshes per material, rest merged static: ~14 meshes. Alternative of one material per reference material would be ~35 draws.
- **Decision**: movement uses world raycasts (Groups worldOnly) for wall stops and spawn-spot search, not the enemies nav grid (other feature folder). Leash 28 m around the guard spot.
- **Decision**: seed from `?seed=<int|string>`, hashed; default `Date.now()`. Mulberry32 + partial Fisher-Yates for 2 of 4.
- **Decision**: tower 3 guard stands on the ground beside the gantry (spot search around the tower at 10 m), distance trigger is horizontal.
