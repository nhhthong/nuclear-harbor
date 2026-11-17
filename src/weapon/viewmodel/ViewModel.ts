import type { Object3D, Vector3 } from 'three';

/** Per-frame inputs a view model may react to. */
export interface ViewModelState {
  /** Horizontal speed in m/s. */
  speed: number;
  sprinting: boolean;
  /** Seconds of simulated time, for idle sway. */
  time: number;
  /** 0..1 blend hip -> aimed (centre the rifle on screen). */
  aim: number;
}

/**
 * Small seam between the weapon logic and the first-person model, so the procedural placeholder
 * can be swapped for a real asset without touching `src/weapon/index.ts`.
 */
export interface ViewModel {
  /** Root; parented to the camera by the weapon module. Visibility is toggled on this object. */
  readonly object3d: Object3D;
  /** Muzzle position in `object3d` space (tracers and flash start here). */
  readonly muzzleLocalPosition: Vector3;
  /** Shell ejection port in `object3d` space. */
  readonly ejectionLocalPosition: Vector3;
  update(dt: number, state: ViewModelState): void;
  playFire(): void;
  /** Animate a reload lasting `duration` seconds. */
  playReload(duration: number): void;
  dispose(): void;
}
