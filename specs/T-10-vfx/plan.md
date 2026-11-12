# Plan: T-10 VFX

Pure core (Node-testable, no three): `ParticleBuffer.ts` (SoA sim), `recipes.ts` (data), `emitter.ts` (recipe -> buffer spawns, seeded RNG, scratch objects), `scheduler.ts` (fixed-capacity delayed spawns for staged sequences), `mapping.ts` (event -> recipe decisions, reflection, landing threshold), `tunables.ts` (budgets, sequences).
Three layer: `VfxSystem.ts` owns Points x2 (ShaderMaterial, canvas soft sprite, `setDrawRange`), ring InstancedMesh, decal InstancedMesh (ring buffer, cap `WEAPON.maxImpactDecals`), 3 lights. `index.ts` wires events, quality, `?vfxtest`, test hooks, disposal via `ctx.resources.scope('vfx')`.
Constitution: pooled/fixed buffers (I), events only (II), tunables in `src/vfx/tunables.ts` (III), pure logic unit-tested (IV), owned files only (V). No foundation changes needed.
Budget: additive buffer 60 % of the preset budget, alpha 40 %; low-priority (dust/smoke) emission refused above 80 % fill of its buffer.
Tests: `src/vfx/*.test.ts`; e2e `tests/e2e/T-10-vfx.e2e.mjs`.
