# Feature Specification: claw grab animation and cutscene

**Feature**: `35-claw-grab-cutscene` | **Created**: 2026-11-25 | **Status**: Implemented on branch `ccr-1b1f2332-o3lx35` (PR #26); not played on a real GPU
**Input**: owner request 2026-11-25, after seeing the grab camera: the boss should raise its claws high and strike hard at the player to seize them; add a cutscene and camera shake when the player is caught and when they are slammed.
**Process**: written with the code by the coordinator (Spec Kit skills not run in order). Checks: `[U file]` unit test, `[B]` browser screenshots (software GL, low preset, 640x360), `[N]` not verified.

## User Scenarios & Testing

### Story 1 - The claws rise and whip at the player (P1)
Telegraph: the arms rise smoothly to full height with the glow. Lunge: the arms start up and are whipped forward and down in the first 45% of the lunge (fast ease-out), then hold out in front. [U `grabCam.test.ts` (`raisePose`, `lungePose`); B screenshots 1 and 2]

### Story 2 - Caught: cutscene (P1)
On the catch: a white flash (0.85, 0.35 s), a hard shake (0.7), the arms clamp inward on the prey, and the camera leaves the player's eyes (blend 0.3 s) for a cutscene shot: in front of the claws, 5 m to the side and 2.5 m above, looking between the prey and the boss, pushing in 2.5 m over the lift and following the height; letterbox bars (10% each) slide in; the weapon model is hidden. A steady rumble shakes the camera while it lifts and holds. [U `grabCam.test.ts` (`grabShot`, `stepGrabBlend`); B screenshots 3 and 4]

### Story 3 - Slam (P1)
On the slam the arms are thrown down hard (`strike`), the impact shakes the camera at full trauma (1.0) with a red flash (0.8, 0.6 s); the player is released, the camera blends back to the player's eyes in 0.4 s and the bars slide out. A miss smashes the claws into the ground with a shake of 0.42. [U pose tests; B screenshot 5; the flashes and the blend back are [N] in screenshots]

### Story 4 - Quake arms and shake (P2)
In the claw quake the arms are held high and thrown down on every pound, and each pound shakes the camera (0.45). [N: arm timing not captured]

## Requirements
- **FR-001** Arm poses (`BodyAnim.claw/strike/clamp`, `CRAB.armPose`) and the pure pose functions in `src/boss/grabCam.ts`. [U]
- **FR-002** Cutscene camera: `grabShot`, `stepGrabBlend`, `CRAB.grabCam`, applied in the boss module's `update` (blended with the player's view; weapon hidden). [U, B]
- **FR-003** New event `camera:shake { trauma }` handled by the vfx module's existing trauma shake. [tsc; N]
- **FR-004** Overlays: letterbox bars and a flash layer in `ctx.uiRoot`, removed on dispose. [B]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass.
- **SC-002** Screenshots (low preset, 640x360) of: arms raised, the whip, the catch with bars, the hold, the slam. [B, done]

## Not verified
The flash and shake feel (screenshots cannot show them); the camera blend back after the slam on a real device; whether the cutscene shot clips into containers near the quay edge; the claw look (the arms are the gun arms, no claw model); motion sickness risk of the shake and the lift.
