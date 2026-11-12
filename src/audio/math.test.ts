import { describe, expect, it } from 'vitest';
import { beaconInterval, distanceGain, humFrequency } from './math';
import { AUDIO } from './tunables';

describe('distanceGain', () => {
  it('is 1 inside the reference distance and falls with distance', () => {
    expect(distanceGain(0)).toBe(1);
    expect(distanceGain(AUDIO.spatial.refDistance)).toBe(1);
    expect(distanceGain(10)).toBeLessThan(distanceGain(5));
    expect(distanceGain(100)).toBeLessThan(distanceGain(10));
  });
  it('stops falling past the max distance', () => {
    expect(distanceGain(500)).toBe(distanceGain(AUDIO.spatial.maxDistance));
  });
});

describe('beaconInterval', () => {
  it('shortens as the player gets closer, within the configured bounds', () => {
    const { minInterval, maxInterval, nearDistance, farDistance } = AUDIO.beacon;
    expect(beaconInterval(0)).toBe(minInterval);
    expect(beaconInterval(nearDistance)).toBe(minInterval);
    expect(beaconInterval(farDistance * 2)).toBe(maxInterval);
    let prev = 0;
    for (let d = 0; d <= 150; d += 5) {
      const v = beaconInterval(d);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('humFrequency', () => {
  it('rises with activation progress and clamps', () => {
    expect(humFrequency(0)).toBe(AUDIO.hum.baseHz);
    expect(humFrequency(1)).toBe(AUDIO.hum.topHz);
    expect(humFrequency(0.5)).toBeGreaterThan(humFrequency(0.2));
    expect(humFrequency(2)).toBe(AUDIO.hum.topHz);
  });
});
