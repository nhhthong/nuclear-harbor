# Feature Specification: Authored STINGER-7 model

**Feature**: `28-scorpion-model` | **Created**: 2026-11-19 | **Status**: Implemented (not played on a real GPU)

## Summary
The semi-boss STINGER-7 (mecha scorpion guarding the relay tower) changes its **look and animation only**: the primitive-built model is replaced by the CC-BY Sketchfab model "Scorpion Robot" by Mirandanimator, recoloured dark gunmetal with green emissive accents. HP (1300), skills (charge, venom shot, tail slam, hexagon shield), stun, enrage, hit zones, drops, audio and the HUD stay exactly as they are. The procedural model stays as the fallback when the GLB cannot be loaded.

## User Scenarios
### US1 - A scorpion that looks authored (P1)
When the player nears the relay tower, STINGER-7 rises out of the ground as before, but as a dark, detailed machine: curled segmented tail ending in a cannon, a round sensor eye, four armoured mech legs.
- Given the GLB loaded, then the scorpion is about 6.4 m long, 5.2 m wide and 4.1 m tall, stands on the ground, faces its target (the head toward -Z at yaw 0) and is not mirrored.
- Given the GLB failed to load (or `?procedural-scorpion`), then the old procedural model is used and nothing else changes.

### US2 - Readable animation (P1)
- Walking and charging: a diagonal trot of the four legs paced by the ground covered.
- Tail slam: the four tail segments wind back, then whip forward and down; venom shot: the tail rises and aims, a venom orb grows at the cannon mouth, the tail recoils on the shot; stun and death: crouch, tail drops.
- Shield: the front legs sweep forward in front of the head while the hexagon shield is up.
- Hit zones: the head sensor (eye drum) and the stinger (cannon at the tail tip) stay critical; body, legs and tail segments are normal zones.

### US3 - Glowing accents (P2)
Green emissive points (same hue as the venom, 0x38ff4a): the eye rings and sensor dots, a disc in the cannon mouth, leg joint discs and thin slits on the carapace. One separate material whose intensity pulses: dim at idle, bright while the venom shot or tail slam telegraphs, flickering on damage. It must still read on the low preset (no bloom).

## Requirements
- FR-1 `public/assets/enemies/scorpion.glb` is built by `tools/asset-pipeline/scorpion_sf.py` from the source GLB: at most 1.2 MB and about 16k triangles, two materials (`sc_armor` dark gunmetal base colour about (0.07, 0.08, 0.10), metallic 0.85, roughness 0.4; `sc_glow` emissive green).
- FR-2 Nodes: `sc_body`, `sc_legL0/L1/R0/R1` (origin at the hip), `sc_tail0..3` as a chain (origin at the joint), empties `sc_head` (eye drum) and `sc_nozzle` (stinger mouth, child of `sc_tail3`).
- FR-3 Pose maths is pure (`scorpionPose.ts`, unit tested); the rig (`ScorpionSkin.ts`) only applies rotations; the glow material is cloned per scorpion; the template is disposed with the module scope.
- FR-4 Hit boxes come from the look in use (`ScorpionAssets.colliders`); for the GLB they are derived from the mesh bounds of each node (head and stinger critical, the rest body).
- FR-5 The GLB loads asynchronously; a scorpion never spawns before a look is ready (the wait is bounded by 5 s, then the procedural look is used).
- FR-6 Credits in `src/ui/credits.ts`, `docs/ASSETS.md`, README table.

## Assumptions
- The source has four legs and no pincers (checked on renders): the game's claws and snapping fingers have no counterpart; the claw pose is mapped to the front legs. The brief assumed six legs and claws; the source wins.
- Legs, tail and head are separated by loose islands (no skinning); a rigid leg swings about its hip, so foot sliding is not perfectly removed.
- The hit boxes follow the body, not the animated tail (as before): the tail boxes sit at the rest pose.
- Out of scope: new audio, a changed HP bar or radar marker, e2e scripts (stale), a skinned/IK rig.
