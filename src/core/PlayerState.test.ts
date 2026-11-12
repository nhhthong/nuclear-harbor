import { describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { EventBus } from './EventBus';
import type { GameEvents } from './events';
import { PlayerState } from './PlayerState';

describe('PlayerState', () => {
  it('takes damage, emits events and dies once', () => {
    const events = new EventBus<GameEvents>();
    const died = vi.fn();
    events.on('player:died', died);
    const player = new PlayerState(events);
    expect(player.applyDamage({ amount: 30, zone: 'body', source: 'enemy' }).dealt).toBe(30);
    expect(player.hp).toBe(70);
    expect(player.applyDamage({ amount: 500, zone: 'body', source: 'boss' }).killed).toBe(true);
    expect(player.alive).toBe(false);
    player.applyDamage({ amount: 10, zone: 'body', source: 'enemy' });
    expect(died).toHaveBeenCalledTimes(1);
  });

  it('heals up to max HP only (GDD 4.2: medkits only)', () => {
    const player = new PlayerState(new EventBus<GameEvents>());
    player.applyDamage({ amount: 25, zone: 'body', source: 'enemy' });
    expect(player.heal(40)).toBe(25);
    expect(player.heal(40)).toBe(0);
  });

  it('looks along -Z at yaw 0 and up with positive pitch', () => {
    const player = new PlayerState(new EventBus<GameEvents>());
    const dir = player.getLookDirection(new Vector3());
    expect(dir.z).toBeCloseTo(-1);
    player.pitch = Math.PI / 2;
    expect(player.getLookDirection(dir).y).toBeCloseTo(1);
    player.pitch = 0;
    player.yaw = Math.PI / 2; // turned left => facing -X
    expect(player.getForward(dir).x).toBeCloseTo(-1);
    expect(player.getRight(dir).z).toBeCloseTo(-1);
  });
});
