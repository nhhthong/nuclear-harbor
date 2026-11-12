# T-10 — VFX: pooled particles and effects

| | |
|---|---|
| Wave | 1 |
| Depends on | none (starts on the foundation) |
| GDD sections | 13.4, 2 (readable combat), 5.3 (hit feedback), 9.2 (weak-point sparks), 16 Performance |
| Spec dir | `specs/T-10-vfx/` |

## Goal

Provide all non-gameplay visual effects through one pooled, GPU-friendly particle system driven by events: bullet impact sparks and dust, armour deflection sparks, robot explosions, smoke, pickup sparkle, boss weak-point bursts and the big boss explosion, plus a generic `vfx:spawn` request API for other modules.

## Files owned (exclusive)

- `src/vfx/**` (replace `src/vfx/index.ts`; keep `createVfxModule` and id `vfx`)
- `tests/e2e/T-10-vfx.e2e.mjs` (browser check, optional but recommended)
- `specs/T-10-vfx/**` (Spec Kit artifacts)

Everything else is read-only for this ticket.

## Interfaces consumed

- `GameContext`, `GameModule` lifecycle, `ResourceTracker` scope (`ctx.resources.scope(id)`), `ctx.flags.sandbox`
- `ObjectPool`; `ctx.camera` (billboarding); `PERFORMANCE.quality` + `settings:changed` (particle budget per preset)
- Events in: `vfx:spawn`, `combat:hit`, `combat:impact`, `enemy:destroyed`, `charger:stunned`, `pickup:collected`, `tower:activated`, `boss:weakPointDamaged/Destroyed`, `boss:coreExposed`, `boss:attack`, `boss:defeated`, `player:landed`

## Interfaces provided

- Rendering of every `VfxKind`: `spark`, `armor-spark`, `explosion`, `big-explosion`, `smoke`, `dust`, `pickup`, `telegraph-ring`
- `ctx.testHooks.vfx = { liveParticles(), liveEmitters(), dropped(), capacity() }`

## How to work

Follow the Spec Kit flow in [`docs/SPECKIT.md`](../SPECKIT.md) (mandatory). This ticket is the input to
`speckit-specify`; do not skip to code.

```bash
export SPECIFY_FEATURE_DIRECTORY=specs/T-10-vfx
export SPECIFY_FEATURE_NO_PERSIST=1
```

1. `speckit-specify` → `specs/T-10-vfx/spec.md` (input: this file + the GDD sections above).
2. `speckit-plan` → `plan.md`; it must respect [`docs/PLAN.md`](../PLAN.md) (interfaces, ownership) and
   `.specify/memory/constitution.md`.
3. `speckit-tasks` → `tasks.md` (tests first for pure logic), optional `speckit-analyze`.
4. `speckit-implement`, ticking tasks off.

Rules: run non-interactively (resolve open questions with this ticket, PLAN and REVIEW defaults and
record them as assumptions). Edit only the files listed under "Files owned". You work in your own
git worktree in parallel with other tickets: never touch foundation files or other tickets'
folders; if you need a foundation change, write `specs/T-10-vfx/foundation-requests.md` and work
around it locally. Read `docs/PLAN.md` sections 3-7 before planning.

## Step-by-step guidance

1. Pure simulation core with tests (`src/vfx/ParticleBuffer.ts`): fixed-capacity struct-of-arrays (position, velocity, life, maxLife, size, colour, gravity factor, drag) with `spawn()` returning false when full, `step(dt)` that integrates and compacts dead particles (swap-remove), and no allocations after construction.
2. Effect recipes as data (`src/vfx/recipes.ts`): per `VfxKind` the particle count, speed cone around the surface normal, lifetime, size curve, colour ramp, gravity, plus optional flash light/shockwave ring. Scaled by the event's `scale`.
3. Rendering: ONE `THREE.Points` (or one `InstancedMesh` of quads) per blend mode — additive (sparks, fire) and alpha (smoke, dust) — fed from the buffer with `BufferAttribute` updates and `setDrawRange`; soft round sprite from a generated canvas texture; size attenuation in a small shader. Target ≤ 3 draw calls for all particles.
4. Extras, each pooled: short-lived point lights for explosions (cap 3, skipped on low quality), expanding ground ring for `telegraph-ring` (lifetime from `duration`), simple scorch decals on impacts (cap from `WEAPON.maxImpactDecals`, oldest recycled).
5. Event mapping: `combat:impact` → dust + small spark along the normal; `combat:hit` → `spark` for body/critical, `armor-spark` (bright, ricochet direction) when `absorbed` or zone `armor`, red burst for `weakpoint`/`core`; `enemy:destroyed` → `explosion` + smoke; `boss:weakPointDestroyed` → large burst; `boss:defeated` → staged `big-explosion` sequence over ~2 s; `pickup:collected` → `pickup` sparkle; `player:landed` (hard) → dust.
6. Budget: total particle capacity from the quality preset (suggest 600 / 1500 / 3000, in `src/vfx/tunables.ts`). When full, new low-priority effects (dust, smoke) are dropped first; count drops for the debug overlay.
7. Simulate in `update(dt)` (visual only, frame rate), nothing in `fixedUpdate`. Effects freeze while the game is not `playing` (no update calls) — acceptable.
8. `?vfxtest` param: spawn each kind in a row in front of the player every 2 s for visual review.
9. e2e: `?sandbox&autostart`: emit 500 `vfx:spawn` requests in one frame, assert `liveParticles() ≤ capacity()`, `dropped() > 0`, no console errors, and that after 5 s `liveParticles()` returns to 0.

## Acceptance criteria

- [ ] **AC1** Every `VfxKind` produces a visible, distinct effect at the requested position/normal/scale via `vfx:spawn`.
- [ ] **AC2** Bullet hits show feedback without any other module asking: world impacts (dust/spark), robot hits (sparks), absorbed/armour hits (distinct deflection spark), weak-point/core hits (red burst).
- [ ] **AC3** Robot destruction shows an explosion with smoke; the boss defeat shows a longer multi-stage explosion.
- [ ] **AC4** All particles live in fixed-capacity buffers: spawning beyond capacity drops effects instead of allocating (unit test), and the live count returns to zero after effects finish.
- [ ] **AC5** All particle rendering uses at most 3 draw calls; the particle budget follows the quality preset.
- [ ] **AC6** No allocations per frame in the simulation step (typed arrays only; verified by unit test on buffer identity and by code review notes).
- [ ] **AC7** `dispose()` releases geometry, textures, lights and listeners.

## Notes

Gameplay-critical telegraphs (Charger ground line, boss danger zones) are drawn by their own tickets; `telegraph-ring` here is a convenience other modules may use. Muzzle flash, tracers and casings belong to T-02.

## How to verify

```bash
npm run typecheck && npm test && npm run build && npm run smoke
npm run e2e -- T-10
# manual: npm run dev → http://localhost:5173/?sandbox&vfxtest
```

Definition of Done: [`docs/PLAN.md`](../PLAN.md) section 7.
