/** Player-module-local numbers (shared ones live in `@/config/tunables`). */
export const PLAYER_LOCAL = {
  /** proposed: metres walked between footstep events. */
  footstepDistanceWalk: 2.2,
  /** proposed: metres sprinted between footstep events. */
  footstepDistanceSprint: 1.8,
  /** proposed: horizontal speed below which no footsteps accumulate (m/s). */
  footstepMinSpeed: 0.5,
  /** proposed: minimum downward speed for a landing event (filters spawn/teleport settling). */
  landedMinSpeed: 2,
  /** proposed: small downward speed while grounded so snap-to-ground keeps contact (m/s). */
  groundedStickSpeed: 1,
} as const;
