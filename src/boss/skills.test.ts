import { describe, expect, it } from 'vitest';
import {
  GRAB_CARRY_SECONDS,
  QuakeWaves,
  SKILLS,
  SkillScheduler,
  TickTimer,
  beamAngles,
  beamHitsPlayer,
  bombDamage,
  bombPattern,
  canReleaseDrones,
  clampOrbitRadius,
  clawPoint,
  droneReleaseCount,
  grabCarry,
  grabConnects,
  inPhaseTwo,
  laserBase,
  lungeEnd,
  orbitPoint,
  pickSkill,
  quakeDuration,
  skillWeights,
} from './skills';
import type { SkillId, SkillInput, SkillWeights } from './skills';
import { CRAB } from './tunables';

const none: Record<SkillId, number> = { bombs: 0, drones: 0, laser: 0, grab: 0, quake: 0 };
/** Phase one by default (full HP); pass 0.4 for phase two. */
const at = (distance: number, aliveDrones = 0, hpFraction = 1): SkillInput => ({ distance, aliveDrones, k: 1, hpFraction });
const zero = (): number => 0;

describe('skill selection', () => {
  it('phase one: bombs, drones and the laser need some distance; the claw skills never run', () => {
    const near = skillWeights(at(10), none, null);
    expect(near.bombs).toBeGreaterThan(0);
    const far = skillWeights(at(30), none, null);
    expect(far.bombs).toBeGreaterThan(near.bombs);
    expect(far.laser).toBeGreaterThan(near.laser);
    const hugging = skillWeights(at(3), none, null);
    expect(hugging.bombs).toBe(0);
    expect(hugging.laser).toBe(0);
    for (const d of [3, 10, 20, 30]) {
      const w = skillWeights(at(d), none, null);
      expect(w.grab).toBe(0);
      expect(w.quake).toBe(0);
    }
  });

  it('there is no spin skill any more (spec 34)', () => {
    expect(SKILLS).not.toContain('spin' as SkillId);
    expect(SKILLS).toEqual(['bombs', 'drones', 'laser', 'grab', 'quake']);
  });

  it('the claw skills unlock below half of the boss HP', () => {
    expect(inPhaseTwo(1)).toBe(false);
    expect(inPhaseTwo(0.5)).toBe(false);
    expect(inPhaseTwo(0.499)).toBe(true);
    expect(inPhaseTwo(0.05)).toBe(true);
    const w = skillWeights(at(12, 0, 0.4), none, null);
    expect(w.grab).toBeGreaterThan(0);
    expect(w.quake).toBeGreaterThan(0);
  });

  it('the grab needs the player within its range, the quake within its radius, both respect the cooldown', () => {
    expect(skillWeights(at(2, 0, 0.4), none, null).grab).toBe(0); // too close
    expect(skillWeights(at(CRAB.grab.maxRange + 1, 0, 0.4), none, null).grab).toBe(0); // too far
    expect(skillWeights(at(CRAB.quake.maxRange + 1, 0, 0.4), none, null).quake).toBe(0);
    const w = skillWeights(at(12, 0, 0.4), { ...none, grab: 4, quake: 2 }, null);
    expect(w.grab).toBe(0);
    expect(w.quake).toBe(0);
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
    const w = skillWeights(at(10), none, 'bombs');
    expect(w.bombs).toBe(0);
    const only = skillWeights(at(10), { bombs: 0, drones: 5, laser: 5, grab: 0, quake: 0 }, 'bombs');
    expect(only.bombs).toBeGreaterThan(0);
  });

  it('weights scale with the boss size factor', () => {
    expect(skillWeights({ distance: 7, aliveDrones: 0, k: 0.8, hpFraction: 1 }, none, null).bombs).toBeGreaterThan(0);
    // grab reaches 24 m at k = 1, so 18 m is in range for k = 0.8 (22.5 m) and 20 m is not (25 m)
    expect(skillWeights({ distance: 18, aliveDrones: 0, k: 0.8, hpFraction: 0.3 }, none, null).grab).toBeGreaterThan(0);
    expect(skillWeights({ distance: 20, aliveDrones: 0, k: 0.8, hpFraction: 0.3 }, none, null).grab).toBe(0);
  });

  it('pickSkill is a weighted choice and null when nothing is eligible', () => {
    const w: SkillWeights = { bombs: 1, drones: 1, laser: 2, grab: 0, quake: 0 };
    expect(pickSkill(w, 0)).toBe('bombs');
    expect(pickSkill(w, 0.3)).toBe('drones');
    expect(pickSkill(w, 0.6)).toBe('laser');
    expect(pickSkill(w, 0.999)).toBe('laser');
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
    expect(s.force('grab')).toBe(true);
    expect(s.cooldowns.grab).toBe(CRAB.cooldown.grab);
    s.reset();
    expect(s.active).toBeNull();
    expect(s.cooldowns.grab).toBe(0);
  });

  it('phase one picks the three old skills, phase two adds the claw skills', () => {
    for (const hp of [1, 0.3]) {
      const s = new SkillScheduler();
      const seen = new Set<SkillId>();
      let seed = 7;
      const rand = (): number => {
        seed = (seed * 16807) % 2147483647;
        return seed / 2147483647;
      };
      for (let t = 0; t < 900; t += 0.1) {
        const pick = s.update(0.1, at(8 + 20 * rand(), 0, hp), rand);
        if (pick) {
          seen.add(pick);
          s.finish(rand);
        }
      }
      for (const k of ['bombs', 'drones', 'laser'] as const) expect(seen.has(k)).toBe(true);
      expect(seen.has('grab')).toBe(hp < 0.5);
      expect(seen.has('quake')).toBe(hp < 0.5);
    }
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

describe('claw grab (spec 34)', () => {
  const boss = { x: 0, z: 0 };

  it('the claw point is `reach` in front of the body along the facing (yaw 0 faces -Z)', () => {
    const out = { x: 0, z: 0 };
    clawPoint(boss, 0, 1, out);
    expect(out.x).toBeCloseTo(0, 9);
    expect(out.z).toBeCloseTo(-CRAB.grab.reach, 9);
    clawPoint(boss, Math.PI / 2, 0.5, out); // turned left: faces -X
    expect(out.x).toBeCloseTo(-CRAB.grab.reach * 0.5, 9);
    expect(out.z).toBeCloseTo(0, 9);
  });

  it('the lunge brings the claws onto the target, is capped, and never goes backwards', () => {
    const out = { x: 0, z: 0 };
    lungeEnd(boss, { x: 0, z: -15 }, 1, out);
    expect(out.z).toBeCloseTo(-(15 - CRAB.grab.reach), 9); // claw point lands on the target
    lungeEnd(boss, { x: 0, z: -80 }, 1, out);
    expect(out.z).toBeCloseTo(-CRAB.grab.lungeMax, 9);
    lungeEnd(boss, { x: 0, z: -3 }, 1, out); // already in reach: stays
    expect(out.x).toBeCloseTo(0, 9);
    expect(out.z).toBeCloseTo(0, 9);
    lungeEnd(boss, boss, 1, out);
    expect(Number.isFinite(out.x + out.z)).toBe(true);
  });

  it('the claws close on a player within the radius and below the jump height', () => {
    const claw = { x: 0, z: -10 };
    expect(grabConnects(claw, { x: 0, y: 0, z: -10 }, 1)).toBe(true);
    expect(grabConnects(claw, { x: CRAB.grab.radius - 0.1, y: 0, z: -10 }, 1)).toBe(true);
    expect(grabConnects(claw, { x: CRAB.grab.radius + 0.5, y: 0, z: -10 }, 1)).toBe(false); // stepped aside
    expect(grabConnects(claw, { x: 0, y: CRAB.grab.maxPlayerHeight + 0.2, z: -10 }, 1)).toBe(false); // jumped
    expect(grabConnects(claw, { x: 0, y: 0, z: -10 - CRAB.grab.radius * 0.7 }, 0.8)).toBe(true);
    expect(grabConnects(claw, { x: 0, y: 0, z: -10 - CRAB.grab.radius * 1.2 }, 0.8)).toBe(false);
  });

  it('carries up, holds, then slams down to the ground', () => {
    const G = CRAB.grab;
    expect(grabCarry(0, 1)).toEqual({ y: 0, stage: 'lift' });
    expect(grabCarry(G.liftTime / 2, 1).y).toBeCloseTo(G.liftHeight / 2, 6);
    expect(grabCarry(G.liftTime / 2, 1).stage).toBe('lift');
    expect(grabCarry(G.liftTime + G.holdTime / 2, 1)).toEqual({ y: G.liftHeight, stage: 'hold' });
    const mid = grabCarry(G.liftTime + G.holdTime + G.slamTime / 2, 1);
    expect(mid.stage).toBe('slam');
    expect(mid.y).toBeGreaterThan(0);
    expect(mid.y).toBeLessThan(G.liftHeight);
    expect(grabCarry(GRAB_CARRY_SECONDS, 1)).toEqual({ y: 0, stage: 'done' });
    // heights scale with the boss size, and never go up while slamming
    expect(grabCarry(G.liftTime + 0.1, 0.5).y).toBeCloseTo(grabCarry(G.liftTime + 0.1, 1).y * 0.5, 9);
    let prev = Infinity;
    for (let t = G.liftTime + G.holdTime; t < GRAB_CARRY_SECONDS; t += 0.01) {
      const y = grabCarry(t, 1).y;
      expect(y).toBeLessThanOrEqual(prev + 1e-9);
      prev = y;
    }
  });

  it('the slam is a big hit but not a one-shot from full health', () => {
    expect(CRAB.grab.damage).toBeGreaterThanOrEqual(50);
    expect(CRAB.grab.damage).toBeLessThan(100);
  });
});

describe('claw quake (spec 34)', () => {
  const Q = CRAB.quake;
  const run = (waves: QuakeWaves, seconds: number, dist: number, y: number): number => {
    let hits = 0;
    for (let t = 0; t < seconds; t += 1 / 60) hits += waves.step(1 / 60, dist, y, 1);
    return hits;
  };

  it('a ring hurts a player on the ground exactly once, when it reaches them', () => {
    const w = new QuakeWaves();
    w.launch(1);
    expect(run(w, 0.3, 20, 0)).toBe(0); // still on its way
    expect(run(w, 3, 20, 0)).toBe(1);
    expect(w.live).toBe(0); // gone past the arena edge
  });

  it('a player in the air when it passes is not hurt, and lands safely behind it', () => {
    const w = new QuakeWaves();
    w.launch(1);
    // ring front reaches 20 m at about (20 - 3.5) / 13 = 1.27 s; airborne through that window
    let hits = run(w, 1.0, 20, 0);
    hits += run(w, 0.6, 20, 2);
    hits += run(w, 2, 20, 0);
    expect(hits).toBe(0);
  });

  it('rings one second apart can each be jumped; a missed jump costs one hit per ring', () => {
    const w = new QuakeWaves();
    let hits = 0;
    let t = 0;
    let launched = 0;
    for (; t < quakeDuration(); t += 1 / 60) {
      if (launched < Q.count && t >= launched * Q.interval) {
        w.launch(1);
        launched++;
      }
      hits += w.step(1 / 60, 24, 0, 1);
    }
    expect(launched).toBe(Q.count);
    expect(hits).toBe(Q.count);
  });

  it('the pounds are `interval` seconds apart and a ring crosses the arena well before the next three have passed', () => {
    expect(Q.interval).toBe(1);
    expect(Q.count).toBe(4);
    expect(quakeDuration()).toBeGreaterThan((Q.count - 1) * Q.interval);
    expect((Q.maxRadius - Q.startRadius) / Q.speed).toBeLessThan(3);
  });

  it('a jump timed to the ring clears it (the safe height is below a single jump)', () => {
    expect(Q.safeHeight).toBeLessThan(0.95);
  });

  it('scales with the boss size', () => {
    const w = new QuakeWaves();
    w.launch(0.5);
    let hits = 0;
    for (let t = 0; t < 3; t += 1 / 60) hits += w.step(1 / 60, 10, 0, 0.5);
    expect(hits).toBe(1);
    expect(w.live).toBe(0);
  });

  it('reset drops every live ring', () => {
    const w = new QuakeWaves();
    w.launch(1);
    w.launch(1);
    expect(w.live).toBe(2);
    expect(w.radii()).toHaveLength(2);
    w.reset();
    expect(w.live).toBe(0);
  });
});
