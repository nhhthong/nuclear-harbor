# Quickstart

1. `bash tools/asset-pipeline/convert.sh` produces the GLB and report (46 bones, 6 clips).
2. `npm run typecheck && npm test && npm run build && SMOKE_PORT=4xxx npm run smoke`
3. `SMOKE_PORT=4xxx npm run e2e -- T-18` checks load, fallback and a screenshot.
4. Manual: `npm run dev`, open `/?sandbox&autostart&viewmodel=glb`.
