import { describe, expect, it } from 'vitest';
import { CHARGER_ROBOT, WEAPON } from '@/config/tunables';
import { resolveDamage } from '@/combat/damage';
import { canStartCharge, planCharge, playerTouchesBody, zoneForHit } from './chargePlan';
import { CHARGER_LOCAL } from './tunables';

const o = { x: 0, z: 0 };
const d = { x: 0, z: -1 };

describe('planCharge', () => {
  it('uses the max charge distance on open ground', () => {
    expect(planCharge(o, d, { obstacleDistance: null, edgeDistance: null })).toEqual({
      maxDistance: CHARGER_ROBOT.maxChargeDistance,
      endsAt: 'range',
    });
  });

  it('ends at a wall closer than the range', () => {
    expect(planCharge(o, d, { obstacleDistance: 12, edgeDistance: null })).toEqual({ maxDistance: 12, endsAt: 'wall' });
  });

  it('ignores a wall beyond the range', () => {
    expect(planCharge(o, d, { obstacleDistance: 45, edgeDistance: null }).endsAt).toBe('range');
  });

  it('stops before the edge by the safety margin and never reaches it', () => {
    const plan = planCharge(o, d, { obstacleDistance: null, edgeDistance: 20 });
    expect(plan.endsAt).toBe('edge');
    expect(plan.maxDistance).toBe(20 - CHARGER_LOCAL.edgeSafetyMargin);
    expect(plan.maxDistance).toBeLessThan(20);
  });

  it('never returns a negative distance when the edge is right there', () => {
    expect(planCharge(o, d, { obstacleDistance: null, edgeDistance: 1 })).toEqual({ maxDistance: 0, endsAt: 'edge' });
  });

  it('takes the nearest of wall and edge', () => {
    expect(planCharge(o, d, { obstacleDistance: 8, edgeDistance: 20 }).endsAt).toBe('wall');
    expect(planCharge(o, d, { obstacleDistance: 25, edgeDistance: 20 }).endsAt).toBe('edge');
  });

  it('never exceeds 30 m for any probe combination', () => {
    for (const obstacleDistance of [null, 0, 10, 29.9, 30, 100]) {
      for (const edgeDistance of [null, 0, 10, 34, 36, 100]) {
        const plan = planCharge(o, d, { obstacleDistance, edgeDistance });
        expect(plan.maxDistance).toBeLessThanOrEqual(30);
        expect(plan.maxDistance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('canStartCharge', () => {
  it('requires the 8-25 m window', () => {
    expect(canStartCharge(7.9, true, 0)).toBe(false);
    expect(canStartCharge(8, true, 0)).toBe(true);
    expect(canStartCharge(25, true, 0)).toBe(true);
    expect(canStartCharge(25.1, true, 0)).toBe(false);
  });

  it('requires line of sight and no cooldown', () => {
    expect(canStartCharge(15, false, 0)).toBe(false);
    expect(canStartCharge(15, true, 0.1)).toBe(false);
    expect(canStartCharge(15, true, 0)).toBe(true);
  });
});

describe('zoneForHit', () => {
  const facing = { x: 0, z: -1 };

  it('front arc is armor', () => {
    // shot travelling south (+Z) hits a robot facing north from the front
    expect(zoneForHit(facing, { x: 0, z: 1 }, false)).toBe('armor');
    expect(zoneForHit(facing, { x: Math.sin(0.9), z: Math.cos(0.9) }, false)).toBe('armor');
  });

  it('flanks and rear are critical, also while stunned', () => {
    expect(zoneForHit(facing, { x: 1, z: 0 }, false)).toBe('critical');
    expect(zoneForHit(facing, { x: -1, z: 0 }, true)).toBe('critical');
    expect(zoneForHit(facing, { x: 0, z: -1 }, false)).toBe('critical');
    expect(zoneForHit(facing, { x: 0, z: -1 }, true)).toBe('critical');
  });

  it('gives 10% from the front and 2x from behind through resolveDamage', () => {
    const profile = { armor: CHARGER_ROBOT.frontDamageMultiplier, critical: CHARGER_ROBOT.rearCritMultiplier, body: 1 };
    const front = resolveDamage(200, { amount: WEAPON.damage, zone: 'body' }, profile, zoneForHit(facing, { x: 0, z: 1 }, false));
    const rear = resolveDamage(200, { amount: WEAPON.damage, zone: 'body' }, profile, zoneForHit(facing, { x: 0, z: -1 }, false));
    expect(front.dealt).toBeCloseTo(WEAPON.damage * 0.1);
    expect(front.zone).toBe('armor');
    expect(rear.dealt).toBeCloseTo(WEAPON.damage * 2);
    expect(rear.zone).toBe('critical');
  });
});

describe('playerTouchesBody', () => {
  it('detects contact in front of the box and not far away', () => {
    // robot at origin facing -Z, half length 1.3: player 1.5 m ahead, radius 0.45 -> touching
    expect(playerTouchesBody(0, 0, -1.5, 0, 0.9, 0, 0)).toBe(true);
    expect(playerTouchesBody(0, 0, -2.5, 0, 0.9, 0, 0)).toBe(false);
  });

  it('respects the yaw', () => {
    // yaw +90 deg faces -X: the long axis lies along X
    expect(playerTouchesBody(-1.5, 0, 0, 0, 0.9, 0, Math.PI / 2)).toBe(true);
    expect(playerTouchesBody(0, 0, -1.5, 0, 0.9, 0, Math.PI / 2)).toBe(false);
  });

  it('misses a player standing above the body', () => {
    expect(playerTouchesBody(0, 3, -1, 0, 0.9, 0, 0)).toBe(false);
  });
});
