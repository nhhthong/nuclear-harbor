# Feature Specification: Authored STINGER-7 model

**Feature**: `28-scorpion-model` | **Created**: 2026-11-19 | **Status**: Implemented and merged (PR #17); not played on a real GPU
**Input**: owner request: replace the primitive-built STINGER-7 with an authored scorpion model, look and animation only.
**Process**: built by a sub-agent in its own worktree (merged `1a4e7de`), the coordinator took the low-preset screenshots and tuned pose and glow from them; PR #17 (squashed into `main`, together with the natural-jump change and the Spec Kit refresh). Written with the work, not by running the skills in order. Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, scripted screenshots), `[N]` not verified.

## Summary
The semi-boss STINGER-7 (mecha scorpion guarding the relay tower) changes **look and animation only**: the primitive model becomes the CC-BY Sketchfab "Scorpion Robot" by Mirandanimator, recoloured dark gunmetal with green emissive accents. HP 1300, skills (charge, venom shot, tail slam, hexagon shield), stun, enrage, hit zones, drops, audio and HUD are unchanged. The procedural model stays as the fallback.

## User Scenarios & Testing

### User Story 1 - A scorpion that looks authored (Priority: P1)
When the player nears the relay tower STINGER-7 rises out of the ground as before, as a dark detailed machine: curled segmented tail ending in a cannon, a round sensor eye, four armoured legs.
1. GLB loaded: about 6.4 m long, 5.2 m wide, 4.1 m tall, standing on the ground, head toward -Z at yaw 0, not mirrored. [U `src/scorpion/scorpionAssets.test.ts`]
2. GLB failed (or `?procedural-scorpion`): the old procedural model, nothing else changes. [U `scorpionAssets.test.ts` fallback on failure]
3. Screenshots of rest in the yard lanes, charge, venom telegraph and shot, tail slam, shield: no console errors. [B]

### User Story 2 - Readable animation (Priority: P1)
- Walking and charging: diagonal trot of the four legs paced by ground covered. [U `scorpionPose.test.ts`; B only seen mid-charge, not in a plain chase]
- Tail slam: four tail segments wind back, whip forward and down; venom shot: tail rises and aims, a venom orb grows at the cannon mouth, recoil on the shot; stun and death: crouch, tail drops. [U `scorpionPose.test.ts`; B]
- Shield: front legs sweep forward in front of the head while the hexagon shield is up. [U pose; B]
- Hit zones: head sensor (eye drum) and stinger (cannon) stay critical; body, legs and tail segments are normal. [U `scorpionAssets.test.ts` boxes from mesh bounds; the `?colliders` view [N]]

### User Story 3 - Glowing accents (Priority: P2)
Green emissive points (0x38ff4a, the venom hue): eye rings and sensor dots, a disc in the cannon mouth, leg joint discs, slits on the carapace. One separate material whose intensity pulses: dim at idle, bright while a skill telegraphs, flicker on damage; intensity = `pose.glow` x 0.62, capped at 1.7 (above it the accents turn white). Reads on the low preset (no bloom). [U pose glow; B low preset; medium/high with bloom [N]]

## Requirements
- **FR-001** `public/assets/enemies/scorpion.glb` built by `tools/asset-pipeline/scorpion_sf.py`: **0.71 MB, 15.6k triangles** (limits 1.2 MB and about 16k), two materials (`sc_armor` base colour about (0.07, 0.08, 0.10), metallic 0.85, roughness 0.4; `sc_glow` emissive green). [U `scorpionAssets.test.ts`]
- **FR-002** Nodes `sc_body`, `sc_legL0/L1/R0/R1` (origin at the hip), `sc_tail0..3` chain (origin at the joint), empties `sc_head` and `sc_nozzle` (child of `sc_tail3`). [U `scorpionAssets.test.ts`]
- **FR-003** Pose maths pure (`scorpionPose.ts`, no allocation: `solveJoints` fills a preallocated struct); the rig (`ScorpionSkin.ts`) only applies rotations; glow material cloned per scorpion; template disposed with the module scope. [U `scorpionPose.test.ts` (10), rig apply and dispose tests; allocation [N] review only]
- **FR-004** Hit boxes come from the look in use (`ScorpionAssets.colliders`); for the GLB derived from mesh bounds per node; they sit at the rest pose and do not follow the animated tail. [U bounds; `?colliders` view [N]]
- **FR-005** GLB loads asynchronously; no scorpion spawns before a look is ready (at most 5 s, then procedural). [U loader validation and failure; the 5 s timeout and `testHooks.scorpion.model()` [N]]
- **FR-006** Credits in `src/ui/credits.ts`, `docs/ASSETS.md`, `CREDITS.md`, README table. [U `src/ui/credits.test.ts`]
- **FR-007** Glow behaviour of User Story 3. [U, B]
- **FR-008** Gameplay unchanged (HP 1300, skills, stun, enrage, drops, audio, HUD). [N: by construction, covered by the existing `src/scorpion/*.test.ts` that still pass]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (513 tests at the time; 655 on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** GLB at most 1.2 MB and about 16k triangles, feet on y = 0, 6.4 x 5.2 x 4.1 m, critical boxes on head and cannon. [U]
- **SC-003** Low-preset screenshots of rest, walk (mid-charge only), charge, venom, slam, shield. [B, done]

## Assumptions
- The source has **four legs and no pincers** (checked on renders; the brief assumed six legs and claws): the claw pose maps to the front legs, `snap` is not animated.
- Legs, tail and head are loose islands (no skinning): a rigid leg swings about its hip, so foot sliding is not fully removed.
- Known limit from the natural-jump change (2026-11-19): the scorpion's dodge clearance (1.9 m) and the samurai's (1.8 m) are above or at the double jump (1.8 m); not changed.
- Out of scope: new audio (spec 32 later added a steam hiss), changed HP bar or radar marker, e2e scripts (stale), a skinned/IK rig.
- Not verified: the `?colliders` view, frame rate on a real GPU, glow with bloom on medium/high, smoke/e2e (skipped, owner policy).
