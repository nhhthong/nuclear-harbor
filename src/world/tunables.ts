/** Feature-local numbers for the harbor greybox (T-03). Shared numbers live in `@/config/tunables`. */
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
    segmentLengths: [3, 3, 2] as readonly number[],
    /** E-W aisle width between block rows and N-S lane width between segments (m). */
    aisleWidth: 6.6,
    laneWidth: 6.6,
    /** Gap between the two rows of one block (m). */
    rowGap: 0.3,
    /** Probability that a whole run is left out (cover gaps). */
    dropRunChance: 0.1,
    /** Stack height weights for 1, 2, 3 high. */
    heightWeights: [0.3, 0.4, 0.3] as readonly number[],
    edgeMarginX: 4,
  },
  /** Sparse cover clusters in zones B and D. */
  clusters: {
    B: { count: 8 },
    D: { count: 4 },
    /** Free space kept around a cluster (m). */
    margin: 4,
    attempts: 800,
    /** Distance kept from the dock edge and zone borders (m). */
    edgeMargin: 6,
  },
  /** Extra clearance around keep-clear discs when placing containers (m). */
  keepClearMargin: 0.5,
  /** Duck lane requirements (ticket T-03, GDD 6.3). */
  lane: { minLength: 30, minWidth: 6 },
  /** Muted container palette (sRGB hex). */
  containerColors: [0x8a3b2e, 0x3a5a78, 0x4f6b4a, 0xb08a2e, 0x6b6e70, 0x7a5a3c, 0x9a9a8c, 0x4b4f5c] as readonly number[],
  warehouse: {
    wallThickness: 1,
    doorWidth: 6,
    /** x centre of the south and north doors. */
    doorX: 0,
    roofThickness: 0.5,
    shelf: { height: 4, depth: 1.2, segmentLength: 16, pitch: 20, centralAisleHalfWidth: 4 },
    /** z centres of shelf rows (world). The corridor strip lies between rows 39.4 and 46.6. */
    shelfRowsZ: [35, 39.4, 46.6, 51] as readonly number[],
    corridor: { z: 43, width: 6, minX: -28, maxX: 28 },
  },
  /**
   * T-17 interior lighting: the roof blocks the sun and the hemisphere fill alone left the hall almost
   * black. A few unshadowed point lights plus emissive ceiling strips (one merged mesh) light it.
   */
  warehouseLights: {
    color: 0xffe2b8,
    y: 7.2,
    z: 43,
    xs: [-18, 18] as readonly number[],
    intensity: 220,
    distance: 40,
    decay: 2,
    stripColor: 0xfff1d0,
    stripWidth: 0.6,
    stripLength: 10,
    stripZs: [36.5, 43, 49.5] as readonly number[],
    stripXs: [-18, 0, 18] as readonly number[],
    floorColor: 0x6a6e6e,
  },
  controlCenter: { upperInset: 4, upperHeight: 3 },
  ocean: { size: 1600, deep: 0x0d3b4f, shallow: 0x2f7f8f, waveSpeed: 0.6 },
  sky: { horizon: 0xcfd9dc, zenith: 0x5b8bb5, radius: 540 },
  sun: { color: 0xffd9a8, intensity: 3.2, distance: 400, frustumHalf: 112 },
  hemi: { sky: 0xbfd4e6, ground: 0x6d6a60, intensity: 0.9 },
  colors: {
    wall: 0x8c8f90,
    roof: 0x5e6264,
    shelf: 0x7b5d3a,
    control: 0xa8aaa5,
    controlUpper: 0x6f8aa0,
    quay: 0xd8b830,
    quayWall: 0x6a6d6e,
  },
  concreteTileMeters: 20,
  /** Ship backdrop. */
  ship: { length: 170, beam: 30, hullDepth: 14, hullBottom: -4 },
  /** Player collision radius used by pure path checks (m). */
  playerRadius: 0.4,
} as const;
