import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type V3 = readonly [number, number, number];

const tmpPos = new Vector3();
const tmpScale = new Vector3();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();
const tmpLocal = new Matrix4();
const tmpColor = { r: 0, g: 0, b: 0 };

/**
 * Collects parts, paints each with a vertex colour and merges them into one geometry (one draw call).
 * Parts are authored in the reference model's units; `base` and the merge transform bake pose and scale.
 */
export class Parts {
  private readonly list: BufferGeometry[] = [];
  /** Matrix applied to every part added after it is set (group transform). */
  base = new Matrix4();

  get count(): number {
    return this.list.length;
  }

  add(geo: BufferGeometry, color: number, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 = [1, 1, 1]): this {
    tmpPos.set(pos[0], pos[1], pos[2]);
    tmpQuat.setFromEuler(tmpEuler.set(rot[0], rot[1], rot[2]));
    tmpScale.set(scale[0], scale[1], scale[2]);
    tmpLocal.compose(tmpPos, tmpQuat, tmpScale).premultiply(this.base);
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    g.applyMatrix4(tmpLocal);
    const n = g.getAttribute('position').count;
    const c = hexToLinear(color);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new Float32BufferAttribute(arr, 3));
    this.list.push(g);
    return this;
  }

  /** Merges all parts into one geometry, optionally transformed (pose/scale bake). */
  merge(transform?: Matrix4): BufferGeometry {
    const merged = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    this.list.length = 0;
    if (!merged) throw new Error('modelKit: nothing to merge');
    if (transform) merged.applyMatrix4(transform);
    merged.computeBoundingSphere();
    return merged;
  }
}

function hexToLinear(hex: number): { r: number; g: number; b: number } {
  // sRGB -> linear, matching three's colour management for vertex colours
  const f = (v: number): number => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  tmpColor.r = f(((hex >> 16) & 255) / 255);
  tmpColor.g = f(((hex >> 8) & 255) / 255);
  tmpColor.b = f((hex & 255) / 255);
  return tmpColor;
}

/** The one material used by all merged robot parts. */
export function createVertexColorMaterial(roughness = 0.45, metalness = 0.18): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness, metalness });
}

export function box(w: number, h: number, d: number, radius = 0): BufferGeometry {
  const r = Math.min(radius, w / 2.01, h / 2.01, d / 2.01);
  return r < 0.02 ? new BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r);
}

export function cylX(r: number, len: number, seg = 14): BufferGeometry {
  const g = new CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  return g;
}

export function cylY(r: number, len: number, seg = 14): BufferGeometry {
  return new CylinderGeometry(r, r, len, seg);
}

export function cylZ(r: number, len: number, seg = 14): BufferGeometry {
  const g = new CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

export function sphere(r: number, wSeg = 12, hSeg = 8): BufferGeometry {
  return new SphereGeometry(r, wSeg, hSeg);
}

export function torusX(major: number, tube: number, seg = 20): BufferGeometry {
  const g = new TorusGeometry(major, tube, 6, seg);
  g.rotateY(Math.PI / 2);
  return g;
}

const UP = new Vector3(0, 1, 0);
const rodDir = new Vector3();

/** Cylinder between two points (radius rA at a, rB at b). Returns geometry already placed. */
export function rod(a: V3, b: V3, rA: number, rB: number, seg = 8): BufferGeometry {
  rodDir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = rodDir.length();
  const g = new CylinderGeometry(rB, rA, len, seg);
  tmpQuat.setFromUnitVectors(UP, rodDir.normalize());
  tmpPos.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  g.applyMatrix4(tmpLocal.compose(tmpPos, tmpQuat, tmpScale.set(1, 1, 1)));
  return g;
}

/**
 * Elliptical shell swept along a Catmull-Rom path (ported from the reference thigh / lower-leg builder).
 * `radiusA` / `radiusB` are [start, end, bulge].
 */
export function sweptLink(
  points: ReadonlyArray<V3>,
  radiusA: V3,
  radiusB: V3,
  radial = 10,
  tubular = 14,
): BufferGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.5);
  const frames = curve.computeFrenetFrames(tubular, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const center = new Vector3();
  const n = new Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, center);
    const rA = radiusA[0] + (radiusA[1] - radiusA[0]) * t + Math.sin(Math.PI * t) * radiusA[2];
    const rB = radiusB[0] + (radiusB[1] - radiusB[0]) * t + Math.sin(Math.PI * t) * radiusB[2];
    const fn = frames.normals[i];
    const fb = frames.binormals[i];
    if (!fn || !fb) continue;
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * Math.PI * 2;
      n.copy(fn).multiplyScalar(Math.cos(v) * rA).addScaledVector(fb, Math.sin(v) * rB);
      positions.push(center.x + n.x, center.y + n.y, center.z + n.z);
      n.normalize();
      normals.push(n.x, n.y, n.z);
      if (i < tubular && j < radial) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new Float32BufferAttribute(new Array<number>((positions.length / 3) * 2).fill(0), 2));
  g.setIndex(indices);
  return g;
}
