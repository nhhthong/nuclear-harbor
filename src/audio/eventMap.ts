import type { GameEvents } from '@/core/events';
import type { BossAttackId } from '@/core/types';
import type { SoundId } from './catalogue';
import { footstepSurface, impactMaterial } from './rules';
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
  /** Seconds after now (reload parts, shell casing). */
  delay?: number;
}

/** Read-only game state some routes need (spec 32: footstep surface). */
export interface RouteEnv {
  /** Player feet position. */
  player?: Vec3Like;
}

type Route<K extends keyof GameEvents> = (e: GameEvents[K], env?: RouteEnv) => SoundRequest | SoundRequest[] | null;

const BOSS_ATTACK_ORDER: readonly BossAttackId[] = [
  'heavy-cannon',
  'ground-slam',
  'missile-barrage',
  'shockwave',
  'target-lock',
  'emp-pulse',
  'carpet-bombs',
  'drone-release',
  'quad-laser',
  'claw-grab',
  'claw-quake',
];

function attackVariant(attack: BossAttackId): number {
  return Math.max(0, BOSS_ATTACK_ORDER.indexOf(attack));
}

const ENEMY_VARIANT = { army: 0, spot: 1, duck: 2, biped: 1, samurai: 0, drone: 2 } as const;

/** Reload in three recorded parts timed against the reload duration (spec 32). */
export function reloadParts(duration: number): SoundRequest[] {
  const d = duration > 0 ? duration : 1.6;
  const r = AUDIO.reload;
  const magIn = Math.max(r.magOutAt + 0.25, d - r.magInBeforeEnd);
  const bolt = Math.max(magIn + 0.2, d - r.boltBeforeEnd);
  return [
    { id: 'reloadMagOut', delay: r.magOutAt },
    { id: 'reloadMagIn', delay: magIn },
    { id: 'reloadBolt', delay: bolt },
  ];
}

/** Event -> sound routing. Stateful sounds (tower hum, beacon, ambience) live in the module. */
export const EVENT_ROUTES = {
  // player
  'weapon:fired': () => [{ id: 'rifleShot' }, { id: 'shellCasing', delay: AUDIO.casingDelay }],
  'weapon:dryFire': () => ({ id: 'dryClick' }),
  'weapon:reloadStarted': (e) => reloadParts(e.duration),
  'player:footstep': (e, env?: RouteEnv) => {
    if (env?.player && footstepSurface(env.player) === 'metal') return { id: 'footstepMetal', intensity: e.sprinting ? 1.25 : 1 };
    return { id: e.sprinting ? 'footstepSprint' : 'footstepWalk' };
  },
  'player:landed': (e) => ({ id: 'land', intensity: Math.min(1.5, e.impactSpeed / 8) }),
  'player:damaged': () => ({ id: 'hurt' }),
  'player:died': () => ({ id: 'death' }),
  'player:jumped': (e) => ({ id: e.air ? 'airJump' : 'jump' }),
  'world:gateMoved': (e) => ({ id: 'gate', position: e.position, intensity: e.open ? 1 : 0.8 }),
  'pickup:collected': (e) => ({ id: e.kind === 'medkit' ? 'pickupMedkit' : 'pickupAmmo' }),
  'combat:hit': (e) => {
    const armored = e.absorbed || e.zone === 'armor';
    const out: SoundRequest[] = [{ id: 'hitMarker', intensity: e.zone === 'critical' || e.zone === 'weakpoint' || e.zone === 'core' ? 1.4 : 1 }];
    if (armored) out.push({ id: 'hitArmor', position: e.point });
    else if (e.targetKind === 'enemy' || e.targetKind === 'boss') out.push({ id: 'impactMetal', position: e.point, intensity: 0.5 });
    return out;
  },
  'combat:impact': (e) => ({ id: impactMaterial(e.point, e.normal) === 'concrete' ? 'impactConcrete' : 'impactMetal', position: e.point }),
  // enemies
  'enemy:alerted': (e) => {
    const alert: SoundRequest = { id: 'enemyAlert', position: e.position, variant: ENEMY_VARIANT[e.type] };
    return e.type === 'drone' ? [alert, { id: 'droneBuzz', position: e.position }] : alert;
  },
  'enemy:attacked': (e) => {
    switch (e.type) {
      case 'duck':
        return null;
      case 'spot':
      case 'biped':
        return { id: 'enemyMelee', position: e.position };
      case 'samurai':
        return { id: 'swordSwing', position: e.position };
      default:
        return { id: 'enemyShot', position: e.position };
    }
  },
  'enemy:waveReleased': (e) => ({ id: 'energyWave', position: e.position }),
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
  'boss:attackTelegraph': (e) => {
    const tel: SoundRequest = { id: 'bossTelegraph', position: e.position, duration: e.duration, variant: attackVariant(e.attack) };
    return e.attack === 'quad-laser' ? [tel, { id: 'laserCharge', position: e.position, duration: e.duration }] : tel;
  },
  'boss:attack': (e) => {
    const variant = attackVariant(e.attack);
    switch (e.attack) {
      case 'heavy-cannon':
        return { id: 'bossCannon', position: e.position, variant };
      case 'ground-slam':
        return { id: 'bossSlam', position: e.position, variant };
      case 'shockwave':
        return [{ id: 'bossSlam', position: e.position, intensity: 1.3, variant }];
      case 'missile-barrage':
        return { id: 'bossMissile', position: e.position, variant };
      case 'emp-pulse':
        return { id: 'bossEmp', position: e.position, variant };
      case 'carpet-bombs':
        return { id: 'bossMissile', position: e.position, variant };
      case 'drone-release':
      case 'quad-laser':
        return { id: 'bossEmp', position: e.position, variant };
      case 'claw-grab':
        return { id: 'bossSlam', position: e.position, intensity: 1.5, variant };
      case 'claw-quake':
        return { id: 'bossSlam', position: e.position, intensity: 1.2, variant };
      case 'target-lock':
        return null; // the telegraph already carries the lock beeps
    }
  },
  'boss:weakPointDamaged': (e) => ({ id: 'weakPing', intensity: 1 + (1 - e.hp / Math.max(1, e.maxHp)) * 0.5 }),
  'boss:weakPointDestroyed': (e) => ({ id: 'weakCrunch', position: e.position }),
  'boss:coreExposed': () => ({ id: 'coreRiser' }),
  'boss:defeated': (e) => ({ id: 'bossDefeat', position: e.position }),
  // scorpion (STINGER-7 keeps its own synth roar/stomp; the steam hiss marks each telegraph)
  'scorpion:telegraph': (e) => ({ id: 'steamHiss', position: e.position }),
  // flow
  'game:over': () => ({ id: 'defeatSting' }),
  'game:victory': () => ({ id: 'victoryFanfare' }),
} satisfies { [K in keyof GameEvents]?: Route<K> };

export type RoutedEvent = keyof typeof EVENT_ROUTES;

export const ROUTED_EVENTS = Object.keys(EVENT_ROUTES) as RoutedEvent[];
