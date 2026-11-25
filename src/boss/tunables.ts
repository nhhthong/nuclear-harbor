import { DRONE_ASSET_URL } from '@/assets/droneAsset';
/**
 * Leg angles (radians in the reference model frame) of the four legs of the procedural TITAN-04 body.
 * That body (`BossBody.ts`) is only the FALLBACK look when the crab GLB does not load; it has no weak
 * points any more.
 */
export const FALLBACK_LEG_ANGLE: readonly number[] = [0.78, -2.28, 2.28, -0.78];

/**
 * Boss-local numbers: cinematic, landing and movement. The HP pool lives in `BOSS` (src/config/tunables.ts),
 * the Gunslinger Crab Mech's skills in `CRAB` below. Distances here are full-size metres times the boss
 * scale (harbor 0.5, sandbox 0.4); `CRAB` numbers are real metres at `harborScale` and are multiplied by
 * `scale / harborScale` in the sandbox.
 */
export const BOSS_LOCAL = {
  /** `?sandbox`: scale and spawn position so the boss fits the test scene (ticket step 5). */
  sandbox: { scale: 0.4, position: { x: -20, y: 0, z: 24 }, arenaRadius: 14 },
  /** Tiny-level rework: the harbor boss is half size so it fits the quay. */
  harborScale: 0.5,
  /** Reference model of the procedural fallback body (about 2.5 units tall, 7.2 m per unit). */
  model: { scale: 7.2, bodyCenterUnits: 1.16, hullRadiusUnits: 1.07, eyeUnits: { y: 1.13, z: 0.96 }, topUnits: 2.5 },
  /** Body centre height of the full-size fallback body. */
  bodyCenterY: 1.16 * 7.2,
  /** Radius of the ground footprint of the feet (full size; the crab spans about 12 m at scale 0.5 => 6 m). */
  footprintRadius: 12,
  /** Landing cinematic (ticket T-22). Times in seconds. */
  cinematic: {
    duration: 6.2,
    /** E skips only after this long. */
    skipAfter: 2,
    /** Boss starts to fall into view / hits the ground. */
    descentStart: 0.9,
    impactAt: 3.9,
    /** Start height above the ground (full size). */
    skyHeight: 240,
    /** Camera stands this far (full size) from the landing spot, towards the player. */
    cameraDistance: 78,
    cameraHeight: 4,
    /** Invulnerability kept after control returns. */
    graceAfter: 1.5,
    shockwaveRadius: 55,
    shockwaveSeconds: 1.5,
    shakeAmount: 1.6,
    barsFraction: 0.12,
  },
  /** Landing spot search. */
  landing: { clearance: 8, enemyRadius: 4, probeHeight: 40, probeMaxGround: 1.5, rings: 3, perRing: 12 },
  /** `?boss` waits this long (sim seconds) after boot so listeners are attached. */
  bootSpawnDelay: 0.4,
  /** Preferred distance band to the player (full size) and arena containment. */
  rangeMin: 20,
  rangeMax: 34,
  arenaMargin: 6,
  /** Yaw turn rate towards the player (rad/s): slow, so the player can circle it. */
  turnRate: 0.45,
  collapseDuration: 3,
  /** Metres the folded fallback body settles into the ground while collapsing (full size). */
  collapseSink: 1.5,
  /** Leg gait of the fallback body. */
  gait: { stride: 2.2, stepHeight: 1.6, cycleLength: 9 },
  flickerHz: 11,
} as const;

/**
 * Gunslinger Crab Mech (spec 27-crab-boss). Metres, seconds, HP, at the harbor scale. The skill numbers
 * are the owner's brief; the GLB (`public/assets/enemies/crab-boss.glb`) is about 10.4 m across and
 * 8.4 m tall with the launcher.
 */
export const CRAB = {
  /** GLBs (relative to the page like the samurai skin); the boss spawn waits at most `loadWaitSeconds` for them. */
  crabUrl: 'assets/enemies/crab-boss.glb',
  /** Shared with the `drone` enemy (spec 29): one fetch through `src/assets/droneAsset.ts`. */
  droneUrl: DRONE_ASSET_URL,
  loadWaitSeconds: 5,
  /** Hit volume (primitives, body space, +Y up, front = -Z). */
  hull: { halfX: 3.0, halfY: 1.5, halfZ: 2.7, y: 5.1, z: 0.3 },
  launcher: { halfX: 2.5, halfY: 1.0, halfZ: 1.3, y: 7.4, z: 2.6 },
  /** Cuboid thickness of the leg and arm colliders. */
  legThickness: 0.9,
  armThickness: 1.1,
  /** Where bombs and drones leave the body (body space; the GLB empties `mortar` and `bay` override these). */
  mortar: { x: 0, y: 8.2, z: 3.0 },
  bay: { x: 0, y: 7.6, z: 3.0 },

  /** Walk towards / away from the player to keep the band, and strafe around the player inside it (m/s). */
  walkSpeed: 3.2,
  strafeSpeed: 1.6,
  /** Seconds between two changes of strafe direction. */
  strafeFlip: [5, 9] as readonly [number, number],

  /** Skill selection: weights by distance, cooldowns (s), gap between two skills (idle, s). */
  idleGap: [1.2, 2.4] as readonly [number, number],
  cooldown: { bombs: 9, drones: 16, laser: 14, grab: 18, quake: 15 },
  weights: {
    bombs: { near: 1.5, far: 3 },
    drones: { near: 1.5, far: 2.5 },
    laser: { near: 1.5, far: 3 },
    /** Phase two only (below `phase2.below` of the HP). */
    grab: 4,
    quake: 3.5,
  },
  /** Distance (m) beyond which the "far" weights apply, and the range each skill may be picked in. */
  farDistance: 14,
  ranges: { bombsMin: 5, bombsMax: 60, dronesMin: 6, dronesMax: 70, laserMin: 7, laserMax: 70 },

  bombs: {
    /** A line of bombs towards the player plus a ring around them. */
    lineCount: 5,
    lineStart: 5,
    lineSpacing: 3.6,
    ringCount: 6,
    ringRadius: 5.5,
    /** Marker time before the blast (s) and delay between two launches. */
    markerTime: 1.2,
    launchGap: 0.14,
    radius: 5,
    damage: 18,
    /** Damage at the edge of the blast as a share of the centre damage. */
    edgeFalloff: 0.35,
    arcHeight: 11,
    capacity: 16,
    telegraph: 0.9,
  },
  drones: {
    /** Launch 3 to 4, at most `cap` alive, release again only while fewer than `reReleaseBelow` are alive. */
    min: 3,
    max: 4,
    cap: 6,
    reReleaseBelow: 2,
    telegraph: 1.1,
    hp: 40,
    hitRadius: 0.9,
    /** Hover ring around the player (m) and height above the player's feet. */
    orbitMin: 4,
    orbitMax: 9,
    heightMin: 2.4,
    heightMax: 4.6,
    speed: 9,
    orbitSpeed: 0.55,
    bolt: { damage: 3, speed: 15, tell: 0.55, interval: [2.2, 3.4] as readonly [number, number], radius: 0.7, capacity: 14, life: 4 },
  },
  /** The two claw skills only start when the boss has less than this share of its HP left (spec 34). */
  phase2: { below: 0.5 },
  /**
   * Claw grab (spec 34): the boss lunges at where the player stood, its claws close on whoever is within
   * `radius` of the claw point (feet below `maxPlayerHeight`, so a jump dodges it, as does stepping aside),
   * lifts them `liftHeight` up, holds, then slams them into the ground for `damage`.
   */
  grab: {
    minRange: 4,
    maxRange: 24,
    telegraph: 1.2,
    /** The lunge target freezes this long into the telegraph (the rest is the player's warning). */
    lockAt: 0.8,
    /** Distance from the body centre to the claw point (m). */
    reach: 7,
    lungeMax: 20,
    lungeTime: 0.5,
    radius: 3.4,
    maxPlayerHeight: 1.3,
    liftTime: 0.9,
    liftHeight: 9,
    holdTime: 0.4,
    slamTime: 0.22,
    damage: 70,
    knockbackUp: 4,
    /** Seconds the boss stands after the slam / after a miss (a window to shoot it). */
    recoverHit: 1.2,
    recoverMiss: 1.6,
    /** Player is untouchable this long after the slam (s). */
    graceAfter: 0.8,
  },
  /**
   * Cutscene of the claw grab (spec 35): the camera leaves the player's eyes and shows the boss holding them, a
   * white flash and letterbox bars mark the catch, shakes mark the catch, the lift, every quake pound and the slam.
   * `distance`, `side`, `height` place the camera relative to the claw point (metres, boss scale), `dolly` is how
   * far it pushes in over the carry.
   */
  grabCam: {
    blendIn: 0.3,
    blendOut: 0.4,
    distance: 11,
    side: 5,
    height: 2.5,
    dolly: 2.5,
    barsFraction: 0.1,
    /** Camera shake ("trauma", see `VFX.shake`). */
    shakeCatch: 0.7,
    shakeRumble: 0.012,
    shakeSlam: 1,
    shakePound: 0.45,
    /** Screen flashes (peak opacity, seconds). */
    flashCatch: { opacity: 0.85, seconds: 0.35 },
    flashSlam: { opacity: 0.8, seconds: 0.6 },
  },
  /** Strike pose of the arms (radians): raised high before the strike, swung forward and down by the whip, clamped inward when they hold. */
  armPose: { raise: 1.1, strikeDown: -0.5, clamp: 0.55, whipPortion: 0.45 },
  /**
   * Claw quake (spec 34): the claws pound the ground `count` times, `interval` s apart; every pound sends a ring
   * out from the body at `speed` m/s up to `maxRadius`. A ring hurts a player on the ground when it passes
   * (feet below `safeHeight`), so each one is jumped over; one second apart gives time to land and jump again.
   */
  quake: {
    maxRange: 34,
    telegraph: 1,
    count: 4,
    interval: 1,
    speed: 13,
    startRadius: 3.5,
    maxRadius: 32,
    thickness: 2.2,
    safeHeight: 0.9,
    damage: 24,
    knockback: 6,
    knockbackUp: 5,
    /** Seconds the boss stays still after the last ring has left. */
    recover: 0.8,
  },
  laser: {
    telegraph: 1.5,
    duration: 4.5,
    beams: 4,
    /** Total sweep (rad) over `duration`. */
    sweep: Math.PI,
    width: 1.2,
    length: 70,
    /** Vertical band the beam occupies (m above the ground): the player must jump above `top`. */
    bottom: 0.4,
    top: 1.3,
    /** Beams are drawn at this height. */
    height: 1.0,
    tickDamage: 10,
    tickEvery: 0.25,
    /** Beams are clipped against the world at this rate (Hz). */
    clipHz: 30,
    /** Beam starts this far from the body centre (m). */
    startRadius: 2.2,
  },
  /**
   * Skill glow: emissive colour (multiplied by the paint, see `prepareGlowMaterial`), the peak intensity and a gain
   * on the charge. The glow is texture-modulated, so it can be stronger than the old flat wash without hiding detail.
   */
  glow: { colour: [1, 0.45, 0.12] as const, max: 1.3, gain: 1.6 },
  /** Body animation (radians, seconds). */
  gait: { lift: 0.3, swing: 0.2, bob: 0.12, cycleLength: 9 },
  /** Death collapse: the body sinks (m). */
  sink: 1.2,
  /** Damage point height of the player (m above the feet). */
  playerCentreHeight: 1,
} as const;
