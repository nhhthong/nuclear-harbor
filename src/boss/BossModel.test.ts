import { describe, expect, it } from 'vitest';
import { BOSS } from '@/config/tunables';
import { BossModel } from './BossModel';

function fighting(): BossModel {
  const m = new BossModel();
  m.spawn();
  m.update(BOSS.awakeningDuration + 0.1);
  return m;
}

describe('BossModel (Gunslinger Crab Mech, one HP pool)', () => {
  it('has a single pool of 5800 HP and no weak points', () => {
    const m = new BossModel();
    expect(m.hp).toBe(5800);
    expect(m.maxHp).toBe(5800);
    expect('weakPoints' in m).toBe(false);
  });

  it('goes dormant -> awakening -> fight and is invulnerable while awakening', () => {
    const m = new BossModel();
    expect(m.phase).toBe('dormant');
    expect(m.spawn()).toEqual([{ type: 'phaseChanged', phase: 'awakening' }]);
    const hit = m.hit(100);
    expect(hit.absorbed).toBe(true);
    expect(hit.dealt).toBe(0);
    expect(m.hp).toBe(5800);
    expect(m.update(BOSS.awakeningDuration - 0.5)).toEqual([]);
    expect(m.update(1)).toEqual([{ type: 'phaseChanged', phase: 'fight' }]);
    expect(m.vulnerable).toBe(true);
  });

  it('finishAwakening ends the awakening at once and is a no-op afterwards', () => {
    const m = new BossModel();
    m.spawn();
    expect(m.finishAwakening()).toEqual([{ type: 'phaseChanged', phase: 'fight' }]);
    expect(m.finishAwakening()).toEqual([]);
    expect(m.spawn()).toEqual([]);
  });

  it('takes full damage anywhere and reports the new HP', () => {
    const m = fighting();
    const r = m.hit(25);
    expect(r).toMatchObject({ dealt: 25, absorbed: false, killed: false });
    expect(r.events).toEqual([{ type: 'damaged', hp: 5775, maxHp: 5800 }]);
    expect(m.hpFraction).toBeCloseTo(5775 / 5800, 6);
  });

  it('dies after 232 hits of 25 (the ammo budget), then is destroyed and absorbs hits', () => {
    const m = fighting();
    let hits = 0;
    let last = m.hit(0);
    while (m.phase !== 'destroyed') {
      last = m.hit(25);
      hits++;
      expect(hits).toBeLessThanOrEqual(232);
    }
    expect(hits).toBe(232);
    expect(last.killed).toBe(true);
    expect(last.events.map((e) => e.type)).toEqual(['damaged', 'phaseChanged', 'defeated']);
    expect(m.hp).toBe(0);
    expect(m.hit(25).absorbed).toBe(true);
  });

  it('setHpFraction starts the fight low (?bossphase=low) but never at zero', () => {
    const m = new BossModel();
    m.setHpFraction(0.2);
    expect(m.hp).toBe(1160);
    m.setHpFraction(0);
    expect(m.hp).toBe(1);
  });
});
