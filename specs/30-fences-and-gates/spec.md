# Feature Specification: Chain-link fences with swing gates

**Spec**: 30 | **Owner request**: 2026-11-20 ("add some fences whose gates open when touched")

## Goal
Thresholds that make the route feel physical: a fence between the gate apron and the container yard, and one between the relay court and the quay, each with gates that swing open when the player (or a robot) reaches them and close again later.

## Scope
- Fence `apron-yard` at z 12.4 (x -35.6..5.75): double gates on both yard lanes (x -15 and 2, 6.6 m), a 1.2 m walk gate at x -29.
- Fence `court-quay` at z -40.75 (full width): double gates at x -10 and x 14 (in line with the warehouse back door).
- Gates open on touch (player within 0.9 m of a leaf) or when a walking robot comes within 1.8 m; they swing away from whoever opened them (100 degrees), stay open while anyone is near and close 5 s after the last visitor. Drones fly over.
- Closed leaves stop walkers only (new GATE collision layer): bullets, sight lines and the nav bake pass through, so robots route through closed gates and open them on arrival. Fence runs are solid world colliders.
- A metallic clank (`world:gateMoved` -> `hitArmor`) when a gate starts opening or finishes closing.
- Also (owner request, tuning, no spec needed): the container livery set gains `nhhthong@`.

## Acceptance
- Gaps exactly at the gates; fences clear of containers, structures, shelters and supplies; lane gates span the lanes (tests).
- Gate state machine: opens on touch, swing side, stays open while someone is near, closes after the delay, opens for robots (tests).
- Browser: the player walks through a closed gate by touching it; the gate closes after leaving; no console errors.
