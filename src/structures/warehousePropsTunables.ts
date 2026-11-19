/**
 * Numbers of the warehouse interior props (spec 29, stream C). Zones, corridor, stairs, openings and the
 * supply spot come from the shared contract `src/config/warehouse.ts`; this file only says how the props fill them.
 */
export const WAREHOUSE_PROPS = {
  /** Same-origin, relative to the page (CC0 Poly Haven + CC-BY Sketchfab, see docs/ASSETS.md). */
  url: 'assets/props/warehouse.glb',
  seed: 2911,
  /** Clearances the placement keeps (tests check the same numbers). */
  clear: { opening: 1.5, supply: 1.2, corridor: 0.05 },
  /**
   * Selective pallet racking. Rows run north-south; `rows[i].x` is the west face of a row measured from the
   * west edge of `propZones.racks`; `sides` 2 = back-to-back double row, 1 = single row.
   */
  racks: {
    rows: [
      { x: 1.5, sides: 2 },
      { x: 7.3, sides: 2 },
      { x: 13.1, sides: 1 },
    ] as ReadonlyArray<{ readonly x: number; readonly sides: 1 | 2 }>,
    /** First frame, measured south from the north edge of the zone (leaves a cross aisle at the north end). */
    startZ: 3,
    bays: 7,
    bayLength: 2.7,
    /** Depth of one single rack (frame), and the gap between the two halves of a double row. */
    depth: 1.1,
    flue: 0.3,
    uprightHeight: 6,
    /** Top of the step beams (m); the floor is a storage level too. */
    beamLevels: [1.6, 3.2, 4.8] as readonly number[],
    beamHeight: 0.12,
    minAisle: 3,
    /** Pallet slots per bay and level. */
    slotsPerBay: 2,
    /** Load mix per slot (the rest is shrink-wrapped). */
    emptyChance: 0.2,
    boxesChance: 0.14,
    cratesChance: 0.1,
    longCratesChance: 0.05,
    wrapHeight: [0.7, 1.15] as readonly [number, number],
    colors: { upright: 0x1d4f9c, beam: 0xe2601a, deck: 0x8d9398 },
  },
  /** Procedural workbench in the workshop (steel frame, wooden top, pegboard at the back). */
  workbench: { w: 2.2, d: 0.8, h: 0.92 },
  /** Hanging lamps: bottom of the shade (m) and where the rows hang. */
  lamps: {
    y: 7.4,
    rows: [
      { x: 23.65, z: [-12, -6, 0, 6] },
      { x: 29.45, z: [-12, -6, 0, 6] },
      { x: 14, z: [-12, -6, 0, 6] },
      { x: 12, z: [8] },
    ] as ReadonlyArray<{ readonly x: number; readonly z: readonly number[] }>,
  },
} as const;
