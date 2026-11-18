import type { Vector3 } from 'three';

/**
 * Shared gameplay contracts. Every module talks to the others through these types, the EventBus
 * (src/core/events.ts) and the registries on GameContext. Do not import another feature module's
 * internals.
 */

export type EnemyType = 'army' | 'spot' | 'duck' | 'samurai';
export type DamageSource = 'player' | 'enemy' | 'boss' | 'environment';
export type DamageableKind = 'player' | 'enemy' | 'boss' | 'prop';

/**
 * Which part of a target a hit landed on. The collider that was hit carries the zone in its
 * ColliderMeta; a target may override it in applyDamage (e.g. the boss decides front/rear
 * from the hit direction).
 *  - body:      normal damage (x1)
 *  - critical:  crit spot, x WEAPON.criticalMultiplier (robot sensors, head)
 *  - armor:     heavily reduced or immune (boss hull)
 *  - weakpoint: boss red light
 *  - core:      boss core (only damageable once exposed)
 */
export type HitZone = 'body' | 'critical' | 'armor' | 'weakpoint' | 'core';

export interface DamageInfo {
  /** Base damage before zone multipliers. */
  amount: number;
  zone: HitZone;
  source: DamageSource;
  /** World-space hit point, if any. */
  point?: Vector3;
  /** Normalised travel direction of the attack (from attacker towards target). */
  direction?: Vector3;
}

export interface DamageResult {
  /** Damage actually removed from HP after multipliers. */
  dealt: number;
  /** Zone that was finally used (may differ from DamageInfo.zone). */
  zone: HitZone;
  /** True if this hit destroyed the target. */
  killed: boolean;
  /** True if the hit was fully absorbed (immune armour, unexposed core). */
  absorbed: boolean;
}

export interface Damageable {
  readonly id: string;
  readonly kind: DamageableKind;
  readonly alive: boolean;
  applyDamage(info: DamageInfo): DamageResult;
}

/** Simulation level of an enemy (GDD 13.2, reduced set because streaming is optional). */
export type SimLevel = 'active' | 'simplified' | 'dormant';

export interface Enemy extends Damageable {
  readonly kind: 'enemy';
  readonly type: EnemyType;
  /** World position of the enemy's centre; owned and mutated by the enemy itself. */
  readonly position: Vector3;
  /** Current FSM state name, for debug/HUD/tests (e.g. 'patrol', 'chase', 'windup'). */
  readonly state: string;
  readonly hp: number;
  readonly maxHp: number;
  simLevel: SimLevel;
  /**
   * Order the enemy to converge on a position (used by the tower defend phase, REVIEW #6).
   * Enemies in uninterruptible states (Duck wind-up countdown) may defer it.
   */
  commandMoveTo(target: Vector3): void;
}

export type GrappleAnchorKind = 'crane' | 'beam' | 'container-top' | 'lamp-post' | 'perch' | 'manual';

/**
 * A registered grapple target (GDD 4.1, 7.4). The grapple raycast itself runs against physics
 * colliders flagged `grappleable`; anchors are the designer-facing registry used for the coverage
 * debug tool, HUD hints and for "perch" landings.
 */
export interface GrappleAnchor {
  readonly id: string;
  readonly kind: GrappleAnchorKind;
  /** Point the cable attaches to. */
  readonly position: Vector3;
  /**
   * Optional point where the player should end up standing (top of a platform). When present the
   * grapple pulls towards `position` and, on arrival, the player is guaranteed to be able to step
   * onto `landing` (anchor is placed above/inside the platform edge).
   */
  readonly landing?: Vector3;
  /** Zone id for coverage statistics. */
  readonly zone?: string;
}

/** What a physics collider represents; attached through PhysicsWorld.setMeta. */
export interface ColliderMeta {
  kind: 'static' | 'player' | 'enemy' | 'boss' | 'pickup' | 'trigger' | 'prop';
  /** Valid grapple surface (GDD 4.1). */
  grappleable?: boolean;
  /** Target that receives damage when this collider is shot. */
  damageable?: Damageable;
  /** Hit zone of this collider on its damageable. Defaults to 'body'. */
  hitZone?: HitZone;
  /** Grapple anchor this collider belongs to, if any. */
  anchorId?: string;
  /** Free-form back reference for the owning module. */
  owner?: unknown;
}

export type GameStateId = 'loading' | 'menu' | 'playing' | 'paused' | 'gameOver' | 'victory';
export type GameOverReason = 'player-died' | 'countdown-expired';
export type PickupKind = 'ammo' | 'medkit';
/** Boss fight phases (spec 27): the crab has one HP pool, so there is a single `fight` phase. */
export type BossPhase = 'dormant' | 'awakening' | 'fight' | 'destroyed';
export type BossAttackId =
  | 'heavy-cannon'
  | 'ground-slam'
  | 'missile-barrage'
  | 'shockwave'
  | 'target-lock'
  | 'emp-pulse'
  /** Gunslinger Crab Mech skills (spec 27). */
  | 'carpet-bombs'
  | 'drone-release'
  | 'body-spin'
  | 'quad-laser';
export type VfxKind = 'spark' | 'armor-spark' | 'explosion' | 'big-explosion' | 'smoke' | 'dust' | 'pickup' | 'telegraph-ring';
