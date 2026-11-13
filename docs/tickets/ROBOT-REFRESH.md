# Robot refresh (T-19 .. T-23)

Owner request: replace the placeholder enemies with the five reference models in `docs/reference-models/*.html`
(Three.js demos loading three from a CDN; they are VISUAL + BEHAVIOUR references only) and upgrade their behaviour.
Four agents build, one agent cleans. Spec Kit is mandatory for T-19..T-22 (see docs/SPECKIT.md "Enforcement"); spec dirs below.

## Role mapping (keeps the GDD totals 14 / 10 / 6 = 30 normal robots)
The internal EnemyType ids are NOT renamed during this work (avoids merge conflicts); T-23 renames them at the end.

| Internal id (kept for now) | Old placeholder | New robot | Reference file | Ticket |
|---|---|---|---|---|
| `charger` (6) | Charger | **Bomber Duck** | bomber_duck.html | T-19 |
| `spider` (10) | Spider | **Spot dog** | spot_robot.html | T-19 |
| `sphere` (14) | Sphere robot | **Vanguard army mech** | robot_army.html | T-20 |
| new, not counted in the 30 | – | **Dinosaur semi-boss** | dinosaur_semi_boss.html | T-21 |
| boss (replaces TITAN-04 model) | TITAN-04 | **Final boss (spherical walker)** | final_boss.html | T-22 |

## Rules for every model port
- Port the geometry/materials/colours of the reference faithfully (same silhouette, palette, glowing parts), as TypeScript builders.
  Generated canvas textures are created ONCE and shared (never per instance). No CDN, no post-processing/bloom (use emissive materials), no OrbitControls/UI from the demos.
- Draw-call budget is a hard rule (global `maxDrawCalls` 350, harbor now ~118-215 with 30 robots): merge static meshes per material
  (`BufferGeometryUtils.mergeGeometries`), keep only truly animated parts separate. Targets: normal robot <= 6 draw calls near and 1-2 far
  (`THREE.LOD`), dinosaur <= 25, final boss <= 40. Dispose through the module resource scope. No per-frame allocation in AI/animation.
- Keep every existing contract: events in `src/core/events.ts`, `Enemy`/`Damageable` interfaces, AIUpdateScheduler, pooling, test hooks,
  hit zones (crit 2x), VFX/audio event hooks (`enemy:*`). New numbers go in the module's own `tunables.ts`.
- Remove the code, tunables and tests of the placeholder you replace INSIDE YOUR OWN FILES (do not touch other agents' folders).
  Shared files (`src/enemies/factories.ts`, `population.ts`, `src/core/*`, `src/config/tunables.ts`, `src/modules.ts`): minimal line-local edits only; anything larger goes into `specs/<dir>/foundation-requests.md`.
- Update/extend the affected unit tests and e2e files; every existing e2e must stay green (run each file separately, unique `SMOKE_PORT`, `npm run build` before e2e).
- Verify visually: Playwright screenshots at deviceScaleFactor 1, LOOK at them and describe honestly. To compare with a reference, open the reference html in
  Playwright with `page.route` serving `three` / `three/addons/*` from `node_modules/three` instead of the CDN.
- Never commit node_modules (a symlink was committed once by mistake). Do not push, no PRs, own worktree, final report <= 250 words.

## T-19 Bomber Duck + Spot dog (agent 1) — `specs/T-19-duck-spot/`
Owns: `src/enemies/duck/**` (new), `src/enemies/spot/**` (new), deletes `src/enemies/charger/**` and `src/enemies/spider/**`; edits `factories.ts` entries for ids `charger` and `spider` only.
- **Duck** (id `charger`): patrols; on detect it hops toward the player (parabolic hops, like a rubber-duck bounce, faster than the player walk speed but slower than sprint); within ~2.5 m it stops and arms a **3 - 2 - 1 countdown** (visible: flashing light, audible beeps via events, each count 1 s), then **explodes: 15 HP damage** (fixed) to the player within the blast radius (~4 m, tunable), small VFX, duck destroyed. If shot dead before zero: no explosion damage (small pop only). If the player is > blast radius at zero: harmless pop. Low HP (~60). Tunable fuse/hop/radius. Telegraph clearly (GDD pillar 1).
- **Spot dog** (id `spider`): weak (HP ~70), fast. On detect it **dashes/leaps to the player and rams** (headbutt): ~10 damage + short knockback, then retreats/circles, cooldown ~2.5 s. Legs animate (trot) via few merged parts; the reference has wheel feet: keep them (rolling) or keep legs, but it must read as the reference silhouette (yellow chassis, rifle prop on the back may be kept static).
- Ranges/speeds from GDD 6.2 as a starting point for Spot; both respect `AIUpdateScheduler` LOD (dormant/simplified).

## T-20 Vanguard army mech (agent 2) — `specs/T-20-army-robot/`
Owns: `src/enemies/army/**` (new), deletes `src/enemies/SphereRobot.ts`, `sphereBrain*.ts`; edits the `sphere` entry in `factories.ts` and `SPHERE_ROBOT` in `src/config/tunables.ts` (rename block to ARMY_ROBOT only inside that block if no other agent touches it).
- Orange heavy assault mech (biped, missile cells), HP ~150.
- Patrol: **slow, wandering patrol** around waypoints (~1.5 m/s), heavy footsteps, idle scanning.
- On detect (~30 m): switches to **smooth, disciplined military movement**: accelerates/decelerates (no snapping), limited turn rate, advances to a firing position (~18-25 m), strafes, keeps cover/distance, retreats if the player closes under ~8 m. Fires **rockets**: slow visible projectile (pooled, ~25 m/s), splash radius ~3 m, ~12 damage, salvo of 2-3 with ~3 s cooldown, telegraphed by the missile-cell glow/opening. Use `EnemyProjectiles`/pools; add a rocket kind there if needed (it is yours for this ticket).

## T-21 Dinosaur semi-boss (agent 3) — `specs/T-21-dinosaur/`
Owns: `src/dinosaur/**` (new module; register in `src/modules.ts` with a one-line edit), `tests/e2e/T-21-*.e2e.mjs`.
- Mecha T-Rex, **about 9 m tall**, HP ~1500, hits anywhere, head = crit 2x, NOT part of the 30-robot count (do not change population totals/tests).
- **Appears randomly at towers**: at run start pick 2 random distinct towers (seeded RNG; honour a `?seed=` param, deterministic in tests); it spawns when the player first comes within ~35 m of that tower (roar + camera shake event, with a short spawn-in effect), guards the tower, and persists until killed. Drops ammo + medkit on death (existing pickup drop API).
- **3 skills** (all telegraphed >= 0.8 s, damage + radius in tunables):
  1. **Ram/charge** (like the old Charger: locked direction, stun on wall hit, ~25 dmg).
  2. **Tail spin**: spins 360 degrees sweeping the tail (radius ~9 m ring, ~20 dmg, brief window).
  3. **Leap + stomp**: jumps to the player's position, AOE shockwave on landing (radius ~8 m, ~30 dmg, falloff), dust VFX, brief stun of the dino.
  Skill choice by distance/cooldown (ram far, leap mid, tail spin close). Follow the boss module's collider/hit patterns (`src/boss/BossColliders.ts`) so bullets register.

## T-22 Final boss (agent 4) — `specs/T-22-final-boss/`
Owns: `src/boss/**` (replace the TITAN-04 model/attacks as needed), `tests/e2e/T-15-*.e2e.mjs` and new `tests/e2e/T-22-*.e2e.mjs`, the cinematic (put cinematic UI such as letterbox bars in `src/boss/` and drive it through existing events; request new events via foundation-requests only if unavoidable).
- Model = the spherical walker (4 legs, red/white armour, glowing orange eye + knee LEDs). **About twice the dinosaur: ~18 m tall**, i.e. clearly taller than a warehouse (10 m).
- **Takes damage only from shots at its lights**: the 4 glowing knee LED rings are the 4 weak points (500 HP each; rest of the armour deals 0 damage but gives spark feedback); when all four are destroyed the central eye (core) opens and takes damage (GDD 9.2/9.3, core HP 4000 stays tunable). Keep Heavy Cannon, Ground Slam, Missile Barrage with telegraphs.
- **Appears only after the last tower is completed** (event `objectives:allActivated`; the owner wrote "destroyed", we keep the GDD meaning: all four towers done). It **falls from the sky onto an empty spot** of the boss arena (use the boss arena centre / keep-clear zone from `src/config/level.ts`, must not land on the player or props) with a **cinematic**: ~6 s, camera leaves the player, shows the sky and the descent (motion blur-free: speed streaks/trail, glow), impact with shockwave ring, dust, strong camera shake, roar, letterbox bars and boss title card; player input locked and invulnerable during it; skippable with a key (e.g. E) after 2 s; then Weak-point-hunt phase starts. Everything procedural, no assets. Make the cinematic testable (test hook to fast-forward) and add an e2e.

## T-23 Cleanup (agent 5) — no Spec Kit; deletion report instead
Phase A (now, parallel with T-19..T-22, must not touch `src/enemies/**`, `src/boss/**`, `src/dinosaur/**`):
find and remove information that is no longer used: unused exports/tunables/events outside those folders, dead files and scripts, stale doc text
(e.g. T-18 "BLOCKED" notes, the old DesertTech/GameBanana asset story, references to removed assets), duplicate or obsolete screenshots in `docs/`, unused npm scripts/deps.
Rules: do NOT delete `specs/**` history, `docs/GDD.md`, reference models, or anything used by a test; prove each deletion with `grep`/typecheck/tests/build; `npx --yes knip` or `ts-prune` may be used without adding it to package.json.
Output: `docs/CLEANUP-LOG.md` listing every removal with the evidence. Phase B (after T-19..T-22 are merged) is a second request: delete leftovers of the old robots, rename internal ids `sphere/spider/charger` to `army/spot/duck`, update tunables/docs.
