/** Feature-local numbers for the night quay. Shared numbers live in `@/config/tunables`. */
export const WORLD_LOCAL = {
  /** Seed of the deterministic layout generator. */
  seed: 20261112,
  /** Gap between neighbouring containers in a run (m). */
  containerGap: 0.1,
  /** Container yard (zone A) grid. */
  yard: {
    /** Number of block rows (each block row = two touching container rows). */
    blockRows: 3,
    /** Containers per run (one run per block segment and row); segments are separated by N-S lanes. */
    segmentLengths: [3, 2, 3] as readonly number[],
    /** E-W aisle width between block rows and N-S lane width between segments (m). */
    aisleWidth: 6.6,
    laneWidth: 6.6,
    /** Gap between the two rows of one block (m). */
    rowGap: 0.3,
    /** Probability that a whole run is left out (cover gaps). */
    dropRunChance: 0.1,
    /** Stack height weights for 1, 2, 3 high. */
    heightWeights: [0.3, 0.4, 0.3] as readonly number[],
    edgeMarginX: 5,
  },
  /** Sparse cover clusters in zones B and D. */
  clusters: {
    B: { count: 0 },
    D: { count: 0 },
    /** Free space kept around a cluster (m). */
    margin: 4,
    attempts: 800,
    /** Distance kept from the dock edge and zone borders (m). */
    edgeMargin: 6,
  },
  /** Extra clearance around keep-clear discs when placing containers (m). */
  keepClearMargin: 0.5,
  /** Duck lane requirements (ticket T-03, GDD 6.3). */
  lane: { minLength: 24, minWidth: 6 },
  /** Muted container palette (sRGB hex). */
  containerColors: [0x8a3b2e, 0x3a5a78, 0x4f6b4a, 0xb08a2e, 0x6b6e70, 0x7a5a3c, 0x9a9a8c, 0x4b4f5c] as readonly number[],
  /** Level-closing walls (see barriers.ts). */
  barriers: {
    parapetHeight: 1.2,
    parapetThickness: 0.6,
    /** Top of the invisible walls: above anything a double jump from a three-high stack reaches. */
    blockerHeight: 40,
    parapetColor: 0x8d9296,
  },
  ocean: { size: 1600, deep: 0x02070c, shallow: 0x0d2230, waveSpeed: 0.5 },
  /** Night, overcast, raining. Colours are sRGB hex. */
  sky: {
    horizon: 0x161d2b,
    zenith: 0x04060b,
    /** Sodium glow of the city behind the port, low on the southern horizon. */
    cityGlow: 0x5a3414,
    moonTint: 0x9fb4dc,
    /** Colour below the horizon (reflection probe only). */
    ground: 0x06080b,
    fog: 0x0a0f17,
    fogDensity: 0.011,
    /** Must stay inside the far plane of every quality preset (low = 300 m) or the dome is clipped. */
    radius: 260,
    environmentIntensity: 1.0,
  },
  /** Moon: the only directional light and the only light whose shadow covers the whole level. */
  moon: { color: 0x8ea6d6, intensity: 0.5, elevationDeg: 42, azimuthDeg: 300, distance: 220, frustumHalf: 62 },
  hemi: { sky: 0x2a3650, ground: 0x15120f, intensity: 0.55 },
  /** Lightning: seconds between strikes (random in the range) and flash strength. */
  lightning: { minGap: 9, maxGap: 22, strength: 2.6, duration: 0.5 },
  ground: {
    asphalt: 0x23252a,
    /** Planar reflection render target scale relative to the drawing buffer. */
    reflectionScale: 0.5,
  },
  rain: { streaks: 7000, boxSize: 44, boxHeight: 26, speed: 26, windX: 3.5, windZ: -1.5, length: 0.9, splashes: 1400 },
  /** Ship backdrop. */
  ship: { length: 170, beam: 30, hullDepth: 14, hullBottom: -4 },
  /** Player collision radius used by pure path checks (m). */
  playerRadius: 0.4,
} as const;
