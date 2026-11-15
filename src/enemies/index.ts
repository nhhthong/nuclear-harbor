import { Vector3 } from 'three';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { EnemyType } from '@/core/types';
import { EnemyManager } from './EnemyManager';

/**
 * Robot framework: manager, AI scheduler, navigation, robot types (GDD 6, 13.7).
 * Robot types live in army/ (Vanguard mech), spot/ (Spot dog) and duck/ (Bomber Duck).
 */
export function createEnemiesModule(): GameModule {
  let manager: EnemyManager | null = null;
  let ctxRef: GameContext | null = null;
  const offs: Array<() => void> = [];

  return {
    id: 'enemies',

    init(ctx: GameContext) {
      ctxRef = ctx;
      const res = ctx.resources.scope('enemies');
      const m = new EnemyManager(ctx, res);
      manager = m;

      offs.push(ctx.events.on('world:ready', () => m.start()));
      offs.push(ctx.events.on('objectives:defendStarted', (e) => m.onDefendStarted(e.position, e.radius)));
      offs.push(ctx.events.on('game:respawn', () => m.onRespawn()));
      offs.push(ctx.events.on('enemy:destroyed', (e) => m.onDestroyed(e.id)));

      ctx.testHooks.enemies = {
        list: () => m.snapshot(),
        spawn: (type: EnemyType, position: { x: number; y?: number; z: number }) => {
          const e = m.spawn({ type, position: new Vector3(position.x, 0, position.z), patrol: [] });
          return e ? e.id : null;
        },
        killAll: () => m.killAll(),
        rosterRemaining: () => m.rosterRemaining,
        projectiles: () => ({ live: m.projectiles.liveCount, cap: m.projectiles.capacity }),
      };
    },

    fixedUpdate(dt) {
      manager?.fixedUpdate(dt);
    },

    update(dt) {
      manager?.update(dt);
    },

    dispose() {
      for (const off of offs) off();
      offs.length = 0;
      manager?.dispose();
      manager = null;
      if (ctxRef) {
        delete ctxRef.testHooks.enemies;
        ctxRef.resources.scope('enemies').dispose();
        ctxRef = null;
      }
    },
  };
}
