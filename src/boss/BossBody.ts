import {
  BackSide,
  Box3,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { getArmorTextures } from './BossTextures';
import { BOSS_LOCAL, FALLBACK_LEG_ANGLE } from './tunables';

/**
 * Spherical walker (docs/reference-models/final_boss.html) as a procedural port. Model space of
 * the reference is "units"; `mech` scales it to metres (BOSS_LOCAL.model.scale, ~18 m tall) and
 * turns it by PI because the reference faces +Z and the game faces -Z. Static parts are merged per
 * material; only the four legs and the hydraulic pistons move (draw call budget: 36).
 */

const K = BOSS_LOCAL.model.scale;
export const BODY_Y = BOSS_LOCAL.bodyCenterY;
export const BODY_R = BOSS_LOCAL.model.hullRadiusUnits * K;
/** Eye (core) centre in body space, metres, front = -Z. */
export const EYE_LOCAL = new Vector3(0, BOSS_LOCAL.model.eyeUnits.y * K, -(BOSS_LOCAL.model.eyeUnits.z + 0.08) * K);

const R = 1.02;
const LEG_COUNT = FALLBACK_LEG_ANGLE.length;
const HIP_RADIUS = 0.88;
const BODY_UNIT_Y = BOSS_LOCAL.model.bodyCenterUnits;
const Z_AXIS = new Vector3(0, 0, 1);

export interface BodyAnim {
  /** Normalised walking intensity 0..1. */
  walk: number;
  /** Distance walked this frame (metres, full-size units). */
  travelled: number;
  dirX: number;
  dirZ: number;
  /** 0..1 front legs raised for the ground slam telegraph. */
  slamRaise: number;
  /** 0..1 eye charging the cannon. */
  cannonCharge: number;
  /** 0..1 collapse progress (legs fold like the reference sphere mode). */
  collapse: number;
  /** Crab look only: current spin rate (rad/s), 0..1 spin wind-up, 0..1 skill charge glow. */
  spin?: number;
  windup?: number;
  charge?: number;
}

interface Leg {
  hip: Group;
  knee: Group;
  anchor: Object3D;
  front: boolean;
}

interface Piston {
  a: Object3D;
  barrel: Mesh;
  rod: Mesh;
}

const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpDir = new Vector3();
const tmpQ = new Quaternion();
const tmpM = new Matrix4();
const invMech = new Matrix4();
const invRoot = new Matrix4();

type Bucket = BufferGeometry[];

function merge(parts: Bucket): BufferGeometry {
  const indexed = parts.filter((g) => g.index !== null).length;
  const list = indexed === 0 || indexed === parts.length ? parts : parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const m = mergeGeometries(list, false);
  if (!m) throw new Error('boss geometry merge failed');
  for (const g of parts) g.dispose();
  return m;
}

/** Rotate (Euler XYZ like Object3D) then translate a geometry in place. */
function put(g: BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): BufferGeometry {
  if (rx || ry || rz) g.applyMatrix4(tmpM.makeRotationFromEuler(new Euler(rx, ry, rz, 'XYZ')));
  g.translate(x, y, z);
  return g;
}

export class BossBody {
  readonly root = new Group();
  /** Height of the standing model in metres (measured). */
  readonly measuredHeight: number;
  /** Knee (weak point) centres in root space, metres, refreshed by `update`. */
  readonly kneeRoot: Vector3[] = Array.from({ length: LEG_COUNT }, () => new Vector3());

  /** Standing pose bones per leg in root space (metres), for the leg armour colliders. */
  readonly restBones: Array<{ hip: Vector3; knee: Vector3; foot: Vector3 }> = [];

  private readonly mech = new Group();
  private readonly body = new Group();
  private readonly legs: Leg[] = [];
  private readonly pistons: Piston[] = [];
  private readonly ledMats: MeshStandardMaterial[] = [];
  private readonly coreGlow: MeshStandardMaterial;
  private readonly lens: MeshStandardMaterial;
  private readonly deadMat: MeshStandardMaterial;
  private readonly fraction = [1, 1, 1, 1];
  private readonly alive = [true, true, true, true];
  private exposed = false;
  private gait = 0;

  constructor(res: ResourceTracker, scale: number) {
    this.root.scale.setScalar(scale);
    this.mech.scale.setScalar(K);
    this.mech.rotation.y = Math.PI;
    this.root.add(this.mech);
    this.mech.add(this.body);
    this.body.position.y = BODY_UNIT_Y;

    const tex = getArmorTextures();
    const mainArmor = new MeshStandardMaterial({
      map: tex.armor.map,
      roughnessMap: tex.armor.roughness,
      bumpMap: tex.armor.bump,
      bumpScale: 0.6,
      roughness: 0.58,
      metalness: 0.16,
    });
    const legArmor = new MeshStandardMaterial({ map: tex.leg.map, bumpMap: tex.leg.bump, bumpScale: 0.5, roughness: 0.46, metalness: 0.15 });
    const gun = new MeshStandardMaterial({ color: 0x383a40, roughness: 0.42, metalness: 0.78 });
    const innerShell = new MeshStandardMaterial({ color: 0x383a40, roughness: 0.42, metalness: 0.78, side: BackSide });
    const black = new MeshStandardMaterial({ color: 0x16171a, roughness: 0.55, metalness: 0.65 });
    const chrome = new MeshStandardMaterial({ color: 0xe6e9ef, roughness: 0.12, metalness: 0.98 });
    const red = new MeshStandardMaterial({ color: 0xb81d1d, roughness: 0.28, metalness: 0.45 });
    this.coreGlow = new MeshStandardMaterial({ color: 0xff9d00, emissive: 0xff6200, emissiveIntensity: 1.8, roughness: 0.2, metalness: 0.1 });
    this.lens = new MeshStandardMaterial({ color: 0x080606, roughness: 0.04, metalness: 0.15, emissive: 0xff5a00, emissiveIntensity: 0 });
    this.deadMat = new MeshStandardMaterial({ color: 0x1a0d0d, roughness: 0.9, metalness: 0.2 });

    this.buildBody({ mainArmor, gun, innerShell, black, chrome, red });
    this.buildLegs({ legArmor, gun, black });
    this.buildPistons(gun, chrome);

    this.root.updateMatrixWorld(true);
    this.measuredHeight = new Box3().setFromObject(this.root).max.y / scale;
    this.pose(0, { walk: 0, travelled: 0, dirX: 0, dirZ: -1, slamRaise: 0, cannonCharge: 0, collapse: 0 }, 0);
    invRoot.copy(this.root.matrixWorld).invert();
    for (const leg of this.legs) {
      const hip = new Vector3().setFromMatrixPosition(leg.hip.matrixWorld).applyMatrix4(invRoot);
      const knee = new Vector3().setFromMatrixPosition(leg.knee.matrixWorld).applyMatrix4(invRoot);
      const foot = new Vector3(0, -0.86, 0).applyMatrix4(leg.knee.matrixWorld).applyMatrix4(invRoot);
      this.restBones.push({ hip, knee, foot });
    }
    res.track(this.root);
    res.track(this.deadMat);
  }

  private mesh(parent: Object3D, parts: Bucket, mat: MeshStandardMaterial): Mesh {
    const m = new Mesh(merge(parts), mat);
    parent.add(m);
    return m;
  }

  private buildBody(m: Record<'mainArmor' | 'gun' | 'innerShell' | 'black' | 'chrome' | 'red', MeshStandardMaterial>): void {
    const armor: Bucket = [];
    const shellIn: Bucket = [];
    const gun: Bucket = [];
    const black: Bucket = [];
    const chrome: Bucket = [];
    const red: Bucket = [];
    const glow: Bucket = [];
    const glass: Bucket = [];

    black.push(new SphereGeometry(R * 0.87, 32, 24));
    for (const side of [-1, 1]) {
      gun.push(put(new TorusGeometry(R * 0.86, 0.032, 10, 28, Math.PI * 0.7), side * 0.18, 0.05, 0.08, 0, side * 0.35, 0));
      glow.push(put(new TorusGeometry(0.36, 0.022, 10, 28, Math.PI * 0.65), side * 0.22, -0.02, 0.68, 0, side * 0.42, side === 1 ? -Math.PI * 0.32 : Math.PI * 0.68));
    }
    const shell = (phiStart: number, phiLen: number, thStart: number, thLen: number, off = 0): void => {
      const outer = R + off;
      armor.push(new SphereGeometry(outer, 36, 28, phiStart, phiLen, thStart, thLen));
      shellIn.push(new SphereGeometry(outer - 0.085, 24, 18, phiStart, phiLen, thStart, thLen));
    };
    const front = Math.PI / 2;
    const gap = 0.085;
    shell(front + gap, Math.PI * 0.86, 0.18, Math.PI - 0.38, 0.01);
    shell(front - gap - Math.PI * 0.86, Math.PI * 0.86, 0.18, Math.PI - 0.38, 0.01);
    shell(front + 0.11, 0.45, 0.14, 0.72, 0.048);
    shell(front - 0.56, 0.45, 0.14, 0.72, 0.048);
    shell(front + Math.PI - 0.42, 0.84, 0.25, Math.PI - 0.5, 0);
    shell(0, Math.PI * 2, Math.PI - 0.42, 0.35, -0.01);

    // crest fin on the head (reference animate() parks it at y = 1.04)
    const fx = 0;
    const fy = 1.04;
    const fz = 0.08;
    gun.push(put(new CylinderGeometry(0.022, 0.026, 0.28, 12), fx + 0.04, fy + 0.06, fz - 0.02, 0, 0, -0.08));
    chrome.push(put(new CylinderGeometry(0.014, 0.014, 0.18, 12), fx - 0.03, fy + 0.08, fz + 0.02));
    const fin = new Shape();
    fin.moveTo(0, 0.14);
    fin.lineTo(0.18, 0.02);
    fin.lineTo(0.12, -0.14);
    fin.lineTo(-0.12, -0.14);
    fin.lineTo(-0.18, 0.02);
    fin.closePath();
    const finGeo = new ExtrudeGeometry(fin, { depth: 0.045, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.012, bevelThickness: 0.012 });
    finGeo.rotateX(Math.PI / 2 + 0.12);
    finGeo.center();
    red.push(put(finGeo, fx, fy + 0.21, fz + 0.02));

    // eye assembly (static in the game: the whole body sways instead)
    const ex = 0;
    const ey = -0.03;
    const ez = R - 0.06;
    armor.push(put(new TorusGeometry(0.28, 0.055, 16, 40), ex, ey, ez));
    gun.push(put(new CylinderGeometry(0.245, 0.265, 0.12, 32).rotateX(Math.PI / 2), ex, ey, ez + 0.02));
    chrome.push(put(new TorusGeometry(0.185, 0.014, 12, 36), ex, ey, ez + 0.082));
    glow.push(put(new TorusGeometry(0.155, 0.021, 14, 40), ex, ey, ez + 0.086));
    glass.push(put(new SphereGeometry(0.145, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.48).rotateX(Math.PI / 2), ex, ey, ez + 0.055));

    this.mesh(this.body, armor, m.mainArmor);
    this.mesh(this.body, shellIn, m.innerShell);
    this.mesh(this.body, black, m.black);
    this.mesh(this.body, gun, m.gun);
    this.mesh(this.body, chrome, m.chrome);
    this.mesh(this.body, red, m.red);
    this.mesh(this.body, glow, this.coreGlow);
    this.mesh(this.body, glass, this.lens);
  }

  private buildLegs(m: Record<'legArmor' | 'gun' | 'black', MeshStandardMaterial>): void {
    for (let i = 0; i < LEG_COUNT; i++) {
      const angle = FALLBACK_LEG_ANGLE[i] ?? 0;
      const hip = new Group();
      hip.rotation.order = 'YXZ';
      hip.position.set(Math.sin(angle) * HIP_RADIUS, -0.18, Math.cos(angle) * HIP_RADIUS);
      hip.rotation.y = angle;
      const knee = new Group();
      knee.position.set(0, 0.1, 0.54);
      hip.add(knee);

      const hipGun: Bucket = [put(new CylinderGeometry(0.18, 0.2, 0.24, 20).rotateZ(Math.PI / 2), 0, 0, 0), put(new BoxGeometry(0.18, 0.16, 0.56), 0, 0.04, 0.26, -0.18)];
      const hipBlack: Bucket = [put(new BoxGeometry(0.24, 0.11, 0.36), 0, 0.05, 0.24, -0.18)];
      this.mesh(hip, hipGun, m.gun);
      this.mesh(hip, hipBlack, m.black);

      const kneeGun: Bucket = [new CylinderGeometry(0.185, 0.185, 0.26, 24).rotateZ(Math.PI / 2)];
      const led: Bucket = [];
      for (const side of [-1, 1]) {
        kneeGun.push(put(new CylinderGeometry(0.125, 0.125, 0.03, 20).rotateZ(Math.PI / 2), side * 0.135, 0, 0));
        for (let s = 0; s < 3; s++) {
          led.push(put(new TorusGeometry(0.145, 0.011, 8, 16, Math.PI * 0.52), side * 0.132, 0, 0, s * ((Math.PI * 2) / 3) + 0.2, Math.PI / 2, 0));
        }
      }
      kneeGun.push(put(new BoxGeometry(0.16, 0.72, 0.14), 0, -0.38, 0.04, 0.12));
      kneeGun.push(put(new CylinderGeometry(0.11, 0.11, 0.24, 20).rotateZ(Math.PI / 2), 0, -0.74, -0.02));
      kneeGun.push(put(new BoxGeometry(0.17, 0.15, 0.24), 0, -0.86, 0));

      const shape = new Shape();
      shape.moveTo(-0.08, 0.26);
      shape.quadraticCurveTo(0.28, 0.28, 0.34, -0.18);
      shape.quadraticCurveTo(0.36, -0.58, 0.14, -0.88);
      shape.lineTo(0.02, -0.84);
      shape.quadraticCurveTo(0.16, -0.52, 0.12, -0.16);
      shape.quadraticCurveTo(0.08, 0.08, -0.1, 0.1);
      shape.closePath();
      const shin = new ExtrudeGeometry(shape, { depth: 0.34, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.028, bevelThickness: 0.035, curveSegments: 14 });
      shin.center();
      shin.rotateY(-Math.PI / 2);
      put(shin, 0, -0.34, 0.14);

      const ledMat = this.coreGlow.clone();
      ledMat.emissiveIntensity = 2;
      this.ledMats.push(ledMat);
      this.mesh(knee, kneeGun, m.gun);
      this.mesh(knee, [shin], m.legArmor);
      this.mesh(knee, led, ledMat);

      const anchor = new Object3D();
      anchor.position.set(0, -0.66, -0.05);
      knee.add(anchor);
      this.body.add(hip);
      this.legs.push({ hip, knee, anchor, front: Math.abs(angle) < 1.5 });
    }
  }

  private buildPistons(gun: MeshStandardMaterial, chrome: MeshStandardMaterial): void {
    for (let i = 0; i < LEG_COUNT; i++) {
      const angle = FALLBACK_LEG_ANGLE[i] ?? 0;
      const a = new Object3D();
      a.position.set(Math.sin(angle) * 0.42, -0.78, Math.cos(angle) * 0.42);
      this.body.add(a);
      const barrelParts: Bucket = [
        new CylinderGeometry(0.036, 0.036, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5),
        new CylinderGeometry(0.044, 0.044, 0.06, 12).rotateX(Math.PI / 2).translate(0, 0, 0.96),
        new SphereGeometry(0.048, 10, 8),
      ];
      const rodParts: Bucket = [new CylinderGeometry(0.023, 0.023, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5), new SphereGeometry(0.048, 10, 8)];
      const barrel = new Mesh(merge(barrelParts), gun);
      const rod = new Mesh(merge(rodParts), chrome);
      barrel.frustumCulled = false;
      rod.frustumCulled = false;
      this.mech.add(barrel, rod);
      this.pistons.push({ a, barrel, rod });
    }
  }

  setWeakPoint(index: number, hp: number, maxHp: number): void {
    this.fraction[index] = Math.max(0, hp / maxHp);
    if (hp <= 0 && this.alive[index]) {
      this.alive[index] = false;
      const mat = this.ledMats[index];
      if (mat) {
        mat.emissive.set(0x000000);
        mat.emissiveIntensity = 0;
        mat.color.set(0x1a0d0d);
      }
    }
  }

  setCoreExposed(exposed: boolean): void {
    this.exposed = exposed;
  }

  update(time: number, dt: number, a: BodyAnim): void {
    this.gait += (a.travelled / BOSS_LOCAL.gait.cycleLength) * Math.PI * 2;
    for (let i = 0; i < this.ledMats.length; i++) {
      const mat = this.ledMats[i];
      if (!mat || !this.alive[i]) continue;
      const f = this.fraction[i] ?? 1;
      const flick = f < 1 ? 1 - (1 - f) * 0.7 * (Math.sin(time * BOSS_LOCAL.flickerHz + i * 2.1) > 0.2 ? 0 : 1) : 1;
      mat.emissiveIntensity = (0.4 + 2.2 * f) * flick;
    }
    const pulse = 1 + Math.sin(time * 8) * 0.25;
    this.coreGlow.emissiveIntensity = (this.exposed ? 3.2 : 1.8) * pulse + a.cannonCharge * 4;
    this.lens.emissiveIntensity = this.exposed ? 2.2 + Math.sin(time * 6) * 0.6 : a.cannonCharge * 2;
    this.pose(time, a, dt);
  }

  private pose(time: number, a: BodyAnim, _dt: number): void {
    const m = a.collapse;
    const idle = 1 - Math.min(1, m * 2);
    const breathe = Math.sin(time * 2.2) * 0.035 * idle;
    this.body.position.y = BODY_UNIT_Y + breathe + (1.04 - BODY_UNIT_Y) * m;
    this.body.rotation.y = Math.sin(time * 1.1) * 0.04 * idle;
    this.body.rotation.z = Math.cos(time * 1.1) * 0.015 * idle;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      if (!leg) continue;
      const p = i < 2 ? this.gait : this.gait + Math.PI;
      const walk = a.walk;
      let hx = -0.08 - breathe * 0.65 + Math.sin(p) * 0.3 * walk;
      let kx = 0.08 + breathe * 0.85 + Math.max(0, Math.cos(p)) * 0.4 * walk;
      if (leg.front) {
        hx -= a.slamRaise * 0.9;
        kx += a.slamRaise * 0.35;
      }
      leg.hip.rotation.x = hx + (-0.35 - hx) * m;
      leg.knee.rotation.x = kx + (1.3 - kx) * m;
    }
    this.root.updateMatrixWorld(true);
    invMech.copy(this.mech.matrixWorld).invert();
    invRoot.copy(this.root.matrixWorld).invert();
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      const piston = this.pistons[i];
      if (!leg || !piston) continue;
      this.kneeRoot[i]?.setFromMatrixPosition(leg.knee.matrixWorld).applyMatrix4(invRoot);
      tmpA.setFromMatrixPosition(piston.a.matrixWorld).applyMatrix4(invMech);
      tmpB.setFromMatrixPosition(leg.anchor.matrixWorld).applyMatrix4(invMech);
      tmpDir.copy(tmpB).sub(tmpA);
      const dist = tmpDir.length();
      if (dist < 1e-5) continue;
      tmpDir.multiplyScalar(1 / dist);
      tmpQ.setFromUnitVectors(Z_AXIS, tmpDir);
      piston.barrel.position.copy(tmpA);
      piston.barrel.quaternion.copy(tmpQ);
      piston.barrel.scale.set(1, 1, dist * 0.56);
      tmpDir.negate();
      tmpQ.setFromUnitVectors(Z_AXIS, tmpDir);
      piston.rod.position.copy(tmpB);
      piston.rod.quaternion.copy(tmpQ);
      piston.rod.scale.set(1, 1, dist * 0.58);
    }
  }
}
