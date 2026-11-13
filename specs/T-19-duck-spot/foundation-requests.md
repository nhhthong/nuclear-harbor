# Foundation requests (T-19)

1. **Audio (T-07 owner)**: map the new events in `src/audio/eventMap.ts`:
   - `duck:beep` {id, position, count} -> `beep` (pitch up per count) at `position`
   - `duck:explode` {id, position, radius, hitPlayer} -> `enemyDestroyed` (or a dedicated blast sound)
   The duck already reuses `charger:windup` (rising growl lasting the 3 s fuse) and `charger:hitPlayer` (thump) so it is audible without this.
2. **Config cleanup (T-23 phase B)**: `SPIDER_ROBOT` and `CHARGER_ROBOT` in `src/config/tunables.ts` are now only read by the GDD ammo-budget tests (`src/combat/damage.test.ts`, `src/pickups/placements.test.ts`, hp). Real HP lives in `src/enemies/spot/tunables.ts` (70) and `src/enemies/duck/tunables.ts` (60). When the ids are renamed, move the HP into the budget test or retarget it; the 404-hit budget is currently an upper bound.
3. **VFX (T-10 owner)**: `enemy:destroyed` scales the explosion by 1.6 for type `charger`; for a shot-dead duck the "small pop" would want scale 1. The detonation spawns its own `explosion` (scale 2.6) and `smoke` through `vfx:spawn`.
4. **Shared helper**: `src/enemies/duck/modelKit.ts` (vertex-colour merge helper) is imported by `src/enemies/spot/model.ts`; T-20..T-22 may want it moved to a shared folder.
