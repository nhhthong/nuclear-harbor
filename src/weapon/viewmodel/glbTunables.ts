/** Tunables for the converted G36C view model (ticket T-18). */
export const GLB_VIEW = {
  /** Same-origin, relative to the page (the build uses a relative base). */
  url: 'assets/weapons/g36c/g36c.glb',
  /** Query value that selects the converted model: `?viewmodel=glb`. */
  queryName: 'viewmodel',
  queryValue: 'glb',
  /** Position of the model root in camera space (metres). */
  offset: { x: 0.04, y: -0.04, z: 0.0 },
  /** Rig shift (camera space, metres) at full aim; tuned by eye against the G36C sights. */
  ads: { x: 0.02, y: 0.06, z: 0.0 },
  /** Uniform scale applied to the converted (already metric) model. */
  scale: 1,
  /** Clip cross-fade times (seconds). */
  fadeToFire: 0.03,
  fadeToIdle: 0.12,
  /** Reload clip is time-scaled to the weapon reload duration, within these bounds. */
  reloadScaleMin: 0.5,
  reloadScaleMax: 2.5,
  /** Fallbacks when the muzzle/eject nodes are missing (model space, metres). */
  muzzleFallback: { x: 0, y: 0.0, z: -0.58 },
  ejectFallback: { x: 0.035, y: 0.04, z: -0.12 },
  /** Procedural motion used on a static mesh when no clips exist. */
  staticKickBackMetres: 0.045,
  staticKickRecoverPerSec: 18,
} as const;
