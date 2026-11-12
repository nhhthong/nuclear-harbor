import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SOUND_DEFS } from './catalogue';
import { EVENT_ROUTES } from './eventMap';

const v = (x = 1, y = 2, z = 3) => new Vector3(x, y, z);
const ids = (out: unknown): string[] => {
  if (!out) return [];
  const list = (Array.isArray(out) ? out : [out]) as Array<{ id: string }>;
  return list.map((r) => r.id);
};

describe('event routes', () => {
  it('only reference catalogue ids', () => {
    const samples: unknown[] = [
      EVENT_ROUTES['weapon:fired'](),
      EVENT_ROUTES['combat:hit']({ targetId: 'a', targetKind: 'enemy', zone: 'armor', dealt: 1, killed: false, absorbed: true, point: v(), normal: v() }),
      EVENT_ROUTES['countdown:tick']({ remaining: 5, critical: true }),
      EVENT_ROUTES['boss:attack']({ attack: 'missile-barrage', position: v(), radius: 4 }),
    ];
    for (const s of samples) for (const id of ids(s)) expect(id in SOUND_DEFS).toBe(true);
  });

  it('covers every GDD 11 group', () => {
    const routed = Object.keys(EVENT_ROUTES);
    for (const e of ['weapon:fired', 'player:footstep', 'grapple:fired', 'enemy:alerted', 'enemy:destroyed', 'charger:windup', 'tower:activated', 'countdown:tick', 'boss:spawned', 'boss:attack', 'boss:weakPointDestroyed', 'boss:defeated']) {
      expect(routed).toContain(e);
    }
  });

  it('passes the charger telegraph duration to the wind-up sound', () => {
    const out = EVENT_ROUTES['charger:windup']({ id: 'c', position: v(), direction: v(), duration: 1.4 });
    expect(out).toMatchObject({ id: 'chargerWindup', duration: 1.4 });
  });

  it('routes the countdown: alarm when critical, beeps in the last 10 s, silence otherwise', () => {
    expect(ids(EVENT_ROUTES['countdown:tick']({ remaining: 200, critical: false }))).toEqual([]);
    expect(ids(EVENT_ROUTES['countdown:tick']({ remaining: 60, critical: true }))).toEqual(['alarm']);
    expect(ids(EVENT_ROUTES['countdown:tick']({ remaining: 8, critical: true }))).toContain('beep');
    expect(ids(EVENT_ROUTES['countdown:tick']({ remaining: 0, critical: true }))).toEqual([]);
  });

  it('maps every mandatory boss attack to a sound', () => {
    for (const attack of ['heavy-cannon', 'ground-slam', 'missile-barrage', 'shockwave', 'emp-pulse'] as const) {
      expect(ids(EVENT_ROUTES['boss:attack']({ attack, position: v(), radius: 4 })).length).toBe(1);
    }
    const tel = EVENT_ROUTES['boss:attackTelegraph']({ attack: 'emp-pulse', position: v(), radius: 3, duration: 1 });
    expect(tel).toMatchObject({ id: 'bossTelegraph', variant: 5 });
  });

  it('picks footstep and pickup variants', () => {
    expect(ids(EVENT_ROUTES['player:footstep']({ sprinting: true }))).toEqual(['footstepSprint']);
    expect(ids(EVENT_ROUTES['player:footstep']({ sprinting: false }))).toEqual(['footstepWalk']);
    expect(ids(EVENT_ROUTES['pickup:collected']({ id: 'p', kind: 'medkit', amount: 1, position: v() }))).toEqual(['pickupMedkit']);
    expect(ids(EVENT_ROUTES['pickup:collected']({ id: 'p', kind: 'ammo', amount: 1, position: v() }))).toEqual(['pickupAmmo']);
  });
});
