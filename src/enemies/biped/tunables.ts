/**
 * Biped robot (enemy type `biped`, spec 26): an infantry robot that runs at the player, crouches with a glow
 * cue, leaps to where the player stood and claws on landing, with a quick two-claw swipe at arm's length.
 * Model: "Biped robot" (Sketchfab, CC-BY 4.0, skudgee), built by tools/asset-pipeline/enemies_sf.py.
 */
export const BIPED = {
  hp: 120,
  detectionRange: 30,
  loseTargetTime: 4,
  patrolSpeed: 2.2,
  chaseSpeed: 5.5,
  /** Stops this close to the player (m) and waits for the swipe instead of walking into them. */
  holdDistance: 1.5,
  arriveRadius: 0.9,
  commandArriveRadius: 3,
  /** Body centre above the ground (m); the model is 2.2 m tall with its feet at the root. */
  centerHeight: 1.1,
  radius: 0.7,
  /** Leap: starts between `min` and `max` metres from the player, with line of sight. */
  leap: {
    min: 3.5,
    max: 13,
    /** Crouch before the jump (s): the head glows up and the legs fold. */
    telegraph: 0.5,
    /** Flight time (s) is `distance / speed` clamped to [minAir, maxAir]. */
    speed: 16,
    minAir: 0.32,
    maxAir: 0.7,
    /** Apex height (m) = clamp(apexPerMetre * distance, minApex, maxApex). */
    apexPerMetre: 0.22,
    minApex: 0.8,
    maxApex: 2.4,
    /** Lands this far short of the locked position (m), so it does not end up inside the player. */
    standOff: 0.9,
    damage: 14,
    /** Claw reach at landing (m) and in the air (m); feet this far above the ground dodge it (double jump). */
    radius: 2,
    contactRadius: 1.3,
    clearance: 1.3,
    knockback: 5,
    /** Frozen after landing (s), then the next leap needs `cooldown` seconds from the landing. */
    recover: 1.2,
    cooldown: 3,
  },
  /** Quick swipe with both claws when the player is adjacent. */
  claw: { range: 2.2, windup: 0.22, recover: 0.4, damage: 9, cooldown: 1.1, knockback: 3, clearance: 1.3 },
  /** Hit volumes relative to the body centre (forward is -z). */
  hit: {
    torso: { y: 0.4, hx: 0.42, hy: 0.45, hz: 0.3 },
    legs: { y: -0.55, hx: 0.34, hy: 0.55, hz: 0.28 },
    head: { y: 0.88, z: -0.05, hx: 0.22, hy: 0.22, hz: 0.25 },
  },
  /** Authored look and animation (see `src/enemies/authored.ts`). Same-origin, relative to the page. */
  skin: {
    url: 'assets/enemies/biped.glb',
    /** Ground speed (m/s) at which the `run` clip at time scale 1 keeps the feet planted (measured on the clip). */
    runSpeed: 3.3,
    /** Lift (m) so the toes of the idle pose rest on the ground. */
    footLift: 0.04,
    /** Head bone that carries the glow and the glow colour. */
    headBone: 'Bip001_Head_041',
    glowColor: 0xff5a1a,
    glowRadius: 0.2,
    /** Time scale of the one-shot clips: crouch is 0.54 s, leap 0.54 s, claw 0.67 s. */
    crouchSeconds: 0.54,
    clawSeconds: 0.67,
  },
} as const;
