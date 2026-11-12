import { AUDIO } from './tunables';

/**
 * Inverse-distance gain as the Web Audio "inverse" model computes it, clamped to
 * [refDistance, maxDistance]: ref / (ref + rolloff * (d - ref)).
 */
export function distanceGain(
  distance: number,
  refDistance: number = AUDIO.spatial.refDistance,
  maxDistance: number = AUDIO.spatial.maxDistance,
  rolloff: number = AUDIO.spatial.rolloff,
): number {
  const d = Math.min(Math.max(distance, refDistance), maxDistance);
  return refDistance / (refDistance + rolloff * (d - refDistance));
}

/** Seconds between beacon pings: short when close, long when far (linear in between). */
export function beaconInterval(distance: number): number {
  const { nearDistance, farDistance, minInterval, maxInterval } = AUDIO.beacon;
  const k = Math.min(1, Math.max(0, (distance - nearDistance) / (farDistance - nearDistance)));
  return minInterval + (maxInterval - minInterval) * k;
}

/** Tower hum frequency for activation progress 0..1. */
export function humFrequency(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return AUDIO.hum.baseHz + (AUDIO.hum.topHz - AUDIO.hum.baseHz) * p;
}
