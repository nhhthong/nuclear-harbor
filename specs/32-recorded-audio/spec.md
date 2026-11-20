# Spec 32: recorded sound effects

**Status**: wave 1 implemented (phases 1 to 5 where sources exist); phase 6 (mix pass) open.

## What the player hears, and why
Every sound used to be synthesised (oscillators and filtered noise), which read as placeholder. The game now plays recorded CC0 / CC-BY samples for the rifle, reload, casings, impacts, footsteps, voice, low health, robots, boss, world and ambience. Each sound keeps its procedural recipe as the fallback (file missing, still loading or failed to decode: never silence).

## Requirements
- R1 A sample layer in `src/audio`: manifest (sound id -> variants, gain, pitch and gain jitter, optional offset), a loader that fetches and decodes OGG files from `public/assets/audio/` with same-origin relative URLs, playback through the existing voice allocator, spatial panner and buses. Each play picks a random variant (never the same twice in a row when there is a choice) with slight pitch and gain variation.
- R2 Fallback: while a sample is loading, missing or failed, the procedural recipe plays. Every new id has a recipe. Everything is disposed with the module.
- R3 Pipeline `tools/asset-pipeline/audio.sh`: mono Ogg Vorbis 44.1 kHz, trimmed, peak-normalised, crossfaded loops; its header lists every source, author, licence and URL. Budget 6 MB (owner); wave 1 ships about 1.3 MB.
- R4 Sources: BigSoundBank (Joseph SARDIN, CC0) wherever it fits (owner decision); OpenGameArt CC0 / CC-BY only for the rest. No CC-BY-SA, NC or ND. Freesound is not reachable from the build sandbox.
- R5 Sounds: rifle shot (variants with an outdoor tail), dry click, reload in three parts timed to the reload duration, shell casing, bullet impacts on metal vs concrete (from the ray hit), footsteps on concrete/asphalt vs metal (stair, mezzanine, container tops), jump, landing, hurt, death, low-health heartbeat and breathing loops that follow HP below 35 %, pickups, hit marker, robot alerts, enemy lasers, melee robot servo, samurai sword, drone buzz, explosions, scorpion steam hiss, boss cannon / stomp / laser / laser charge / electric strike, countdown alarm and beeps, swing gates, warehouse metal creaks, wind and sea ambience layered on the procedural bed.
- R6 Credits in `src/ui/credits.ts`, `CREDITS.md` and `docs/ASSETS.md`. Offline: the files live in `public/`, so the service worker precaches them; nothing loads from the network.

## Assumptions
- Ground-level surfaces (asphalt, quay, warehouse slab) read as concrete; anything raised above 0.5 m (containers, mezzanine) and the stair footprint read as metal.
- Bullet impacts: ground floors and the perimeter wall are concrete; everything else (containers, warehouse steel, props) is metal. Hits on robots add a quiet metal impact.
- The tower hum and the boss telegraphs stay procedural (they follow progress and attack variants).
- Spec 31 (samurai crescent wave) is on another branch. The energy-wave whoosh is wired to the boss shockwave here and can be routed to the crescent wave after the merge.

## Out of scope (later)
Per-drone looping buzz, roller door sound (no event), rain (no weather), rocket launch (no BigSoundBank page found), the mix pass on a real device (phase 6).
