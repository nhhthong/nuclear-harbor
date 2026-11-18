import { AdditiveBlending, Mesh, MeshBasicMaterial, SphereGeometry, Vector3, type Object3D } from 'three';

/** Where a glow sits: a bone of an authored model and a point in the model's rest pose (instance-root space, metres). */
export interface GlowAnchor {
  bone: string;
  point: Vector3;
  /** World radius (m) at full level. */
  radius: number;
}

const scale = new Vector3();
const local = new Vector3();

let sphere: SphereGeometry | null = null;
/** Unit sphere shared by every glow of every robot (a few dozen triangles). */
function sphereGeometry(): SphereGeometry {
  sphere ??= new SphereGeometry(1, 10, 8);
  return sphere;
}

/**
 * Additive glow spheres riding on bones: the telegraph cue of the biped (head) and of the striker (rocket pods, muzzle
 * flash). One material per cue (opacity is the level), the unit sphere is shared. `set(level)` is allocation-free.
 */
export class GlowCue {
  private readonly material: MeshBasicMaterial;
  private readonly meshes: Mesh[] = [];
  private readonly radii: number[] = [];
  private level = -1;

  /** `root` is the instance root of an authored model, still at the origin (rest pose). Missing bones are skipped. */
  constructor(root: Object3D, anchors: readonly GlowAnchor[], color: number) {
    this.material = new MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
    root.updateMatrixWorld(true);
    for (const a of anchors) {
      const bone = root.getObjectByName(a.bone);
      if (!bone) continue;
      const mesh = new Mesh(sphereGeometry(), this.material);
      mesh.position.copy(bone.worldToLocal(local.copy(a.point)));
      bone.getWorldScale(scale);
      this.radii.push(a.radius / (scale.x || 1));
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 5;
      mesh.userData.noReflect = true;
      bone.add(mesh);
      this.meshes.push(mesh);
    }
  }

  get count(): number {
    return this.meshes.length;
  }

  /** Level 0 hides the glow; 1 is full brightness and size. */
  set(level: number): void {
    const v = level <= 0.01 ? 0 : Math.min(1, level);
    if (v === this.level) return;
    this.level = v;
    this.material.opacity = 0.85 * v;
    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i] as Mesh;
      m.visible = v > 0;
      m.scale.setScalar((this.radii[i] as number) * (0.55 + 0.45 * v));
    }
  }

  dispose(): void {
    for (const m of this.meshes) m.removeFromParent();
    this.meshes.length = 0;
    this.material.dispose();
  }
}
