import { describe, expect, it } from 'vitest';
import {
  SKILLS,
  SkillScheduler,
  SweepTracker,
  TickTimer,
  beamAngles,
  beamHitsPlayer,
  bombDamage,
  bombPattern,
  canReleaseDrones,
  clampOrbitRadius,
  droneReleaseCount,
  laserBase,
  orbitPoint,
  pickSkill,
  skillWeights,
  spinRate,
  sweepContact,
} from './skills';
import type { SkillId, SkillInput, SkillWeights } from './skills';
import { CRAB } from './tunables';

const none: Record<SkillId, number> = { bombs: 0, drones: 0, spin: 0, laser: 0 };
const at = (distance: number, aliveDrones = 0): SkillInput => ({ distance, aliveDrones, k: 1 });
const zero = (): number => 0;

describe('skill selection', () => {
  it('spin is only eligible when the player is close, the others need some distance', () => {
    const near = skillWeights(at(10), none, null);
    expect(near.spin).toBeGreaterThan(0);
    expect(near.bombs).toBeGreaterThan(0);
    const far = skillWeights(at(30), none, null);
    expect(far.spin).toBe(0);
    expect(far.bombs).toBeGreaterThan(near.bombs);
    expect(far.laser).toBeGreaterThan(near.laser);
    const hugging = skillWeights(at(3), none, null);
    expect(hugging.spin).toBeGreaterThan(0);
    expect(hugging.bombs).toBe(0);
    expect(hugging.laser).toBe(0);
  });

  it('cooldowns and the drone cap remove skills', () => {
    const w = skillWeights(at(20), { ...none, bombs: 3, laser: 1 }, null);
    expect(w.bombs).toBe(0);
    expect(w.laser).toBe(0);
    expect(w.drones).toBeGreaterThan(0);
    expect(skillWeights(at(20, 2), none, null).drones).toBe(0);
    expect(skillWeights(at(20, 1), none, null).drones).toBeGreaterThan(0);
  });

  it('never repeats the last skill while another one can run, but may when it is the only one', () => {
    const w = skillWeights(at(10), none, 'spin');
    expect(w.spin).toBe(0);
    const only = skillWeights(at(10), { bombs: 5, drones: 5, spin: 0, laser: 5 }, 'spin');
    expect(only.spin).toBeGreaterThan(0);
  });

  it('weights scale with the boss size factor', () => {
    expect(skillWeights({ distance: 7, aliveDrones: 0, k: 0.8 }, none, null).spin).toBeGreaterThan(0);
    // 14 m is "close" for k = 1 (16 m trigger), but 14 / 0.8 = 17.5 m is not for k = 0.8
    expect(skillWeights({ distance: 14, aliveDrones: 0, k: 1 }, none, null).spin).toBeGreaterThan(0);
    expect(skillWeights({ distance: 14, aliveDrones: 0, k: 0.8 }, none, null).spin).toBe(0);
  });

  it('pickSkill is a weighted choice and null when nothing is eligible', () => {
    const w: SkillWeights = { bombs: 1, drones: 1, spin: 2, laser: 0 };
    expect(pickSkill(w, 0)).toBe('bombs');
    expect(pickSkill(w, 0.3)).toBe('drones');
    expect(pickSkill(w, 0.6)).toBe('spin');
    expect(pickSkill(w, 0.999)).toBe('spin');
    expect(pickSkill(none, 0.5)).toBeNull();
  });
});

describe('SkillScheduler', () => {
  it('waits the idle gap, runs one skill at a time and sets cooldowns', () => {
    const s = new SkillScheduler();
    expect(s.update(0.1, at(10), zero)).toBeNull();
    const first = s.update(CRAB.idleGap[1], at(10), zero);
    expect(first).not.toBeNull();
    expect(s.active).toBe(first);
    expect(s.update(5, at(10), zero)).toBeNull();
    expect(s.cooldowns[first as SkillId]).toBeGreaterThan(0);
    expect(s.force('laser')).toBe(false);
    s.finish(zero);
    expect(s.active).toBeNull();
    expect(s.update(CRAB.idleGap[0] - 0.01, at(10), zero)).toBeNull();
    const second = s.update(0.02, at(10), zero);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });

  it('force starts a skill regardless of range and reset clears everything', () => {
    const s = new SkillScheduler();
    expect(s.force('spin')).toBe(true);
    expect(s.cooldowns.spin).toBe(CRAB.cooldown.spin);
    s.reset();
    expect(s.active).toBeNull();
    expect(s.cooldowns.spin).toBe(0);
  });

  it('all four skills get picked over a long fight', () => {
    const s = new SkillScheduler();
    const seen = new Set<SkillId>();
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let t = 0; t < 600; t += 0.1) {
      const pick = s.update(0.1, at(8 + 20 * rand()), rand);
      if (pick) {
        seen.add(pick);
        s.finish(rand);
      }
    }
    for (const k of SKILLS) expect(seen.has(k)).toBe(true);
  });
});

describe('bomb pattern', () => {
  const boss = { x: 0, z: 0 };
  const player = { x: 0, z: -20 };

  it('is a line towards the player plus a ring around them', () => {
    const p = bombPattern(boss, player, 1, () => 0.5);
    expect(p.length).toBe(CRAB.bombs.lineCount + CRAB.bombs.ringCount);
    const line = p.slice(0, CRAB.bombs.lineCount);
    for (const b of line) expect(Math.abs(b.x)).toBeLessThan(1e-9);
    expect(line[0]?.z).toBeCloseTo(-CRAB.bombs.lineStart, 6);
    expect(line[1]?.z).toBeCloseTo(-CRAB.bombs.lineStart - CRAB.bombs.lineSpacing, 6);
    for (const b of p.slice(CRAB.bombs.lineCount)) {
      expect(Math.hypot(b.x - player.x, b.z - player.z)).toBeCloseTo(CRAB.bombs.ringRadius, 6);
    }
  });

  it('launches in order with the configured gap and scales with k', () => {
    const p = bombPattern(boss, player, 0.8, () => 0);
    for (let i = 1; i < p.length; i++) expect((p[i]?.delay ?? 0) - (p[i - 1]?.delay ?? 0)).toBeCloseTo(CRAB.bombs.launchGap, 9);
    expect(p[0]?.z).toBeCloseTo(-CRAB.bombs.lineStart * 0.8, 6);
    expect(Math.hypot((p[CRAB.bombs.lineCount]?.x ?? 0) - player.x, (p[CRAB.bombs.lineCount]?.z ?? 0) - player.z)).toBeCloseTo(CRAB.bombs.ringRadius * 0.8, 6);
  });

  it('handles the player standing on the boss', () => {
    const p = bombPattern(boss, boss, 1, () => 0);
    expect(p.every((b) => Number.isFinite(b.x) && Number.isFinite(b.z))).toBe(true);
  });

  it('damage falls off from 18 at the centre to 35% at the edge and 0 outside', () => {
    expect(bombDamage(0, 5)).toBeCloseTo(18, 9);
    expect(bombDamage(2.5, 5)).toBeCloseTo(18 * (1 - 0.65 * 0.5), 9);
    expect(bombDamage(4.999, 5)).toBeCloseTo(18 * 0.35, 1);
    expect(bombDamage(5, 5)).toBe(0);
    expect(bombDamage(9, 5)).toBe(0);
  });
});

describe('drones', () => {
  it('re-release only while fewer than 2 are alive', () => {
    expect(canReleaseDrones(0)).toBe(true);
    expect(canReleaseDrones(1)).toBe(true);
    expect(canReleaseDrones(2)).toBe(false);
    expect(canReleaseDrones(6)).toBe(false);
  });

  it('launches 3 to 4 and never goes above the cap of 6', () => {
    expect(droneReleaseCount(0, 0)).toBe(3);
    expect(droneReleaseCount(0, 0.99)).toBe(4);
    expect(droneReleaseCount(1, 0.99)).toBe(4);
    expect(droneReleaseCount(4, 0.99)).toBe(2);
    expect(droneReleaseCount(6, 0.5)).toBe(0);
    for (let alive = 0; alive <= 6; alive++) {
      for (const r of [0, 0.3, 0.6, 0.99]) expect(alive + droneReleaseCount(alive, r)).toBeLessThanOrEqual(CRAB.drones.cap);
    }
  });

  it('hover ring stays between 4 and 9 m', () => {
    expect(clampOrbitRadius(1)).toBe(4);
    expect(clampOrbitRadius(6)).toBe(6);
    expect(clampOrbitRadius(20)).toBe(9);
    const out = { x: 0, z: 0 };
    orbitPoint({ x: 10, z: 5 }, 6, Math.PI / 2, out);
    expect(out.x).toBeCloseTo(10, 6);
    expect(out.z).toBeCloseTo(11, 6);
  });
});

describe('laser', () => {
  it('four beams in a cross, 90 degrees apart', () => {
    const a = beamAngles(0.3, 4);
    expect(a).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect((a[i] ?? 0) - (a[i - 1] ?? 0)).toBeCloseTo(Math.PI / 2, 9);
    expect(a[0]).toBeCloseTo(0.3, 9);
  });

  it('rotates about 180 degrees over 4.5 s, both ways, and holds at the end', () => {
    expect(laserBase(1, 1, 0)).toBe(1);
    expect(laserBase(1, 1, CRAB.laser.duration / 2)).toBeCloseTo(1 + Math.PI / 2, 9);
    expect(laserBase(1, 1, CRAB.laser.duration)).toBeCloseTo(1 + Math.PI, 9);
    expect(laserBase(1, -1, CRAB.laser.duration * 2)).toBeCloseTo(1 - Math.PI, 9);
  });

  const origin = { x: 0, z: 0 };
  it('hits a player standing on the beam and misses one beside it', () => {
    // angle 0 points to -Z
    expect(beamHitsPlayer(origin, 0, 70, { x: 0, y: 0, z: -10 })).toBe(true);
    expect(beamHitsPlayer(origin, 0, 70, { x: 0.8, y: 0, z: -10 })).toBe(true); // width 1.2 + body radius
    expect(beamHitsPlayer(origin, 0, 70, { x: 2, y: 0, z: -10 })).toBe(false);
    expect(beamHitsPlayer(origin, 0, 70, { x: 0, y: 0, z: 10 })).toBe(false); // behind the origin
    expect(beamHitsPlayer(origin, Math.PI / 2, 70, { x: -10, y: 0, z: 0 })).toBe(true); // turns left: -X
  });

  it('stops where the world stops it (length) and at the start radius', () => {
    expect(beamHitsPlayer(origin, 0, 8, { x: 0, y: 0, z: -10 })).toBe(false);
    expect(beamHitsPlayer(origin, 0, 70, { x: 0, y: 0, z: -1 }, 2.2)).toBe(false);
  });

  it('can be jumped over but not ducked under', () => {
    expect(beamHitsPlayer(origin, 0, 70, { x: 0, y: 0.5, z: -10 })).toBe(true);
    expect(beamHitsPlayer(origin, 0, 70, { x: 0, y: CRAB.laser.top + 0.1, z: -10 })).toBe(false);
  });

  it('ticks 10 damage every 0.25 s while touching and resets when not', () => {
    const t = new TickTimer();
    expect(t.step(0.016, true)).toBe(1);
    let ticks = 0;
    for (let i = 0; i < 60; i++) ticks += t.step(1 / 60, true);
    expect(ticks).toBeGreaterThanOrEqual(3);
    expect(ticks).toBeLessThanOrEqual(4);
    expect(t.step(1 / 60, false)).toBe(0);
    expect(t.step(1 / 60, true)).toBe(1);
    expect(CRAB.laser.tickDamage).toBe(10);
    expect(CRAB.laser.tickEvery).toBe(0.25);
  });
});

describe('spin', () => {
  it('ramps up and down and runs about 2.5 s', () => {
    expect(spinRate(0)).toBe(0);
    expect(spinRate(CRAB.spin.duration)).toBe(0);
    expect(spinRate(CRAB.spin.duration / 2)).toBeCloseTo(CRAB.spin.rate, 9);
    expect(spinRate(0.1)).toBeLessThan(spinRate(0.3));
    let turned = 0;
    for (let t = 0; t < CRAB.spin.duration; t += 0.01) turned += spinRate(t) * 0.01;
    expect(turned).toBeGreaterThan(Math.PI * 2);
  });

  it('contact needs reach, the right direction and a low player', () => {
    const boss = { x: 0, z: 0 };
    // arm yaw 0 points to -Z
    expect(sweepContact(0, boss, { x: 0, y: 0, z: -10 }, 1)).toBe(true);
    expect(sweepContact(0, boss, { x: 0, y: 0, z: -20 }, 1)).toBe(false); // out of reach
    expect(sweepContact(0, boss, { x: 10, y: 0, z: 0 }, 1)).toBe(false); // 90 degrees away
    expect(sweepContact(0, boss, { x: 0, y: 3, z: -10 }, 1)).toBe(false); // jumped over
    expect(sweepContact(Math.PI, boss, { x: 0, y: 0, z: 10 }, 1)).toBe(true); // second arm
  });

  it('a sweep contact hurts once: only the rising edge counts', () => {
    const t = new SweepTracker();
    expect(t.step([true, false])).toBe(true);
    expect(t.step([true, false])).toBe(false);
    expect(t.step([false, false])).toBe(false);
    expect(t.step([false, true])).toBe(true);
    expect(t.step([true, true])).toBe(true);
    expect(t.step([true, true])).toBe(false);
    t.reset();
    expect(t.step([true, false])).toBe(true);
  });
});
