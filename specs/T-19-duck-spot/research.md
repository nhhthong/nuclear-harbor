# Research (T-19)

- **Draw calls**: reference models have hundreds of meshes. Decision: paint each part with vertex colours, convert to non-indexed, drop uv, `mergeGeometries` into few meshes with one shared `MeshStandardMaterial({vertexColors:true})`. Rejected: per-material merge (10+ materials) and canvas brushed-metal texture (extra material, no gain).
- **Diagonal trot for Spot**: merge legs per diagonal pair (FL+RR, FR+RL) and animate the merged mesh by translation and slight tilt instead of per-leg joints; keeps legs at 2 draw calls. Wheels stay part of the leg meshes (rolling is implied by sliding).
- **LOD**: `THREE.LOD` updates itself on render; far level is one merged low-poly mesh with the same palette.
- **Audio**: audio routes are owned by T-07; the duck reuses `charger:windup` (rising growl lasting the fuse) and `charger:hitPlayer` (thump). Beep mapping is requested via foundation-requests.
- **Ammo budget test**: depends on `CHARGER_ROBOT.hp` and `SPIDER_ROBOT.hp` (404 hits). Keep config untouched; module tunables hold the new HP.
- **Scale**: reference duck about 3 units tall, Spot about 2.7; scaled to about 0.5 and 0.55.
