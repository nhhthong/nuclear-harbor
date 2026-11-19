import { Vector3 } from 'three';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { EnemyType } from '@/core/types';
import { loadDroneAsset, loadedDroneAsset } from '@/assets/droneAsset';
import { authoredModel, disposeAuthored, loadAllAuthored } from './authored';
import { EnemyManager } from './EnemyManager';
import { loadSamuraiSkin, samuraiSkin, setSamuraiSkin } from './samurai/skin';

/** Longest the population start waits for the authored GLBs (samurai, biped, striker, spot). */
const SKIN_WAIT_MS = 5000;

/**
 * Robot framework: manager, AI scheduler, navigation, robot types (GDD 6, 13.7).
 * Robot types live in army/ (Medium Mech Striker), spot/ (Spot dog), duck/ (Bomber Duck), biped/ (Biped robot)
 * and samurai/ (cyber samurai).
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
      // authored looks: a robot built before its GLB has loaded would keep the procedural model for good, so
      // the population starts only once every model (samurai skin, biped, striker, spot) has loaded or failed
      // (5 s at most); a failed load falls back to the procedural model of that type
      const browser = typeof document !== 'undefined';
      const skinReady: Promise<unknown> = browser
        ? Promise.all([
            ctx.flags.params.has('procedural-samurai') ? Promise.resolve(null) : loadSamuraiSkin(),
            ctx.flags.params.has('procedural') ? Promise.resolve([]) : loadAllAuthored(),
            // spec 29: the dragonfly GLB, shared with the boss drones (one fetch)
            ctx.flags.params.has('procedural') ? Promise.resolve(null) : loadDroneAsset(),
          ])
        : Promise.resolve(null);
      const startWhenReady = (): void => {
        const timeout = new Promise<void>((resolve) => {
          const id = setTimeout(resolve, SKIN_WAIT_MS);
          offs.push(() => clearTimeout(id));
        });
        void Promise.race([skinReady, timeout]).then(() => {
          if (manager === m) m.start();
        });
      };

      offs.push(ctx.events.on('world:ready', startWhenReady));
      offs.push(ctx.events.on('objectives:defendStarted', (e) => m.onDefendStarted(e.position, e.radius)));
      offs.push(ctx.events.on('game:respawn', () => m.onRespawn()));
      offs.push(ctx.events.on('enemy:destroyed', (e) => m.onDestroyed(e.id)));

      ctx.testHooks.enemies = {
        list: () => m.snapshot(),
        spawn: (type: EnemyType, position: { x: number; y?: number; z: number }, patrol: Array<{ x: number; z: number }> = []) => {
          const e = m.spawn({ type, position: new Vector3(position.x, 0, position.z), patrol: patrol.map((p) => new Vector3(p.x, 0, p.z)) });
          return e ? e.id : null;
        },
        killAll: () => m.killAll(),
        samuraiSkin: () => samuraiSkin() !== null,
        authored: () => ({ biped: authoredModel('biped') !== null, striker: authoredModel('striker') !== null, spot: authoredModel('spot') !== null }),
        rosterRemaining: () => m.rosterRemaining,
        projectiles: () => ({ live: m.projectiles.liveCount, cap: m.projectiles.capacity }),
        // spec 29: flying drones
        droneModel: () => loadedDroneAsset() !== null,
        /** Spawns `count` hunter drones outside the warehouse openings, as the anti-camping call-in does. */
        callInDrones: (count = 2) => m.spawnCallIn(count),
        callIn: () => m.callInState(),
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
      setSamuraiSkin(null);
      disposeAuthored();
      if (ctxRef) {
        delete ctxRef.testHooks.enemies;
        ctxRef.resources.scope('enemies').dispose();
        ctxRef = null;
      }
    },
  };
}
