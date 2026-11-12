import { Vector3 } from 'three';
import { spawnFor } from '@/config/level';
import { PLAYER } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';

/**
 * Player module (GDD 4, 4.2).
 *
 * FOUNDATION PLACEHOLDER: a collision-less free-fly camera so that the app is navigable and other
 * tickets have a moving `ctx.player`. Ticket T-01 replaces this file with the real Rapier
 * character controller and owns every file in this folder. Keep the factory name and module id.
 *
 * What the placeholder already honours (and T-01 must keep): spawn from `spawnFor`, mouse look
 * into `ctx.player.yaw/pitch`, camera synced from PlayerState every frame.
 */
export function createPlayerModule(): GameModule {
  let ctx: GameContext;
  const forward = new Vector3();
  const right = new Vector3();
  const eye = new Vector3();
  const maxPitch = (PLAYER.maxPitchDeg * Math.PI) / 180;

  return {
    id: 'player',

    init(context) {
      ctx = context;
      const spawn = spawnFor(ctx.flags.sandbox);
      ctx.player.teleport(spawn.position, spawn.yaw);
      ctx.player.teleportPending = false;
      syncCamera();
    },

    update(dt) {
      const player = ctx.player;
      const look = ctx.input.consumeLookDelta();
      const sensitivity = PLAYER.lookRadPerPixel * ctx.settings.get('mouseSensitivity');
      player.yaw -= look.x * sensitivity;
      player.pitch = Math.max(-maxPitch, Math.min(maxPitch, player.pitch - look.y * sensitivity));

      const axis = ctx.input.getMoveAxis();
      player.sprinting = ctx.input.isDown('sprint');
      const speed = player.sprinting ? PLAYER.sprintSpeed * 2 : PLAYER.walkSpeed * 2;
      player.getLookDirection(forward);
      player.getRight(right);
      player.velocity.set(0, 0, 0).addScaledVector(forward, axis.y).addScaledVector(right, axis.x);
      if (player.velocity.lengthSq() > 0) player.velocity.normalize().multiplyScalar(speed);
      player.position.addScaledVector(player.velocity, dt);
      player.teleportPending = false;
      syncCamera();
    },
  };

  function syncCamera(): void {
    ctx.camera.position.copy(ctx.player.getEyePosition(eye));
    ctx.camera.rotation.set(ctx.player.pitch, ctx.player.yaw, 0, 'YXZ');
  }
}
