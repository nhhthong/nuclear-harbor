# Foundation requests (T-21)

1. **Guaranteed pickup drops.** `src/pickups` only drops 15 ammo at random per `enemy:destroyed`. Request: a request event such as `pickup:drop { kind, position, amount? }` handled by the pickups module. Work-around: `src/dinosaur/drops.ts` keeps its own bounded (12) ammo/medkit pickups and emits `pickup:spawned` / `pickup:collected`.
2. **Camera shake service.** No shared shake exists. Work-around: the dinosaur module adds a decaying random offset to `ctx.camera.position` after the player pose (`dino:roar` carries `shake`, `duration`). Request: a shared `camera:shake { amplitude, seconds }` event.
3. **Audio for `dino:*`.** The audio module has no mapping for `dino:roar`, `dino:telegraph`, `dino:attack`. Work-around: `src/dinosaur/dinoAudio.ts` synthesises a roar, a warning pulse and a thud with its own AudioContext. Request: map these events in `src/audio/eventMap.ts` and drop the local synth.
4. **`?seed=` parameter.** Not documented in `docs/PLAN.md` section 4.7; the dinosaur module reads it (integer or string). Add to the table.
5. **Registry line.** `src/modules.ts` got an import and one registry entry (`createDinosaurModule()` after the boss), as the ticket allows.
