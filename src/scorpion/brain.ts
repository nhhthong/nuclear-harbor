import type { ScorpionSkill } from './events';
import { SCORPION } from './tunables';

export interface Cooldowns {
  ram: number;
  venom: number;
  tailSlam: number;
}

export function createCooldowns(): Cooldowns {
  return { ram: 0, venom: 0, tailSlam: 0 };
}

export function tickCooldowns(cd: Cooldowns, dt: number): void {
  cd.ram = Math.max(0, cd.ram - dt);
  cd.venom = Math.max(0, cd.venom - dt);
  cd.tailSlam = Math.max(0, cd.tailSlam - dt);
}

export function startCooldown(cd: Cooldowns, skill: ScorpionSkill): void {
  cd[skill] = SCORPION.skills[skill].cooldown;
}

export function skillTelegraph(skill: ScorpionSkill): number {
  return SCORPION.skills[skill].telegraph;
}

/** True when `distance` lies in the skill's usable range (the tail slam has no minimum). */
function inRange(skill: ScorpionSkill, distance: number): boolean {
  switch (skill) {
    case 'tailSlam':
      return distance <= SCORPION.skills.tailSlam.max;
    case 'venom':
      return distance >= SCORPION.skills.venom.min && distance <= SCORPION.skills.venom.max;
    case 'ram':
      return distance >= SCORPION.skills.ram.min && distance <= SCORPION.skills.ram.max;
  }
}

/**
 * Skill choice by distance and cooldown: tail slam close, venom shot mid, charge far. When the
 * preferred skill cools down, any other ready skill whose range fits is used; null = keep walking.
 */
export function chooseSkill(distance: number, cd: Cooldowns): ScorpionSkill | null {
  const preferred: ScorpionSkill =
    distance < SCORPION.skills.venom.min ? 'tailSlam' : distance < SCORPION.skills.venomPreferMax ? 'venom' : 'ram';
  const order: ScorpionSkill[] = [preferred, 'venom', 'ram', 'tailSlam'];
  for (const s of order) if (cd[s] <= 0 && inRange(s, distance)) return s;
  return null;
}
