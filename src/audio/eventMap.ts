import type { GameEvents } from '@/core/events';
import type { BossAttackId } from '@/core/types';
import type { SoundId } from './catalogue';
import { AUDIO } from './tunables';

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** A request to play one catalogue sound. `position` is only read synchronously. */
export interface SoundRequest {
  id: SoundId;
  position?: Vec3Like;
  intensity?: number;
  /** Seconds; sounds that follow a telegraph (duck wind-up, reload) use it. */
  duration?: number;
  variant?: number;
}

type Route<K extends keyof GameEvents> = (e: GameEvents[K]) => SoundRequest | SoundRequest[] | null;

const BOSS_ATTACK_ORDER: readonly BossAttackId[] = [
  'heavy-cannon',
  'ground-slam',
  'missile-barrage',
  'shockwave',
  'target-lock',
  'emp-pulse',
  'carpet-bombs',
  'drone-release',
  'body-spin',
  'quad-laser',
];

function attackVariant(attack: BossAttackId): number {
  return Math.max(0, BOSS_ATTACK_ORDER.indexOf(attack));
}

const ENEMY_VARIANT = { army: 0, spot: 1, duck: 2, samurai: 0 } as const;

/** Event -> sound routing. Stateful sounds (tower hum, beacon, ambience) live in the module. */
export const EVENT_ROUTES = {
  // player
  'weapon:fired': () => ({ id: 'rifleShot' }),
  'weapon:dryFire': () => ({ id: 'dryClick' }),
  'weapon:reloadStarted': (e) => ({ id: 'reload', duration: e.duration }),
  'player:footstep': (e) => ({ id: e.sprinting ? 'footstepSprint' : 'footstepWalk' }),
  'player:landed': (e) => ({ id: 'land', intensity: Math.min(1.5, e.impactSpeed / 8) }),
  'player:damaged': () => ({ id: 'hurt' }),
  'player:died': () => ({ id: 'death' }),
  'player:jumped': (e) => ({ id: e.air ? 'airJump' : 'jump' }),
  'pickup:collected': (e) => ({ id: e.kind === 'medkit' ? 'pickupMedkit' : 'pickupAmmo' }),
  'combat:hit': (e) => {
    const armored = e.absorbed || e.zone === 'armor';
    const out: SoundRequest[] = [{ id: 'hitMarker', intensity: e.zone === 'critical' || e.zone === 'weakpoint' || e.zone === 'core' ? 1.4 : 1 }];
    if (armored) out.push({ id: 'hitArmor', position: e.point });
    return out;
  },
  'combat:impact': (e) => ({ id: 'impact', position: e.point }),
  // enemies
  'enemy:alerted': (e) => ({ id: 'enemyAlert', position: e.position, variant: ENEMY_VARIANT[e.type] }),
  'enemy:attacked': (e) => (e.type === 'duck' ? null : { id: 'enemyShot', position: e.position }),
  'enemy:destroyed': (e) => ({ id: 'enemyDestroyed', position: e.position }),
  'duck:windup': (e) => ({ id: 'duckWindup', position: e.position, duration: e.duration }),
  'duck:beep': (e) => ({ id: 'beep', position: e.position }),
  'duck:hitPlayer': (e) => ({ id: 'duckHit', position: e.position }),
  // objective
  'tower:activationCancelled': () => ({ id: 'towerCancel' }),
  'tower:activated': (e) => ({ id: 'towerActivated', position: e.position }),
  'countdown:tick': (e) => {
    if (e.remaining <= 0) return null;
    if (e.remaining <= AUDIO.finalBeepSeconds) {
      return e.critical ? [{ id: 'beep' }, { id: 'alarm' }] : { id: 'beep' };
    }
    return e.critical ? { id: 'alarm' } : null;
  },
  'countdown:expired': () => ({ id: 'countdownExpired' }),
  // boss
  'boss:spawned': (e) => ({ id: 'bossSpawn', position: e.position }),
  'boss:attackTelegraph': (e) => ({
    id: 'bossTelegraph',
    position: e.position,
    duration: e.duration,
    variant: attackVariant(e.attack),
  }),
  'boss:attack': (e) => {
    const variant = attackVariant(e.attack);
    switch (e.attack) {
      case 'heavy-cannon':
        return { id: 'bossCannon', position: e.position, variant };
      case 'ground-slam':
        return { id: 'bossSlam', position: e.position, variant };
      case 'shockwave':
        return { id: 'bossSlam', position: e.position, intensity: 1.3, variant };
      case 'missile-barrage':
        return { id: 'bossMissile', position: e.position, variant };
      case 'emp-pulse':
        return { id: 'bossEmp', position: e.position, variant };
      case 'carpet-bombs':
        return { id: 'bossMissile', position: e.position, variant };
      case 'drone-release':
      case 'quad-laser':
        return { id: 'bossEmp', position: e.position, variant };
      case 'body-spin':
        return { id: 'bossSlam', position: e.position, intensity: 1.2, variant };
      case 'target-lock':
        return null; // the telegraph already carries the lock beeps
    }
  },
  'boss:weakPointDamaged': (e) => ({ id: 'weakPing', intensity: 1 + (1 - e.hp / Math.max(1, e.maxHp)) * 0.5 }),
  'boss:weakPointDestroyed': (e) => ({ id: 'weakCrunch', position: e.position }),
  'boss:coreExposed': () => ({ id: 'coreRiser' }),
  'boss:defeated': (e) => ({ id: 'bossDefeat', position: e.position }),
  // flow
  'game:over': () => ({ id: 'defeatSting' }),
  'game:victory': () => ({ id: 'victoryFanfare' }),
} satisfies { [K in keyof GameEvents]?: Route<K> };

export type RoutedEvent = keyof typeof EVENT_ROUTES;

export const ROUTED_EVENTS = Object.keys(EVENT_ROUTES) as RoutedEvent[];
