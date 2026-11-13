export type SoundCategory = 'sfx' | 'ambience' | 'ui';

export interface SoundDef {
  category: SoundCategory;
  /** Higher = more important; low-priority voices are stolen first. */
  priority: number;
  /** Maximum simultaneous instances of this sound. */
  maxInstances: number;
  /** Minimum time between two starts of this sound. */
  cooldownMs: number;
  /** Plays through a PannerNode when the request carries a position. */
  spatial: boolean;
  /** Panner reference distance override (big sources stay audible further away). */
  refDistance?: number;
}

const d = (
  category: SoundCategory,
  priority: number,
  maxInstances: number,
  cooldownMs: number,
  spatial = false,
  refDistance?: number,
): SoundDef => (refDistance === undefined
  ? { category, priority, maxInstances, cooldownMs, spatial }
  : { category, priority, maxInstances, cooldownMs, spatial, refDistance });

/** The sound catalogue. Every id has a recipe in `sounds.ts` (checked by tests). */
export const SOUND_DEFS = {
  // player
  rifleShot: d('sfx', 6, 6, 55),
  dryClick: d('sfx', 4, 2, 120),
  reload: d('sfx', 5, 1, 200),
  footstepWalk: d('sfx', 2, 3, 150),
  footstepSprint: d('sfx', 2, 3, 110),
  land: d('sfx', 4, 2, 150),
  hurt: d('sfx', 8, 2, 120),
  death: d('sfx', 10, 1, 500),
  grappleFire: d('sfx', 5, 1, 150),
  grappleAttach: d('sfx', 5, 1, 150),
  grappleRelease: d('sfx', 4, 1, 150),
  grappleFail: d('sfx', 4, 1, 150),
  pickupAmmo: d('sfx', 5, 2, 120),
  pickupMedkit: d('sfx', 5, 2, 120),
  hitMarker: d('ui', 5, 3, 40),
  hitArmor: d('sfx', 3, 3, 60, true),
  impact: d('sfx', 2, 4, 40, true),
  // enemies
  enemyAlert: d('sfx', 4, 3, 200, true),
  enemyShot: d('sfx', 4, 5, 90, true),
  enemyDestroyed: d('sfx', 6, 4, 80, true, 6),
  duckWindup: d('sfx', 7, 2, 300, true, 8),
  duckHit: d('sfx', 7, 2, 200, true),
  // objective
  towerCancel: d('sfx', 5, 1, 150),
  towerActivated: d('sfx', 8, 2, 300, true, 10),
  alarm: d('sfx', 7, 1, 400),
  beep: d('ui', 8, 1, 300),
  countdownExpired: d('sfx', 10, 1, 1000),
  beacon: d('sfx', 3, 1, 250, true, 25),
  // boss
  bossSpawn: d('sfx', 9, 1, 1000, true, 20),
  bossTelegraph: d('sfx', 7, 2, 200, true, 20),
  bossCannon: d('sfx', 9, 2, 200, true, 20),
  bossSlam: d('sfx', 9, 2, 200, true, 20),
  bossMissile: d('sfx', 8, 3, 150, true, 20),
  bossEmp: d('sfx', 8, 2, 200, true, 20),
  weakPing: d('sfx', 6, 3, 60),
  weakCrunch: d('sfx', 8, 2, 150, true, 15),
  coreRiser: d('sfx', 8, 1, 500),
  bossDefeat: d('sfx', 10, 1, 1000, true, 25),
  // game flow
  defeatSting: d('sfx', 9, 1, 1000),
  victoryFanfare: d('sfx', 9, 1, 1000),
} satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUND_DEFS;

export const SOUND_IDS = Object.keys(SOUND_DEFS) as SoundId[];

export function soundDef(id: SoundId): SoundDef {
  return SOUND_DEFS[id];
}
