# Data model (T-19)

**Duck** (`type: 'charger'`): hp 60. States `patrol | hop | arming | destroyed`. Fields: hop clock, arm countdown (3 s), last beep count, blast radius 4 m, blast damage 15.
Transitions: patrol -> hop (aware) ; hop -> arming (distance <= 2.5 m with LOS) ; hop -> patrol (target lost) ; arming -> destroyed (fuse 0 or killed).

**Spot** (`type: 'spider'`): hp 70. States `patrol | chase | telegraph | lunge | retreat | destroyed`. Fields: lock direction, travelled, hit-this-lunge flag, cooldown, retreat timer, circle sign.
Transitions: patrol -> chase (aware) ; chase -> telegraph (distance <= lungeRange, cooldown 0, LOS) ; telegraph -> lunge (0.45 s) ; lunge -> retreat (hit, wall, or max distance) ; retreat -> chase (cooldown over).

Events (new): `duck:beep {id, position, count}`, `duck:explode {id, position, radius, hitPlayer}`.
