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
