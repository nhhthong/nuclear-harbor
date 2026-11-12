# Contracts

- `createViewModel(res: ResourceTracker, params: URLSearchParams): ViewModel` in `src/weapon/viewmodel/createViewModel.ts`: returns a model immediately; `viewmodel=glb` starts an async same-origin load of `assets/weapons/g36c/g36c.glb`; any error keeps the procedural model.
- `GlbViewModel implements ViewModel`, built from a parsed glTF.
- CLI: `bash tools/asset-pipeline/convert.sh [source.mdl]` writes `public/assets/weapons/g36c/g36c.glb` and `tools/asset-pipeline/report.json`.
