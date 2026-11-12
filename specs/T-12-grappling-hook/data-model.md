# Data model: Grappling hook

## GrappleState (pure)

- `phase`: `ready` | `pulling` | `cooldown`
- `cooldownRemaining`, `cooldownTotal`
- `target`: attach/aim point (x, y, z), `anchorId?`, `landing?` (perch), `isPerch`
- `pullDelay` (hook flight time left), `pullTime`, stuck window accumulators

### Transitions

| From | Trigger | To | Output |
|------|---------|----|--------|
| ready | fire, no hit / out of range | cooldown (short) | failed `no-target` |
| ready | fire, hit not grappleable | cooldown (short) | failed `not-grappleable` |
| ready | fire, valid target | pulling | fired, attached |
| cooldown | fire | cooldown (unchanged) | failed `cooldown` |
| pulling | fire (edge) | cooldown | released `manual` |
| pulling | eye within `releaseDistance` of aim point | cooldown | released `arrived` (+ perch landing flag) |
| pulling | moved < `stuckDistance` within `stuckWindow` | cooldown | released `stuck` |
| pulling | pull time > `maxPullDuration` | cooldown | released `timeout` |
| any | death | ready (cooldown on release) | released `death` |
| cooldown | timer reaches 0 | ready | cooldown {0, total} |

## StepInput / StepOutput

Input: `dt`, `firePressed`, `ray` (`hit`, `grappleable`, `distance`, `point`, `anchorId?`, `landing?`; only needed when firing), `eye`, `moved` (metres since last step).
Output (reused object): `pulling` flag, pull direction (unit), `events` (reused array of grapple events), `landing` request.
