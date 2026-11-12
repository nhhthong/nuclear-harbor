import { describe, expect, it } from 'vitest';
import { SPIDER_ROBOT } from '@/config/tunables';
import { computeFlankPoint, decideSpider, type SpiderBrainInput } from './spiderBrain';
import { SPIDER_LOCAL } from './tunables';

function input(over: Partial<SpiderBrainInput> = {}): SpiderBrainInput {
  return {
    state: 'patrol',
    timeInState: 0,
    distance: 50,
    hasLos: false,
    timeSinceSeen: Infinity,
    playerAlive: true,
    flankReached: false,
    playerMovedFar: false,
    commanded: false,
    commandArrived: false,
    ...over,
  };
}

describe('decideSpider', () => {
  it('stays on patrol with nothing in range', () => {
    expect(decideSpider(input())).toBe('patrol');
  });

  it('detects at 30 m with LOS (into flank), not beyond or without LOS', () => {
    const d = SPIDER_ROBOT.detectionRange;
    expect(decideSpider(input({ distance: d - 1, hasLos: true }))).toBe('flank');
    expect(decideSpider(input({ distance: d + 1, hasLos: true }))).toBe('patrol');
    expect(decideSpider(input({ distance: d - 1, hasLos: false }))).toBe('patrol');
  });

  it('goes to chase when commanded and idle', () => {
    expect(decideSpider(input({ commanded: true }))).toBe('chase');
  });

  it('flank holds for the minimum time, then ends on reach, far player or timeout', () => {
    const base = { state: 'flank' as const, distance: 20, hasLos: true, timeSinceSeen: 0 };
    expect(decideSpider(input({ ...base, timeInState: 0.1, flankReached: true }))).toBe('flank');
    expect(decideSpider(input({ ...base, timeInState: SPIDER_LOCAL.flankMinTime + 0.1, flankReached: true }))).toBe('chase');
    expect(decideSpider(input({ ...base, timeInState: 1, playerMovedFar: true }))).toBe('chase');
    expect(decideSpider(input({ ...base, timeInState: SPIDER_LOCAL.flankTimeout + 0.1 }))).toBe('chase');
    expect(decideSpider(input({ ...base, timeInState: 1 }))).toBe('flank');
  });

  it('chase enters attack within 12 m with LOS', () => {
    const a = SPIDER_ROBOT.attackRange;
    expect(decideSpider(input({ state: 'chase', distance: a - 1, hasLos: true, timeSinceSeen: 0 }))).toBe('attack');
    expect(decideSpider(input({ state: 'chase', distance: a + 3, hasLos: true, timeSinceSeen: 0 }))).toBe('chase');
    expect(decideSpider(input({ state: 'chase', distance: a - 1, hasLos: false, timeSinceSeen: 1 }))).toBe('chase');
  });

  it('attack falls back to chase without LOS or beyond hysteresis, patrol after loseTargetTime', () => {
    const a = SPIDER_ROBOT.attackRange;
    expect(decideSpider(input({ state: 'attack', distance: a - 1, hasLos: true, timeSinceSeen: 0 }))).toBe('attack');
    expect(decideSpider(input({ state: 'attack', distance: a - 1, hasLos: false, timeSinceSeen: 1 }))).toBe('chase');
    expect(decideSpider(input({ state: 'attack', distance: a * 1.5, hasLos: true, timeSinceSeen: 0 }))).toBe('chase');
    expect(
      decideSpider(input({ state: 'attack', distance: a - 1, hasLos: false, timeSinceSeen: SPIDER_ROBOT.loseTargetTime + 1 })),
    ).toBe('patrol');
  });

  it('returns to patrol when the player is dead', () => {
    expect(decideSpider(input({ state: 'attack', distance: 5, hasLos: true, timeSinceSeen: 0, playerAlive: false }))).toBe('patrol');
  });

  it('keeps hop and destroyed states untouched', () => {
    expect(decideSpider(input({ state: 'hop', distance: 5, hasLos: true }))).toBe('hop');
    expect(decideSpider(input({ state: 'destroyed' }))).toBe('destroyed');
  });
});

describe('computeFlankPoint', () => {
  const player = { x: 0, z: 0 };
  const forward = { x: 0, z: -1 };
  const self = { x: 0, z: -20 };

  it('lies flankDistance from the player at flankAngleDeg off the facing', () => {
    const p = computeFlankPoint(player, forward, self, 1, SPIDER_ROBOT);
    expect(Math.hypot(p.x - player.x, p.z - player.z)).toBeCloseTo(SPIDER_ROBOT.flankDistance, 5);
    const dot = (p.x * forward.x + p.z * forward.z) / SPIDER_ROBOT.flankDistance;
    expect(Math.acos(dot)).toBeCloseTo((SPIDER_ROBOT.flankAngleDeg * Math.PI) / 180, 5);
  });

  it('opposite sides give mirrored points', () => {
    const a = computeFlankPoint(player, forward, self, 1, SPIDER_ROBOT);
    const b = computeFlankPoint(player, forward, self, -1, SPIDER_ROBOT);
    expect(a.x).toBeCloseTo(-b.x, 5);
    expect(a.z).toBeCloseTo(b.z, 5);
    expect(Math.sign(a.x)).not.toBe(Math.sign(b.x));
  });

  it('snaps to a walkable cell, falling back to self when none exists', () => {
    const snap = (x: number, z: number, out: { x: number; z: number }) => {
      out.x = x + 1;
      out.z = z;
      return true;
    };
    const raw = computeFlankPoint(player, forward, self, 1, SPIDER_ROBOT);
    const snapped = computeFlankPoint(player, forward, self, 1, SPIDER_ROBOT, snap);
    expect(snapped.x).toBeCloseTo(raw.x + 1, 5);
    const none = computeFlankPoint(player, forward, self, 1, SPIDER_ROBOT, () => false);
    expect(none).toEqual({ x: self.x, z: self.z });
  });
});
