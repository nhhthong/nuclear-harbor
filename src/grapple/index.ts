import { Vector3 } from 'three';
import { GRAPPLE } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { GrappleAnchor } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { bestInCone } from './aim';
import { GrappleState, type GrappleConfig, type GrappleEvent, type RayResult, type StepOutput } from './GrappleState';
import { GRAPPLE_LOCAL } from './tunables';
import { GrappleVisuals } from './visuals';

/**
 * Grappling hook (GDD 4.1, T-12). Space fires along the view; the pure GrappleState decides the
 * outcome and this module applies it: ray targeting (with a small aim assist), the pull via
 * `player.externalVelocity`, events, hook/cable visuals and the crosshair indicator.
 */
export function createGrappleModule(): GameModule {
  let ctx: GameContext;
  let state: GrappleState;
  let visuals: GrappleVisuals | null = null;
  const offs: Array<() => void> = [];

  const config: { -readonly [K in keyof GrappleConfig]: GrappleConfig[K] } = {
    maxRange: GRAPPLE.maxRange,
    cooldown: GRAPPLE.cooldown,
    failureCooldown: GRAPPLE_LOCAL.failureCooldown,
    releaseDistance: GRAPPLE.releaseDistance,
    maxPullDuration: GRAPPLE.maxPullDuration,
    stuckDistance: GRAPPLE.stuckDistance,
    stuckWindow: GRAPPLE.stuckWindow,
    hookTravelSpeed: GRAPPLE.hookTravelSpeed,
    maxAttachDelay: GRAPPLE_LOCAL.maxAttachDelay,
    aimLift: 0,
    wallInset: GRAPPLE_LOCAL.wallInset,
    cooldownEventInterval: GRAPPLE_LOCAL.cooldownEventInterval,
  };

  // scratch objects: nothing below allocates per tick while pulling
  const eye = new Vector3();
  const look = new Vector3();
  const pull = new Vector3();
  const lastPos = new Vector3();
  const impulse = new Vector3();
  const sight = new Vector3();
  const ray: RayResult = { hit: false, grappleable: false, distance: 0, point: { x: 0, y: 0, z: 0 } };
  const coneRad = (GRAPPLE_LOCAL.aimAssistConeDeg * Math.PI) / 180;

  let firePending = false;
  let wasPlaying = false;
  let frame = 0;
  let lastTarget: { x: number; y: number; z: number; anchorId?: string } | null = null;

  const playing = (): boolean => ctx.state.current === 'playing';

  function setRay(
    hit: boolean,
    grappleable: boolean,
    distance: number,
    p: { x: number; y: number; z: number },
    nx = 0,
    nz = 0,
  ): RayResult {
    ray.hit = hit;
    ray.grappleable = grappleable;
    ray.distance = distance;
    ray.point.x = p.x;
    ray.point.y = p.y;
    ray.point.z = p.z;
    ray.nx = nx;
    ray.nz = nz;
    ray.anchorId = undefined;
    ray.landing = undefined;
    return ray;
  }

  function useAnchor(anchor: GrappleAnchor): void {
    ray.anchorId = anchor.id;
    ray.landing = anchor.landing;
    ray.point.x = anchor.position.x;
    ray.point.y = anchor.position.y;
    ray.point.z = anchor.position.z;
  }

  /** One ray against the static world; aim assist if the centre ray gives no valid target. */
  function resolveTarget(): RayResult {
    ctx.player.getEyePosition(eye);
    ctx.player.getLookDirection(look);
    const hit = ctx.physics.raycast(eye, look, GRAPPLE.maxRange, { groups: QueryGroups.grapple });
    if (hit && hit.meta.grappleable) {
      setRay(true, true, hit.distance, hit.point, hit.normal.x, hit.normal.z);
      const anchor =
        (hit.meta.anchorId !== undefined ? ctx.grappleAnchors.get(hit.meta.anchorId) : undefined) ??
        ctx.grappleAnchors.nearest(hit.point, GRAPPLE_LOCAL.anchorSnapRadius);
      if (anchor) useAnchor(anchor);
      return ray;
    }

    const candidates = ctx.grappleAnchors
      .inRange(eye, GRAPPLE.maxRange)
      .filter((a) => bestInCone(eye, look, [a], coneRad) !== null);
    while (candidates.length > 0) {
      const best = bestInCone(eye, look, candidates, coneRad);
      if (!best) break;
      const d = best.position.distanceTo(eye);
      sight.copy(best.position).sub(eye).normalize();
      const block = ctx.physics.raycast(eye, sight, d, { groups: QueryGroups.grapple });
      if (!block || block.distance >= d - GRAPPLE_LOCAL.anchorSightTolerance) {
        setRay(true, true, d, best.position);
        useAnchor(best);
        return ray;
      }
      candidates.splice(candidates.indexOf(best), 1);
    }

    if (hit) return setRay(true, false, hit.distance, hit.point, hit.normal.x, hit.normal.z);
    return setRay(false, false, 0, eye);
  }

  function clearPull(): void {
    ctx.player.externalVelocity = null;
  }

  function emit(e: GrappleEvent): void {
    switch (e.type) {
      case 'fired':
        ctx.events.emit('grapple:fired', { origin: eye.clone(), direction: look.clone() });
        break;
      case 'attached': {
        const point = new Vector3(state.target.x, state.target.y, state.target.z);
        const payload: { point: Vector3; distance: number; anchorId?: string } = { point, distance: e.distance };
        if (e.anchorId !== undefined) payload.anchorId = e.anchorId;
        ctx.events.emit('grapple:attached', payload);
        break;
      }
      case 'released':
        ctx.events.emit('grapple:released', { reason: e.reason });
        break;
      case 'failed':
        ctx.events.emit('grapple:failed', { reason: e.reason });
        break;
      case 'cooldown':
        ctx.events.emit('grapple:cooldown', { remaining: e.remaining, total: e.total });
        break;
    }
  }

  function canPlaceOn(landing: { x: number; y: number; z: number }): boolean {
    const p = ctx.player.position;
    if (Math.hypot(landing.x - p.x, landing.y - p.y, landing.z - p.z) > GRAPPLE_LOCAL.perchTeleportMax) return false;
    ctx.player.getEyePosition(eye);
    sight.set(landing.x, landing.y + ctx.player.eyeHeight, landing.z);
    return ctx.physics.hasLineOfSight(eye, sight);
  }

  function apply(out: StepOutput): void {
    for (const e of out.events) {
      if (e.type === 'attached') {
        lastTarget = { x: state.target.x, y: state.target.y, z: state.target.z };
        if (state.anchorId !== undefined) lastTarget.anchorId = state.anchorId;
        visuals?.show(state.target);
      }
      emit(e);
      if (e.type === 'released') {
        visuals?.hide();
        lastTarget = null;
        if (e.reason !== 'death') {
          if (out.landing && canPlaceOn(out.landing)) {
            clearPull();
            ctx.player.teleport(out.landing);
          } else {
            clearPull();
            // the controller keeps the last real velocity: remove everything but releaseMomentum
            impulse.copy(ctx.player.velocity).multiplyScalar(-(1 - GRAPPLE.releaseMomentum));
            ctx.player.addImpulse(impulse);
          }
        }
      }
    }
    if (out.pulling) {
      pull.set(out.dirX, out.dirY, out.dirZ).multiplyScalar(GRAPPLE.pullSpeed);
      ctx.player.externalVelocity = pull;
    } else {
      clearPull();
    }
  }

  function stopAll(): void {
    state.reset();
    clearPull();
    visuals?.hide();
    lastTarget = null;
    firePending = false;
  }

  return {
    id: 'grapple',

    init(context) {
      ctx = context;
      const res = ctx.resources.scope('grapple');
      // the eye is pulled towards the aim point and the pull ends releaseDistance short of it, so
      // lift it by eye height + release distance + clearance to end with the feet above the lip
      config.aimLift = GRAPPLE_LOCAL.lipClearance + ctx.player.eyeHeight + GRAPPLE.releaseDistance;
      state = new GrappleState(config);
      visuals = new GrappleVisuals(ctx.scene, ctx.camera, ctx.uiRoot, res);
      lastPos.copy(ctx.player.position);

      offs.push(
        ctx.events.on('player:died', () => {
          if (state.phase !== 'pulling') {
            clearPull();
            return;
          }
          ctx.player.getEyePosition(eye);
          apply(state.forceRelease('death'));
        }),
        ctx.events.on('game:respawn', () => stopAll()),
        ctx.events.on('game:stateChanged', ({ to }) => {
          if (to !== 'playing') stopAll();
        }),
      );
      res.onDispose(() => {
        for (const off of offs.splice(0)) off();
        clearPull();
      });

      ctx.testHooks.grapple = {
        getState: () => ({
          phase: state.phase,
          cooldown: state.cooldownRemaining,
          target: lastTarget ? { ...lastTarget } : null,
        }),
      };
    },

    fixedUpdate(dt) {
      if (!playing()) return;
      const player = ctx.player;
      const moved = Math.hypot(
        player.position.x - lastPos.x,
        player.position.y - lastPos.y,
        player.position.z - lastPos.z,
      );
      lastPos.copy(player.position);

      const fire = firePending && player.alive && !player.controlsLocked;
      firePending = false;
      if (!player.alive) {
        if (state.phase === 'pulling') apply(state.forceRelease('death'));
        else clearPull();
        return;
      }

      player.getEyePosition(eye);
      const target = fire && state.phase === 'ready' ? resolveTarget() : null;
      player.getEyePosition(eye);
      apply(
        state.step({
          dt,
          firePressed: fire,
          ray: target,
          eye,
          moved,
        }),
      );
    },

    update(dt) {
      if (!playing()) {
        if (wasPlaying) stopAll();
        wasPlaying = false;
        return;
      }
      wasPlaying = true;
      if (ctx.input.wasPressed('grapple')) firePending = true;
      visuals?.update(dt);

      // crosshair indicator: ~20 Hz, only while a shot is possible (keeps the pull allocation-free)
      frame++;
      if (state.phase === 'ready' && ctx.player.alive && frame % 3 === 0) {
        const r = resolveTarget();
        visuals?.setIndicator(r.hit && r.grappleable ? 'valid' : 'off');
      } else if (state.phase !== 'ready') {
        visuals?.setIndicator('off');
      }
    },

    dispose() {
      for (const off of offs.splice(0)) off();
      if (ctx) {
        clearPull();
        delete ctx.testHooks.grapple;
      }
      visuals = null;
    },
  };
}
