/** Feature-local numbers for the quay at sunset. Shared numbers live in `@/config/tunables`. */
export const WORLD_LOCAL = {
  /** Seed of the deterministic layout generator. */
  seed: 20261112,
  /** Gap between neighbouring containers in a run (m). */
  containerGap: 0.1,
  /**
   * Container yard (zone A). The lanes are fixed (patrol posts and Duck runs rely on them) and set off
   * centre on purpose; every block between them is filled in its own style (long rows, short columns,
   * or a loose dump), with uneven stack heights, holes and a few boxes set down at an angle.
   */
  yard: {
    /** Centre lines of the N-S lanes and the E-W aisles (m). */
    nsLanesX: [-11, 9] as readonly number[],
    ewAislesZ: [-15.5, 2.5] as readonly number[],
    aisleWidth: 6.6,
    laneWidth: 6.6,
    /** Free strip kept along the fence and the zone borders (m). */
    edgeMargin: 1.6,
    /** Gap between rows inside a block, and the wider straddle-carrier gap every few rows (m). */
    rowGap: 0.3,
    straddleGap: 0.8,
    /** Stack height weights for 1, 2, 3 high (per row; single cells vary by one tier). */
    heightWeights: [0.15, 0.4, 0.45] as readonly number[],
    /** Chance that one cell of a row differs by a tier, and that a cell is left empty. */
    stepChance: 0.3,
    holeChance: 0.04,
    /** Loose boxes in "dump" blocks: how many, and the largest angle off the grid (rad). */
    dumpCount: [7, 11] as readonly number[],
    dumpYaw: 0.35,
  },
  /** Cover clusters in zones B and D (rows of 2 or 3 boxes, 1 or 2 rows, uneven heights). */
  clusters: {
    B: { count: 3 },
    D: { count: 10 },
    /** Free space kept around a cluster (m). */
    margin: 3,
    attempts: 6000,
    /** Distance kept from the dock edge and zone borders (m). */
    edgeMargin: 4,
    /** Strips kept free for patrol beats and supply spots in the court and on the quay. */
    reserved: [
      // court: west beat and supply, east beat, east supply, duck beat
      { minX: -18, maxX: 0, minZ: -40, maxZ: -36.5 },
      { minX: 13, maxX: 28, minZ: -33, maxZ: -29 },
      { minX: 20, maxX: 28, minZ: -39, maxZ: -33 },
      { minX: 16, maxX: 32, minZ: -40, maxZ: -36 },
      // quay: east beat, supplies (the other beats run on the free ring around the boss arena)
      { minX: 14, maxX: 36, minZ: -47, maxZ: -40 },
      { minX: 3, maxX: 11, minZ: -48, maxZ: -42 },
      { minX: 26, maxX: 34, minZ: -54, maxZ: -48 },
      { minX: 24, maxX: 32, minZ: -67, maxZ: -61 },
    ] as ReadonlyArray<{ minX: number; maxX: number; minZ: number; maxZ: number }>,
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
  ocean: { size: 1600, deep: 0x070d13, shallow: 0x2c363e, waveSpeed: 0.5 },
  /**
   * Owner request: gloomy, cold, "Dark Souls" mood. Heavy overcast, the sun a pale smear behind the deck,
   * cold grey-blue haze; the warm lamps are the only warm colours left. Colours are sRGB hex.
   */
  sky: {
    horizon: 0x6a7682,
    zenith: 0x2e3a4a,
    /** Colour of the band opposite the sun, so no direction is black. */
    antiSun: 0x55606c,
    sunTint: 0xa8b8c8,
    /** Colour below the horizon (reflection probe only). */
    ground: 0x15171b,
    /** Cloud deck: share of the sky covered (0..1), lit and shaded colours (linear-ish RGB 0..1). */
    cloudCover: 0.82,
    cloudLit: [0.42, 0.46, 0.51] as readonly [number, number, number],
    cloudShade: [0.2, 0.225, 0.26] as readonly [number, number, number],
    fog: 0x66727e,
    fogDensity: 0.0085,
    /** Must stay inside the far plane of every quality preset (low = 300 m) or the dome is clipped. */
    radius: 260,
    environmentIntensity: 0.95,
  },
  /** The sun is the only real light in the level (performance): one shadow map, no spot lights. */
  sun: { color: 0xc4d2e2, intensity: 2.6, elevationDeg: 22, azimuthDeg: 248, distance: 220, frustumHalf: 74, frustumHalfHeight: 42, centerZ: -27 },
  hemi: { sky: 0x8495a8, ground: 0x34373d, intensity: 1.35 },
  ground: {
    asphalt: 0x2a2c30,
  },
  /** Ship backdrop. */
  ship: { length: 170, beam: 30, hullDepth: 14, hullBottom: -4 },
  /** Player collision radius used by pure path checks (m). */
  playerRadius: 0.4,
} as const;
