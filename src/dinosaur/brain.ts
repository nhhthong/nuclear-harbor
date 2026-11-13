import type { DinoSkill } from './events';
import { DINO } from './tunables';

export interface Cooldowns {
  ram: number;
  leapStomp: number;
  tailSpin: number;
}

export function createCooldowns(): Cooldowns {
  return { ram: 0, leapStomp: 0, tailSpin: 0 };
}

export function tickCooldowns(cd: Cooldowns, dt: number): void {
  cd.ram = Math.max(0, cd.ram - dt);
  cd.leapStomp = Math.max(0, cd.leapStomp - dt);
  cd.tailSpin = Math.max(0, cd.tailSpin - dt);
}

export function startCooldown(cd: Cooldowns, skill: DinoSkill): void {
  cd[skill] = DINO.skills[skill].cooldown;
}

export function skillTelegraph(skill: DinoSkill): number {
  return DINO.skills[skill].telegraph;
}

/** True when `distance` lies in the skill's usable range (tail spin has no minimum). */
function inRange(skill: DinoSkill, distance: number): boolean {
  switch (skill) {
    case 'tailSpin':
      return distance <= DINO.skills.tailSpin.max;
    case 'leapStomp':
      return distance >= DINO.skills.leapStomp.min && distance <= DINO.skills.leapStomp.max;
    case 'ram':
      return distance >= DINO.skills.ram.min && distance <= DINO.skills.ram.max;
  }
}

/**
 * Skill choice by distance and cooldown: tail spin close, leap + stomp mid, ram far. When the
 * preferred skill cools down, any other ready skill whose range fits is used; null = keep walking.
 */
export function chooseSkill(distance: number, cd: Cooldowns): DinoSkill | null {
  const preferred: DinoSkill =
    distance < DINO.skills.leapStomp.min ? 'tailSpin' : distance < DINO.skills.leapPreferMax ? 'leapStomp' : 'ram';
  const order: DinoSkill[] = [preferred, 'leapStomp', 'ram', 'tailSpin'];
  for (const s of order) if (cd[s] <= 0 && inRange(s, distance)) return s;
  return null;
}
