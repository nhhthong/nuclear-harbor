# Foundation requests (T-18)

Status: APPLIED. `src/weapon/index.ts` now calls `createViewModel(res, c.flags.params)`; kept for history.

1. `src/weapon/index.ts` (T-02 owned): replace `viewModel = new ProceduralViewModel(res);` with `viewModel = createViewModel(res, c.flags.params);` imported from `./viewmodel/createViewModel`. Needed so `?viewmodel=glb` takes effect in the running game. Worked around locally: the factory, loader and tests exist and are verified without this edit; the in-game screenshot uses a temporary, uncommitted local patch.
