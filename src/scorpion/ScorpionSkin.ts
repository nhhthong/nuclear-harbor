import { Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Material, Object3D, Vector3 } from 'three';
import { LEG_NODES, MATERIAL_GLOW, NODE_BODY, NODE_NOZZLE, TAIL_NODES, type AuthoredScorpion } from './scorpionAssets';
import { createJoints, solveJoints } from './scorpionPose';
import type { ScorpionPose, ScorpionRig } from './ScorpionModel';

/** Venom orb at the stinger mouth: radius (m) at full charge. */
const ORB_RADIUS = 0.42;

/**
 * The authored STINGER-7: the GLB nodes (body, four legs on hip pivots, four tail segments in a chain) driven
 * by `solveJoints`. The scene is cloned; geometries and the armour material stay shared with the loaded
 * template (disposed with the module), the glow material is cloned per scorpion so its intensity can pulse.
 */
export function createAuthoredRig(authored: AuthoredScorpion): ScorpionRig {
  const group = new Group();
  const model = authored.scene.clone(true);
  const spine = new Group();
  group.add(model);
  model.add(spine);

  const byName = new Map<string, Object3D>();
  model.traverse((o) => {
    if (o.name) byName.set(o.name, o);
  });
  const node = (n: string): Object3D => byName.get(n) as Object3D;
  // the body and the tail chain lean together; the legs stay on the ground
  spine.add(node(NODE_BODY));
  spine.add(node(TAIL_NODES[0]));

  // the glow material of the template is shared by every glow mesh: clone it once for this scorpion
  let meshCount = 0;
  const swapped = new Map<Material, Material>();
  model.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = false;
    meshCount++;
    if (!Array.isArray(m.material) && m.material.name === MATERIAL_GLOW) {
      let own = swapped.get(m.material);
      if (!own) {
        own = m.material.clone();
        swapped.set(m.material, own);
      }
      m.material = own;
    }
  });
  const glows = [...swapped.values()] as MeshStandardMaterial[];
  const glowMaterial = glows[0] ?? new MeshStandardMaterial();

  const legs = LEG_NODES.map((n) => node(n));
  const tail = TAIL_NODES.map((n) => node(n));
  const nozzle = node(NODE_NOZZLE);
  const orb = new Mesh(new SphereGeometry(ORB_RADIUS, 14, 10), glowMaterial);
  orb.scale.setScalar(0.01);
  orb.frustumCulled = false;
  nozzle.add(orb);
  meshCount++;

  const spineRestY = spine.position.y;
  const legRestY = legs.map((l) => l.position.y);
  const joints = createJoints();

  return {
    group,
    glowMaterial,
    meshCount,
    apply(pose: ScorpionPose) {
      solveJoints(pose, joints);
      spine.position.y = spineRestY + joints.spineY;
      spine.rotation.x = joints.spinePitch;
      for (let i = 0; i < 4; i++) {
        const leg = legs[i] as Object3D;
        leg.position.y = (legRestY[i] as number) + joints.hipDrop;
        leg.rotation.y = joints.legYaw[i] as number;
        leg.rotation.z = joints.legRoll[i] as number;
        (tail[i] as Object3D).rotation.x = joints.tail[i] as number;
      }
      orb.scale.setScalar(0.01 + pose.charge * (1 + Math.sin(pose.time * 40) * 0.08));
      for (const g of glows) g.emissiveIntensity = joints.glow;
    },
    stingerWorld(out: Vector3) {
      return nozzle.getWorldPosition(out);
    },
    dispose() {
      for (const g of glows) g.dispose();
      orb.geometry.dispose();
    },
  };
}
