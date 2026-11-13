import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { resolveDamage } from '@/combat/damage';
import { WORLD } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import type { DamageInfo, DamageResult, Damageable } from '@/core/types';

/**
 * Foundation test scene (`?sandbox`). Owned by the foundation; feature tickets do not edit it.
 *
 * A flat 80 x 80 m slab with a few containers, a wall, a low step, a tall grappleable pillar with
 * a registered anchor + perch platform, and two shootable target dummies. It is every ticket's
 * isolated testbed: gameplay modules add their own sandbox fixtures (one robot, one tower, one
 * crate...) when `ctx.flags.sandbox` is set; level modules (world, structures) build nothing.
 *
 * Outside sandbox mode this module only provides fallback lighting for as long as no world module
 * owns lighting: T-03 sets `scene.userData.hasWorldLighting = true` in its init, which disables
 * the fallback (checked on `world:ready`).
 */
const SANDBOX = {
  groundHalfSize: 40,
  pillar: { x: 0, z: -14, halfWidth: 1.5, height: 12 },
  perch: { x: 12, z: -14, halfWidth: 3, topY: 8 },
  dummies: [
    { x: -6, z: -8 },
    { x: 6, z: -22 },
  ],
} as const;

class TargetDummy implements Damageable {
  readonly kind = 'prop' as const;
  hp = 300;

  constructor(
    readonly id: string,
    private readonly mesh: Mesh,
  ) {}

  get alive(): boolean {
    return this.hp > 0;
  }

  applyDamage(info: DamageInfo): DamageResult {
    const result = resolveDamage(this.hp, info);
    this.hp = result.hpAfter;
    if (result.killed) {
      // sandbox dummies reset instead of dying so they can be shot forever
      this.hp = 300;
      result.killed = false;
    }
    (this.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.2 + 0.8 * (1 - this.hp / 300);
    return result;
  }
}

export function createSandboxModule(): GameModule {
  return {
    id: 'sandbox',

    init(ctx: GameContext) {
      const res = ctx.resources.scope('sandbox');

      if (!ctx.flags.sandbox) {
        // Fallback lighting so an empty (pre-T-03) harbor is not a black screen.
        ctx.events.once('world:ready', () => {
          if (ctx.scene.userData.hasWorldLighting) return;
          ctx.scene.background = new Color(0x9db4c8);
          ctx.scene.add(res.track(new HemisphereLight(0xcfe3ff, 0x4a4a48, 1.0)));
        });
        return;
      }

      const { scene, physics } = ctx;
      scene.background = new Color(0x9db4c8);
      scene.fog = new Fog(0x9db4c8, WORLD.fogNear, WORLD.fogFar);
      scene.add(res.track(new HemisphereLight(0xcfe3ff, 0x4a4a48, 0.9)));
      scene.add(res.track(new AmbientLight(0xffffff, 0.15)));
      const sun = new DirectionalLight(0xfff1d6, 2.2);
      sun.position.set(-30, 40, 20);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      const s = sun.shadow.camera;
      s.left = -50;
      s.right = 50;
      s.top = 50;
      s.bottom = -50;
      s.near = 1;
      s.far = 150;
      scene.add(res.track(sun));

      const box = new BoxGeometry(1, 1, 1);
      const materials = {
        ground: new MeshStandardMaterial({ color: 0x6f7377, roughness: 0.95 }),
        containerA: new MeshStandardMaterial({ color: 0x2f6f9f, roughness: 0.7, metalness: 0.3 }),
        containerB: new MeshStandardMaterial({ color: 0xa5482f, roughness: 0.7, metalness: 0.3 }),
        steel: new MeshStandardMaterial({ color: 0xd9a514, roughness: 0.5, metalness: 0.6 }),
        wall: new MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.9 }),
      };

      const addBox = (
        center: { x: number; y: number; z: number },
        half: { x: number; y: number; z: number },
        material: MeshStandardMaterial,
        grappleable = false,
        yaw = 0,
      ): Mesh => {
        const mesh = new Mesh(box, material);
        mesh.position.set(center.x, center.y, center.z);
        mesh.scale.set(half.x * 2, half.y * 2, half.z * 2);
        mesh.rotation.y = yaw;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(res.track(mesh));
        physics.addStaticBox({ center, halfExtents: half, yaw, meta: { kind: 'static', grappleable } });
        return mesh;
      };

      // ground slab (top at y = 0)
      const g = SANDBOX.groundHalfSize;
      addBox({ x: 0, y: -0.5, z: 0 }, { x: g, y: 0.5, z: g }, materials.ground).castShadow = false;
      const grid = new GridHelper(g * 2, g, 0x30363c, 0x565c62);
      grid.position.y = 0.01;
      scene.add(res.track(grid));

      // containers: a single, a stack of two (top is grappleable, GDD 7.5), one rotated
      const c = WORLD.container;
      const half = { x: c.length / 2, y: c.height / 2, z: c.width / 2 };
      addBox({ x: -12, y: half.y, z: -4 }, half, materials.containerA);
      addBox({ x: -12, y: half.y, z: -18 }, half, materials.containerB);
      addBox({ x: -12, y: half.y * 3, z: -18 }, half, materials.containerA, true);
      addBox({ x: 14, y: half.y, z: 2 }, half, materials.containerB, false, Math.PI / 2);
      // wall (wall-collision tests) and a low step (auto-step tests)
      addBox({ x: 0, y: 2, z: -34 }, { x: 20, y: 2, z: 0.5 }, materials.wall);
      addBox({ x: 6, y: 0.15, z: 6 }, { x: 2, y: 0.15, z: 2 }, materials.wall);

      // grappleable pillar with an anchor at the top
      const p = SANDBOX.pillar;
      addBox({ x: p.x, y: p.height / 2, z: p.z }, { x: p.halfWidth, y: p.height / 2, z: p.halfWidth }, materials.steel, true);
      ctx.grappleAnchors.add({
        id: 'sandbox-pillar',
        kind: 'manual',
        position: new Vector3(p.x, p.height - 0.5, p.z + p.halfWidth),
        zone: 'sandbox',
      });

      // perch platform (REVIEW #2): slab on a post, anchor above its edge, landing on top
      const q = SANDBOX.perch;
      addBox({ x: q.x, y: (q.topY - 0.4) / 2, z: q.z }, { x: 0.4, y: (q.topY - 0.4) / 2, z: 0.4 }, materials.steel);
      addBox({ x: q.x, y: q.topY - 0.2, z: q.z }, { x: q.halfWidth, y: 0.2, z: q.halfWidth }, materials.steel, true);
      addBox({ x: q.x, y: q.topY + 2.5, z: q.z - q.halfWidth + 0.2 }, { x: 0.2, y: 2.5, z: 0.2 }, materials.steel, true);
      ctx.grappleAnchors.add({
        id: 'sandbox-perch',
        kind: 'perch',
        position: new Vector3(q.x, q.topY + 2.2, q.z - q.halfWidth + 0.45),
        landing: new Vector3(q.x, q.topY, q.z),
        zone: 'sandbox',
      });

      // shootable dummies: body + critical "head"
      SANDBOX.dummies.forEach((d, i) => {
        const material = new MeshStandardMaterial({ color: 0x8c1d18, emissive: 0xff2a1a, emissiveIntensity: 0.2 });
        const body = new Mesh(box, material);
        body.position.set(d.x, 0.9, d.z);
        body.scale.set(0.8, 1.8, 0.5);
        body.castShadow = true;
        scene.add(res.track(body));
        const head = new Mesh(box, material);
        head.position.set(d.x, 2.05, d.z);
        head.scale.set(0.4, 0.4, 0.4);
        scene.add(res.track(head));
        const dummy = new TargetDummy(`sandbox-dummy-${i}`, body);
        physics.addStaticBox({
          center: body.position,
          halfExtents: { x: 0.4, y: 0.9, z: 0.25 },
          meta: { kind: 'prop', damageable: dummy, hitZone: 'body' },
        });
        physics.addStaticBox({
          center: head.position,
          halfExtents: { x: 0.2, y: 0.2, z: 0.2 },
          meta: { kind: 'prop', damageable: dummy, hitZone: 'critical' },
        });
      });
    },
  };
}
