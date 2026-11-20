# Feature Specification: Chain-link fences with swing gates

**Feature**: `30-fences-and-gates` | **Created**: 2026-11-20 | **Status**: Implemented and merged (PR #20 with spec 29); not played on a real GPU
**Input**: owner request 2026-11-20: "add some fences whose gates open when touched".
**Process**: written by the coordinator with the implementation on the dev branch `claude/wizardly-cori-697x6r`, not by running the skills in order; the coordinator did the browser check (stepped simulation). The container livery text `nhhthong@` was an owner tuning request done in the same change (no spec needed). Rewritten in the 2026-11 analysis (`specs/ANALYSIS-2026-11.md`).
**Check tags**: `[U file]` unit test, `[B]` browser check (low preset, stepped simulation), `[N]` not verified.

## Goal
Thresholds that make the route feel physical: a fence between the gate apron and the container yard, and one between the relay court and the quay, with gates that swing open when the player or a robot reaches them and close again later.

## User Scenarios & Testing

### User Story 1 - Walk through a gate by touching it (Priority: P1)
1. Fence `apron-yard` at z 12.4 (x -35.6..5.75): double gates (6.6 m) on both yard lanes (x -15 and 2) and a 1.2 m walk gate at x -29. Fence `court-quay` at z -40.75 (x -35.6..35.6): double gates at x -10 and x 14 (in line with the warehouse back door). 5 gates, 9 leaves, fence height 2.4 m. Gaps are exactly at the gates; fences stay clear of containers, structures, shelters and supplies; lane gates span the lanes. [U `src/structures/gates.test.ts`]
2. The player opens a gate within 0.9 m of a leaf; it swings 100 degrees (3.2 rad/s) away from whoever opened it, stays open while anyone is within 2.2 m of its centre and closes 5 s after the last visitor. [U `gates.test.ts` touch, swing side, close after delay; B walking north into the closed west lane gate opened it (swung north), the player passed from z 17 to z -3, 9 s after leaving it was closed]
3. Court/quay gates render closed; no console errors. [B]

### User Story 2 - Robots and the gates (Priority: P2)
A walking robot within 1.8 m of a leaf opens the gate; robots route through closed gates (the nav bake ignores them) and open them on arrival. Drones fly over.
1. A robot that walks up to a gate opens it. [U `gates.test.ts`]
2. Robots opening gates in a real fight, nav routing through closed gates, drones over fences. [N]

### User Story 3 - Sound (Priority: P3)
A metallic clank when a gate starts opening or finishes closing: `world:gateMoved` routes to the sound `gate` (first the existing `hitArmor`; spec 32 replaced it with a recorded gate sample, procedural recipe as fallback). [U `src/audio/samples.test.ts` route; heard [N]]

## Requirements
- **FR-001** Two fence lines with gaps at the gates (User Story 1.1); fence runs are solid world colliders. [U, B]
- **FR-002** Gate state machine: opens on touch (0.9 m player, 1.8 m robot), swings away 100 degrees, stays open while someone is near, closes after `closeDelay` 5 s. [U, B]
- **FR-003** New collision layer `GATE` (`src/physics/groups.ts`): closed leaves stop walkers only (player and enemy groups include it); bullets, sight lines and the nav bake pass through; leaves disable their collider while moving or open. [N: no test of the layer filters; B only shows the player passing after the gate opened]
- **FR-004** Event `world:gateMoved` (`core/events.ts`) with an audio route. [U route test]
- **FR-005** Drones are not blocked by fences (they fly over). [N]
- **FR-006** Numbers in `GATES` (`src/structures/tunables.ts`). [review]
- **FR-007** The container livery set gains `nhhthong@` (about one box in seven; 14 decals counted). [B]
- **FR-008** Robots open gates they walk into. [U; real fight N]

## Success Criteria
- **SC-001** `npx tsc --noEmit`, unit tests and build pass (612 tests at the time; 655 on 2026-11-20). [run 2026-11-20: pass]
- **SC-002** Browser walk through a gate, closing, court/quay gates rendered, livery visible, no console errors. [B, done]

## Assumptions
- Chain-link texture is a procedural canvas; no assets were added.
- Fence frame and panel are merged into 2 draws; 9 leaf pivots with 3 small meshes each; no per-step allocation beyond a walker list (review only).
- Not verified: robots at gates in a real fight, medium/high presets, a real GPU, the audible clank, bullets passing a closed leaf.
