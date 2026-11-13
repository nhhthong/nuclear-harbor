# Data model

- **CinematicFrame** (pure): `{ t, stage: 'sky'|'descent'|'impact'|'title'|'release', bars 0..1, title 0..1, fall 0..1 (0 sky, 1 landed), shake 0..1, camera: {pos, look} }`.
- **LandingInput**: `{ centre, arenaRadius, footprint, player, obstacles[{x,z,r}], blocked(x,z) }` -> `{ x, z, clear: boolean }`.
- **Weak point i** (0 front-left, 1 front-right, 2 back-left, 3 back-right): hp 500; ability loss: 0 cannon slower, 1 and 2 missiles minus 2, 3 slam radius x0.7.
- **Phases**: dormant -> awakening (cinematic) -> weakpoint-hunt -> core-exposed -> destroyed.
