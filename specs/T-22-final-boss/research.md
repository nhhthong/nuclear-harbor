# Research

- **Scale**: reference is 2.5 units tall (fin tip), so 18 m means scale 7.2; hull radius about 7.5 m, feet ring about 10.5 m radius. Decision: model group scale `modelScale = 7.2`, tunable.
- **Orientation**: reference front is +Z, game front is -Z: model group rotated by PI.
- **Draw calls**: merge per material with `mergeGeometries`; body 8, legs 4 x 5, pistons 4 x 2 = 36. Eye scan animation dropped (eye is static, body sways).
- **Leg animation**: leg pivots use Euler order YXZ so rotation.x is leg local; gait by swinging hip and bending knee; collapse folds legs (morph of the reference).
- **Weak points**: knee drum centre of each leg, ball collider updated from the animated knee after each render update.
- **Camera**: player module poses the camera in its `update`; boss module is updated after it, so overriding there wins. Weapon view model (camera child) hidden during the cinematic.
- **Landing**: candidates on rings inside `arena.radius - footprint`; reject by player distance, enemy distance, and downward probes hitting world above 1 m; fallback = candidate maximising min distance to the player.
- **Roar**: `boss:spawned` (audio `bossSpawn`) is emitted at impact; the checkpoint at cinematic start.
- **Timing**: awakening phase of the model lasts the cinematic duration; skip calls `finishAwakening()`.
