import { describe, expect, it } from 'vitest';
import { WAREHOUSE } from '@/config/warehouse';
import { CallInDirector, callInSpawnPoints, onMezzanine } from './callIn';
import { chooseOpening, insideRect, insideWarehouse, openingPoints, openingRoute, usableOpenings } from './openings';
import { DRONE, DRONE_NO_FLY } from './tunables';

const C = DRONE.opening;

describe('warehouse openings for drones', () => {
  it('uses the flyable openings except the window over the glazed office', () => {
    const ids = usableOpenings(C).map((o) => o.id).sort();
    expect(ids).toEqual(['north-back', 'west-roller', 'win-n1', 'win-n2']);
  });

  it('puts the approach point outside the wall and the inside point inside, at the opening height', () => {
    for (const o of usableOpenings(C)) {
      const p = openingPoints(o, C);
      expect(insideWarehouse(p.approach), o.id).toBe(false);
      expect(insideWarehouse(p.inside), o.id).toBe(true);
      expect(p.approach.y).toBe(o.y);
      expect(p.inside.y).toBe(o.y);
      // the inside point of a window is over the mezzanine, above its floor
      if (o.kind === 'window') {
        expect(insideRect(WAREHOUSE.mezzanine, p.inside.x, p.inside.z)).toBe(true);
        expect(p.inside.y - WAREHOUSE.mezzanine.floorY).toBeGreaterThan(DRONE.bodyRadius + 0.5);
      }
    }
  });

  it('fits the drone body through every usable opening', () => {
    for (const o of usableOpenings(C)) {
      expect(o.width / 2, o.id).toBeGreaterThan(DRONE.bodyRadius + DRONE.skin);
      expect(o.height / 2, o.id).toBeGreaterThan(DRONE.bodyRadius + DRONE.skin);
    }
  });

  it('picks the nearest opening for the route', () => {
    // from the west yard to the warehouse floor: the roller door
    expect(chooseOpening({ x: -10, y: 4, z: -4 }, { x: 12, y: 1.6, z: -4 }, false, C)?.id).toBe('west-roller');
    // from the court to the mezzanine near the windows: a window
    expect(chooseOpening({ x: 21, y: 6, z: -34 }, { x: 21, y: 5.2, z: -20 }, false, C)?.id).toBe('win-n2');
    // from the court to the floor near the back door: the back door
    expect(chooseOpening({ x: 14, y: 4, z: -34 }, { x: 14, y: 1.6, z: -12 }, false, C)?.id).toBe('north-back');
    // from inside out to the yard: the roller door
    expect(chooseOpening({ x: 12, y: 3, z: -4 }, { x: -10, y: 1.6, z: -4 }, true, C)?.id).toBe('west-roller');
  });

  it('orders the route by side', () => {
    const o = WAREHOUSE.openings[0]!;
    const into = openingRoute(o, false, C);
    const out = openingRoute(o, true, C);
    expect(insideWarehouse(into[0]!)).toBe(false);
    expect(insideWarehouse(into[2]!)).toBe(true);
    expect(out).toEqual([...into].reverse());
  });

  it('counts a drone above the roof as outside', () => {
    expect(insideWarehouse({ x: 20, y: 3, z: -5 })).toBe(true);
    expect(insideWarehouse({ x: 20, y: WAREHOUSE.ridgeHeight + 1, z: -5 })).toBe(false);
  });
});

describe('anti-camping call-in', () => {
  const cfg = DRONE.callIn;
  const m = WAREHOUSE.mezzanine;

  it('knows when the player is on the mezzanine', () => {
    expect(onMezzanine({ x: 20, y: m.floorY, z: -20 }, cfg.yMargin)).toBe(true);
    expect(onMezzanine({ x: 20, y: 0, z: -20 }, cfg.yMargin)).toBe(false); // under it
    expect(onMezzanine({ x: 20, y: m.floorY, z: -10 }, cfg.yMargin)).toBe(false);
  });

  it('calls 2 drones after 8 s of camping, not again while 2 are alive', () => {
    const d = new CallInDirector(cfg);
    const dt = 0.1;
    let sent = 0;
    for (let t = 0; t < cfg.campSeconds - 0.2; t += dt) sent += d.update(dt, true, 0, 0, 10);
    expect(sent).toBe(0);
    for (let i = 0; i < 4; i++) sent += d.update(dt, true, 0, 0, 10);
    expect(sent).toBe(cfg.count);
    // the two are alive: no more, however long the player camps
    for (let i = 0; i < 300; i++) sent += d.update(dt, true, 2, 2, 10);
    expect(sent).toBe(cfg.count);
  });

  it('resets the timer when the player leaves and stops at 6 call-ins per run', () => {
    const d = new CallInDirector(cfg);
    for (let i = 0; i < 70; i++) d.update(0.1, true, 0, 0, 10);
    expect(d.called).toBe(0);
    d.update(0.1, false, 0, 0, 10);
    expect(d.camp).toBe(0);
    let sent = 0;
    for (let i = 0; i < 10000; i++) sent += d.update(0.1, true, 0, 0, 10);
    expect(sent).toBe(cfg.maxPerRun);
    expect(d.called).toBe(cfg.maxPerRun);
  });

  it('respects the global live cap', () => {
    const d = new CallInDirector(cfg);
    let sent = 0;
    for (let i = 0; i < 200; i++) sent += d.update(0.1, true, 0, 10, 10);
    expect(sent).toBe(0);
    for (let i = 0; i < 200 && sent === 0; i++) sent += d.update(0.1, true, 0, 9, 10);
    expect(sent).toBe(1);
  });

  it('spawns outside the north windows or the roller door, never inside or in the closed block', () => {
    const player = { x: 20, y: m.floorY, z: -20 };
    const seen = new Set<string>();
    for (let wave = 0; wave < 6; wave++) {
      const pts = callInSpawnPoints(player, cfg.count, wave, { ...C, spawnOut: cfg.spawnOut });
      expect(pts).toHaveLength(cfg.count);
      for (const p of pts) {
        expect(insideWarehouse(p)).toBe(false);
        expect(insideRect(DRONE_NO_FLY, p.x, p.z)).toBe(false);
        seen.add(`${p.x},${p.z}`);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});
