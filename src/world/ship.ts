import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Shape,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SHIP_BACKDROP } from '@/config/level';
import { WORLD } from '@/config/tunables';
import { createRng } from './rng';
import { WORLD_LOCAL } from './tunables';

function colored(geo: BufferGeometry, hex: number): BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.clearGroups();
  const c = new Color(hex);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return g;
}

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, hex: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return colored(g, hex);
}

/**
 * Low-poly cargo ship (GDD 7.1): hull prism, deck container stacks and a superstructure merged
 * into ONE geometry with vertex colours. Static decoration: no collider, no interior.
 * Bow points to +X; the mesh is placed at `SHIP_BACKDROP`.
 */
export function createShip(): Mesh {
  const { length: len, beam, hullDepth, hullBottom } = WORLD_LOCAL.ship;
  const rng = createRng(99);

  const shape = new Shape();
  shape.moveTo(-len / 2, -beam / 2);
  shape.lineTo(len / 2 - 35, -beam / 2);
  shape.lineTo(len / 2, 0);
  shape.lineTo(len / 2 - 35, beam / 2);
  shape.lineTo(-len / 2, beam / 2);
  shape.closePath();
  const hull = new ExtrudeGeometry(shape, { depth: hullDepth, bevelEnabled: false });
  hull.rotateX(-Math.PI / 2); // extrude upwards
  hull.translate(0, hullBottom, 0);
  const parts: BufferGeometry[] = [colored(hull, 0x3d2f2c)];

  const deckY = hullBottom + hullDepth;
  const cl = WORLD.container.length;
  const ch = WORLD.container.height;
  const cw = WORLD.container.width;
  const cols = Math.floor((len - 90) / (cl + 0.2));
  const rows = Math.floor((beam - 4) / (cw + 0.2));
  const startX = -len / 2 + 45;
  const startZ = -((rows - 1) * (cw + 0.2)) / 2;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const stack = 1 + Math.floor(rng() * 4);
      for (let t = 0; t < stack; t++) {
        const hex = WORLD_LOCAL.containerColors[Math.floor(rng() * WORLD_LOCAL.containerColors.length)] ?? 0x888888;
        parts.push(boxAt(cl, ch, cw, startX + i * (cl + 0.2), deckY + (t + 0.5) * ch, startZ + j * (cw + 0.2), hex));
      }
    }
  }
  // superstructure and bridge at the stern
  parts.push(boxAt(30, 22, beam - 6, -len / 2 + 20, deckY + 11, 0, 0xd0d2d0));
  parts.push(boxAt(14, 7, beam - 4, -len / 2 + 18, deckY + 25.5, 0, 0xe4e6e4));
  parts.push(boxAt(4, 14, 4, -len / 2 + 12, deckY + 29, 0, 0xa83a2e));

  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const mesh = new Mesh(merged, new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }));
  mesh.name = 'ship-backdrop';
  mesh.position.set(SHIP_BACKDROP.position.x, SHIP_BACKDROP.position.y, SHIP_BACKDROP.position.z);
  mesh.rotation.y = SHIP_BACKDROP.yaw;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}
