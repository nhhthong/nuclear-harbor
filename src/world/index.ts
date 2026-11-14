import { BoxGeometry, Color, Group, InstancedMesh, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, type PerspectiveCamera } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '@dimforge/rapier3d-compat';
import { LAND, SHIP_BACKDROP } from '@/config/level';
import { PERFORMANCE } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { FLOOD_LIGHTS } from '@/structures/layout';
import { buildBarriers } from './barriers';
import { applyWeatheredPaint, createContainerMeshes } from './containerModel';
import { generateContainerLayout } from './containerLayout';
import { PlanarReflection, createWetGround } from './ground';
import { createLighting } from './lighting';
import { createOcean, type Ocean } from './ocean';
import { createRain, type Rain } from './rain';
import { createShip } from './ship';
import { WORLD_LOCAL } from './tunables';

const MODULE_ID = 'world';

/**
 * The night quay: wet ground with a planar reflection, modelled containers, kerb, ocean, the moored
 * ship, rain, moonlight, lightning and the reflection probe. Builds nothing in `?sandbox`.
 */
export function createWorldModule(): GameModule {
  let ocean: Ocean | null = null;
  let dome: Object3D | null = null;
  let camera: PerspectiveCamera | null = null;
  let rain: Rain | null = null;
  let tickSky: ((dt: number) => number) | null = null;
  let groundTime: { value: number } | null = null;
  let res: ReturnType<GameContext['resources']['scope']> | null = null;
  let colliders: Collider[] = [];
  let ctxRef: GameContext | null = null;

  return {
    id: MODULE_ID,

    init(ctx) {
      if (ctx.flags.sandbox) return;
      ctxRef = ctx;
      camera = ctx.camera;
      const scope = ctx.resources.scope(MODULE_ID);
      res = scope;
      const scene = ctx.scene;
      const addCollider = (c: Collider): void => {
        colliders.push(c);
      };

      // ---- lighting, sky, fog, reflection probe ------------------------------------------------
      const lighting = createLighting(
        ctx,
        FLOOD_LIGHTS.map((f) => ({ x: f.x, y: f.height, z: f.z, color: f.color })),
      );
      scene.userData.hasWorldLighting = true;
      scope.track(lighting.moon);
      scope.track(lighting.hemi);
      scope.track(lighting.dome);
      scene.add(lighting.moon, lighting.moon.target, lighting.hemi, lighting.dome);
      dome = lighting.dome;
      tickSky = lighting.update;
      scope.onDispose(() => {
        lighting.moon.shadow.map?.dispose();
        lighting.moon.shadow.dispose();
        lighting.moon.target.removeFromParent();
        scene.fog = null;
        scene.background = null;
        scene.environment = null;
        lighting.environment?.dispose();
        scene.userData.hasWorldLighting = false;
      });

      // ---- containers ----------------------------------------------------------------------------
      const layout = generateContainerLayout();
      const lanesX = layout.lanes.filter((l) => l.axis === 'z').map((l) => l.start.x);
      const containers = createContainerMeshes(
        layout.instances.map((c, i) => ({
          x: c.x,
          y: c.y,
          z: c.z,
          yaw: c.yaw,
          color: WORLD_LOCAL.containerColors[c.colorIndex] ?? 0x888888,
          seed: ((i * 2654435761) >>> 0) / 4294967296,
        })),
      );
      for (const m of [containers.body, containers.hardware, containers.liveries]) {
        scope.track(m);
        scene.add(m);
      }
      for (const b of layout.boxes) {
        addCollider(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, meta: { kind: 'static' } }));
      }
      const containerColliderCount = layout.boxes.length;

      // ---- wet ground with planar reflection -----------------------------------------------------
      const landW = LAND.maxX - LAND.minX;
      const landD = LAND.maxZ - LAND.minZ;
      const landCx = (LAND.minX + LAND.maxX) / 2;
      const landCz = (LAND.minZ + LAND.maxZ) / 2;
      const reflection = new PlanarReflection(WORLD_LOCAL.ground.reflectionScale);
      const ground = createWetGround(reflection, lanesX);
      groundTime = ground.uniforms.uTime;
      scope.track(ground.mesh);
      scene.add(ground.mesh);
      scope.onDispose(() => reflection.dispose());
      addCollider(
        ctx.physics.addStaticBox({
          center: { x: landCx, y: -1, z: landCz },
          halfExtents: { x: landW / 2, y: 1, z: landD / 2 },
          meta: { kind: 'static' },
        }),
      );
      // quay wall down to the water, with fenders
      const quayMat = new MeshStandardMaterial({ color: 0x4c4f50, roughness: 0.7, metalness: 0 });
      applyWeatheredPaint(quayMat, { bottomY: -3, height: 3, wear: 0.9, key: 'quay' });
      const quayBody = new Mesh(new BoxGeometry(landW, 6, landD), quayMat);
      quayBody.name = 'quay-body';
      quayBody.position.set(landCx, -3.02, landCz);
      scope.track(quayBody);
      scene.add(quayBody);

      // ---- kerb (visible) and invisible blockers -------------------------------------------------
      const barriers = buildBarriers();
      for (const b of barriers) {
        addCollider(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, meta: { kind: 'static' } }));
      }
      const kerbParts = barriers
        .filter((b) => b.kind === 'parapet')
        .map((b) => new BoxGeometry(b.halfExtents.x * 2, b.halfExtents.y * 2, b.halfExtents.z * 2).translate(b.center.x, b.center.y, b.center.z));
      const kerbMat = new MeshStandardMaterial({ color: WORLD_LOCAL.barriers.parapetColor, roughness: 0.65, metalness: 0 });
      applyWeatheredPaint(kerbMat, { bottomY: 0, height: WORLD_LOCAL.barriers.parapetHeight, wear: 0.35, key: 'kerb' });
      const kerb = new Mesh(mergeGeometries(kerbParts, false), kerbMat);
      for (const p of kerbParts) p.dispose();
      kerb.name = 'kerb';
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      scope.track(kerb);
      scene.add(kerb);

      // ---- ocean, ship backdrop with lit windows ------------------------------------------------
      ocean = createOcean(lighting.moonDir, lighting.fogColor);
      scope.track(ocean.mesh);
      scene.add(ocean.mesh);
      const ship = new Group();
      ship.name = 'ship';
      ship.position.set(SHIP_BACKDROP.position.x, SHIP_BACKDROP.position.y, SHIP_BACKDROP.position.z);
      ship.rotation.y = SHIP_BACKDROP.yaw;
      const hull = createShip();
      hull.position.set(0, 0, 0);
      hull.rotation.set(0, 0, 0);
      ship.add(hull);
      const sh = WORLD_LOCAL.ship;
      const deckY = sh.hullBottom + sh.hullDepth;
      const lightMat = new MeshBasicMaterial({ color: 0xffffff });
      lightMat.color.setRGB(4.5, 3.6, 2.2);
      const winGeo = new BoxGeometry(0.9, 0.7, 0.2);
      const slots: Array<[number, number, number]> = [];
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 9; col++) {
          if ((row * 7 + col * 13) % 5 === 0) continue; // dark cabins
          slots.push([-sh.length / 2 + 8 + col * 2.9, deckY + 4 + row * 3.6, sh.beam / 2 - 3 + 0.05]);
        }
      }
      // deck flood lights along the container bays
      for (let i = 0; i < 6; i++) slots.push([-sh.length / 2 + 50 + i * 20, deckY + 13, 0]);
      const windows = new InstancedMesh(winGeo, lightMat, slots.length);
      const o = new Object3D();
      slots.forEach(([x, y, z], i) => {
        o.position.set(x, y, z);
        o.updateMatrix();
        windows.setMatrixAt(i, o.matrix);
      });
      windows.instanceMatrix.needsUpdate = true;
      windows.name = 'ship-lights';
      ship.add(windows);
      scope.track(ship);
      scene.add(ship);

      // ---- rain ----------------------------------------------------------------------------------
      rain = createRain();
      for (const obj of rain.objects) {
        scope.track(obj);
        scene.add(obj);
      }

      // ---- planar reflection pass, before the main render ----------------------------------------
      let hidden: Object3D[] | null = null;
      const applyQuality = (): void => {
        const q = PERFORMANCE.quality[ctx.settings.get('quality')];
        reflection.enabled = q.reflections;
        ground.uniforms.uReflOn.value = q.reflections ? 1 : 0;
        lighting.setQuality(ctx.settings.get('quality'));
      };
      applyQuality();
      scope.onDispose(
        ctx.events.on('settings:changed', ({ key }) => {
          if (key === 'quality') applyQuality();
        }),
      );
      const preRender = (): void => {
        if (!reflection.enabled || !camera) return;
        if (!hidden) {
          // the ground itself, rain, the first-person rig and anything flagged `noReflect` (light beams)
          hidden = [ground.mesh, camera, ...(rain?.objects ?? [])];
          scene.traverse((node) => {
            if (node.userData.noReflect === true) hidden?.push(node);
          });
        }
        reflection.render(ctx.renderer.webgl, scene, camera, hidden);
      };
      ctx.renderer.preRender.push(preRender);
      scope.onDispose(() => {
        const i = ctx.renderer.preRender.indexOf(preRender);
        if (i >= 0) ctx.renderer.preRender.splice(i, 1);
      });

      // ---- bookkeeping ---------------------------------------------------------------------------
      scope.onDispose(() => {
        for (const c of colliders) {
          try {
            ctx.physics.removeCollider(c);
          } catch {
            // physics world may already be gone during Game.dispose
          }
        }
        colliders = [];
        delete ctx.testHooks[MODULE_ID];
      });

      ctx.testHooks[MODULE_ID] = {
        containerCount: layout.instances.length,
        colliderCount: colliders.length,
        containerColliderCount,
        lanes: layout.lanes,
        fogColor: new Color(WORLD_LOCAL.sky.fog).getHex(),
      };
    },

    update(dt) {
      if (ocean) (ocean.material.uniforms.uTime as { value: number }).value += dt;
      if (dome && camera) dome.position.copy(camera.position);
      const flash = tickSky ? tickSky(dt) : 0;
      if (groundTime) groundTime.value += dt;
      if (rain && camera && ctxRef) {
        const h = ctxRef.renderer.webgl.domElement.height;
        rain.update(dt, camera.position.x, camera.position.y, camera.position.z, flash, h, camera.fov);
      }
    },

    dispose() {
      res?.dispose();
      res = null;
      ocean = null;
      dome = null;
      camera = null;
      rain = null;
      tickSky = null;
      groundTime = null;
      ctxRef = null;
    },
  };
}
