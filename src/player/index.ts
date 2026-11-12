import { spawnFor } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { PlayerController } from './PlayerController';

/**
 * Player module (GDD 4, 4.2, T-01): Rapier kinematic capsule controller, mouse look and camera.
 * There is no jump: Space belongs to the grapple.
 */
export function createPlayerModule(): GameModule {
  let ctx: GameContext;
  let controller: PlayerController | null = null;

  return {
    id: 'player',

    init(context) {
      ctx = context;
      const res = ctx.resources.scope('player');
      const spawn = spawnFor(ctx.flags.sandbox);
      ctx.player.teleport(spawn.position, spawn.yaw);
      ctx.player.teleportPending = false;
      controller = new PlayerController({
        physics: ctx.physics,
        player: ctx.player,
        input: ctx.input,
        events: ctx.events,
        camera: ctx.camera,
        getSensitivity: () => ctx.settings.get('mouseSensitivity'),
      });
      res.onDispose(() => controller?.dispose());
      controller.poseCamera(1);
      ctx.testHooks.player = {
        getState: () => ({
          position: ctx.player.position.clone(),
          velocity: ctx.player.velocity.clone(),
          speed: Math.hypot(ctx.player.velocity.x, ctx.player.velocity.z),
          yaw: ctx.player.yaw,
          pitch: ctx.player.pitch,
          grounded: ctx.player.grounded,
          sprinting: ctx.player.sprinting,
          alive: ctx.player.alive,
        }),
      };
    },

    fixedUpdate(dt) {
      controller?.fixedUpdate(dt);
    },

    update(dt, alpha) {
      controller?.update(dt, alpha);
    },

    dispose() {
      delete ctx.testHooks.player;
      controller = null;
    },
  };
}
