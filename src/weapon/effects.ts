import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  PointLight,
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
  mesh: Mesh;
  from: Vector3;
  to: Vector3;
  /** Seconds since the shot and total flight time. */
  age: number;
  duration: number;
}
interface Casing {
  mesh: Mesh;
  velocity: Vector3;
  spin: Vector3;
  life: number;
}

/**
 * Pooled weapon effects: muzzle flash (HDR star that blooms, plus one shared point light that lights
 * the surroundings for a few frames), tracer streaks that fly from the muzzle to the hit, and shell casings
 * (simple ballistic arc, no physics bodies). Every pool is capped; an exhausted pool skips the effect.
 */
export class WeaponEffects {
  private readonly flashes: ObjectPool<Flash>;
  private readonly tracers: ObjectPool<Tracer>;
  private readonly casings: ObjectPool<Casing>;
  private readonly liveFlashes: Flash[] = [];
  private readonly liveTracers: Tracer[] = [];
  private readonly liveCasings: Casing[] = [];
  /** One light for every flash: always in the scene (intensity 0 when idle) so no shader recompiles. */
  private readonly flashLight: PointLight;
  private flashLightLife = 0;

  constructor(
    scene: Scene,
    flashParent: Object3D,
    res: ResourceTracker,
  ) {
    const star = new Shape();
    const points = 8;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? FX.flashRadius : FX.flashRadius * 0.28;
      const a = (i / (points * 2)) * Math.PI * 2;
      if (i === 0) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const flashGeometry = res.track(new ShapeGeometry(star));
    const flashMaterial = res.track(
      new MeshBasicMaterial({
        color: 0xffffff,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    // HDR colour: brighter than 1 so the bloom pass picks it up
    flashMaterial.color.setRGB(FX.flashColor[0], FX.flashColor[1], FX.flashColor[2]);
    this.flashLight = new PointLight(FX.flashLightColor, 0, FX.flashLightRange, 2);
    this.flashLight.castShadow = false;
    flashParent.add(res.track(this.flashLight));
    const tracerGeometry = res.track(new BoxGeometry(1, 1, 1));
    const tracerMaterial = res.track(
      new MeshBasicMaterial({ color: 0xffffff, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }),
    );
    tracerMaterial.color.setRGB(FX.tracerColor[0], FX.tracerColor[1], FX.tracerColor[2]);
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
        const mesh = new Mesh(tracerGeometry, tracerMaterial);
        mesh.visible = false;
        mesh.frustumCulled = false;
        scene.add(res.track(mesh));
        return { mesh, from: new Vector3(), to: new Vector3(), age: 0, duration: 0 };
      },
      reset: (t) => {
        t.mesh.visible = false;
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
    this.flashLight.position.copy(localMuzzle);
    this.flashLight.intensity = FX.flashLightIntensity;
    this.flashLightLife = FX.flashLightLifetime;
    this.liveFlashes.push(f);
  }

  spawnTracer(from: Vector3, to: Vector3): void {
    const t = this.tracers.acquire();
    if (!t) return;
    t.from.copy(from);
    t.to.copy(to);
    t.age = 0;
    t.duration = Math.min(FX.tracerMaxTime, Math.max(FX.tracerMinTime, from.distanceTo(to) / FX.tracerSpeed));
    t.mesh.visible = true;
    this.poseTracer(t);
    this.liveTracers.push(t);
  }

  /** A bright streak of `tracerLength` metres whose head travels from the muzzle to the hit point. */
  private poseTracer(t: Tracer): void {
    const total = t.from.distanceTo(t.to);
    const head = Math.min(1, t.age / t.duration) * total;
    const tail = Math.max(0, head - FX.tracerLength);
    const len = Math.max(0.05, head - tail);
    const mid = (head + tail) / 2 / Math.max(total, 1e-6);
    t.mesh.position.lerpVectors(t.from, t.to, mid);
    t.mesh.lookAt(t.to);
    t.mesh.scale.set(FX.tracerWidth, FX.tracerWidth, len);
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
    if (this.flashLightLife > 0) {
      this.flashLightLife -= dt;
      this.flashLight.intensity = this.flashLightLife > 0 ? FX.flashLightIntensity * (this.flashLightLife / FX.flashLightLifetime) : 0;
    }
    for (let i = this.liveTracers.length - 1; i >= 0; i--) {
      const t = this.liveTracers[i];
      if (!t) continue;
      t.age += dt;
      if (t.age >= t.duration + FX.tracerLength / FX.tracerSpeed) {
        this.tracers.release(t);
        this.liveTracers.splice(i, 1);
      } else {
        this.poseTracer(t);
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
    this.flashLight.intensity = 0;
    this.flashLightLife = 0;
    // pooled meshes/lines are removed from the scene by the ResourceTracker scope
  }
}
