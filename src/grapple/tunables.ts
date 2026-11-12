/** Grapple-module-local numbers (shared ones live in `GRAPPLE` in `@/config/tunables`). */
export const GRAPPLE_LOCAL = {
  /** proposed: cooldown after a failed shot (shorter than the 1.0 s release cooldown), seconds. */
  failureCooldown: 0.3,
  /** proposed: minimum seconds between `grapple:cooldown` events (10 Hz cap). */
  cooldownEventInterval: 0.1,
  /** proposed: aim assist cone half-angle in degrees. */
  aimAssistConeDeg: 3,
  /** proposed: the feet should end this many metres above the hit point (plus eye height and release distance). */
  lipClearance: 0.5,
  /** proposed: aim point is moved this far into the surface so the pull carries over the lip. */
  wallInset: 0.6,
  /** proposed: a valid hit within this many metres of a registered anchor snaps to that anchor. */
  anchorSnapRadius: 1.5,
  /** proposed: perch landing is placed directly when the feet are within this many metres of it. */
  perchTeleportMax: 3,
  /** proposed: the pull starts when the hook lands, at most this many seconds after firing. */
  maxAttachDelay: 0.4,
  /** proposed: tolerance when checking that an anchor is visible (it sits on a surface), metres. */
  anchorSightTolerance: 0.6,
  /** proposed: hook/cable visual offset from the camera (right, down, forward), metres. */
  handOffset: { x: 0.25, y: -0.22, z: -0.45 },
  /** proposed: cable radius, metres. */
  cableRadius: 0.012,
  /** proposed: hook head size, metres. */
  hookSize: 0.12,
  /** proposed: crosshair indicator size in px. */
  indicatorSize: 26,
} as const;
