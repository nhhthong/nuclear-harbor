import { describe, expect, it } from 'vitest';
import { FlowState, mergeBest, parseBest, type Checkpoint } from './FlowState';

const spawn: Checkpoint = { id: 'spawn', x: 0, y: 0, z: 96, yaw: 0 };
const tower: Checkpoint = { id: 'tower-1', x: 20, y: 0, z: 60, yaw: 1 };
const make = () => new FlowState(spawn);

describe('FlowState outcomes', () => {
  it('starts running with the level spawn as checkpoint', () => {
    const f = make();
    expect(f.status).toBe('running');
    expect(f.checkpoint).toEqual(spawn);
  });

  it('death -> died / player-died and respawn is allowed (AC1)', () => {
    const f = make();
    expect(f.onPlayerDied()).toEqual({ over: 'player-died' });
    expect(f.status).toBe('died');
    expect(f.canRespawn()).toBe(true);
  });

  it('countdown expiry -> expired / countdown-expired and respawn is refused (AC2)', () => {
    const f = make();
    expect(f.onCountdownExpired()).toEqual({ over: 'countdown-expired' });
    expect(f.status).toBe('expired');
    expect(f.canRespawn()).toBe(false);
    expect(f.respawn()).toBeNull();
  });

  it('boss defeat -> victory pending, then won (AC3)', () => {
    const f = make();
    expect(f.onBossDefeated()).toBe(true);
    expect(f.status).toBe('victoryPending');
    expect(f.completeVictory()).toBe(true);
    expect(f.status).toBe('won');
  });

  it('respawn returns the latest checkpoint and resumes running', () => {
    const f = make();
    f.setCheckpoint(tower);
    f.onPlayerDied();
    expect(f.respawn()).toEqual(tower);
    expect(f.status).toBe('running');
    expect(f.stats.deaths).toBe(1);
    expect(f.stats.respawns).toBe(1);
  });

  it('respawn does nothing while running', () => {
    const f = make();
    expect(f.respawn()).toBeNull();
    expect(f.stats.respawns).toBe(0);
  });

  it('the latest checkpoint wins and is copied', () => {
    const f = make();
    const a = { ...tower };
    f.setCheckpoint(a);
    a.x = 999;
    expect(f.checkpoint.x).toBe(20);
    f.setCheckpoint({ id: 'tower-2', x: 1, y: 0, z: 2, yaw: 0 });
    expect(f.checkpoint.id).toBe('tower-2');
  });
});

describe('FlowState ignores events once the run has ended (AC9)', () => {
  it('ignores everything after countdown expiry', () => {
    const f = make();
    f.onCountdownExpired();
    expect(f.onPlayerDied()).toBeNull();
    expect(f.onBossDefeated()).toBe(false);
    expect(f.onCountdownExpired()).toBeNull();
    expect(f.status).toBe('expired');
  });

  it('ignores everything after victory', () => {
    const f = make();
    f.onBossDefeated();
    f.completeVictory();
    expect(f.onPlayerDied()).toBeNull();
    expect(f.onCountdownExpired()).toBeNull();
    expect(f.onBossDefeated()).toBe(false);
    expect(f.completeVictory()).toBe(false);
    expect(f.status).toBe('won');
  });

  it('death or expiry during the victory delay does not undo the victory', () => {
    const f = make();
    f.onBossDefeated();
    expect(f.onPlayerDied()).toBeNull();
    expect(f.onCountdownExpired()).toBeNull();
    expect(f.status).toBe('victoryPending');
    expect(f.completeVictory()).toBe(true);
  });

  it('ignores a second death while already dead, and boss defeat while dead', () => {
    const f = make();
    f.onPlayerDied();
    expect(f.onPlayerDied()).toBeNull();
    expect(f.onBossDefeated()).toBe(false);
    expect(f.stats.deaths).toBe(1);
  });

  it('a countdown expiry while dead is ignored (the clock is paused anyway)', () => {
    const f = make();
    f.onPlayerDied();
    expect(f.onCountdownExpired()).toBeNull();
    expect(f.status).toBe('died');
  });

  it('completeVictory requires a pending victory', () => {
    expect(make().completeVictory()).toBe(false);
  });
});

describe('FlowState stats', () => {
  it('tracks time, kills, shots, hits and accuracy', () => {
    const f = make();
    expect(f.stats.accuracy).toBe(0);
    f.addTime(1.5);
    f.addTime(0.5);
    f.addKill();
    f.addKill();
    for (let i = 0; i < 4; i++) f.addShot();
    f.addHit();
    f.addHit();
    f.addHit();
    expect(f.stats).toMatchObject({ elapsed: 2, kills: 2, shots: 4, hits: 3, accuracy: 0.75 });
  });

  it('stops counting once the run has ended', () => {
    const f = make();
    f.onCountdownExpired();
    f.addTime(10);
    f.addKill();
    f.addShot();
    expect(f.stats).toMatchObject({ elapsed: 0, kills: 0, shots: 0 });
  });
});

describe('best result', () => {
  it('parses stored JSON defensively', () => {
    expect(parseBest(null)).toBeNull();
    expect(parseBest('nope')).toBeNull();
    expect(parseBest('{"completed":true,"bestTimeRemaining":"x"}')).toBeNull();
    expect(parseBest('{"completed":true,"bestTimeRemaining":120}')).toEqual({ completed: true, bestTimeRemaining: 120 });
  });

  it('keeps the larger time remaining and marks completed', () => {
    expect(mergeBest(null, 100)).toEqual({ completed: true, bestTimeRemaining: 100 });
    expect(mergeBest({ completed: true, bestTimeRemaining: 100 }, 50).bestTimeRemaining).toBe(100);
    expect(mergeBest({ completed: true, bestTimeRemaining: 100 }, 150).bestTimeRemaining).toBe(150);
  });

  it('clamps negative times to zero', () => {
    expect(mergeBest(null, -5).bestTimeRemaining).toBe(0);
  });
});
