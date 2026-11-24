import type { Vector3 } from 'three';
import type {
  BossAttackId,
  BossPhase,
  DamageSource,
  DamageableKind,
  EnemyType,
  GameOverReason,
  GameStateId,
  HitZone,
  PickupKind,
  VfxKind,
} from './types';

/**
 * The complete, typed event catalogue. This is the main integration surface between modules:
 * producers `ctx.events.emit(name, payload)`, consumers `ctx.events.on(name, handler)`.
 *
 * Conventions:
 *  - `domain:pastTense` = something happened (fact). `domain:verb` (grant/spawn/show) = request.
 *  - Payload Vector3s are only valid during the callback; clone them if you keep them.
 *  - Adding an event: append to this file in your ticket's block. Never rename or remove an
 *    existing event without updating docs/PLAN.md.
 */
export interface GameEvents {
  // ---- core (foundation) ---------------------------------------------------------------
  'game:stateChanged': { from: GameStateId; to: GameStateId };
  /** Emitted once after every module finished init: static world colliders exist (nav may bake). */
  'world:ready': Record<string, never>;
  /** A swing gate started opening (`open`) or finished closing (spec 30). */
  'world:gateMoved': { id: string; position: Vector3; open: boolean };
  'game:over': { reason: GameOverReason };
  'game:victory': { timeRemaining: number };
  /** A checkpoint was stored (REVIEW #7: each activated tower + boss start). */
  'game:checkpoint': { id: string; position: Vector3; yaw: number };
  /** Player was put back at a checkpoint; modules restore what they own (ammo floor, enemy aggro...). */
  'game:respawn': { checkpointId: string; position: Vector3 };
  /** Requests from the UI (game-over / pause screens); handled by the flow module. */
  'game:requestRespawn': Record<string, never>;
  'game:requestRestart': Record<string, never>;
  'input:pointerLockChanged': { locked: boolean };
  'settings:changed': { key: string };

  // ---- player (T-01) -------------------------------------------------------------------
  'player:damaged': { amount: number; hp: number; maxHp: number; source: DamageSource; direction?: Vector3 };
  'player:healed': { amount: number; hp: number; maxHp: number };
  'player:died': { source: DamageSource };
  'player:landed': { impactSpeed: number };
  'player:footstep': { sprinting: boolean };

  // ---- weapon (T-02) -------------------------------------------------------------------
  'weapon:fired': { origin: Vector3; direction: Vector3; mag: number; reserve: number };
  'weapon:dryFire': Record<string, never>;
  'weapon:reloadStarted': { duration: number };
  'weapon:reloadFinished': { mag: number; reserve: number };
  'weapon:ammoChanged': { mag: number; reserve: number; magSize: number; name: string };
  /** Request: add rounds to the reserve (pickups). */
  'weapon:grantAmmo': { amount: number };
  /** A shot hit a damageable target. */
  'combat:hit': {
    targetId: string;
    targetKind: DamageableKind;
    zone: HitZone;
    dealt: number;
    killed: boolean;
    absorbed: boolean;
    point: Vector3;
    normal: Vector3;
  };
  /** A shot hit static geometry. */
  'combat:impact': { point: Vector3; normal: Vector3 };

  // ---- jump (replaces the grapple) ------------------------------------------------------
  /** `air` = the mid-air (second) jump; `airJumpsLeft` after this jump. */
  'player:jumped': { air: boolean; airJumpsLeft: number };

  // ---- enemies (T-05, T-13, T-14) ------------------------------------------------------
  'enemy:spawned': { id: string; type: EnemyType; position: Vector3 };
  'enemy:alerted': { id: string; type: EnemyType; position: Vector3 };
  'enemy:attacked': { id: string; type: EnemyType; position: Vector3 };
  /** The samurai let its sword-energy crescent go (spec 31). */
  'enemy:waveReleased': { id: string; position: Vector3 };
  'enemy:damaged': { id: string; type: EnemyType; hp: number; maxHp: number; zone: HitZone };
  'enemy:destroyed': { id: string; type: EnemyType; position: Vector3; remaining: number };
  'duck:windup': { id: string; position: Vector3; direction: Vector3; duration: number };
  'duck:hitPlayer': { id: string; position: Vector3 };

  // ---- objectives (T-08) ---------------------------------------------------------------
  /** Emitted once per tower from the objectives module's `world:ready` handler (HUD compass, audio). */
  'tower:registered': { towerId: number; position: Vector3; total: number };
  'tower:activationStarted': { towerId: number };
  'tower:activationProgress': { towerId: number; progress: number };
  'tower:activationCancelled': { towerId: number; reason: 'left-range' | 'released' | 'died' };
  'tower:activated': { towerId: number; activatedCount: number; total: number; position: Vector3 };
  /** Defend phase: existing robots of the zone are pulled to the tower (REVIEW #6). */
  'objectives:defendStarted': { towerId: number; position: Vector3; radius: number };
  'objectives:allActivated': { timeRemaining: number };
  /** 1 Hz while running. */
  'countdown:tick': { remaining: number; critical: boolean };
  'countdown:stopped': { remaining: number };
  'countdown:expired': Record<string, never>;
  /** HUD prompt such as "Hold E to activate"; null text hides it. */
  'interact:prompt': { text: string | null };

  // ---- pickups (T-09) ------------------------------------------------------------------
  'pickup:spawned': { id: string; kind: PickupKind; position: Vector3; dropped: boolean };
  'pickup:collected': { id: string; kind: PickupKind; amount: number; position: Vector3 };

  // ---- boss (T-15) ---------------------------------------------------------------------
  /** `coreHp` is the size of the single HP pool, `weakPoints` is 0 (the crab has none; fields kept for the contract). */
  'boss:spawned': { name: string; coreHp: number; weakPoints: number; position: Vector3 };
  'boss:phaseChanged': { phase: BossPhase };
  /** Legacy (never emitted by the crab). */
  'boss:weakPointDamaged': { index: number; hp: number; maxHp: number };
  'boss:weakPointDestroyed': { index: number; remaining: number; position: Vector3 };
  'boss:coreExposed': Record<string, never>;
  /** Fired for every hit on the boss's single HP pool (name kept from the TITAN-04 contract). */
  'boss:coreDamaged': { hp: number; maxHp: number };
  'boss:attackTelegraph': { attack: BossAttackId; position: Vector3; radius: number; duration: number };
  'boss:attack': { attack: BossAttackId; position: Vector3; radius: number };
  'boss:defeated': { position: Vector3 };
  /** A boss drone shot down by the player (spec 34): the pickups module drops ammo or health there. */
  'boss:droneDestroyed': { position: Vector3 };

  // ---- presentation requests (T-10 vfx, T-06 ui) ---------------------------------------
  'vfx:spawn': { kind: VfxKind; position: Vector3; normal?: Vector3; scale?: number; duration?: number };
  'ui:toast': { text: string; seconds?: number };
}

