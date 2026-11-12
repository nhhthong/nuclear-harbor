import { describe, expect, it } from 'vitest';
import { createRng, ParticleEmitter } from './emitter';
import { ParticleBuffer } from './ParticleBuffer';
import { RECIPE_IDS, RECIPES, recipeParticleCount } from './recipes';

function make(cap = 400) {
  const e = new ParticleEmitter(new ParticleBuffer(cap), new ParticleBuffer(cap), createRng(7));
  e.setBudget(cap);
  return e;
}

describe('ParticleEmitter', () => {
  it('every kind except pure rings spawns particles', () => {
    for (const id of RECIPE_IDS) {
      const e = make();
      const n = e.emit(id, 0, 1, 0, 0, 1, 0, 1);
      if (RECIPES[id].layers.length === 0) expect(RECIPES[id].ring).toBeDefined();
      else expect(n).toBeGreaterThan(0);
    }
  });

  it('kinds are distinct (colour or count differs)', () => {
    const sigs = new Set<string>();
    for (const id of RECIPE_IDS) {
      const l = RECIPES[id].layers[0];
      sigs.add(`${l?.from.join(',')}|${l?.count}|${l?.buffer}`);
    }
    expect(sigs.size).toBe(RECIPE_IDS.length);
  });

  it('emits within the cone around the normal', () => {
    const e = make();
    e.emit('armor-spark', 0, 0, 0, 0, 0, 1, 1);
    const cone = Math.cos(RECIPES['armor-spark'].layers[0]!.coneDeg * (Math.PI / 180));
    for (let i = 0; i < 16; i++) {
      const v = Math.hypot(e.additive.vx[i]!, e.additive.vy[i]!, e.additive.vz[i]!);
      expect(e.additive.vz[i]! / v).toBeGreaterThanOrEqual(cone - 1e-4);
    }
  });

  it('scale increases particle count', () => {
    expect(recipeParticleCount('explosion', 2)).toBeGreaterThan(recipeParticleCount('explosion', 1));
    const a = make();
    const b = make();
    expect(b.emit('spark', 0, 0, 0, 0, 1, 0, 3)).toBeGreaterThan(a.emit('spark', 0, 0, 0, 0, 1, 0, 1));
  });

  it('drops instead of allocating when full, and counts drops', () => {
    const e = make(20);
    for (let i = 0; i < 50; i++) e.emit('explosion', 0, 0, 0, 0, 1, 0, 1);
    expect(e.live).toBeLessThanOrEqual(e.capacity);
    expect(e.dropped).toBeGreaterThan(0);
  });

  it('drops low priority before high priority', () => {
    const e = make(100);
    e.alpha.setLimit(10);
    for (let i = 0; i < 30; i++) e.emit('dust', 0, 0, 0, 0, 1, 0, 1);
    expect(e.alpha.count).toBeLessThan(10);
    const before = e.additive.count;
    e.emit('spark', 0, 0, 0, 0, 1, 0, 1);
    expect(e.additive.count).toBeGreaterThan(before);
  });

  it('budget follows the preset and live returns to zero', () => {
    const e = make(3000);
    e.setBudget(600);
    expect(e.capacity).toBe(600);
    for (let i = 0; i < 100; i++) e.emit('big-explosion', 0, 0, 0, 0, 1, 0, 1);
    expect(e.live).toBeLessThanOrEqual(600);
    for (let i = 0; i < 400; i++) e.step(0.016);
    expect(e.live).toBe(0);
  });
});
