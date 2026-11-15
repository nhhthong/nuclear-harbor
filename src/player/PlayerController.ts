import { Vector3 } from 'three';
import type { Camera } from 'three';
import { PLAYER } from '@/config/tunables';
import type { EventBus } from '@/core/EventBus';
import type { GameEvents } from '@/core/events';
import type { InputManager } from '@/core/InputManager';
import type { PlayerState } from '@/core/PlayerState';
import { Groups } from '@/physics/groups';
import type { CharacterBody, PhysicsWorld } from '@/physics/PhysicsWorld';
import { approachHorizontal, canSprint, clampPitch, desiredVelocity } from './movement';
import { PLAYER_LOCAL } from './tunables';

export interface PlayerControllerDeps {
  physics: PhysicsWorld;
  player: PlayerState;
  input: Pick<InputManager, 'getMoveAxis' | 'isDown' | 'wasPressed' | 'consumeLookDelta'>;
  events: EventBus<GameEvents>;
  camera: Camera;
  getSensitivity: () => number;
}

/**
 * First-person controller on a Rapier kinematic capsule (GDD 4, 4.2) with jump and one air jump.
 * Sole writer of movement state.
 */
export class PlayerController {
  private readonly character: CharacterBody;
  private readonly prev = new Vector3();
  private readonly cur = new Vector3();
  private readonly moved = new Vector3();
  private readonly eye = new Vector3();
  private readonly vel2 = { x: 0, z: 0 };
  private readonly target2 = { x: 0, z: 0 };
  private readonly intent = new Vector3();
  private wasGrounded = false;
  private stepDistance = 0;
  /** Seconds a jump press stays queued (set in update(), where input edges are valid). */
  private jumpBuffer = 0;
  /** Seconds left in which a ground jump is still allowed after leaving the ground. */
  private coyote = 0;
  private airJumpsLeft = 0;

  constructor(private readonly deps: PlayerControllerDeps) {
    const { physics, player } = deps;
    this.character = physics.createCharacter({
      position: player.position,
      radius: PLAYER.capsuleRadius,
      halfHeight: PLAYER.capsuleHalfHeight,
      groups: Groups.player,
      offset: PLAYER.kccOffset,
      maxStepHeight: PLAYER.maxStepHeight,
      minStepWidth: PLAYER.minStepWidth,
      maxSlopeDeg: PLAYER.maxSlopeDeg,
      snapToGround: PLAYER.snapToGround,
      meta: { kind: 'player', damageable: player },
    });
    this.prev.copy(player.position);
    this.cur.copy(player.position);
    physics.syncQueries();
  }

  fixedUpdate(dt: number): void {
    const { player, input, events } = this.deps;
    const character = this.character;

    if (player.teleportPending) {
      character.setPosition(player.position);
      player.teleportPending = false;
      this.prev.copy(player.position);
      this.cur.copy(player.position);
      this.wasGrounded = false;
      this.stepDistance = 0;
      this.intent.set(0, 0, 0);
      this.jumpBuffer = 0;
      this.coyote = 0;
    }
    this.prev.copy(this.cur);

    // `intent` is the unblocked simulation velocity; `player.velocity` reports the real motion.
    const vel = this.intent;
    if (player.pendingImpulse.lengthSq() > 0) {
      vel.add(player.pendingImpulse);
      player.pendingImpulse.set(0, 0, 0);
    }

    const external = player.externalVelocity;
    const canControl = player.alive && !player.controlsLocked;
    const axis = canControl ? input.getMoveAxis() : { x: 0, y: 0 };

    if (external) {
      vel.copy(external);
      player.sprinting = false;
    } else {
      player.sprinting = canControl && canSprint(this.wasGrounded, axis.y, input.isDown('sprint'), player.sprinting);
      const speed = player.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      desiredVelocity(axis.x, axis.y, player.yaw, speed, this.target2);
      this.vel2.x = vel.x;
      this.vel2.z = vel.z;
      const control = this.wasGrounded ? 1 : PLAYER.airControl;
      approachHorizontal(this.vel2, this.target2, PLAYER.groundAccel, PLAYER.groundDecel, dt, control);
      vel.x = this.vel2.x;
      vel.z = this.vel2.z;
      // ---- jump / double jump ----
      // still "grounded" for a few ticks after take-off (snap distance): rising must not re-arm the jumps
      if (this.wasGrounded && vel.y <= 0) {
        this.coyote = PLAYER.coyoteTime;
        this.airJumpsLeft = PLAYER.airJumps;
      } else if (this.coyote > 0) {
        this.coyote = Math.max(0, this.coyote - dt);
      }
      let jumped = false;
      if (this.jumpBuffer > 0 && canControl) {
        if (this.coyote > 0) {
          vel.y = PLAYER.jumpSpeed;
          this.coyote = 0;
          this.jumpBuffer = 0;
          jumped = true;
          events.emit('player:jumped', { air: false, airJumpsLeft: this.airJumpsLeft });
        } else if (this.airJumpsLeft > 0) {
          vel.y = PLAYER.airJumpSpeed;
          this.airJumpsLeft--;
          this.jumpBuffer = 0;
          jumped = true;
          events.emit('player:jumped', { air: true, airJumpsLeft: this.airJumpsLeft });
        }
      }
      if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

      if (jumped) {
        // keep the take-off speed this step
      } else if (this.wasGrounded && vel.y <= 0) vel.y = -PLAYER_LOCAL.groundedStickSpeed;
      else vel.y += PLAYER.gravity * dt;
    }
    const applyVy = vel.y;

    character.move({ x: vel.x * dt, y: applyVy * dt, z: vel.z * dt }, this.moved);
    character.getPosition(this.cur);
    player.position.copy(this.cur);
    player.grounded = character.grounded;

    // Report the real displacement so blocked movement reads as zero speed.
    const inv = 1 / dt;
    player.velocity.set(this.moved.x * inv, this.moved.y * inv, this.moved.z * inv);
    if (external) {
      vel.copy(player.velocity);
    } else if (character.grounded && applyVy <= 0) {
      vel.y = 0;
      player.velocity.y = 0;
    } else if (applyVy > 0 && this.moved.y < applyVy * dt * 0.5) {
      vel.y = 0; // ceiling
    }

    if (!this.wasGrounded && character.grounded) {
      const impactSpeed = Math.max(0, -applyVy);
      if (impactSpeed >= PLAYER_LOCAL.landedMinSpeed) events.emit('player:landed', { impactSpeed });
      this.stepDistance = 0;
    }
    this.wasGrounded = character.grounded;

    if (character.grounded && !external) {
      const horizontal = Math.hypot(this.moved.x, this.moved.z);
      if (horizontal * inv >= PLAYER_LOCAL.footstepMinSpeed) {
        this.stepDistance += horizontal;
        const stride = player.sprinting ? PLAYER_LOCAL.footstepDistanceSprint : PLAYER_LOCAL.footstepDistanceWalk;
        if (this.stepDistance >= stride) {
          this.stepDistance -= stride;
          events.emit('player:footstep', { sprinting: player.sprinting });
        }
      }
    }

    if (player.position.y < PLAYER.killPlaneY && player.alive) {
      player.invulnerableFor = 0;
      player.applyDamage({ amount: player.hp, zone: 'body', source: 'environment' });
    }

    if (player.invulnerableFor > 0) player.invulnerableFor = Math.max(0, player.invulnerableFor - dt);
  }

  update(_dt: number, alpha: number): void {
    const { player, input } = this.deps;
    const look = input.consumeLookDelta();
    if (player.alive && !player.controlsLocked && input.wasPressed('jump')) this.jumpBuffer = PLAYER.jumpBufferTime;
    if (player.alive && !player.controlsLocked) {
      const s = PLAYER.lookRadPerPixel * this.deps.getSensitivity();
      player.yaw -= look.x * s;
      player.pitch = clampPitch(player.pitch - look.y * s, PLAYER.maxPitchDeg);
    } else {
      player.pitch = clampPitch(player.pitch, PLAYER.maxPitchDeg);
    }
    this.poseCamera(alpha);
  }

  poseCamera(alpha: number): void {
    const { player, camera } = this.deps;
    const a = Math.max(0, Math.min(1, alpha));
    this.eye.lerpVectors(this.prev, this.cur, a);
    camera.position.set(this.eye.x, this.eye.y + player.eyeHeight, this.eye.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }

  dispose(): void {
    this.character.dispose();
  }
}
