import { Group, Mesh } from 'three';
import type { Material, MeshStandardMaterial, Object3D } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import type { BodyAnim } from './BossBody';
import { ARM_NAMES, LEG_NAMES } from './crabAssets';
import type { CrabAssets } from './crabAssets';
import { CRAB } from './tunables';

/** What the module needs from the boss look: the crab, or the procedural fallback (`BossBody`). */
export interface BossVisual {
  readonly root: Group;
  update(time: number, dt: number, a: BodyAnim): void;
}

const PHASE: Record<string, number> = { crab_legL0: 0, crab_legR1: 0, crab_legL2: 0, crab_legR0: 1, crab_legL1: 1, crab_legR2: 1 };

interface Leg {
  node: Object3D;
  side: number;
  group: number;
}

/**
 * The Gunslinger Crab Mech look: the GLB parts (body, two gun arms, six legs pivoting at the hips) driven by a
 * procedural tripod gait, a body bob, and an emissive glow that telegraphs the skills. The GLB is cloned
 * (geometries and materials are shared with the loaded template and disposed with the boss scope).
 */
export class CrabBody implements BossVisual {
  readonly root = new Group();
  private readonly rig = new Group();
  private readonly legs: Leg[] = [];
  private readonly arms: Array<{ node: Object3D; side: number }> = [];
  private readonly glow: MeshStandardMaterial[] = [];
  private gait = 0;
  private walkSmooth = 0;

  constructor(res: ResourceTracker, assets: CrabAssets, scale: number) {
    this.root.scale.setScalar(scale);
    const model = assets.scene.clone(true);
    this.rig.add(model);
    this.root.add(this.rig);
    const mats = new Set<Material>();
    model.traverse((o) => {
      if (o instanceof Mesh) {
        o.frustumCulled = false;
        o.castShadow = true;
        o.receiveShadow = false;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.add(m);
      }
      if ((LEG_NAMES as readonly string[]).includes(o.name)) this.legs.push({ node: o, side: o.position.x >= 0 ? 1 : -1, group: PHASE[o.name] ?? 0 });
      if ((ARM_NAMES as readonly string[]).includes(o.name)) this.arms.push({ node: o, side: o.position.x >= 0 ? 1 : -1 });
    });
    for (const m of mats) {
      const sm = m as MeshStandardMaterial;
      if (sm.emissive) {
        sm.emissive.setRGB(1, 0.32, 0.08);
        sm.emissiveIntensity = 0;
        this.glow.push(sm);
      }
    }
    res.track(this.root);
    res.onDispose(() => {
      for (const m of this.glow) m.emissiveIntensity = 0;
    });
  }

  update(time: number, _dt: number, a: BodyAnim): void {
    const G = CRAB.gait;
    this.walkSmooth += (a.walk - this.walkSmooth) * 0.2;
    this.gait += (a.travelled / G.cycleLength) * Math.PI * 2;
    const walk = this.walkSmooth;
    const collapse = a.collapse;
    const idle = 1 - Math.min(1, collapse * 2);
    this.rig.position.y = Math.sin(time * 2.1) * 0.05 * idle + Math.abs(Math.sin(this.gait)) * G.bob * walk;
    const claw = a.claw ?? 0;
    // crouch a little while the claws are up, tiny sway otherwise
    this.rig.position.y -= Math.max(0, claw) * 0.25;
    this.rig.rotation.z = Math.sin(time * 1.3) * 0.012 * idle + Math.sin(this.gait) * 0.015 * walk;
    this.rig.rotation.x = Math.cos(time * 0.9) * 0.01 * idle + (a.charge ?? 0) * -0.05;
    for (const leg of this.legs) {
      const p = this.gait + leg.group * Math.PI;
      const lift = Math.max(0, Math.sin(p)) * G.lift * walk + Math.max(0, claw) * 0.15 + collapse * 0.5;
      leg.node.rotation.z = leg.side * lift;
      leg.node.rotation.y = Math.cos(p) * G.swing * walk;
    }
    for (const arm of this.arms) {
      // claw skills (spec 34): the arms swing up (claw 1) and down onto the ground (claw below 0)
      arm.node.rotation.x = Math.sin(time * 1.7 + arm.side) * 0.02 * idle + (a.charge ?? 0) * 0.18 + claw * 0.75;
      arm.node.rotation.y = arm.side * ((a.charge ?? 0) * 0.08 - Math.max(0, claw) * 0.35);
    }
    const pulse = 0.75 + 0.25 * Math.sin(time * 14);
    const glow = Math.min(0.8, ((a.charge ?? 0) * 0.6 + Math.max(0, claw) * 0.3) * pulse);
    for (const m of this.glow) m.emissiveIntensity = glow;
  }
}
