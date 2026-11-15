import { describe, expect, it } from 'vitest';
import { chooseSkill, createCooldowns, tickCooldowns, startCooldown, skillTelegraph } from './brain';
import { SCORPION } from './tunables';

describe('chooseSkill', () => {
  const ready = createCooldowns();

  it('tail slam close, venom mid, charge far', () => {
    expect(chooseSkill(5, ready)).toBe('tailSlam');
    expect(chooseSkill(10, ready)).toBe('venom');
    expect(chooseSkill(25, ready)).toBe('ram');
  });

  it('returns null out of every range', () => {
    expect(chooseSkill(80, ready)).toBeNull();
  });

  it('falls back to another skill whose range fits when the preferred one cools down', () => {
    const cd = createCooldowns();
    startCooldown(cd, 'venom');
    // at 12 m the venom shot is on cooldown -> charge (min 11)
    expect(chooseSkill(12, cd)).toBe('ram');
    const cd2 = createCooldowns();
    startCooldown(cd2, 'ram');
    expect(chooseSkill(20, cd2)).toBe('venom');
    const cd3 = createCooldowns();
    startCooldown(cd3, 'tailSlam');
    // 5 m is below the venom minimum: nothing fits, keep walking
    expect(chooseSkill(5, cd3)).toBeNull();
  });

  it('cooldowns tick down and re-enable', () => {
    const cd = createCooldowns();
    startCooldown(cd, 'ram');
    expect(cd.ram).toBe(SCORPION.skills.ram.cooldown);
    tickCooldowns(cd, 100);
    expect(cd.ram).toBe(0);
    expect(chooseSkill(25, cd)).toBe('ram');
  });
});

describe('telegraph', () => {
  it('every skill telegraphs at least 0.8 s', () => {
    for (const s of ['ram', 'venom', 'tailSlam'] as const) {
      expect(skillTelegraph(s)).toBeGreaterThanOrEqual(0.8);
    }
  });
});
