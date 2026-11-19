# Stream C notes: interior props (T030 to T033)

## Done
- T030 `tools/asset-pipeline/warehouse_props.py` -> `public/assets/props/warehouse.glb` (1.7 MB, 25 nodes, 19.2k triangles, normals quantized). Sources and exact ids in the script header, `docs/ASSETS.md`, `CREDITS.md`, `src/ui/credits.ts`. Raw downloads stay out of git (rebuild: download into `<raw>/<name>/`, run Blender, then `quantize_normals.py`).
- T031 procedural racks (`addRackSteel` in `src/structures/warehousePropMeshes.ts`): one merged vertex-coloured mesh with the workbench; loads instanced (pallets, cartons, crates, translucent wrap blocks).
- T032 `src/structures/warehouseProps.ts` (layout, pure) + `warehousePropMeshes.ts` (meshes, GLB load, fallback, colliders) + `warehousePropsTunables.ts`; mounted from a separate block in `src/structures/index.ts`.
- T033 tests: `warehouseProps.test.ts`, `warehousePropMeshes.test.ts`.

## Assumptions about stream A (check after merge)
- Placement only reads `src/config/warehouse.ts`. Unknowns: mezzanine columns (props under the mezzanine sit at z <= -17.5 and x >= 19.5), the office door (office props keep x >= 26.8 and z <= -18.6 free), roof trusses (lamps hang from 8.75 m down to 7.4 m), stream A's own lamps (spec says "basic lamps" in T014: if A adds lamps too, drop one set; `WAREHOUSE_PROPS.lamps.rows` can be emptied).
- Colliders are added synchronously in `init` so the nav bake (physics overlap queries, 0.2 to 2 m band) sees them; office colliders are above that band.
- Stream B's ammo crate at `supplySpot`: nothing of ours within 1.2 m (tested).

## Coordinator browser checks
- Racks read as real racking (colours, bracing direction, beams at the right heights, loads sit on the beams), wrap blocks not flickering through each other (transparent sorting).
- Orientation: desks face into the office, cabinets' drawers face the room, carts' fronts face north, ladder leans into the south wall (not away), pallet jack in the south cross aisle.
- Lamps glow (MeshBasic HDR colour) and do not clip the roof; nothing blocks the corridor, stairs, back door, roller door, mezzanine windows.
- `ctx.testHooks.warehouseProps.summary()` -> shown > 0 (GLB loaded), and renderer draw calls with the warehouse in view.
- Robots in the rack aisles; player cannot walk through racks, desks, IBCs.
