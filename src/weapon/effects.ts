import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  Shape,
  ShapeGeometry,
  type Scene,
  Vector3,
} from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { WEAPON } from '@/config/tunables';
import { ObjectPool } from '@/core/ObjectPool';
import { WEAPON_LOCAL } from './tunables';

const FX = WEAPON_LOCAL.effects;

interface Flash {
  mesh: Mesh;
  life: number;
}
interface Tracer {
  line: Line;
  positions: BufferAttribute;
  material: LineBasicMaterial;
  life: number;
}
interface Casing {
  mesh: Mesh;
  velocity: Vector3;
  spin: Vector3;
  life: number;
}

/**
 * Pooled weapon effects: muzzle flash (emissive star, no light), tracer lines and shell casings
 * (simple ballistic arc, no physics bodies). Every pool is capped; an exhausted pool skips the effect.
 */
export class WeaponEffects {
  private readonly flashes: ObjectPool<Flash>;
  private readonly tracers: ObjectPool<Tracer>;
  private readonly casings: ObjectPool<Casing>;
  private readonly liveFlashes: Flash[] = [];
  private readonly liveTracers: Tracer[] = [];
  private readonly liveCasings: Casing[] = [];

  constructor(
    scene: Scene,
    flashParent: Object3D,
    res: ResourceTracker,
  ) {
    const star = new Shape();
    const points = 8;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? 0.07 : 0.02;
      const a = (i / (points * 2)) * Math.PI * 2;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const flashGeometry = res.track(new ShapeGeometry(star));
    const flashMaterial = res.track(
      new MeshBasicMaterial({
        color: 0xffc766,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    const casingGeometry = res.track(new CylinderGeometry(FX.casingRadius, FX.casingRadius, FX.casingLength, 6));
    const casingMaterial = res.track(new MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.35 }));

    this.flashes = new ObjectPool<Flash>({
      capacity: FX.flashPoolSize,
      create: () => {
        const mesh = new Mesh(flashGeometry, flashMaterial);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 11;
        flashParent.add(res.track(mesh));
        return { mesh, life: 0 };
      },
      reset: (f) => {
        f.mesh.visible = false;
      },
    });

    this.tracers = new ObjectPool<Tracer>({
      capacity: WEAPON.maxTracers,
      create: () => {
        const geometry = new BufferGeometry();
        const positions = new BufferAttribute(new Float32Array(6), 3);
        geometry.setAttribute('position', positions);
        const material = new LineBasicMaterial({
          color: FX.tracerColor,
          transparent: true,
          blending: AdditiveBlending,
          depthWrite: false,
        });
        const line = new Line(geometry, material);
        line.visible = false;
        line.frustumCulled = false;
        scene.add(res.track(line));
        return { line, positions, material, life: 0 };
      },
      reset: (t) => {
        t.line.visible = false;
      },
    });

    this.casings = new ObjectPool<Casing>({
      capacity: WEAPON.maxShellCasings,
      create: () => {
        const mesh = new Mesh(casingGeometry, casingMaterial);
        mesh.visible = false;
        scene.add(res.track(mesh));
        return { mesh, velocity: new Vector3(), spin: new Vector3(), life: 0 };
      },
      reset: (c) => {
        c.mesh.visible = false;
      },
    });
  }

  /** Flash at the view model muzzle (parent-local coordinates). */
  spawnFlash(localMuzzle: Vector3): void {
    const f = this.flashes.acquire();
    if (!f) return;
    f.life = FX.flashLifetime;
    f.mesh.position.copy(localMuzzle);
    f.mesh.rotation.z = Math.random() * Math.PI;
    f.mesh.scale.setScalar(0.8 + Math.random() * 0.6);
    f.mesh.visible = true;
    this.liveFlashes.push(f);
  }

  spawnTracer(from: Vector3, to: Vector3): void {
    const t = this.tracers.acquire();
    if (!t) return;
    t.life = FX.tracerLifetime;
    t.positions.setXYZ(0, from.x, from.y, from.z);
    t.positions.setXYZ(1, to.x, to.y, to.z);
    t.positions.needsUpdate = true;
    t.material.opacity = 1;
    t.line.visible = true;
    this.liveTracers.push(t);
  }

  spawnCasing(position: Vector3, velocity: Vector3): void {
    const c = this.casings.acquire();
    if (!c) return;
    c.life = FX.casingLifetime;
    c.mesh.position.copy(position);
    c.velocity.copy(velocity);
    c.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(FX.casingSpin);
    c.mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    c.mesh.visible = true;
    this.liveCasings.push(c);
  }

  update(dt: number): void {
    for (let i = this.liveFlashes.length - 1; i >= 0; i--) {
      const f = this.liveFlashes[i];
      if (!f) continue;
      f.life -= dt;
      if (f.life <= 0) {
        this.flashes.release(f);
        this.liveFlashes.splice(i, 1);
      }
    }
    for (let i = this.liveTracers.length - 1; i >= 0; i--) {
      const t = this.liveTracers[i];
      if (!t) continue;
      t.life -= dt;
      t.material.opacity = Math.max(0, t.life / FX.tracerLifetime);
      if (t.life <= 0) {
        this.tracers.release(t);
        this.liveTracers.splice(i, 1);
      }
    }
    for (let i = this.liveCasings.length - 1; i >= 0; i--) {
      const c = this.liveCasings[i];
      if (!c) continue;
      c.life -= dt;
      c.velocity.y -= FX.casingGravity * dt;
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.spin.x * dt;
      c.mesh.rotation.y += c.spin.y * dt;
      c.mesh.rotation.z += c.spin.z * dt;
      if (c.life <= 0 || c.mesh.position.y < 0) {
        this.casings.release(c);
        this.liveCasings.splice(i, 1);
      }
    }
  }

  get liveCounts(): { flashes: number; tracers: number; casings: number } {
    return { flashes: this.flashes.liveCount, tracers: this.tracers.liveCount, casings: this.casings.liveCount };
  }

  dispose(): void {
    this.flashes.releaseAll();
    this.tracers.releaseAll();
    this.casings.releaseAll();
    this.liveFlashes.length = 0;
    this.liveTracers.length = 0;
    this.liveCasings.length = 0;
    // pooled meshes/lines are removed from the scene by the ResourceTracker scope
  }
}
