import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  ShaderMaterial,
  SpotLight,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { Collider } from '@dimforge/rapier3d-compat';
import { CRANE_SITES, LAND } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { applyWeatheredPaint } from '@/world/containerModel';
import { WORLD_LOCAL } from '@/world/tunables';
import { CRANE, FLOOD_LIGHTS, PROPS, structureSolids, type Prop, type PropKind } from './layout';
import { buildBarrier, buildBollard, buildCabin, buildCone, buildCrane, buildDrum, buildFence, buildMast, buildPallet } from './models';
import { STRUCTURES } from './tunables';

const MODULE_ID = 'structures';

const coneVertex = /* glsl */ `
varying float vAxis;
varying vec3 vN;
varying vec3 vV;
void main() {
  vAxis = 1.0 - uv.y;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

// Fake volumetric beam: brightest near the lamp and where the view grazes through the middle of the
// cone, fading at the silhouette; slow noise makes the rain haze drift through it.
const coneFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
varying float vAxis;
varying vec3 vN;
varying vec3 vV;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float body = pow(facing, 2.2);
  float along = pow(1.0 - vAxis, 1.7) * smoothstep(0.0, 0.04, vAxis);
  float haze = 0.75 + 0.5 * noise(vec2(vAxis * 9.0 - uTime * 0.35, gl_FragCoord.x * 0.01 + uTime * 0.05));
  float a = body * along * haze * uStrength;
  gl_FragColor = vec4(uColor * a, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function createChainLinkTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) {
    g.clearRect(0, 0, size, size);
    g.strokeStyle = 'rgba(190,196,200,1)';
    g.lineWidth = 5;
    // two diagonal wire families = diamond mesh, 2 diamonds per tile
    for (let i = -2; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64 + size, size);
      g.stroke();
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64 - size, size);
      g.stroke();
    }
  }
  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Everything that stands on the quay besides containers: the gantry crane, flood-light masts with
 * real spot lights and volumetric beams, the perimeter fence and the hand-placed props.
 */
export function createStructuresModule(): GameModule {
  let res: ReturnType<GameContext['resources']['scope']> | null = null;
  let colliders: Collider[] = [];
  const cones: ShaderMaterial[] = [];
  let beaconMat: MeshBasicMaterial | null = null;
  let time = 0;

  return {
    id: MODULE_ID,

    init(ctx) {
      if (ctx.flags.sandbox) return;
      const scope = ctx.resources.scope(MODULE_ID);
      res = scope;
      const scene = ctx.scene;
      const add = <T extends Object3D>(o: T): T => {
        scene.add(scope.track(o));
        return o;
      };
      const obj = new Object3D();

      // ---- shared materials -------------------------------------------------------------------
      const galvanised = new MeshStandardMaterial({ color: 0x7d8387, roughness: 0.42, metalness: 0.85 });
      applyWeatheredPaint(galvanised, { bottomY: 0, height: 12, wear: 0.55, key: 'galv' });
      const darkSteel = new MeshStandardMaterial({ color: 0x23272b, roughness: 0.5, metalness: 0.8 });
      const lensMat = new MeshBasicMaterial({ color: 0xffffff });
      lensMat.color.setRGB(7, 5.6, 3.6);

      // ---- flood-light masts ------------------------------------------------------------------
      const coneGeo = scope.track(new ConeGeometry(1, 1, 28, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2));
      const head = new Vector3();
      const aim = new Vector3();
      for (const f of FLOOD_LIGHTS) {
        const mast = buildMast(f.height);
        const yaw = Math.atan2(f.aimX - f.x, f.aimZ - f.z);
        const steel = add(new Mesh(mast.steel, galvanised));
        steel.position.set(f.x, 0, f.z);
        steel.rotation.y = yaw;
        steel.castShadow = true;
        steel.receiveShadow = true;
        const lens = add(new Mesh(mast.lens, lensMat));
        lens.position.copy(steel.position);
        lens.rotation.y = yaw;

        head.set(f.x + Math.sin(yaw) * mast.headZ, mast.headY - 0.1, f.z + Math.cos(yaw) * mast.headZ);
        aim.set(f.aimX, 0, f.aimZ);
        const spot = new SpotLight(f.color, f.intensity * STRUCTURES.floodGain, STRUCTURES.floodRange, STRUCTURES.floodAngle, STRUCTURES.floodPenumbra, 2);
        spot.name = `flood-${f.id}`;
        spot.position.copy(head);
        spot.target.position.copy(aim);
        spot.castShadow = f.castShadow;
        if (f.castShadow) {
          spot.shadow.mapSize.set(STRUCTURES.floodShadowSize, STRUCTURES.floodShadowSize);
          spot.shadow.camera.near = 1.5;
          spot.shadow.camera.far = STRUCTURES.floodRange;
          spot.shadow.bias = -0.0008;
          spot.shadow.normalBias = 0.06;
          spot.shadow.radius = 4;
        }
        add(spot);
        scene.add(spot.target);
        scope.onDispose(() => {
          spot.target.removeFromParent();
          spot.shadow.map?.dispose();
        });

        const dist = head.distanceTo(aim);
        const coneMat = new ShaderMaterial({
          vertexShader: coneVertex,
          fragmentShader: coneFragment,
          uniforms: { uColor: { value: new Color(f.color) }, uStrength: { value: STRUCTURES.beamStrength }, uTime: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: AdditiveBlending,
          side: DoubleSide,
          fog: false,
        });
        cones.push(coneMat);
        const cone = add(new Mesh(coneGeo, coneMat));
        cone.name = `beam-${f.id}`;
        cone.position.copy(head);
        const length = dist * 1.05;
        const radius = Math.tan(STRUCTURES.floodAngle * 0.82) * length;
        cone.scale.set(radius, radius, length);
        cone.lookAt(aim);
        cone.renderOrder = 6;
        cone.userData.noReflect = true;
      }

      // ---- gantry crane -------------------------------------------------------------------------
      const crane = buildCrane();
      const cranePaint = new MeshStandardMaterial({ color: CRANE.color, roughness: 0.45, metalness: 0.3 });
      applyWeatheredPaint(cranePaint, { bottomY: 0, height: CRANE.apexY, wear: 0.55, key: 'crane' });
      const beacon = new MeshBasicMaterial({ color: 0xffffff });
      beacon.color.setRGB(6, 0.5, 0.3);
      beaconMat = beacon;
      for (const site of CRANE_SITES) {
        const parts: Array<[BufferGeometry, Material, boolean]> = [
          [crane.paint, cranePaint, true],
          [crane.dark, darkSteel, true],
          [crane.glow, lensMat, false],
          [crane.beacon, beacon, false],
        ];
        for (const [geo, mat, shadow] of parts) {
          const m = add(new Mesh(geo, mat));
          m.position.set(site.position.x, 0, site.position.z);
          m.rotation.y = site.yaw;
          m.castShadow = shadow;
          m.receiveShadow = shadow;
          m.name = `${site.id}`;
        }
        // two work lights under the portal beam, pointing straight down at the quay
        for (const sx of [-0.55, 0.55]) {
          const x = site.position.x + sx * CRANE.legX;
          const z = site.position.z - CRANE.legZ;
          const spot = new SpotLight(CRANE.workLight.color, CRANE.workLight.intensity * STRUCTURES.floodGain, 40, 0.75, 0.6, 2);
          spot.position.set(x, CRANE.workLight.y, z);
          spot.target.position.set(x - sx * 3, 0, z + 2);
          spot.castShadow = false;
          add(spot);
          scene.add(spot.target);
          scope.onDispose(() => spot.target.removeFromParent());
        }
      }

      // ---- fence on the kerb (west, south, east; the quay edge stays open to the water) ---------
      const k = WORLD_LOCAL.barriers;
      const inset = k.parapetThickness / 2;
      const { minX, maxX, minZ, maxZ } = LAND;
      const fence = buildFence(
        [
          { x0: minX + inset, z0: minZ + 4, x1: minX + inset, z1: maxZ - inset },
          { x0: minX + inset, z0: maxZ - inset, x1: maxX - inset, z1: maxZ - inset },
          { x0: maxX - inset, z0: maxZ - inset, x1: maxX - inset, z1: minZ + 4 },
        ],
        k.parapetHeight,
        STRUCTURES.fenceHeight,
      );
      const frame = add(new Mesh(fence.frame, galvanised));
      frame.castShadow = true;
      const chain = createChainLinkTexture();
      const meshMat = new MeshStandardMaterial({ map: chain, alphaTest: 0.45, side: DoubleSide, roughness: 0.45, metalness: 0.9, color: 0xaab0b4 });
      const fenceMesh = add(new Mesh(fence.mesh, meshMat));
      fenceMesh.name = 'fence-mesh';

      // ---- props --------------------------------------------------------------------------------
      const byKind = (kind: PropKind): Prop[] => PROPS.filter((p) => p.kind === kind);
      const instanced = (geo: BufferGeometry, mat: Material, items: readonly Prop[], color?: (p: Prop) => number, yOffset = 0): InstancedMesh | null => {
        if (items.length === 0) return null;
        const mesh = new InstancedMesh(geo, mat, items.length);
        const c = new Color();
        items.forEach((p, i) => {
          obj.position.set(p.x, yOffset, p.z);
          obj.rotation.set(0, p.yaw, 0);
          obj.scale.setScalar(1);
          obj.updateMatrix();
          mesh.setMatrixAt(i, obj.matrix);
          if (color) mesh.setColorAt(i, c.setHex(color(p)));
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        return add(mesh);
      };

      const concrete = new MeshStandardMaterial({ color: 0x8b8d8a, roughness: 0.7, metalness: 0 });
      applyWeatheredPaint(concrete, { bottomY: 0, height: 0.85, wear: 0.25, key: 'concrete' });
      instanced(buildBarrier(), concrete, byKind('barrier'));

      const drumPaint = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.45 });
      applyWeatheredPaint(drumPaint, { bottomY: 0, height: 0.9, wear: 1.3, key: 'drum' });
      const drumColors = [0x1f4f8a, 0x8a1f1f, 0x2e6b3a, 0x242628, 0xb58a12];
      instanced(buildDrum(), drumPaint, byKind('drum'), (p) => drumColors[Math.floor(p.variant * drumColors.length)] ?? 0x1f4f8a);

      const pallet = buildPallet();
      const wood = new MeshStandardMaterial({ color: 0x6f5334, roughness: 0.82, metalness: 0 });
      applyWeatheredPaint(wood, { bottomY: 0, height: 1.2, wear: 0.15, key: 'wood' });
      const crateMat = new MeshStandardMaterial({ color: 0x5d6a4a, roughness: 0.75, metalness: 0.05 });
      applyWeatheredPaint(crateMat, { bottomY: 0, height: 1.2, wear: 0.5, key: 'crate' });
      instanced(pallet.wood, wood, byKind('pallet'));
      instanced(pallet.crate, crateMat, byKind('pallet'));

      const iron = new MeshStandardMaterial({ color: 0x1b1d1f, roughness: 0.55, metalness: 0.75 });
      applyWeatheredPaint(iron, { bottomY: 0, height: 0.72, wear: 1.4, key: 'iron' });
      instanced(buildBollard(), iron, byKind('bollard'));

      const coneMat = new MeshStandardMaterial({ color: 0xe2571a, roughness: 0.55, metalness: 0 });
      instanced(buildCone(), coneMat, byKind('cone'));

      const cabin = buildCabin();
      const cabinPaint = new MeshStandardMaterial({ color: 0xb9bdb6, roughness: 0.5, metalness: 0.2 });
      applyWeatheredPaint(cabinPaint, { bottomY: 0, height: 2.9, wear: 0.9, key: 'cabin' });
      instanced(cabin.shell, cabinPaint, byKind('cabin'));
      instanced(cabin.trim, darkSteel, byKind('cabin'));
      const windowMat = new MeshBasicMaterial({ color: 0xffffff });
      windowMat.color.setRGB(3.2, 2.5, 1.5);
      const windows = instanced(cabin.windows, windowMat, byKind('cabin'));
      if (windows) windows.castShadow = false;

      // ---- colliders ----------------------------------------------------------------------------
      for (const s of structureSolids()) {
        colliders.push(ctx.physics.addStaticBox({ center: s.center, halfExtents: s.half, meta: { kind: 'static' } }));
      }
      scope.onDispose(() => {
        for (const c of colliders) {
          try {
            ctx.physics.removeCollider(c);
          } catch {
            // physics world may already be gone during Game.dispose
          }
        }
        colliders = [];
        cones.length = 0;
        beaconMat = null;
        delete ctx.testHooks[MODULE_ID];
      });

      ctx.testHooks[MODULE_ID] = {
        summary: () => ({ floodLights: FLOOD_LIGHTS.length, props: PROPS.length, cranes: CRANE_SITES.length, colliders: colliders.length }),
      };
    },

    update(dt) {
      time += dt;
      for (const m of cones) (m.uniforms.uTime as { value: number }).value = time;
      // slow double blink of the red obstruction lights
      if (beaconMat) {
        const t = time % 2.4;
        const on = t < 0.18 || (t > 0.36 && t < 0.54) ? 1 : 0.06;
        beaconMat.color.setRGB(6 * on, 0.5 * on, 0.3 * on);
      }
    },

    dispose() {
      res?.dispose();
      res = null;
    },
  };
}
