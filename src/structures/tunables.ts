/** Numbers of the quay structures. Placement lives in `layout.ts`. */
export const STRUCTURES = {
  fenceHeight: 2.6,
  /** Same-origin, relative to the page (CC0 / CC-BY models, see docs/ASSETS.md). */
  vehiclesUrl: 'assets/props/vehicles.glb',
  /** Scanned CC0 clutter from Poly Haven (cabinets, barriers, barrels, tyres, generator, work light). */
  dressingUrl: 'assets/props/industrial.glb',
  /** CC0 packs by 3DModelsCC0 (water tower, switchgear, dumpster, cable drums, pallets, ...). */
  terminalUrl: 'assets/props/terminal.glb',
  /** Warehouse floor: Poly Haven `concrete_floor_worn_001` (CC0), 1k maps; `tile` is the metres one map repeat covers. */
  warehouseFloor: {
    diffuseUrl: 'assets/textures/warehouse-floor/diff.jpg',
    normalUrl: 'assets/textures/warehouse-floor/nor.jpg',
    /** AO (r), roughness (g), metalness (b). */
    armUrl: 'assets/textures/warehouse-floor/arm.jpg',
    tile: 3,
    /** Saw-cut slab joints every `jointSpacing` metres, `jointWidth` wide. */
    jointSpacing: 6,
    jointWidth: 0.025,
    normalScale: 0.7,
  },
} as const;

/**
 * Chain-link fences with swing gates (spec 30). A gate opens when the player touches it (or a robot comes
 * near), swings away from whoever opened it and closes again once nobody has been near for `closeDelay`.
 */
export const GATES = {
  fenceHeight: 2.4,
  /** Fence lines: x0..x1 at z (E-W runs), gaps are the gates below. */
  lines: [
    { id: 'apron-yard', z: 12.4, x0: -35.6, x1: 5.75 },
    { id: 'court-quay', z: -40.75, x0: -35.6, x1: 35.6 },
  ],
  /** Gates: centre x on a line, total width, 1 or 2 leaves. `lockedUntilTower`: stays shut (touching does nothing) until all relay towers are active, then swings open and stays open (spec 33). */
  gates: [
    { id: 'apron-lane-west', line: 'apron-yard', x: -15, width: 6.6, leaves: 2, lockedUntilTower: false },
    { id: 'apron-lane-east', line: 'apron-yard', x: 2, width: 6.6, leaves: 2, lockedUntilTower: false },
    { id: 'apron-walk', line: 'apron-yard', x: -29, width: 1.2, leaves: 1, lockedUntilTower: false },
    { id: 'court-quay-west', line: 'court-quay', x: -10, width: 6.6, leaves: 2, lockedUntilTower: true },
    { id: 'court-quay-east', line: 'court-quay', x: 14, width: 6.6, leaves: 2, lockedUntilTower: true },
  ],
  /** The player opens a gate within this distance of a leaf (capsule radius 0.4 + reach). */
  touchDistance: 0.9,
  /** Robots open it within this distance of a leaf (they arrive faster and wider than the player). */
  enemyDistance: 1.8,
  openAngle: (100 * Math.PI) / 180,
  /** rad/s */
  swingSpeed: 3.2,
  closeDelay: 5,
  /** A locked gate shows its hint at most this often (s). */
  lockedToastEvery: 4,
  /** Nobody within this distance of the gate centre before it may close. */
  clearRadius: 2.2,
  leafThickness: 0.08,
} as const;

