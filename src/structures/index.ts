import {
  Color,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { CRANE_SITES } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { applyWeatheredPaint } from '@/world/containerModel';
import { CRANE, FLOOD_LIGHTS, PROPS, VEHICLES, structureSolids, type Prop, type PropKind } from './layout';
import { buildBarrier, buildBollard, buildCabin, buildCone, buildCrane, buildDrum, buildMast, buildPallet } from './models';
import { buildVehicleMeshes, loadVehicleGeometries } from './vehicles';
import { buildDressingMeshes, loadDressingModels } from './dressing';
import { createWarehouseMeshes } from './warehouse';
import { mountGates } from './gateMeshes';
import { warehouseColliders } from './warehouseLayout';
import { mountWarehouseProps } from './warehousePropMeshes';

const MODULE_ID = 'structures';

/**
 * Everything that stands on the quay besides containers: the gantry crane, flood-light masts (emissive lenses
 * only: the sun is the single real light), the warehouse shell and the hand-placed props.
 */
export function createStructuresModule(): GameModule {
  let res: ReturnType<GameContext['resources']['scope']> | null = null;
  let colliders: Collider[] = [];
  let beaconMat: MeshBasicMaterial | null = null;
  let gates: ReturnType<typeof mountGates> | null = null;
  let time = 0;

  return {
    id: MODULE_ID,

    init(ctx) {
      if (ctx.flags.sandbox) return;
      const scope = ctx.resources.scope(MODULE_ID);
      res = scope;
      const scene = ctx.scene;
      const add = <T extends Object3D>(o: T): T => {
        scene.add(scope.track(o));
        return o;
      };
      const obj = new Object3D();

      // ---- shared materials -------------------------------------------------------------------
      const galvanised = new MeshStandardMaterial({ color: 0x7d8387, roughness: 0.42, metalness: 0.85 });
      applyWeatheredPaint(galvanised, { bottomY: 0, height: 12, wear: 0.55, key: 'galv' });
      const darkSteel = new MeshStandardMaterial({ color: 0x23272b, roughness: 0.5, metalness: 0.8 });
      const lensMat = new MeshBasicMaterial({ color: 0xffffff });
      lensMat.color.setRGB(2.6, 2.1, 1.4); // lamps just switched on at dusk: glow only, no real light

      // ---- flood-light masts ------------------------------------------------------------------
      for (const f of FLOOD_LIGHTS) {
        const mast = buildMast(f.height);
        const yaw = Math.atan2(f.aimX - f.x, f.aimZ - f.z);
        const steel = add(new Mesh(mast.steel, galvanised));
        steel.position.set(f.x, 0, f.z);
        steel.rotation.y = yaw;
        steel.castShadow = true;
        steel.receiveShadow = true;
        const lens = add(new Mesh(mast.lens, lensMat));
        lens.position.copy(steel.position);
        lens.rotation.y = yaw;
      }

      // ---- gantry crane -------------------------------------------------------------------------
      const crane = buildCrane();
      const cranePaint = new MeshStandardMaterial({ color: CRANE.color, roughness: 0.45, metalness: 0.3 });
      applyWeatheredPaint(cranePaint, { bottomY: 0, height: CRANE.apexY, wear: 0.55, key: 'crane' });
      const beacon = new MeshBasicMaterial({ color: 0xffffff });
      beacon.color.setRGB(6, 0.5, 0.3);
      beaconMat = beacon;
      for (const site of CRANE_SITES) {
        const parts: Array<[BufferGeometry, Material, boolean]> = [
          [crane.paint, cranePaint, true],
          [crane.dark, darkSteel, true],
          [crane.glow, lensMat, false],
          [crane.beacon, beacon, false],
        ];
        for (const [geo, mat, shadow] of parts) {
          const m = add(new Mesh(geo, mat));
          m.position.set(site.position.x, 0, site.position.z);
          m.rotation.y = site.yaw;
          m.castShadow = shadow;
          m.receiveShadow = shadow;
          m.name = `${site.id}`;
        }
      }

      // ---- warehouse shell (spec 29; the 7 m perimeter wall in the world module replaced the fence) ----
      const warehouse = createWarehouseMeshes();
      for (const m of warehouse.meshes) add(m);
      for (const b of warehouseColliders()) {
        colliders.push(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.half, rotation: b.rotation, meta: { kind: 'static' } }));
      }

      // ---- chain-link fences with swing gates (spec 30) ------------------------------------------
      gates = mountGates(ctx, scope, galvanised);
      scope.onDispose(() => {
        gates = null;
      });

      // ---- props --------------------------------------------------------------------------------
      const byKind = (kind: PropKind): Prop[] => PROPS.filter((p) => p.kind === kind);
      const instanced = (geo: BufferGeometry, mat: Material, items: readonly Prop[], color?: (p: Prop) => number, yOffset = 0): InstancedMesh | null => {
        if (items.length === 0) return null;
        const mesh = new InstancedMesh(geo, mat, items.length);
        const c = new Color();
        items.forEach((p, i) => {
          obj.position.set(p.x, yOffset, p.z);
          obj.rotation.set(0, p.yaw, 0);
          obj.scale.setScalar(1);
          obj.updateMatrix();
          mesh.setMatrixAt(i, obj.matrix);
          if (color) mesh.setColorAt(i, c.setHex(color(p)));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        return add(mesh);
      };

      const concrete = new MeshStandardMaterial({ color: 0x8b8d8a, roughness: 0.7, metalness: 0 });
      applyWeatheredPaint(concrete, { bottomY: 0, height: 0.85, wear: 0.25, key: 'concrete' });
      instanced(buildBarrier(), concrete, byKind('barrier'));

      const drumPaint = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.45 });
      applyWeatheredPaint(drumPaint, { bottomY: 0, height: 0.9, wear: 1.3, key: 'drum' });
      const drumColors = [0x1f4f8a, 0x8a1f1f, 0x2e6b3a, 0x242628, 0xb58a12];
      instanced(buildDrum(), drumPaint, byKind('drum'), (p) => drumColors[Math.floor(p.variant * drumColors.length)] ?? 0x1f4f8a);

      const pallet = buildPallet();
      const wood = new MeshStandardMaterial({ color: 0x6f5334, roughness: 0.82, metalness: 0 });
      applyWeatheredPaint(wood, { bottomY: 0, height: 1.2, wear: 0.15, key: 'wood' });
      const crateMat = new MeshStandardMaterial({ color: 0x5d6a4a, roughness: 0.75, metalness: 0.05 });
      applyWeatheredPaint(crateMat, { bottomY: 0, height: 1.2, wear: 0.5, key: 'crate' });
      instanced(pallet.wood, wood, byKind('pallet'));
      instanced(pallet.crate, crateMat, byKind('pallet'));

      const iron = new MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.55, metalness: 0.75 });
      applyWeatheredPaint(iron, { bottomY: 0, height: 0.72, wear: 1.4, key: 'iron' });
      instanced(buildBollard(), iron, byKind('bollard'));

      const coneMat = new MeshStandardMaterial({ color: 0xe2571a, roughness: 0.55, metalness: 0 });
      instanced(buildCone(), coneMat, byKind('cone'));

      const cabin = buildCabin();
      const cabinPaint = new MeshStandardMaterial({ color: 0xb9bdb6, roughness: 0.5, metalness: 0.2 });
      applyWeatheredPaint(cabinPaint, { bottomY: 0, height: 2.9, wear: 0.9, key: 'cabin' });
      instanced(cabin.shell, cabinPaint, byKind('cabin'));
      instanced(cabin.trim, darkSteel, byKind('cabin'));
      const windowMat = new MeshBasicMaterial({ color: 0xffffff });
      windowMat.color.setRGB(3.2, 2.5, 1.5);
      const windows = instanced(cabin.windows, windowMat, byKind('cabin'));
      if (windows) windows.castShadow = false;

      // ---- parked vehicles (async GLB; the colliders below exist from the first frame) -------------
      let vehiclesShown = 0;
      void loadVehicleGeometries().then((geos) => {
        if (res !== scope) return; // disposed while loading
        for (const mesh of buildVehicleMeshes(geos)) {
          add(mesh);
          vehiclesShown += mesh.count;
        }
        ctx.renderer.markShadowsDirty();
      });
      let dressingShown = 0;
      void loadDressingModels().then((models) => {
        if (res !== scope) return;
        for (const mesh of buildDressingMeshes(models)) {
          add(mesh);
          dressingShown += mesh.count;
        }
        ctx.renderer.markShadowsDirty();
      });

      // ---- warehouse interior props (spec 29, stream C: racks, GLB props, their colliders) ----------
      const warehouseProps = mountWarehouseProps(ctx, scope, () => res === scope);
      ctx.testHooks.warehouseProps = { summary: warehouseProps.summary };
      scope.onDispose(() => {
        delete ctx.testHooks.warehouseProps;
      });
      // ---- end warehouse interior props ------------------------------------------------------------

      // ---- colliders ----------------------------------------------------------------------------
      for (const s of structureSolids()) {
        colliders.push(ctx.physics.addStaticBox({ center: s.center, halfExtents: s.half, meta: { kind: 'static' } }));
      }
      scope.onDispose(() => {
        for (const c of colliders) {
          try {
            ctx.physics.removeCollider(c);
          } catch {
            // physics world may already be gone during Game.dispose
          }
        }
        colliders = [];
        beaconMat = null;
        delete ctx.testHooks[MODULE_ID];
      });

      ctx.testHooks[MODULE_ID] = {
        gates: () => gates?.summary(),
        summary: () => ({ floodLights: FLOOD_LIGHTS.length, props: PROPS.length, vehicles: VEHICLES.length, vehiclesShown, dressingShown, cranes: CRANE_SITES.length, colliders: colliders.length }),
      };
    },

    fixedUpdate(dt) {
      gates?.update(dt);
    },

    update(dt) {
      time += dt;
      // slow double blink of the red obstruction lights
      if (beaconMat) {
        const t = time % 2.4;
        const on = t < 0.18 || (t > 0.36 && t < 0.54) ? 1 : 0.06;
        beaconMat.color.setRGB(6 * on, 0.5 * on, 0.3 * on);
      }
    },

    dispose() {
      res?.dispose();
      res = null;
    },
  };
}
