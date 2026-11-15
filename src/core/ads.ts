import { ADS, CAMERA } from '@/config/tunables';

const DEG = Math.PI / 180;

/** Smoothly move the aim amount (0..1) towards `target`. Frame-rate independent. */
export function stepAim(current: number, target: 0 | 1, dt: number): number {
  const next = current + (target - current) * (1 - Math.exp(-ADS.response * dt));
  return Math.abs(target - next) < 0.002 ? target : next;
}

/** Camera vertical FOV (deg) for an aim amount. */
export function aimFovDeg(aim: number): number {
  return CAMERA.fovDeg + (ADS.fovDeg - CAMERA.fovDeg) * aim;
}

/** Mouse sensitivity multiplier: keeps the same angular feel per screen pixel when zoomed. */
export function aimSensitivityScale(aim: number): number {
  return Math.tan((aimFovDeg(aim) * DEG) / 2) / Math.tan((CAMERA.fovDeg * DEG) / 2);
}

/** Linear blend 1 -> `scale` by aim amount (spread, recoil, speed). */
export function aimScale(scale: number, aim: number): number {
  return 1 + (scale - 1) * aim;
}
