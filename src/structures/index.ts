import { BoxGeometry, Color, Group, InstancedMesh, LOD, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { GRAPPLE } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { RAPIER } from '@/physics/PhysicsWorld';
import type { MaterialRole, StructureBox, V3 } from './boxes';
import { checkCoverage, groundFootprints, sampleWalkable } from './coverage';
import type { SamplePoint, ZoneCoverage } from './coverage';
import { craneLocalParts, craneLowParts } from './craneLayout';
import { createDebugView } from './debugView';
import { buildLayout } from './layout';
import { COVERAGE, CRANE } from './tunables';

const STATIC_COLOR: Record<MaterialRole, number> = { frame: 0x9aa3a8, accent: 0x55595e };

interface InstanceSpec {
  center: V3;
  half: V3;
  yaw: number;
  color?: number;
}

const scratch = new Object3D();
const scratchColor = new Color();

function makeInstanced(
  geometry: BoxGeometry,
  material: MeshStandardMaterial,
  specs: readonly InstanceSpec[],
  useColor: boolean,
): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, specs.length);
  specs.forEach((s, i) => {
    scratch.position.set(s.center.x, s.center.y, s.center.z);
    scratch.rotation.set(0, s.yaw, 0);
    scratch.scale.set(s.half.x * 2, s.half.y * 2, s.half.z * 2);
    scratch.updateMatrix();
    mesh.setMatrixAt(i, scratch.matrix);
    if (useColor) mesh.setColorAt(i, scratchColor.setHex(s.color ?? 0xffffff));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function zoneSummary(zones: readonly ZoneCoverage[]): { zone: string; covered: number; total: number }[] {
  return zones.map((z) => ({ zone: z.zone, covered: z.covered, total: z.total }));
}

export function createStructuresModule(): GameModule {
  let res: ResourceTracker | null = null;
  let ctxRef: GameContext | null = null;
  const colliders: RAPIER.Collider[] = [];
  const anchorIds: string[] = [];

  return {
    id: 'structures',

    init(ctx: GameContext) {
      // the sandbox has its own pillar and perch: build nothing there
      if (ctx.flags.sandbox) return;
      ctxRef = ctx;
      const scope = ctx.resources.scope('structures');
      res = scope;

      const layout = buildLayout();
      const box = scope.track(new BoxGeometry(1, 1, 1));
      const frameMat = scope.track(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.5 }));
      const accentMat = scope.track(new MeshStandardMaterial({ color: CRANE.accentColor, roughness: 0.7, metalness: 0.4 }));

      // --- cranes: one base model, scale/colour variants, two LOD levels -----------------------
      const parts = craneLocalParts();
      const frameParts = parts.filter((p) => p.material === 'frame');
      const accentParts = parts.filter((p) => p.material === 'accent');
      const low = craneLowParts();
      const cranes: LOD[] = layout.cranes.map((placed, i) => {
        const tint = CRANE.palette[i % CRANE.palette.length] as number;
        const toSpec = (p: { center: V3; half: V3 }): InstanceSpec => ({ center: p.center, half: p.half, yaw: 0, color: tint });
        const high = new Group();
        high.add(makeInstanced(box, frameMat, frameParts.map(toSpec), true));
        high.add(makeInstanced(box, accentMat, accentParts.map(toSpec), false));
        const far = new Group();
        far.add(makeInstanced(box, frameMat, low.map(toSpec), true));
        const lod = new LOD();
        lod.name = placed.site.id;
        lod.addLevel(high, 0);
        lod.addLevel(far, CRANE.lodDistance);
        lod.position.set(placed.site.position.x, placed.site.position.y, placed.site.position.z);
        lod.rotation.y = placed.site.yaw;
        lod.scale.setScalar(placed.site.scale);
        ctx.scene.add(scope.track(lod));
        return lod;
      });

      // --- perches, platform, lamp posts: two instanced meshes ---------------------------------
      const spec = (b: StructureBox): InstanceSpec => ({ center: b.center, half: b.half, yaw: b.yaw, color: STATIC_COLOR[b.material] });
      for (const role of ['frame', 'accent'] as const) {
        const specs = layout.staticBoxes.filter((b) => b.material === role).map(spec);
        if (specs.length === 0) continue;
        const mesh = makeInstanced(box, role === 'frame' ? frameMat : accentMat, specs, role === 'frame');
        ctx.scene.add(scope.track(mesh));
      }

      // --- colliders and anchors --------------------------------------------------------------
      const anchorOfBox = new Map(layout.anchors.map((a) => [a.boxId, a.id]));
      for (const b of layout.allBoxes) {
        const anchorId = anchorOfBox.get(b.id);
        colliders.push(
          ctx.physics.addStaticBox({
            center: b.center,
            halfExtents: b.half,
            yaw: b.yaw,
            meta: { kind: 'static', grappleable: b.grappleable, ...(anchorId ? { anchorId } : {}) },
          }),
        );
      }
      for (const a of layout.anchors) {
        ctx.grappleAnchors.add({
          id: a.id,
          kind: a.kind,
          position: new Vector3(a.position.x, a.position.y, a.position.z),
          ...(a.landing ? { landing: new Vector3(a.landing.x, a.landing.y, a.landing.z) } : {}),
          zone: a.zone,
        });
        anchorIds.push(a.id);
      }

      // --- coverage tools ----------------------------------------------------------------------
      const samples: SamplePoint[] = sampleWalkable(groundFootprints(layout.allBoxes));
      const range = GRAPPLE.maxRange;
      let losCache: ZoneCoverage[] | null = null;
      const registryAnchors = (): { kind: (typeof layout.anchors)[number]['kind']; position: V3 }[] =>
        ctx.grappleAnchors.all().map((a) => ({ kind: a.kind, position: a.position }));
      const rangeCoverage = (): ZoneCoverage[] => checkCoverage(samples, registryAnchors(), range);
      const losCoverage = (): ZoneCoverage[] => {
        if (!losCache) {
          losCache = checkCoverage(samples, registryAnchors(), range, (from, to) => ctx.physics.hasLineOfSight(from, to));
        }
        return losCache;
      };

      const perchCounts: Record<number, number> = {};
      for (const p of layout.perches) perchCounts[p.topY] = (perchCounts[p.topY] ?? 0) + 1;
      const anchorKinds: Record<string, number> = {};
      for (const a of layout.anchors) anchorKinds[a.kind] = (anchorKinds[a.kind] ?? 0) + 1;

      ctx.testHooks.structures = {
        coverage: () => zoneSummary(rangeCoverage()),
        coverageLos: () => zoneSummary(losCoverage()),
        summary: () => ({
          cranes: cranes.length,
          craneLods: cranes.map((c) => c.levels.length),
          perches: { ...perchCounts },
          platformTop: layout.platform.topY,
          lamps: layout.lamps.length,
          anchors: { ...anchorKinds },
          colliders: colliders.length,
        }),
      };

      const debug = ctx.flags.params.has('anchors');
      const off = ctx.events.on('world:ready', () => {
        if (!debug) return;
        const los = losCoverage();
        const total = los.reduce((n, z) => n + z.total, 0);
        const covered = los.reduce((n, z) => n + z.covered, 0);
        const share = total ? covered / total : 1;
        console.info(
          `[structures] anchor LOS coverage ${(share * 100).toFixed(1)}% (required ${COVERAGE.minLosShare * 100}%)`,
          los.flatMap((z) => z.uncovered).slice(0, 20),
        );
        createDebugView(ctx, scope, registryAnchors(), rangeCoverage(), los);
      });
      scope.onDispose(off);
    },

    dispose() {
      const ctx = ctxRef;
      if (!ctx || !res) return;
      for (const c of colliders) ctx.physics.removeCollider(c);
      colliders.length = 0;
      for (const id of anchorIds) ctx.grappleAnchors.remove(id);
      anchorIds.length = 0;
      delete ctx.testHooks.structures;
      res.dispose();
      res = null;
      ctxRef = null;
    },
  };
}
