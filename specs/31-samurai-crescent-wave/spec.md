# Feature Specification: Samurai crescent wave, frontal spin

**Spec**: 31 | **Owner request**: 2026-11-20

## Goal
1. Fix: the spinning naginata (deflect skill) turned in the sagittal plane beside the body; it must spin 90 degrees round, in the frontal plane in front of the samurai, facing the player it deflects.
2. New skill: the samurai's armour glows red, then a vertical overhead cut releases a bright crescent of sword energy, standing upright, that glides at the player: slower than a bullet, high damage.

## Behaviour
- Spin: the skinned naginata is stood up (pitch +90 degrees) and rolled about the facing axis, held 0.55 m in front of the grip; the blur disc lies in the frontal plane at the same spot. Deflection numbers unchanged.
- Crescent wave (`SAMURAI.wave`): used from 6 to 26 m with line of sight, when the player is beyond leap range or the leap recharges; cooldown 8.5 s. Charge 0.95 s (blade overhead, armour emissive red, pulsing), overhead cut 0.32 s (release half way), recover 0.55 s. The crescent (2.9 m tall, 0.75 m bulge, additive white-hot red core plus a red halo) flies at 12 m/s towards where the player stood (within about 35 degrees of the facing), up to 30 m; 32 damage and knockback on a hit (1.05 m half width across the flight); a double jump does not clear it, stepping aside does; walls stop it (static world ray), gates and fences' chain-link do not.

## Acceptance
- Unit tests: hit volume (in path, beside, behind, not reached, jump), crescent shape bounds, speed below bullet speed, damage above the cut and the leap.
- Browser: a samurai 20 m away charges red, cuts and the crescent reaches and hurts the player; the spin disc faces the player; no console errors.
