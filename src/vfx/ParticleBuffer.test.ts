import { describe, expect, it } from 'vitest';
import { createParticleInit, ParticleBuffer } from './ParticleBuffer';

function init(life = 1) {
  const p = createParticleInit();
  p.life = life;
  return p;
}

describe('ParticleBuffer', () => {
  it('drops spawns beyond capacity and counts them', () => {
    const b = new ParticleBuffer(3);
    const p = init();
    expect(b.spawn(p)).toBe(true);
    expect(b.spawn(p)).toBe(true);
    expect(b.spawn(p)).toBe(true);
    expect(b.spawn(p)).toBe(false);
    expect(b.count).toBe(3);
    expect(b.dropped).toBe(1);
  });

  it('respects the soft limit', () => {
    const b = new ParticleBuffer(10);
    b.setLimit(2);
    const p = init();
    b.spawn(p);
    b.spawn(p);
    expect(b.spawn(p)).toBe(false);
    expect(b.canSpawn(false, 0.8)).toBe(false);
  });

  it('refuses low priority first', () => {
    const b = new ParticleBuffer(10);
    const p = init();
    for (let i = 0; i < 8; i++) b.spawn(p);
    expect(b.canSpawn(true, 0.8)).toBe(false);
    expect(b.canSpawn(false, 0.8)).toBe(true);
  });

  it('swap-removes dead particles and returns to zero', () => {
    const b = new ParticleBuffer(4);
    const short = init(0.1);
    const long = init(1);
    long.x = 5;
    b.spawn(short);
    b.spawn(long);
    b.spawn(short);
    b.step(0.2);
    expect(b.count).toBe(1);
    expect(b.px[0]).toBe(5);
    b.step(1);
    expect(b.count).toBe(0);
  });

  it('integrates velocity, gravity and drag', () => {
    const b = new ParticleBuffer(2);
    const p = init(5);
    p.vx = 2;
    p.gravity = 1;
    b.spawn(p);
    b.step(0.5);
    expect(b.px[0]).toBeCloseTo(1);
    expect(b.vy[0]).toBeCloseTo(-9.81 * 0.5);
    const q = init(5);
    q.vx = 10;
    q.drag = 2;
    b.spawn(q);
    b.step(0.1);
    expect(b.vx[1]).toBeCloseTo(8);
  });

  it('keeps the same typed arrays during spawn/step/fill', () => {
    const b = new ParticleBuffer(8);
    const refs = [b.px, b.py, b.pz, b.vx, b.vy, b.vz, b.life, b.color];
    const pos = new Float32Array(24);
    const size = new Float32Array(8);
    const col = new Float32Array(32);
    for (let i = 0; i < 20; i++) {
      b.spawn(init(0.3));
      b.step(0.05);
      b.fill(pos, size, col);
    }
    const after = [b.px, b.py, b.pz, b.vx, b.vy, b.vz, b.life, b.color];
    after.forEach((arr, i) => expect(arr).toBe(refs[i]));
    expect(b.px.length).toBe(8);
  });

  it('fill interpolates size and colour over life', () => {
    const b = new ParticleBuffer(2);
    const p = init(1);
    p.size0 = 1;
    p.size1 = 3;
    p.a0 = 1;
    p.a1 = 0;
    b.spawn(p);
    b.step(0.5);
    const pos = new Float32Array(6);
    const size = new Float32Array(2);
    const col = new Float32Array(8);
    expect(b.fill(pos, size, col)).toBe(1);
    expect(size[0]).toBeCloseTo(2);
    expect(col[3]).toBeCloseTo(0.5);
  });
});
