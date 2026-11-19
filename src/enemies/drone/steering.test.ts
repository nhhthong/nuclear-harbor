import { describe, expect, it } from 'vitest';
import { WAREHOUSE } from '@/config/warehouse';
import { insideWarehouse, chooseOpening, openingRoute } from './openings';
import {
  altitudeBand,
  chooseDirection,
  clampStep,
  freeDistance,
  keepOutOf,
  resolveTarget,
  standoffTarget,
  StuckMonitor,
  type V3,
} from './steering';
import { boxProbe, overlaps, type Box } from './testBoxes';
import { DRONE, DRONE_NO_FLY } from './tunables';

const R = DRONE.bodyRadius;
const v = (x: number, y: number, z: number): V3 => ({ x, y, z });

/** The warehouse shell from the contract as boxes: four walls with the flyable openings cut out, and the roof. */
function warehouseBoxes(): Box[] {
  const f = WAREHOUSE.footprint;
  const t = WAREHOUSE.wallThickness;
  const H = WAREHOUSE.eaveHeight;
  const out: Box[] = [];
  const wallX = (x: number, z0: number, z1: number, y0: number, y1: number): void => {
    if (z1 > z0 && y1 > y0) out.push({ c: v(x, (y0 + y1) / 2, (z0 + z1) / 2), h: v(t / 2, (y1 - y0) / 2, (z1 - z0) / 2) });
  };
  const wallZ = (z: number, x0: number, x1: number, y0: number, y1: number): void => {
    if (x1 > x0 && y1 > y0) out.push({ c: v((x0 + x1) / 2, (y0 + y1) / 2, z), h: v((x1 - x0) / 2, (y1 - y0) / 2, t / 2) });
  };
  // west wall with the roller door
  const rd = WAREHOUSE.openings.find((o) => o.id === 'west-roller')!;
  wallX(f.minX, f.minZ, rd.z - rd.width / 2, 0, H);
  wallX(f.minX, rd.z + rd.width / 2, f.maxZ, 0, H);
  wallX(f.minX, rd.z - rd.width / 2, rd.z + rd.width / 2, rd.y + rd.height / 2, H);
  // north wall: cut every north opening (door and windows) as columns, with wall below/above each
  const north = WAREHOUSE.openings.filter((o) => o.nz === -1).sort((a, b) => a.x - b.x);
  let x = f.minX;
  for (const o of north) {
    wallZ(f.minZ, x, o.x - o.width / 2, 0, H);
    wallZ(f.minZ, o.x - o.width / 2, o.x + o.width / 2, 0, o.y - o.height / 2);
    wallZ(f.minZ, o.x - o.width / 2, o.x + o.width / 2, o.y + o.height / 2, H);
    x = o.x + o.width / 2;
  }
  wallZ(f.minZ, x, f.maxX, 0, H);
  // east and south walls, roof, mezzanine floor slab
  wallX(f.maxX, f.minZ, f.maxZ, 0, H);
  wallZ(f.maxZ, f.minX, f.maxX, 0, H);
  out.push({ c: v((f.minX + f.maxX) / 2, H + 0.15, (f.minZ + f.maxZ) / 2), h: v((f.maxX - f.minX) / 2 + 0.5, 0.15, (f.maxZ - f.minZ) / 2 + 0.5) });
  const m = WAREHOUSE.mezzanine;
  out.push({ c: v((m.minX + m.maxX) / 2, m.floorY - 0.15, (m.minZ + m.maxZ) / 2), h: v((m.maxX - m.minX) / 2, 0.15, (m.maxZ - m.minZ) / 2) });
  // ground
  out.push({ c: v(0, -0.5, 0), h: v(100, 0.5, 100) });
  return out;
}

/** Flies a point through `waypoints` with the same steps as Drone (avoid, then clamp). Returns the path. */
function fly(boxes: Box[], start: V3, waypoints: V3[], seconds: number, directFrom = 1): V3[] {
  const probe = boxProbe(boxes, R);
  const pos = { ...start };
  const dir = v(0, 0, 0);
  const mem = { side: 0 };
  const path: V3[] = [];
  let i = 0;
  const dt = 1 / 30;
  for (let s = 0; s < seconds / dt && i < waypoints.length; s++) {
    const wp = waypoints[i]!;
    const d = v(wp.x - pos.x, wp.y - pos.y, wp.z - pos.z);
    const dist = Math.hypot(d.x, d.y, d.z);
    if (dist < DRONE.opening.arrive) {
      i++;
      continue;
    }
    if (i >= directFrom) {
      dir.x = d.x / dist;
      dir.y = d.y / dist;
      dir.z = d.z / dist;
    } else {
      chooseDirection(probe, pos, d, DRONE, dir, mem);
    }
    const step = clampStep(probe, pos, dir, Math.min(dist, DRONE.speed * dt), DRONE.skin);
    pos.x += dir.x * step;
    pos.y += dir.y * step;
    pos.z += dir.z * step;
    path.push({ ...pos });
  }
  return path;
}

describe('drone steering: avoidance', () => {
  it('keeps the desired direction when the way is free', () => {
    const out = v(0, 0, 0);
    chooseDirection(boxProbe([], R), v(0, 4, 0), v(0, 0, -5), DRONE, out);
    expect(out).toEqual({ x: 0, y: 0, z: -1 });
  });

  it('picks a free direction around a wall ahead, still roughly forward', () => {
    const wall: Box[] = [{ c: v(0, 5, -3), h: v(3, 5, 0.2) }];
    const probe = boxProbe(wall, R);
    const out = v(0, 0, 0);
    chooseDirection(probe, v(0, 4, 0), v(0, 0, -10), DRONE, out);
    expect(freeDistance(probe, v(0, 4, 0), out, DRONE.lookAhead)).toBeGreaterThanOrEqual(DRONE.lookAhead - 1e-6);
    expect(out.z).toBeLessThan(0.2); // not turning back
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1, 6);
  });

  it('falls back to straight up when no candidate is free (the unstick logic then turns)', () => {
    const t = 0.2;
    const walls: Box[] = [
      { c: v(0, 2, -0.6), h: v(2, 2, t) },
      { c: v(0, 2, 0.6), h: v(2, 2, t) },
      { c: v(-0.6, 2, 0), h: v(t, 2, 2) },
      { c: v(0.6, 2, 0), h: v(t, 2, 2) },
    ];
    const out = v(0, 0, 0);
    chooseDirection(boxProbe(walls, R), v(0, 2, 0), v(0, 0, -1), DRONE, out);
    expect(out).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('never moves the body into a wall (clampStep)', () => {
    const wall: Box[] = [{ c: v(0, 5, -3), h: v(10, 5, 0.2) }];
    const probe = boxProbe(wall, R);
    const pos = v(0, 4, 0);
    for (let i = 0; i < 100; i++) {
      const step = clampStep(probe, pos, v(0, 0, -1), 0.5, DRONE.skin);
      pos.z -= step;
      expect(overlaps(wall, pos, R)).toBe(false);
    }
    expect(pos.z).toBeGreaterThan(-3 + 0.2 - 0.01 - R - DRONE.skin - 1e-6 - 0.01);
  });

  it('flies around a wall to a target behind it without touching it', () => {
    const wall: Box[] = [{ c: v(0, 5, -6), h: v(6, 5, 0.2) }, { c: v(0, -0.5, 0), h: v(50, 0.5, 50) }];
    const path = fly(wall, v(0, 4, 0), [v(0, 4, -12)], 30, 99);
    for (const p of path) expect(overlaps(wall, p, R)).toBe(false);
    const end = path[path.length - 1]!;
    expect(Math.hypot(end.x, end.y - 4, end.z + 12)).toBeLessThan(1.5);
  });
});

describe('drone steering: altitude band and stand-off', () => {
  it('cruises 3 to 6 m above the floor, below a ceiling', () => {
    expect(altitudeBand(0, null, DRONE)).toEqual({ min: 3, max: 6 });
    const mezz = altitudeBand(3.6, 9, DRONE);
    expect(mezz.min).toBeCloseTo(6.6, 6);
    expect(mezz.max).toBeCloseTo(9 - DRONE.ceilingMargin, 6);
    const low = altitudeBand(0, 4, DRONE);
    expect(low.min).toBeLessThanOrEqual(low.max);
    expect(low.max).toBeLessThanOrEqual(4);
  });

  it('keeps 5 to 10 m from the player and leads the orbit', () => {
    const player = { x: 0, z: 0 };
    const out = v(0, 0, 0);
    standoffTarget({ x: 30, z: 0 }, player, 1, DRONE, out);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(10, 6);
    standoffTarget({ x: 1, z: 0 }, player, 1, DRONE, out);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(5, 6);
    standoffTarget({ x: 7, z: 0 }, player, 1, DRONE, out);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(7, 6);
    expect(Math.atan2(out.z, out.x)).toBeCloseTo(DRONE.orbitLead, 6);
    standoffTarget({ x: 7, z: 0 }, player, -1, DRONE, out);
    expect(Math.atan2(out.z, out.x)).toBeCloseTo(-DRONE.orbitLead, 6);
  });
});

describe('drone steering: targets never inside walls', () => {
  it('pulls a target that lies inside a wall back in front of it', () => {
    const wall: Box[] = [{ c: v(0, 5, -6), h: v(6, 5, 0.5) }];
    const out = v(0, 0, 0);
    resolveTarget(boxProbe(wall, R), v(0, 2, 0), v(0, 4, -6), DRONE.skin, out);
    expect(overlaps(wall, out, R)).toBe(false);
    expect(out.z).toBeGreaterThan(-6 + 0.5);
  });

  it('keeps a stand-off point in the player room when the orbit would put it behind a wall', () => {
    const boxes = warehouseBoxes();
    const eye = v(20, WAREHOUSE.mezzanine.floorY + 1.6, -20);
    const out = v(0, 0, 0);
    // a stand-off point north of the north wall (outside) is pulled back inside
    resolveTarget(boxProbe(boxes, R), eye, v(20, 6, -30), DRONE.skin + R, out);
    expect(insideWarehouse(out)).toBe(true);
    expect(overlaps(boxes, out, R)).toBe(false);
  });

  it('never targets the closed south-east block', () => {
    const p = keepOutOf(DRONE_NO_FLY, v(20, 4, 20));
    expect(p.x < DRONE_NO_FLY.minX || p.z < DRONE_NO_FLY.minZ).toBe(true);
    const q = keepOutOf(DRONE_NO_FLY, v(-10, 4, 20));
    expect(q).toEqual({ x: -10, y: 4, z: 20 });
  });
});

describe('drone steering: through the warehouse openings (fake colliders)', () => {
  it('flies from the yard through the roller door into the warehouse without touching a wall', () => {
    const boxes = warehouseBoxes();
    const start = v(-6, 4, 2);
    const player = v(20, 1.6, -6);
    const o = chooseOpening(start, player, false, DRONE.opening)!;
    expect(o.id).toBe('west-roller');
    const path = fly(boxes, start, openingRoute(o, false, DRONE.opening), 30);
    for (const p of path) expect(overlaps(boxes, p, R), `${p.x.toFixed(2)} ${p.y.toFixed(2)} ${p.z.toFixed(2)}`).toBe(false);
    expect(insideWarehouse(path[path.length - 1]!)).toBe(true);
  });

  it('flies from the relay court through a north window onto the mezzanine', () => {
    const boxes = warehouseBoxes();
    const start = v(20, 6, -36);
    const player = v(20, WAREHOUSE.mezzanine.floorY + 1.6, -19);
    const o = chooseOpening(start, player, false, DRONE.opening)!;
    expect(o.kind).toBe('window');
    const path = fly(boxes, start, openingRoute(o, false, DRONE.opening), 30);
    for (const p of path) expect(overlaps(boxes, p, R)).toBe(false);
    const end = path[path.length - 1]!;
    expect(insideWarehouse(end)).toBe(true);
    expect(end.y).toBeGreaterThan(WAREHOUSE.mezzanine.floorY);
  });

  it('leaves the warehouse through the back door to reach the court', () => {
    const boxes = warehouseBoxes();
    const start = v(14, 2.5, -10);
    const player = v(14, 1.6, -34);
    const o = chooseOpening(start, player, true, DRONE.opening)!;
    expect(o.id).toBe('north-back');
    const path = fly(boxes, start, openingRoute(o, true, DRONE.opening), 30);
    for (const p of path) expect(overlaps(boxes, p, R)).toBe(false);
    expect(insideWarehouse(path[path.length - 1]!)).toBe(false);
  });
});

describe('drone unstick', () => {
  it('reports stuck once when no progress is made over the window, never while closing in', () => {
    const s = new StuckMonitor(DRONE.stuck);
    let d = 20;
    for (let i = 0; i < 100; i++) {
      d -= 0.1;
      expect(s.update(0.1, d, false)).toBe(false);
    }
    let fired = 0;
    for (let i = 0; i < Math.round(DRONE.stuck.window / 0.1) + 1; i++) if (s.update(0.1, d, false)) fired++;
    expect(fired).toBe(1);
    expect(s.update(0.1, d, true)).toBe(false);
  });
});
