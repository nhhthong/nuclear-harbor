import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { BOSS } from '@/config/tunables';
import { BOSS_LOCAL } from './tunables';

/** Greybox TITAN-04 (GDD 15.1) in body space: -Z is front, +X is right, y up, unscaled metres. */

export const BODY_R = BOSS.bodyDiameter / 2;
export const BODY_Y = BOSS_LOCAL.bodyCenterY;

/** Unit directions of the weak points in body space, by WEAK_POINT index. */
export const WEAK_POINT_DIRS: readonly Vector3[] = [
  new Vector3(0, 0, -1), // front
  new Vector3(0, 0, 1), // back
  new Vector3(-1, 0, 0), // left
  new Vector3(1, 0, 0), // right
];

/** Hatch/core direction: bottom and front. */
export const HATCH_DIR = new Vector3(0, -0.8, -0.6).normalize();

const UP = new Vector3(0, 1, 0);
const LEG_COUNT = BOSS.legCount;
/** Leg i diagonal signs (x, z): 0 front-left, 1 front-right, 2 back-left, 3 back-right. */
const LEG_SIGNS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];
const SQ = Math.SQRT1_2;
const HIP_HORIZ = BODY_R * 0.8;
const HIP_Y = BODY_Y - BODY_R * 0.42;
const FOOT_HORIZ = 12.5;
const SEG_LEN = 8.2;

const tmpMid = new Vector3();
const tmpAxis = new Vector3();
const tmpBend = new Vector3();
const tmpOut = new Vector3();
const tmpQuat = new Quaternion();

export function legHip(i: number, out: Vector3): Vector3 {
  const s = LEG_SIGNS[i] ?? LEG_SIGNS[0]!;
  return out.set(s[0] * SQ * HIP_HORIZ, HIP_Y, s[1] * SQ * HIP_HORIZ);
}

export function legFootRest(i: number, out: Vector3): Vector3 {
  const s = LEG_SIGNS[i] ?? LEG_SIGNS[0]!;
  return out.set(s[0] * SQ * FOOT_HORIZ, 0, s[1] * SQ * FOOT_HORIZ);
}

/** Two-bone leg pose for a foot target: fills hip, knee and foot (body space). */
export function legPose(i: number, foot: Vector3, hip: Vector3, knee: Vector3): void {
  legHip(i, hip);
  tmpAxis.copy(foot).sub(hip);
  const d = Math.min(tmpAxis.length(), SEG_LEN * 2 - 0.05);
  tmpAxis.normalize();
  tmpMid.copy(hip).addScaledVector(tmpAxis, d * 0.5);
  const s = LEG_SIGNS[i] ?? LEG_SIGNS[0]!;
  tmpBend.set(s[0] * SQ * 0.6, 0.8, s[1] * SQ * 0.6);
  tmpBend.addScaledVector(tmpAxis, -tmpBend.dot(tmpAxis)).normalize();
  const h = Math.sqrt(Math.max(0, SEG_LEN * SEG_LEN - (d * 0.5) ** 2));
  knee.copy(tmpMid).addScaledVector(tmpBend, h);
}

export interface BodyAnim {
  /** Normalised walking intensity 0..1. */
  walk: number;
  /** Distance walked this frame (metres, full-size units). */
  travelled: number;
  /** Walk direction in body space (unit, xz). */
  dirX: number;
  dirZ: number;
  /** 0..1 front legs raised for the ground slam telegraph. */
  slamRaise: number;
  /** 0..1 cannon barrel glow. */
  cannonCharge: number;
  /** 0..1 collapse progress. */
  collapse: number;
}

export class BossBody {
  readonly root = new Group();
  private readonly wpMeshes: Mesh[] = [];
  private readonly wpMats: MeshStandardMaterial[] = [];
  private readonly deadMat: MeshStandardMaterial;
  private readonly hatch: Mesh;
  private readonly core: Mesh;
  private readonly barrelMat: MeshStandardMaterial;
  private readonly legUpper: Mesh[] = [];
  private readonly legLower: Mesh[] = [];
  private readonly wpFraction = [1, 1, 1, 1];
  private readonly wpAlive = [true, true, true, true];
  private readonly coreMat: MeshStandardMaterial;
  private gaitPhase = 0;
  private exposed = false;
  private readonly foot = new Vector3();
  private readonly hip = new Vector3();
  private readonly knee = new Vector3();
  private readonly rest = new Vector3();
  private readonly hatchClosed = new Vector3();
  private readonly hatchOpen = new Vector3();

  constructor(res: ResourceTracker, scale: number) {
    this.root.scale.setScalar(scale);
    const hull = new MeshStandardMaterial({ color: 0x4d555c, roughness: 0.8, metalness: 0.4 });
    const plate = new MeshStandardMaterial({ color: 0x2c3237, roughness: 0.7, metalness: 0.5 });
    const legMat = new MeshStandardMaterial({ color: 0x3a4046, roughness: 0.75, metalness: 0.45 });
    this.deadMat = new MeshStandardMaterial({ color: 0x1a0d0d, roughness: 0.9 });
    this.barrelMat = new MeshStandardMaterial({ color: 0x2a2f33, emissive: 0xff6a20, emissiveIntensity: 0 });
    this.coreMat = new MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffa040, emissiveIntensity: 3 });
    const hatchMat = new MeshStandardMaterial({ color: 0x22272b, roughness: 0.6, metalness: 0.6 });

    const sphere = new SphereGeometry(1, 24, 16);
    const box = new BoxGeometry(1, 1, 1);

    const body = new Mesh(sphere, hull);
    body.scale.setScalar(BODY_R);
    body.position.set(0, BODY_Y, 0);
    this.root.add(body);

    // armour plates on the upper hull, at the diagonals (weak points stay in the open)
    for (const s of LEG_SIGNS) {
      const n = tmpOut.set(s[0] * SQ * 0.7, 0.72, s[1] * SQ * 0.7).normalize();
      const m = new Mesh(box, plate);
      m.scale.set(4, 0.7, 3);
      m.position.set(n.x * (BODY_R + 0.2), BODY_Y + n.y * (BODY_R + 0.2), n.z * (BODY_R + 0.2));
      m.quaternion.setFromUnitVectors(UP, n);
      this.root.add(m);
    }

    // weak points on the equator
    WEAK_POINT_DIRS.forEach((dir) => {
      const mat = new MeshStandardMaterial({ color: 0x440808, emissive: 0xff1010, emissiveIntensity: 2 });
      const m = new Mesh(sphere, mat);
      m.scale.setScalar(BOSS.weakPointRadius);
      m.position.set(
        dir.x * (BODY_R + BOSS_LOCAL.weakPointProud),
        BODY_Y + dir.y * (BODY_R + BOSS_LOCAL.weakPointProud),
        dir.z * (BODY_R + BOSS_LOCAL.weakPointProud),
      );
      this.wpMeshes.push(m);
      this.wpMats.push(mat);
      this.root.add(m);
    });

    // hatch + core (bottom, front)
    this.hatchClosed.set(HATCH_DIR.x * (BODY_R + 0.1), BODY_Y + HATCH_DIR.y * (BODY_R + 0.1), HATCH_DIR.z * (BODY_R + 0.1));
    tmpOut.set(0, -0.6, 0.8); // slides back along the hull when opening
    this.hatchOpen.copy(this.hatchClosed).addScaledVector(tmpOut, 5.5);
    this.hatch = new Mesh(box, hatchMat);
    this.hatch.scale.set(4, 0.6, 4);
    this.hatch.position.copy(this.hatchClosed);
    this.hatch.quaternion.setFromUnitVectors(UP, HATCH_DIR);
    this.root.add(this.hatch);

    this.core = new Mesh(sphere, this.coreMat);
    this.core.scale.setScalar(BOSS_LOCAL.coreRadius);
    this.core.position.set(
      HATCH_DIR.x * BODY_R * BOSS_LOCAL.coreDepth,
      BODY_Y + HATCH_DIR.y * BODY_R * BOSS_LOCAL.coreDepth,
      HATCH_DIR.z * BODY_R * BOSS_LOCAL.coreDepth,
    );
    this.core.visible = false;
    this.root.add(this.core);

    // cannon barrel on top, front
    const barrel = new Mesh(box, this.barrelMat);
    barrel.scale.set(1.6, 1.6, 6);
    barrel.position.set(0, BODY_Y + BODY_R * 0.78, -BODY_R * 0.55);
    this.root.add(barrel);

    // legs: two boxes each, posed every frame
    for (let i = 0; i < LEG_COUNT; i++) {
      const up = new Mesh(box, legMat);
      const lo = new Mesh(box, legMat);
      this.legUpper.push(up);
      this.legLower.push(lo);
      this.root.add(up, lo);
    }
    this.poseLegs(0, 0, 0, 0, 0, 0);

    res.track(this.root);
    res.track(this.deadMat);
  }

  setWeakPoint(index: number, hp: number, maxHp: number): void {
    this.wpFraction[index] = Math.max(0, hp / maxHp);
    if (hp <= 0 && this.wpAlive[index]) {
      this.wpAlive[index] = false;
      const mesh = this.wpMeshes[index];
      if (mesh) {
        mesh.material = this.deadMat;
        mesh.scale.setScalar(BOSS.weakPointRadius * 0.75);
      }
    }
  }

  /** Local body-space position of a weak point (unscaled). */
  weakPointLocal(index: number, out: Vector3): Vector3 {
    const m = this.wpMeshes[index];
    return m ? out.copy(m.position) : out.set(0, BODY_Y, 0);
  }

  setCoreExposed(exposed: boolean): void {
    this.exposed = exposed;
    this.core.visible = exposed;
  }

  update(time: number, dt: number, a: BodyAnim): void {
    // weak point lights: dim and flicker with damage
    for (let i = 0; i < this.wpMats.length; i++) {
      const mat = this.wpMats[i];
      if (!mat || !this.wpAlive[i]) continue;
      const f = this.wpFraction[i] ?? 1;
      const flick = f < 1 ? 1 - (1 - f) * 0.7 * (Math.sin(time * BOSS_LOCAL.flickerHz + i * 2.1) > 0.2 ? 0 : 1) : 1;
      mat.emissiveIntensity = (0.3 + 1.9 * f) * flick;
    }
    this.barrelMat.emissiveIntensity = a.cannonCharge * 4;
    this.coreMat.emissiveIntensity = 2.5 + Math.sin(time * 8) * 0.8;

    // hatch slides open
    const target = this.exposed ? this.hatchOpen : this.hatchClosed;
    this.hatch.position.lerp(target, Math.min(1, dt * 2));

    // gait: phase follows distance walked
    this.gaitPhase += (a.travelled / BOSS_LOCAL.gait.cycleLength) * Math.PI * 2;
    this.poseLegs(this.gaitPhase, a.walk, a.dirX, a.dirZ, a.slamRaise, a.collapse);
  }

  private poseLegs(phase: number, walk: number, dirX: number, dirZ: number, slamRaise: number, collapse: number): void {
    const g = BOSS_LOCAL.gait;
    for (let i = 0; i < LEG_COUNT; i++) {
      legFootRest(i, this.rest);
      const pairB = i === 1 || i === 2;
      const p = pairB ? phase + Math.PI : phase;
      const lift = Math.max(0, Math.sin(p)) * g.stepHeight * walk;
      const along = Math.cos(p) * g.stride * walk;
      this.foot.set(this.rest.x + dirX * along, lift, this.rest.z + dirZ * along);
      if (i < 2) this.foot.y += slamRaise * 5; // front legs rear up before the slam
      // collapse: feet slide inwards and the hull sags
      this.foot.x *= 1 - collapse * 0.25;
      this.foot.z *= 1 - collapse * 0.25;
      legPose(i, this.foot, this.hip, this.knee);
      this.place(this.legUpper[i], this.hip, this.knee, 1.5);
      this.place(this.legLower[i], this.knee, this.foot, 1.1);
    }
  }

  private place(mesh: Mesh | undefined, a: Vector3, b: Vector3, thickness: number): void {
    if (!mesh) return;
    tmpAxis.copy(b).sub(a);
    const len = tmpAxis.length();
    if (len < 1e-4) return;
    tmpAxis.multiplyScalar(1 / len);
    mesh.position.copy(a).addScaledVector(tmpAxis, len * 0.5);
    tmpQuat.setFromUnitVectors(UP, tmpAxis);
    mesh.quaternion.copy(tmpQuat);
    mesh.scale.set(thickness, len, thickness);
  }
}
