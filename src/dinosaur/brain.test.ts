import { describe, expect, it } from 'vitest';
import { chooseSkill, createCooldowns, tickCooldowns, startCooldown, skillTelegraph } from './brain';
import { DINO } from './tunables';

describe('chooseSkill', () => {
  const ready = createCooldowns();

  it('tail spin close, leap mid, ram far', () => {
    expect(chooseSkill(5, ready)).toBe('tailSpin');
    expect(chooseSkill(10, ready)).toBe('leapStomp');
    expect(chooseSkill(25, ready)).toBe('ram');
  });

  it('returns null out of every range', () => {
    expect(chooseSkill(80, ready)).toBeNull();
  });

  it('falls back to another skill whose range fits when the preferred one cools down', () => {
    const cd = createCooldowns();
    startCooldown(cd, 'leapStomp');
    // 25 m: leap preferred? no, far side prefers ram; at 12 m leap on cooldown -> ram (min 11)
    expect(chooseSkill(12, cd)).toBe('ram');
    const cd2 = createCooldowns();
    startCooldown(cd2, 'ram');
    expect(chooseSkill(20, cd2)).toBe('leapStomp');
    const cd3 = createCooldowns();
    startCooldown(cd3, 'tailSpin');
    // 5 m is below the leap minimum: nothing fits, keep walking
    expect(chooseSkill(5, cd3)).toBeNull();
  });

  it('cooldowns tick down and re-enable', () => {
    const cd = createCooldowns();
    startCooldown(cd, 'ram');
    expect(cd.ram).toBe(DINO.skills.ram.cooldown);
    tickCooldowns(cd, 100);
    expect(cd.ram).toBe(0);
    expect(chooseSkill(25, cd)).toBe('ram');
  });
});

describe('telegraph', () => {
  it('every skill telegraphs at least 0.8 s', () => {
    for (const s of ['ram', 'leapStomp', 'tailSpin'] as const) {
      expect(skillTelegraph(s)).toBeGreaterThanOrEqual(0.8);
    }
  });
});
