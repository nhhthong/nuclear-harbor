import { describe, expect, it } from 'vitest';
import { BOSS } from '@/config/tunables';
import { BossModel } from './BossModel';
import type { BossModelEvent } from './BossModel';

function awake(): BossModel {
  const m = new BossModel();
  m.spawn();
  m.update(BOSS.awakeningDuration + 0.1);
  return m;
}

function types(events: BossModelEvent[]): string[] {
  return events.map((e) => e.type);
}

describe('BossModel', () => {
  it('has the GDD 5.4 HP budget 2,000 + 4,000', () => {
    const m = new BossModel();
    expect(m.totalHp).toBe(2000 + 4000);
    expect(m.weakPoints).toEqual([500, 500, 500, 500]);
    expect(m.coreHp).toBe(4000);
  });

  it('goes dormant -> awakening -> weakpoint-hunt and is invulnerable while awakening', () => {
    const m = new BossModel();
    expect(m.phase).toBe('dormant');
    expect(types(m.spawn())).toEqual(['phaseChanged']);
    expect(m.phase).toBe('awakening');
    const hit = m.hitWeakPoint(0, 100);
    expect(hit.absorbed).toBe(true);
    expect(hit.dealt).toBe(0);
    expect(m.weakPoints[0]).toBe(500);
    expect(m.update(BOSS.awakeningDuration - 0.5)).toEqual([]);
    expect(m.update(1)).toEqual([{ type: 'phaseChanged', phase: 'weakpoint-hunt' }]);
  });

  it('armour absorbs everything', () => {
    const m = awake();
    const r = m.hitArmor(9999);
    expect(r).toMatchObject({ dealt: 0, absorbed: true, killed: false });
    expect(m.coreHp).toBe(4000);
  });

  it('core absorbs everything until all four weak points are destroyed', () => {
    const m = awake();
    for (let i = 0; i < 3; i++) m.hitWeakPoint(i, 500);
    const r = m.hitCore(4000);
    expect(r.absorbed).toBe(true);
    expect(r.dealt).toBe(0);
    expect(m.coreHp).toBe(4000);
    expect(m.phase).toBe('weakpoint-hunt');
  });

  it('damages and destroys a weak point with events, ignoring later hits', () => {
    const m = awake();
    const a = m.hitWeakPoint(2, 200);
    expect(a.dealt).toBe(200);
    expect(a.events).toEqual([{ type: 'weakPointDamaged', index: 2, hp: 300, maxHp: 500 }]);
    const b = m.hitWeakPoint(2, 900);
    expect(b.dealt).toBe(300);
    expect(b.killed).toBe(true);
    expect(types(b.events)).toEqual(['weakPointDamaged', 'weakPointDestroyed']);
    const c = m.hitWeakPoint(2, 50);
    expect(c).toMatchObject({ dealt: 0, absorbed: true, events: [] });
    expect(m.hitWeakPoint(9, 50).absorbed).toBe(true);
  });

  it('the last weak point exposes the core; overflow does not hit the core', () => {
    const m = awake();
    for (let i = 0; i < 3; i++) m.hitWeakPoint(i, 500);
    const last = m.hitWeakPoint(3, 5000);
    expect(types(last.events)).toEqual(['weakPointDamaged', 'weakPointDestroyed', 'phaseChanged', 'coreExposed']);
    expect(m.phase).toBe('core-exposed');
    expect(m.coreHp).toBe(4000);
  });

  it('core damage is reported and defeat is emitted exactly once', () => {
    const m = awake();
    for (let i = 0; i < 4; i++) m.hitWeakPoint(i, 500);
    const a = m.hitCore(1000);
    expect(a.events).toEqual([{ type: 'coreDamaged', hp: 3000, maxHp: 4000 }]);
    const b = m.hitCore(4000);
    expect(b.killed).toBe(true);
    expect(types(b.events)).toEqual(['coreDamaged', 'phaseChanged', 'defeated']);
    expect(m.phase).toBe('destroyed');
    const c = m.hitCore(4000);
    expect(c).toMatchObject({ absorbed: true, events: [] });
    expect(m.hitArmor(10).dealt).toBe(0);
  });

  it('cannot be killed in any order without the fourth weak point (random sequences)', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const m = awake();
      let s = seed;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let n = 0; n < 200; n++) {
        const k = Math.floor(rnd() * 3);
        if (k === 0) m.hitArmor(500);
        else if (k === 1) m.hitCore(500);
        else m.hitWeakPoint(Math.floor(rnd() * 3), 20);
        expect(m.phase).not.toBe('destroyed');
      }
      expect(m.coreHp).toBe(4000);
    }
  });

  it('?bossphase=core: weak points gone, core opens after awakening', () => {
    const m = new BossModel();
    m.destroyAllWeakPointsSilently();
    m.spawn();
    const ev = m.update(BOSS.awakeningDuration + 1);
    expect(types(ev)).toEqual(['phaseChanged', 'coreExposed']);
    expect(m.hitCore(100).dealt).toBe(100);
  });
});
