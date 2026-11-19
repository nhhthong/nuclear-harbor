# Feature Specification: Warehouse, L-shaped map, flying drones, interior props

**Spec**: 29 | **Status**: in progress | **Owner request**: 2026-11-19 (playable warehouse with stairs, an upstairs office, windows and a real warehouse structure where the player can stand and shoot from above; the map becomes an L with the warehouse filling the rest; flying robots (reuse the dragonfly drone) so robots can reach the upper floor; free models scattered inside the warehouse).

## Goal
Make the level more dramatic: height, an indoor fight, a forced path with a reveal, and a closed boundary.

## Scope (wave 1)
1. **L-shaped map**: the outdoor play area is the west leg (gate apron + container yard, x -36..6) plus the north leg (relay court + quay, full width). A tall perimeter wall (7 m) closes the land sides; the quay edge stays as it is. The south-east block is a closed loading dock outside the play area. Player spawn moves to (-15, 29).
2. **Warehouse** (`src/config/warehouse.ts` is the contract): steel portal frame, corrugated walls, pitched roof with skylights, west roller door, north back door, steel stair, mezzanine along the north wall with railings and a glazed office, open window frames over the relay court. The yard is closed to the north by a container wall, so the only path to the court runs through the warehouse.
3. **Flying drone enemy**: the boss's dragonfly drone becomes a regular enemy type that flies (no nav grid), avoids walls, enters the warehouse through flyable openings and is called in when the player camps on the mezzanine.
4. **Interior props**: procedural pallet racks plus free CC0/CC-BY GLB props (crates, boxes, barrels, IBC tank, pallet jack, workshop tools, office furniture, industrial lamps), instanced, with colliders for the large ones.

## Out of scope (wave 2)
Interior lighting polish beyond basics, scripted events (alarm, falling containers), ambient audio, grenades.

## Acceptance
- The player can walk gate -> yard -> warehouse (roller door) -> stairs -> mezzanine and office -> back door -> court; the yard has no other way north. Stairs are walkable with the current jump (0.95 m / 1.8 m).
- From the mezzanine windows the player sees and can shoot into the relay court.
- Ground robots never path into walls; drones reach a player on the mezzanine through an opening and never pass through walls or the roof.
- Props never block the corridor, the stairs, the openings, the supply spot or robot routes (tests).
- Ammo budget test still passes; roster and drone counts are tunables.
- Draw calls stay within the 350 budget (instancing); new GLBs at most about 2 MB in total.
- `npx tsc --noEmit && npm test && npm run build` pass. Browser checks are done by the coordinator after merge.

## Assumptions
Defaults confirmed by the owner: the warehouse is on the forced path; the L's missing corner is the south-east. Sub-agents only write code and build assets (no dev server, browser or screenshots); the coordinator verifies in the browser after merging.
