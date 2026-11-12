/** Weapon-local tunables (ticket T-02). Shared numbers live in `WEAPON` (src/config/tunables.ts). */
export const WEAPON_LOCAL = {
  /** Reserve rounds guaranteed after a respawn (GDD 5.4 economy). */
  respawnReserveFloor: 60,
  /** Extra spread floor (degrees) while moving / sprinting; clamped to `WEAPON.spreadMaxDeg`. */
  moveSpreadDeg: 0.5,
  sprintSpreadDeg: 1.4,
  /** Horizontal speed (m/s) above which the player counts as moving. */
  moveSpeedThreshold: 0.5,
  /** Share of each camera kick that is recovered afterwards (the rest is the player's "pull down"). */
  recoilRecoverFraction: 0.6,
  /** Minimum seconds between dry-fire clicks. */
  dryFireInterval: 0.25,

  viewModel: {
    /** Position of the rifle in camera space (metres). */
    offset: { x: 0.2, y: -0.19, z: -0.42 },
    kickBackMetres: 0.045,
    kickPitchRad: 0.05,
    kickRecoverPerSec: 18,
    swayAmount: 0.006,
    swayFrequency: 7,
    sprintTiltRad: 0.35,
    sprintLowerMetres: 0.05,
    /** Where the muzzle is, in view model space. */
    muzzle: { x: 0, y: 0.015, z: -0.58 },
    /** Ejection port, in view model space. */
    ejectionPort: { x: 0.035, y: 0.04, z: -0.12 },
  },

  effects: {
    flashLifetime: 0.045,
    flashPoolSize: 3,
    tracerLifetime: 0.07,
    tracerColor: 0xffd27a,
    casingLifetime: 1.1,
    casingGravity: 9.8,
    casingSpeedMin: 1.6,
    casingSpeedMax: 2.6,
    casingSpin: 18,
    casingLength: 0.03,
    casingRadius: 0.006,
    /** Rays that hit nothing draw a tracer this long (m). */
    missTracerLength: 60,
  },
} as const;
