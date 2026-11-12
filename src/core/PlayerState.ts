import { Vector3 } from 'three';
import { PLAYER } from '@/config/tunables';
import type { EventBus } from './EventBus';
import type { GameEvents } from './events';
import type { DamageInfo, DamageResult, Damageable } from './types';

/**
 * Shared, authoritative player data. Lives on GameContext (`ctx.player`) from the first frame so
 * that every module can be developed without the real controller:
 *
 *  - the player module (T-01) moves `position` / `velocity` with the Rapier character controller,
 *    applies mouse look to `yaw` / `pitch` and syncs the camera;
 *  - the grapple (T-12) drives movement by setting `externalVelocity`;
 *  - enemies / boss call `applyDamage()` and `addImpulse()` (knockback);
 *  - pickups call `heal()`;
 *  - the weapon reads `getEyePosition()` / `getLookDirection()` and may add recoil to `pitch`/`yaw`.
 *
 * Conventions: `position` is the FEET position. yaw = 0 looks along -Z, positive yaw turns left
 * (counter-clockwise seen from above); pitch > 0 looks up. Camera rotation order is 'YXZ'.
 */
export class PlayerState implements Damageable {
  readonly id = 'player';
  readonly kind = 'player' as const;

  readonly position = new Vector3();
  readonly velocity = new Vector3();
  yaw = 0;
  pitch = 0;
  eyeHeight: number = PLAYER.eyeHeight;
  grounded = false;
  sprinting = false;

  maxHp: number = PLAYER.maxHp;
  hp: number = PLAYER.maxHp;
  /** Seconds of remaining invulnerability (respawn protection); the controller counts it down. */
  invulnerableFor = 0;
  /** Scales incoming damage (1 = normal). The objectives module lowers it while a tower is being activated. */
  damageTakenMultiplier = 1;

  /**
   * When non-null the controller moves the capsule with exactly this velocity (still colliding
   * with the world) and ignores input and gravity. Set by the grapple, cleared on release.
   */
  externalVelocity: Vector3 | null = null;
  /** Accumulated knockback (m/s) to be added to velocity by the controller, then zeroed. */
  readonly pendingImpulse = new Vector3();
  /** Set by teleport(); the controller must move the physics body to `position` and clear it. */
  teleportPending = false;
  /** Modules may set this to freeze input-driven movement and look (cinematics, menus). */
  controlsLocked = false;

  constructor(private readonly events: EventBus<GameEvents>) {}

  get alive(): boolean {
    return this.hp > 0;
  }

  getEyePosition(out: Vector3): Vector3 {
    return out.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
  }

  /** Normalised view direction including pitch. */
  getLookDirection(out: Vector3): Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  /** Normalised horizontal facing direction (ignores pitch). */
  getForward(out: Vector3): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  getRight(out: Vector3): Vector3 {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  applyDamage(info: DamageInfo): DamageResult {
    if (!this.alive || this.invulnerableFor > 0 || info.amount <= 0) {
      return { dealt: 0, zone: 'body', killed: false, absorbed: true };
    }
    const dealt = Math.min(this.hp, info.amount * this.damageTakenMultiplier);
    this.hp -= dealt;
    this.events.emit('player:damaged', {
      amount: dealt,
      hp: this.hp,
      maxHp: this.maxHp,
      source: info.source,
      direction: info.direction,
    });
    const killed = this.hp <= 0;
    if (killed) this.events.emit('player:died', { source: info.source });
    return { dealt, zone: 'body', killed, absorbed: false };
  }

  /** Returns the HP actually restored (0 when already full or dead). */
  heal(amount: number): number {
    if (!this.alive || amount <= 0) return 0;
    const restored = Math.min(this.maxHp - this.hp, amount);
    if (restored <= 0) return 0;
    this.hp += restored;
    this.events.emit('player:healed', { amount: restored, hp: this.hp, maxHp: this.maxHp });
    return restored;
  }

  /** Knockback: velocity change applied by the controller on its next fixed step. */
  addImpulse(impulse: Vector3): void {
    this.pendingImpulse.add(impulse);
  }

  teleport(position: { x: number; y: number; z: number }, yaw?: number): void {
    this.position.set(position.x, position.y, position.z);
    this.velocity.set(0, 0, 0);
    this.pendingImpulse.set(0, 0, 0);
    this.externalVelocity = null;
    if (yaw !== undefined) {
      this.yaw = yaw;
      this.pitch = 0;
    }
    this.teleportPending = true;
  }

  /** Full restore used by respawn / restart. Does not emit player:healed. */
  revive(position: { x: number; y: number; z: number }, yaw = 0): void {
    this.hp = this.maxHp;
    this.invulnerableFor = PLAYER.respawnInvulnerability;
    this.controlsLocked = false;
    this.teleport(position, yaw);
  }
}
