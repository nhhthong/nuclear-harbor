# Research (T-17)

- **Decision**: Hand-written `public/sw.js` with a build-time generated precache list (small Vite plugin writes `precache.json`-style list into the SW at `closeBundle`). Rationale: ticket step 8, no dependency. Alternative: workbox (rejected, new dependency).
- **Decision**: Static shadow once (`shadowMap.autoUpdate = false`, `needsUpdate` on world ready / quality change) plus a periodic cheap refresh only if a measurement shows dynamic casters matter; otherwise document. Rationale: PLAN A10 / GDD 13.6. Alternative: second frustum (more code, more draw calls).
- **Decision**: Menu draw-call cause is investigated by measurement (renderer.info per pass) before changing anything; findings recorded in docs/PERFORMANCE.md.
- **Decision**: Quality presets as a pure table in `src/core/quality.ts`; FPS cap as a pure "should render now" accumulator. Rationale: unit-testable (Principle IV).
- **Decision**: Vendor chunks via `build.rollupOptions.output.manualChunks` (three, rapier). Rapier is WASM-in-base64 (compat build) so it is big; dynamic import deferral only if init order allows.
- **Decision**: Offline proof = Playwright script: load, wait for SW active + cache populated, `context.setOffline(true)`, reload, reach `playing`, no failed requests; plus request-origin assertion.
- **Open items resolved**: real-device benchmarks are impossible here; provided as `?bench` instructions.
