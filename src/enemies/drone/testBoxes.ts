import type { Probe, V3 } from './steering';

/** Axis-aligned box for the pure steering tests: centre and half extents. */
export interface Box {
  c: V3;
  h: V3;
}

/**
 * Test helper: a sphere cast of radius `r` against boxes, as a ray against each box grown by `r` (slightly
 * conservative at the corners). A start inside a grown box moving out of it is ignored, moving in returns 0
 * (like Rapier's `castShape` with `stopAtPenetration = false`).
 */
export function boxProbe(boxes: readonly Box[], r: number): Probe {
  return (o, d, max) => {
    let best: number | null = null;
    for (const b of boxes) {
      const min = [b.c.x - b.h.x - r, b.c.y - b.h.y - r, b.c.z - b.h.z - r];
      const mx = [b.c.x + b.h.x + r, b.c.y + b.h.y + r, b.c.z + b.h.z + r];
      const oo = [o.x, o.y, o.z];
      const dd = [d.x, d.y, d.z];
      const inside = oo.every((v, i) => v > min[i]! && v < mx[i]!);
      if (inside) {
        const out = (o.x - b.c.x) * d.x + (o.y - b.c.y) * d.y + (o.z - b.c.z) * d.z;
        if (out > 0) continue;
        return 0;
      }
      let t0 = 0;
      let t1 = max;
      let hit = true;
      for (let i = 0; i < 3; i++) {
        const di = dd[i]!;
        const oi = oo[i]!;
        if (Math.abs(di) < 1e-9) {
          if (oi < min[i]! || oi > mx[i]!) hit = false;
          continue;
        }
        let a = (min[i]! - oi) / di;
        let c = (mx[i]! - oi) / di;
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a);
        t1 = Math.min(t1, c);
        if (t0 > t1) hit = false;
      }
      if (hit && t0 <= max && (best === null || t0 < best)) best = t0;
    }
    return best;
  };
}

/** True when the sphere of radius `r` at `p` overlaps a box (exact sphere/box test). */
export function overlaps(boxes: readonly Box[], p: V3, r: number): boolean {
  return boxes.some((b) => {
    const dx = Math.max(0, Math.abs(p.x - b.c.x) - b.h.x);
    const dy = Math.max(0, Math.abs(p.y - b.c.y) - b.h.y);
    const dz = Math.max(0, Math.abs(p.z - b.c.z) - b.h.z);
    return dx * dx + dy * dy + dz * dz < r * r;
  });
}
