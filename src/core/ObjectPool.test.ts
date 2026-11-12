import { describe, expect, it } from 'vitest';
import { ObjectPool } from './ObjectPool';

describe('ObjectPool', () => {
  it('reuses released objects and resets them', () => {
    let created = 0;
    const pool = new ObjectPool({ create: () => ({ id: created++, dirty: true }), reset: (o) => (o.dirty = false), capacity: 2 });
    const a = pool.acquire()!;
    a.dirty = true;
    pool.release(a);
    const b = pool.acquire()!;
    expect(b).toBe(a);
    expect(b.dirty).toBe(false);
    expect(created).toBe(1);
  });

  it('returns null instead of growing past capacity (GDD 13.4)', () => {
    const pool = new ObjectPool({ create: () => ({}), capacity: 2 });
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).not.toBeNull();
    expect(pool.acquire()).toBeNull();
    expect(pool.droppedCount).toBe(1);
    expect(pool.liveCount).toBe(2);
  });

  it('ignores double release and supports releaseAll', () => {
    const pool = new ObjectPool({ create: () => ({}), capacity: 3, prewarm: 3 });
    const a = pool.acquire()!;
    pool.acquire();
    pool.release(a);
    pool.release(a);
    expect(pool.freeCount).toBe(2);
    pool.releaseAll();
    expect(pool.liveCount).toBe(0);
    expect(pool.freeCount).toBe(3);
  });
});
