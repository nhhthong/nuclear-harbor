# Data Model: Spider Robot

- **SpiderState**: `patrol | flank | chase | attack | hop | destroyed`.
- **SpiderBrainInput**: state, timeInState, distance, hasLos, timeSinceSeen, playerAlive, flankReached, playerMovedFar, hopRequested.
- **FlankSide**: `-1 | 1` (left/right of the player's facing).
- **Leg**: hip offset (x,z), home offset, foot position (x,y,z), step progress, tripod group (0|1), stepping flag.
- **HopPlan**: start, end, elapsed, duration (~0.5 s), apex height.

Transitions: patrol -> flank (detect) -> chase (flank reached / player far / flank timeout) -> attack (within 12 m with LOS) -> chase (LOS lost or beyond range hysteresis) -> patrol (target lost for loseTargetTime). Any moving state -> hop -> previous state. Any -> destroyed (damage path).
