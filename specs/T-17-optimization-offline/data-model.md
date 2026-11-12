# Data model (T-17)

- **QualityPreset** `{ name: 'low'|'medium'|'high', shadows: boolean, shadowMapSize: number, pixelRatioCap: number, post: boolean, viewDistance: number }`
- **Settings** (existing, persisted): `quality`, `fpsCap` (0 = uncapped | 30 | 60 | 120), `volume` (0..1).
- **PrecacheManifest**: `{ version: string, files: string[] }` embedded in `sw.js` at build; cache name `nh-<version>`.
