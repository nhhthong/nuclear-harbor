# Data model

- **ChargerState**: `patrol | detect | windup | charge | stunned | recover | destroyed` (string in `enemy.state`).
- **ChargeProbes**: `{ obstacleDistance: number | null; edgeDistance: number | null }` (distance along the line to the first obstacle / first missing ground).
- **ChargePlan**: `{ maxDistance: number; endsAt: 'wall' | 'edge' | 'range' }`.
- **ChargeStartInput**: distance, hasLos, cooldownLeft.
- **Transitions**: patrol -> detect (sees player) -> windup (can start) -> charge (after telegraph) -> stunned (wall) | recover (edge/range) -> detect; any -> destroyed.
- **Timers**: windup 1.0 s, stun 2.5 s, recover 1.0 s, cooldown 6 s counted from charge end.
