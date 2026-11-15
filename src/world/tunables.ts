/** Feature-local numbers for the quay at sunset. Shared numbers live in `@/config/tunables`. */
export const WORLD_LOCAL = {
  /** Seed of the deterministic layout generator. */
  seed: 20261112,
  /** Gap between neighbouring containers in a run (m). */
  containerGap: 0.1,
  /** Container yard (zone A) grid. */
  yard: {
    /** Number of block rows (each block row = two touching container rows). */
    blockRows: 4,
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
  ocean: { size: 1600, deep: 0x0b2030, shallow: 0x6b5a5c, waveSpeed: 0.5 },
  /** Sunset after rain: low warm sun, pink-orange horizon, violet zenith, light haze. Colours are sRGB hex. */
  sky: {
    horizon: 0xf2a268,
    zenith: 0x2c3a6e,
    /** Colour of the band opposite the sun (the "anti-twilight" side), so no direction is black. */
    antiSun: 0x7a6f9a,
    sunTint: 0xffb070,
    /** Colour below the horizon (reflection probe only). */
    ground: 0x3a3230,
    fog: 0xc79a86,
    fogDensity: 0.0052,
    /** Must stay inside the far plane of every quality preset (low = 300 m) or the dome is clipped. */
    radius: 260,
    environmentIntensity: 1.25,
  },
  /** The sun is the only real light in the level (performance): one shadow map, no spot lights. */
  sun: { color: 0xffa868, intensity: 3.4, elevationDeg: 11, azimuthDeg: 248, distance: 220, frustumHalf: 98, frustumHalfHeight: 45, centerZ: -38 },
  hemi: { sky: 0x9aa2d0, ground: 0x6a4a38, intensity: 1.35 },
  ground: {
    asphalt: 0x2a2c30,
  },
  /** Ship backdrop. */
  ship: { length: 170, beam: 30, hullDepth: 14, hullBottom: -4 },
  /** Player collision radius used by pure path checks (m). */
  playerRadius: 0.4,
} as const;
