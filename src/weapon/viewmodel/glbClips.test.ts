import { describe, expect, it } from 'vitest';
import { hasStateClips, mapClips, pickFireClip, reloadTimeScale } from './glbClips';

describe('glbClips', () => {
  const names = ['idle', 'reload', 'draw', 'shoot2', 'shoot1', 'shoot3'];

  it('maps converted clip names to weapon states', () => {
    const map = mapClips(names);
    expect(map.idle).toBe('idle');
    expect(map.reload).toBe('reload');
    expect(map.draw).toBe('draw');
    expect(map.fire).toEqual(['shoot1', 'shoot2', 'shoot3']);
    expect(hasStateClips(map)).toBe(true);
  });

  it('round-robins fire clips and handles none', () => {
    const map = mapClips(names);
    expect([0, 1, 2, 3].map((i) => pickFireClip(map, i))).toEqual(['shoot1', 'shoot2', 'shoot3', 'shoot1']);
    expect(pickFireClip(mapClips(['idle']), 0)).toBeNull();
  });

  it('reports missing clips', () => {
    expect(hasStateClips(mapClips([]))).toBe(false);
    expect(hasStateClips(mapClips(['idle', 'reload']))).toBe(false);
  });

  it('scales the reload clip to the requested duration within limits', () => {
    expect(reloadTimeScale(3.3, 1.65)).toBeCloseTo(2);
    expect(reloadTimeScale(3.3, 0.1)).toBeLessThanOrEqual(2.5);
    expect(reloadTimeScale(0, 1.8)).toBe(1);
    expect(reloadTimeScale(3.3, 0)).toBe(1);
  });
});
