/** Feature-local numbers of the debug module (T-11). */
export const DEBUG_TUNABLES = {
  /** Frame-time ring buffer length (samples). */
  frameWindow: 240,
  /** Overlay text refresh rate. */
  overlayHz: 4,
  /** Sustained low-FPS warning delay in seconds (ticket step 4). */
  lowFpsSeconds: 2,
  /** Collider wireframe refresh rate. */
  colliderRefreshHz: 4,
  /** Initial vertex capacity (floats) of the collider line buffer. */
  colliderInitialFloats: 3 * 2 * 4096,
  colliderColor: [0.2, 1, 0.3] as const,
  grappleColor: [1, 0.6, 0.1] as const,
  bytesPerMb: 1024 * 1024,
} as const;
