# Data model (T-21)

## Dinosaur FSM
`spawning` (2 s rise, invulnerable-looking, takes damage) -> `guard` (idle at tower, scans) -> `chase` (walk to player within leash) -> `telegraph(skill)` (>= 0.8 s) -> `execute(skill)` -> `recover` -> `guard`/`chase`; `stunned` after a wall-hit ram or a stomp landing; `dead`.

## Skills (tunables `DINO.skills`)
| Skill | Chosen when | Telegraph | Execute | Damage | Radius | Cooldown |
|---|---|---|---|---|---|---|
| ram | distance 14..40 | 1.0 s (red strip) | locked-direction charge 16 m/s up to 40 m, stops at wall/leash | 25 on contact + knockback | body ~3.5 m | 7 s |
| leapStomp | distance 8..30 | 1.0 s crouch + ring at target | 0.9 s parabola to locked target, shockwave | 30 at centre, falloff to 30% at edge | 8 m | 8 s |
| tailSpin | distance < 10 | 0.9 s wind-up ring | 0.8 s, 360 degrees | 20 once per spin | 9 m ring | 5 s |

Stun after wall ram 2.5 s, after stomp 1.2 s.

## Events (`src/dinosaur/events.ts`)
- `dino:spawned {id, towerId, position}`
- `dino:roar {position, shake, duration}`
- `dino:telegraph {id, skill, position, radius, duration}`
- `dino:attack {id, skill, position, radius}`
- `dino:stunned {id, position, duration}`
- `dino:defeated {id, position}`

## Pure functions
`pickGuardTowers(seed, total=4, count=2)`, `chooseSkill(distance, cooldowns)`, `stompDamage(distance)`, `inTailRing(...)`, `rammedPlayer(...)`.
