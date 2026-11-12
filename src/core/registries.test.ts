import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GRAPPLE } from '@/config/tunables';
import { GrappleAnchorRegistry } from './registries';

describe('GrappleAnchorRegistry', () => {
  const registry = new GrappleAnchorRegistry();
  registry.add({ id: 'a', kind: 'crane', position: new Vector3(0, 20, 0) });
  registry.add({ id: 'b', kind: 'lamp-post', position: new Vector3(60, 8, 0) });

  it('finds the nearest anchor within range', () => {
    expect(registry.nearest(new Vector3(5, 1.6, 0), GRAPPLE.maxRange)?.id).toBe('a');
    expect(registry.nearest(new Vector3(200, 1.6, 0), GRAPPLE.maxRange)).toBeNull();
  });

  it('computes coverage of sample points (GDD 7.4)', () => {
    const samples = [new Vector3(0, 1.6, 0), new Vector3(50, 1.6, 0), new Vector3(150, 1.6, 0)];
    const result = registry.coverage(samples, GRAPPLE.maxRange);
    expect(result.covered).toBe(2);
    expect(result.uncovered).toHaveLength(1);
  });

  it('rejects duplicate ids', () => {
    expect(() => registry.add({ id: 'a', kind: 'manual', position: new Vector3() })).toThrow();
  });
});
