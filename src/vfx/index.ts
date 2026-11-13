import { Vector3 } from 'three';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { VfxKind } from '@/core/types';
import { bossAttackRecipes, hitRecipe, landingScale, reflect } from './mapping';
import { RECIPE_IDS, type RecipeId } from './recipes';
import { SpawnScheduler } from './scheduler';
import { VFX } from './tunables';
import { VfxSystem } from './VfxSystem';

const MODULE_ID = 'vfx';

const scratchDir = new Vector3();
const scratchOut = { x: 0, y: 0, z: 0 };
const UP_N = { x: 0, y: 1, z: 0 };

/**
 * Pooled particles and effects driven by events (GDD 13.4). Visual only: simulated in `update`,
 * nothing in `fixedUpdate`. See specs/T-10-vfx.
 */
export function createVfxModule(): GameModule {
  let ctx: GameContext | null = null;
  let system: VfxSystem | null = null;
  let scheduler: SpawnScheduler | null = null;
  let testTimer = 0;
  let testIndex = 0;
  let vfxTest = false;
  const bossPos = new Vector3();

  const spawn = (id: RecipeId, x: number, y: number, z: number, nx: number, ny: number, nz: number, scale: number, duration?: number) => {
    system?.spawn(id, x, y, z, nx, ny, nz, scale, duration);
  };

  const fireStaged = (id: RecipeId, x: number, y: number, z: number, scale: number) => spawn(id, x, y, z, 0, 1, 0, scale);

  return {
    id: MODULE_ID,

    init(context) {
      ctx = context;
      const res = context.resources.scope(MODULE_ID);
      const sys = new VfxSystem(context.scene, context.camera, context.canvas, context.settings.get('quality'));
      system = sys;
      scheduler = new SpawnScheduler(VFX.maxScheduled);
      vfxTest = context.flags.params.has('vfxtest');
      res.onDispose(() => sys.dispose());

      const ev = context.events;
      const on = <K extends Parameters<typeof ev.on>[0]>(name: K, fn: Parameters<typeof ev.on<K>>[1]) => {
        res.onDispose(ev.on(name, fn));
      };

      context.testHooks[MODULE_ID] = {
        liveParticles: () => sys.liveParticles,
        liveEmitters: () => sys.liveEmitters + (scheduler?.count ?? 0),
        dropped: () => sys.dropped + (scheduler?.dropped ?? 0),
        capacity: () => sys.capacity,
        decals: () => sys.decals,
      };
      res.onDispose(() => {
        delete context.testHooks[MODULE_ID];
      });

      on('settings:changed', (e) => {
        if (e.key === 'quality') sys.setQuality(context.settings.get('quality'));
      });

      on('vfx:spawn', (e) => {
        const n = e.normal;
        spawn(e.kind as VfxKind, e.position.x, e.position.y, e.position.z, n ? n.x : 0, n ? n.y : 1, n ? n.z : 0, e.scale ?? 1, e.duration);
      });

      on('combat:impact', (e) => {
        const { point: p, normal: n } = e;
        spawn('dust', p.x, p.y, p.z, n.x, n.y, n.z, 0.6);
        spawn('spark', p.x, p.y, p.z, n.x, n.y, n.z, 0.5);
        sys.addDecal(p.x, p.y, p.z, n.x, n.y, n.z);
      });

      on('combat:hit', (e) => {
        const id = hitRecipe(e.zone, e.absorbed);
        const { point: p, normal: n } = e;
        if (id === 'armor-spark') {
          // ricochet: look direction reflected about the surface normal
          context.player.getLookDirection(scratchDir);
          reflect(scratchDir.x, scratchDir.y, scratchDir.z, n.x, n.y, n.z, scratchOut);
          spawn(id, p.x, p.y, p.z, scratchOut.x, scratchOut.y, scratchOut.z, 1);
        } else {
          spawn(id, p.x, p.y, p.z, n.x, n.y, n.z, 1);
        }
      });

      on('enemy:destroyed', (e) => {
        const p = e.position;
        const scale = e.type === 'duck' ? 1.6 : 1;
        spawn('explosion', p.x, p.y, p.z, 0, 1, 0, scale);
        spawn('smoke', p.x, p.y + 0.4, p.z, 0, 1, 0, scale);
      });

      on('pickup:collected', (e) => spawn('pickup', e.position.x, e.position.y, e.position.z, 0, 1, 0, 1));

      on('tower:activated', (e) => spawn('pickup', e.position.x, e.position.y + 1, e.position.z, 0, 1, 0, VFX.towerActivatedScale));

      on('player:landed', (e) => {
        const s = landingScale(e.impactSpeed);
        if (s <= 0) return;
        const p = context.player.position;
        spawn('dust', p.x, p.y + 0.05, p.z, UP_N.x, UP_N.y, UP_N.z, s);
      });

      on('boss:spawned', (e) => {
        bossPos.copy(e.position);
      });

      on('boss:weakPointDestroyed', (e) => {
        const p = e.position;
        spawn('weakpoint-burst', p.x, p.y, p.z, 0, 1, 0, VFX.weakPointBurstScale);
        spawn('explosion', p.x, p.y, p.z, 0, 1, 0, 1.2);
      });

      on('boss:coreExposed', () => {
        spawn('explosion', bossPos.x, bossPos.y + 3, bossPos.z, 0, 1, 0, VFX.bossCoreExposedScale);
      });

      on('boss:attack', (e) => {
        const p = e.position;
        for (const id of bossAttackRecipes(e.attack)) {
          if (id === 'telegraph-ring') spawn(id, p.x, p.y + 0.05, p.z, 0, 1, 0, e.radius, 0.5);
          else spawn(id, p.x, p.y, p.z, 0, 1, 0, Math.max(0.5, e.radius / 4));
        }
      });

      on('boss:defeated', (e) => {
        const p = e.position;
        for (const s of VFX.bossDefeatStages) {
          scheduler?.schedule(s.t, s.kind, p.x + s.x, p.y + s.y, p.z + s.z, s.scale);
        }
        // first stage fires on the next update
      });
    },

    update(dt) {
      if (!ctx || !system) return;
      scheduler?.advance(dt, fireStaged);
      if (vfxTest) {
        testTimer -= dt;
        if (testTimer <= 0) {
          testTimer = VFX.testInterval;
          const id = RECIPE_IDS[testIndex % RECIPE_IDS.length] as RecipeId;
          testIndex++;
          const p = ctx.player.position;
          ctx.player.getForward(scratchDir);
          spawn(id, p.x + scratchDir.x * VFX.testDistance, p.y + VFX.testHeight, p.z + scratchDir.z * VFX.testDistance, 0, 1, 0, 1, 1.5);
        }
      }
      system.update(dt);
    },

    dispose() {
      ctx?.resources.scope(MODULE_ID).dispose();
      system = null;
      scheduler = null;
      ctx = null;
    },
  };
}
