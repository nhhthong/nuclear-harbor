import { describe, expect, it } from 'vitest';
import { PLAYER } from '@/config/tunables';
import { decideSpot, lungeTouchesPlayer, retreatDirection, type SpotBrainInput } from './spotBrain';
import { SPOT } from './tunables';

const base: SpotBrainInput = {
  state: 'patrol',
  timeInState: 0,
  distance: 20,
  hasLos: true,
  timeSinceSeen: 0,
  playerAlive: true,
  cooldownLeft: 0,
  commanded: false,
};

describe('decideSpot', () => {
  it('is fast: faster than the player walk', () => {
    expect(SPOT.chaseSpeed).toBeGreaterThan(PLAYER.walkSpeed);
    expect(SPOT.hp).toBe(70);
  });
  it('patrol -> chase on detection, back when the player is forgotten', () => {
    expect(decideSpot({ ...base, hasLos: false, timeSinceSeen: Infinity })).toBe('patrol');
    expect(decideSpot(base)).toBe('chase');
    expect(decideSpot({ ...base, state: 'chase', hasLos: false, timeSinceSeen: 9 })).toBe('patrol');
  });
  it('a defend-phase order keeps it moving', () => {
    expect(decideSpot({ ...base, hasLos: false, timeSinceSeen: Infinity, commanded: true })).toBe('chase');
  });
  it('chase -> telegraph only in range, with line of sight and no cooldown', () => {
    const near = { ...base, state: 'chase' as const, distance: 5 };
    expect(decideSpot(near)).toBe('telegraph');
    expect(decideSpot({ ...near, cooldownLeft: 1 })).toBe('chase');
    expect(decideSpot({ ...near, hasLos: false })).toBe('chase');
    expect(decideSpot({ ...near, distance: 12 })).toBe('chase');
  });
  it('telegraph lasts the crouch time, then lunges', () => {
    const t = { ...base, state: 'telegraph' as const, distance: 5 };
    expect(decideSpot({ ...t, timeInState: SPOT.telegraphTime - 0.01 })).toBe('telegraph');
    expect(decideSpot({ ...t, timeInState: SPOT.telegraphTime })).toBe('lunge');
  });
  it('lunge is only ended by the robot; retreat waits out the 2.5 s cooldown', () => {
    expect(decideSpot({ ...base, state: 'lunge', timeInState: 5 })).toBe('lunge');
    expect(SPOT.cooldown).toBeGreaterThanOrEqual(2.5);
    expect(decideSpot({ ...base, state: 'retreat', cooldownLeft: 1 })).toBe('retreat');
    expect(decideSpot({ ...base, state: 'retreat', cooldownLeft: 0 })).toBe('chase');
  });
});

describe('lunge helpers', () => {
  it('touch test uses horizontal reach and a vertical band', () => {
    expect(lungeTouchesPlayer(0.5, 0.5, 0, 0)).toBe(true);
    expect(lungeTouchesPlayer(2, 0, 0, 0)).toBe(false);
    expect(lungeTouchesPlayer(0, 0, 5, 0)).toBe(false);
  });
  it('retreat first backs away, then circles tangentially', () => {
    const out = { x: 0, z: 0 };
    retreatDirection(0, 1, 0, 1, out);
    expect(out).toEqual({ x: 1, z: 0 });
    retreatDirection(SPOT.backoffTime + 0.1, 1, 0, 1, out);
    expect(Math.abs(out.x)).toBe(0);
    expect(out.z).toBe(1);
    retreatDirection(SPOT.backoffTime + 0.1, 1, 0, -1, out);
    expect(out.z).toBe(-1);
  });
});
