import {
  BoxGeometry,
  BufferGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Collider } from '@dimforge/rapier3d-compat';
import { CONTROL_CENTER_FOOTPRINT, LAND, WAREHOUSE_FOOTPRINT } from '@/config/level';
import { WORLD } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { buildBarriers } from './barriers';
import { buildControlCenter, buildWarehouse, type BuildingBox, type BuildingBoxKind } from './buildings';
import { generateContainerLayout } from './containerLayout';
import { createLighting } from './lighting';
import { createOcean, type Ocean } from './ocean';
import { createShip } from './ship';
import { createConcreteTexture, createCorrugatedBump, createGroundRoughness, createWornRoughness } from './textures';
import { WORLD_LOCAL } from './tunables';

const MODULE_ID = 'world';

function mergeBoxes(boxes: readonly BuildingBox[]): BufferGeometry {
  const parts = boxes.map((b) => {
    const g = new BoxGeometry(b.halfExtents.x * 2, b.halfExtents.y * 2, b.halfExtents.z * 2);
    g.translate(b.center.x, b.center.y, b.center.z);
    return g;
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  return merged;
}

/**
 * Harbor greybox: ground, containers, warehouse, control center, ocean, ship backdrop and
 * lighting (GDD 7). Builds nothing in `?sandbox`.
 */
export function createWorldModule(): GameModule {
  let ocean: Ocean | null = null;
  let dome: Object3D | null = null;
  let tickSky: ((dt: number) => void) | null = null;
  let camera: Object3D | null = null;
  let res: ReturnType<GameContext['resources']['scope']> | null = null;
  let anchorIds: string[] = [];
  let colliders: Collider[] = [];

  return {
    id: MODULE_ID,

    init(ctx) {
      if (ctx.flags.sandbox) return;
      camera = ctx.camera;
      const scope = ctx.resources.scope(MODULE_ID);
      res = scope;
      const scene = ctx.scene;
      const addCollider = (c: Collider): void => {
        colliders.push(c);
      };

      // ---- lighting, sky, fog -------------------------------------------------------------
      const lighting = createLighting(ctx);
      scene.userData.hasWorldLighting = true;
      scope.track(lighting.sun);
      scope.track(lighting.hemi);
      scope.track(lighting.dome);
      scene.add(lighting.sun, lighting.sun.target, lighting.hemi, lighting.dome);
      dome = lighting.dome;
      tickSky = lighting.update;
      scope.onDispose(() => {
        lighting.sun.shadow.map?.dispose();
        lighting.sun.shadow.dispose();
        lighting.sun.target.removeFromParent();
        scene.fog = null;
        scene.background = null;
        scene.environment = null;
        lighting.environment?.dispose();
        scene.userData.hasWorldLighting = false;
      });
      scope.onDispose(
        ctx.events.on('settings:changed', ({ key }) => {
          if (key === 'quality') lighting.setQuality(ctx.settings.get('quality'));
        }),
      );

      // ---- ground ---------------------------------------------------------------------------
      const landW = LAND.maxX - LAND.minX;
      const landD = LAND.maxZ - LAND.minZ;
      const landCx = (LAND.minX + LAND.maxX) / 2;
      const landCz = (LAND.minZ + LAND.maxZ) / 2;
      const concrete = createConcreteTexture();
      concrete.repeat.set(landW / WORLD_LOCAL.concreteTileMeters, landD / WORLD_LOCAL.concreteTileMeters);
      const groundRough = createGroundRoughness();
      // a different period than the colour tile hides the repetition of the puddles
      groundRough.repeat.set(landW / (WORLD_LOCAL.concreteTileMeters * 1.7), landD / (WORLD_LOCAL.concreteTileMeters * 1.7));
      concrete.wrapS = RepeatWrapping;
      concrete.wrapT = RepeatWrapping;
      const ground = new Mesh(
        new PlaneGeometry(landW, landD).rotateX(-Math.PI / 2),
        new MeshStandardMaterial({ map: concrete, roughnessMap: groundRough, roughness: 1, metalness: 0, envMapIntensity: 1.15 }),
      );
      ground.name = 'ground';
      ground.position.set(landCx, 0, landCz);
      ground.receiveShadow = true;
      // solid body below the surface so the quay wall is visible down to the water
      const quayBody = new Mesh(
        new BoxGeometry(landW, 6, landD),
        new MeshStandardMaterial({ color: WORLD_LOCAL.colors.quayWall, roughness: 1 }),
      );
      quayBody.name = 'quay-body';
      quayBody.position.set(landCx, -3.02, landCz);
      // thin painted edge at the dock edge
      const edge = new Mesh(
        new BoxGeometry(landW, 0.03, 0.5),
        new MeshStandardMaterial({ color: WORLD_LOCAL.colors.quay, roughness: 0.8 }),
      );
      edge.name = 'quay-edge';
      edge.position.set(landCx, 0.02, LAND.minZ + 0.45);
      scope.track(ground);
      scope.track(quayBody);
      scope.track(edge);
      scene.add(ground, quayBody, edge);
      addCollider(
        ctx.physics.addStaticBox({
          center: { x: landCx, y: -1, z: landCz },
          halfExtents: { x: landW / 2, y: 1, z: landD / 2 },
          meta: { kind: 'static' },
        }),
      );

      // ---- containers -------------------------------------------------------------------------
      const layout = generateContainerLayout();
      // painted corrugated steel: ribs as a bump map, scuffed paint as roughness, sky reflections
      const ribs = createCorrugatedBump();
      const worn = createWornRoughness();
      const containerMat = new MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        roughnessMap: worn,
        metalness: 0.55,
        bumpMap: ribs,
        bumpScale: 2.2,
      });
      const containers = new InstancedMesh(
        new BoxGeometry(WORLD.container.length, WORLD.container.height, WORLD.container.width),
        containerMat,
        layout.instances.length,
      );
      containers.name = 'containers';
      const m = new Matrix4();
      const obj = new Object3D();
      const color = new Color();
      layout.instances.forEach((c, i) => {
        obj.position.set(c.x, c.y, c.z);
        obj.rotation.set(0, c.yaw, 0);
        obj.updateMatrix();
        m.copy(obj.matrix);
        containers.setMatrixAt(i, m);
        color.setHex(WORLD_LOCAL.containerColors[c.colorIndex] ?? 0x888888);
        containers.setColorAt(i, color);
      });
      containers.instanceMatrix.needsUpdate = true;
      if (containers.instanceColor) containers.instanceColor.needsUpdate = true;
      containers.computeBoundingSphere();
      containers.castShadow = true;
      containers.receiveShadow = true;
      scope.track(containers);
      scene.add(containers);
      for (const b of layout.boxes) {
        addCollider(
          ctx.physics.addStaticBox({
            center: b.center,
            halfExtents: b.halfExtents,
            meta: b.grappleable ? { kind: 'static', grappleable: true } : { kind: 'static' },
          }),
        );
      }
      const containerColliderCount = layout.boxes.length;
      layout.stackTops.forEach((t, i) => {
        const id = `container-top-${i}`;
        const position = new Vector3(t.x, t.y, t.z);
        ctx.grappleAnchors.add({ id, kind: 'container-top', position, landing: position.clone(), zone: t.zone });
        anchorIds.push(id);
      });

      // ---- warehouse and control center ---------------------------------------------------------
      const warehouse = buildWarehouse();
      const control = buildControlCenter();
      const allBuilding = [...warehouse.boxes, ...control];
      for (const b of allBuilding) {
        addCollider(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, meta: { kind: 'static' } }));
      }
      const materials: Record<BuildingBoxKind, number> = {
        wall: WORLD_LOCAL.colors.wall,
        roof: WORLD_LOCAL.colors.roof,
        shelf: WORLD_LOCAL.colors.shelf,
        control: WORLD_LOCAL.colors.control,
        controlUpper: WORLD_LOCAL.colors.controlUpper,
      };
      (Object.keys(materials) as BuildingBoxKind[]).forEach((kind) => {
        const boxes = allBuilding.filter((b) => b.kind === kind);
        if (boxes.length === 0) return;
        const clad = kind === 'wall' || kind === 'roof' || kind === 'control';
        const mesh = new Mesh(
          mergeBoxes(boxes),
          new MeshStandardMaterial({
            color: materials[kind],
            roughness: clad ? 0.62 : 0.8,
            metalness: clad ? 0.45 : kind === 'controlUpper' ? 0.7 : 0.1,
            ...(clad ? { bumpMap: ribs, bumpScale: 1.4, roughnessMap: worn } : {}),
          }),
        );
        mesh.name = `building-${kind}`;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scope.track(mesh);
        scene.add(mesh);
      });
      // dim interior floor patch (the roof blocks the sun, this reads as a darker hall)
      const f = WAREHOUSE_FOOTPRINT;
      const interior = new Mesh(
        new PlaneGeometry(f.maxX - f.minX - 2, f.maxZ - f.minZ - 2).rotateX(-Math.PI / 2),
        new MeshStandardMaterial({ color: WORLD_LOCAL.warehouseLights.floorColor, roughness: 1 }),
      );
      interior.name = 'warehouse-floor';
      interior.position.set((f.minX + f.maxX) / 2, 0.02, (f.minZ + f.maxZ) / 2);
      interior.receiveShadow = true;
      scope.track(interior);
      scene.add(interior);

      // interior lighting (T-17): unshadowed point lights + emissive ceiling strips, no new shadow casters
      const wl = WORLD_LOCAL.warehouseLights;
      for (const x of wl.xs) {
        const lamp = new PointLight(wl.color, wl.intensity, wl.distance, wl.decay);
        lamp.name = 'warehouse-lamp';
        lamp.position.set(x, wl.y, wl.z);
        lamp.castShadow = false;
        scope.track(lamp);
        scene.add(lamp);
      }
      const stripBoxes: BuildingBox[] = [];
      for (const z of wl.stripZs) {
        for (const x of wl.stripXs) {
          stripBoxes.push({
            center: { x, y: f.height - 0.08, z },
            halfExtents: { x: wl.stripLength / 2, y: 0.05, z: wl.stripWidth / 2 },
            kind: 'roof',
          });
        }
      }
      const strips = new Mesh(mergeBoxes(stripBoxes), new MeshBasicMaterial({ color: wl.stripColor, fog: false }));
      strips.name = 'warehouse-light-strips';
      scope.track(strips);
      scene.add(strips);

      // ---- level-closing walls (perimeter parapet, blast walls, invisible blockers) -----------------
      const barriers = buildBarriers();
      for (const b of barriers) {
        addCollider(ctx.physics.addStaticBox({ center: b.center, halfExtents: b.halfExtents, meta: { kind: 'static' } }));
      }
      for (const kind of ['parapet', 'blast'] as const) {
        const boxes = barriers.filter((b) => b.kind === kind);
        const mesh = new Mesh(
          mergeBoxes(boxes.map((b) => ({ ...b, kind: 'wall' as const }))),
          new MeshStandardMaterial({
            color: kind === 'parapet' ? WORLD_LOCAL.barriers.parapetColor : WORLD_LOCAL.barriers.blastColor,
            roughness: 0.85,
            metalness: 0.05,
          }),
        );
        mesh.name = `barrier-${kind}`;
        mesh.castShadow = kind === 'blast';
        mesh.receiveShadow = true;
        scope.track(mesh);
        scene.add(mesh);
      }

      // ---- ocean and ship backdrop ----------------------------------------------------------------
      ocean = createOcean(lighting.sunDir, lighting.fogColor);
      scope.track(ocean.mesh);
      scene.add(ocean.mesh);
      const ship = createShip();
      scope.track(ship);
      scene.add(ship);

      // ---- bookkeeping ------------------------------------------------------------------------------
      scope.onDispose(() => {
        for (const c of colliders) {
          try {
            ctx.physics.removeCollider(c);
          } catch {
            // physics world may already be gone during Game.dispose
          }
        }
        colliders = [];
        for (const id of anchorIds) ctx.grappleAnchors.remove(id);
        anchorIds = [];
        delete ctx.testHooks[MODULE_ID];
      });

      ctx.testHooks[MODULE_ID] = {
        containerCount: layout.instances.length,
        colliderCount: colliders.length,
        containerColliderCount,
        anchorCount: anchorIds.length,
        lanes: layout.lanes,
        corridor: warehouse.corridor,
        controlCenter: CONTROL_CENTER_FOOTPRINT,
      };
    },

    update(dt) {
      if (ocean) (ocean.material.uniforms.uTime as { value: number }).value += dt;
      if (dome && camera) dome.position.copy(camera.position);
      tickSky?.(dt);
    },

    dispose() {
      res?.dispose();
      res = null;
      ocean = null;
      dome = null;
      tickSky = null;
      camera = null;
    },
  };
}
