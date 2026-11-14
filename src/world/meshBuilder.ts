import { BufferGeometry, Float32BufferAttribute } from 'three';

type V3 = readonly [number, number, number];

/**
 * Small non-indexed mesh builder for hard-surface props: every quad gets its own flat normal, which
 * is what painted steel sections, corrugated sheet and concrete blocks need. Pure data until
 * `build()`; no three.js state is touched before that.
 */
export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly uv: number[] = [];

  get triangleCount(): number {
    return this.pos.length / 9;
  }

  /** Quad a-b-c-d, counter-clockwise seen from the front. */
  quad(a: V3, b: V3, c: V3, d: V3, uv: readonly [number, number, number, number] = [0, 0, 1, 1]): this {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = d[0] - a[0];
    const vy = d[1] - a[1];
    const vz = d[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const [u0, v0, u1, v1] = uv;
    const verts: Array<[V3, number, number]> = [
      [a, u0, v0],
      [b, u1, v0],
      [c, u1, v1],
      [a, u0, v0],
      [c, u1, v1],
      [d, u0, v1],
    ];
    for (const [p, u, v] of verts) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(nx, ny, nz);
      this.uv.push(u, v);
    }
    return this;
  }

  /** Axis-aligned box from its centre and half extents. `skip` omits faces: '+x', '-y', ... */
  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, skip: readonly string[] = []): this {
    const x0 = cx - hx;
    const x1 = cx + hx;
    const y0 = cy - hy;
    const y1 = cy + hy;
    const z0 = cz - hz;
    const z1 = cz + hz;
    if (!skip.includes('+x')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]);
    if (!skip.includes('-x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (!skip.includes('+y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]);
    if (!skip.includes('-y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    if (!skip.includes('+z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (!skip.includes('-z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]);
    return this;
  }

  /**
   * Box section between two points (beams, braces, pipes with a square profile). `w` and `h` are
   * the full cross-section sizes; the section's "up" is world Y unless the beam is vertical.
   */
  beam(a: V3, b: V3, w: number, h: number = w): this {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const fx = dx / len;
    const fy = dy / len;
    const fz = dz / len;
    // side = forward x up (fallback to +X when the beam is vertical); up' = side x forward
    let sx = -fz;
    const sy = 0;
    let sz = fx;
    let sl = Math.hypot(sx, sy, sz);
    if (sl < 1e-4) {
      sx = 1;
      sz = 0;
      sl = 1;
    }
    sx /= sl;
    sz /= sl;
    const ux = sy * fz - sz * fy;
    const uy = sz * fx - sx * fz;
    const uz = sx * fy - sy * fx;
    const hw = w / 2;
    const hh = h / 2;
    const corner = (p: V3, s: number, u: number): V3 => [p[0] + sx * hw * s + ux * hh * u, p[1] + sy * hw * s + uy * hh * u, p[2] + sz * hw * s + uz * hh * u];
    const a00 = corner(a, -1, -1);
    const a10 = corner(a, 1, -1);
    const a11 = corner(a, 1, 1);
    const a01 = corner(a, -1, 1);
    const b00 = corner(b, -1, -1);
    const b10 = corner(b, 1, -1);
    const b11 = corner(b, 1, 1);
    const b01 = corner(b, -1, 1);
    this.quad(a10, b10, b11, a11);
    this.quad(b00, a00, a01, b01);
    this.quad(a01, a11, b11, b01);
    this.quad(a00, b00, b10, a10);
    this.quad(a00, a10, a11, a01);
    this.quad(b10, b00, b01, b11);
    return this;
  }

  /**
   * Corrugated sheet: starts at `origin`, runs `length` along unit `u`, `height` along unit `v`,
   * ribs stand `depth` proud along unit `n` (the outward normal). Trapezoid profile, 4 quads per rib.
   */
  corrugated(origin: V3, u: V3, v: V3, n: V3, length: number, height: number, period: number, depth: number): this {
    const ribs = Math.max(1, Math.round(length / period));
    const p = length / ribs;
    const at = (du: number, dn: number, dv: number): V3 => [
      origin[0] + u[0] * du + n[0] * dn + v[0] * dv,
      origin[1] + u[1] * du + n[1] * dn + v[1] * dv,
      origin[2] + u[2] * du + n[2] * dn + v[2] * dv,
    ];
    // profile across one rib: (offset along u as share of the period, height along n)
    const profile: Array<[number, number]> = [
      [0, 0],
      [0.22, 0],
      [0.42, depth],
      [0.78, depth],
      [1, 0],
    ];
    for (let i = 0; i < ribs; i++) {
      const base = i * p;
      for (let k = 0; k < profile.length - 1; k++) {
        const [s0, d0] = profile[k] as [number, number];
        const [s1, d1] = profile[k + 1] as [number, number];
        const u0 = base + s0 * p;
        const u1 = base + s1 * p;
        this.quad(at(u0, d0, 0), at(u1, d1, 0), at(u1, d1, height), at(u0, d0, height), [u0 / length, 0, u1 / length, 1]);
      }
    }
    return this;
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(this.uv, 2));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}
