import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { WEAPON_LOCAL } from '../tunables';
import type { ViewModel, ViewModelState } from './ViewModel';

const VM = WEAPON_LOCAL.viewModel;

/** Rifle built from boxes and cylinders (7 meshes, 3 shared materials). */
export class ProceduralViewModel implements ViewModel {
  readonly object3d = new Group();
  readonly muzzleLocalPosition = new Vector3(VM.muzzle.x, VM.muzzle.y, VM.muzzle.z);
  readonly ejectionLocalPosition = new Vector3(VM.ejectionPort.x, VM.ejectionPort.y, VM.ejectionPort.z);

  private readonly rig = new Group();
  private readonly magazine: Mesh;
  private readonly magRestY: number;
  private kick = 0;
  private reloadDuration = 0;
  private reloadElapsed = 0;

  constructor(res: ResourceTracker) {
    const dark = new MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.55, metalness: 0.6 });
    const body = new MeshStandardMaterial({ color: 0x5b6169, roughness: 0.6, metalness: 0.4 });
    const accent = new MeshStandardMaterial({ color: 0xd9a514, roughness: 0.5, metalness: 0.3 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: MeshStandardMaterial) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      this.rig.add(mesh);
      return mesh;
    };

    box(0.06, 0.08, 0.34, 0, 0, -0.2, body); // receiver
    box(0.05, 0.05, 0.18, 0, -0.005, -0.43, dark); // handguard
    const barrel = new Mesh(new CylinderGeometry(0.011, 0.011, 0.2, 8), dark);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, -0.49);
    this.rig.add(barrel);
    box(0.05, 0.1, 0.22, 0, -0.01, 0.1, dark); // stock
    box(0.016, 0.03, 0.05, 0, 0.055, -0.14, accent); // sight
    box(0.035, 0.09, 0.05, 0, -0.08, -0.03, dark); // grip
    this.magazine = new Mesh(new BoxGeometry(0.04, 0.14, 0.06), accent);
    this.magRestY = -0.1;
    this.magazine.position.set(0, this.magRestY, -0.2);
    this.rig.add(this.magazine);

    this.object3d.add(this.rig);
    this.object3d.position.set(VM.offset.x, VM.offset.y, VM.offset.z);
    this.object3d.traverse((n) => {
      n.frustumCulled = false;
      n.renderOrder = 10;
    });
    res.track(this.object3d);
  }

  update(dt: number, state: ViewModelState): void {
    this.kick *= Math.exp(-VM.kickRecoverPerSec * dt);
    const moveAmt = Math.min(1, state.speed / 6);
    const calm = 1 - state.aim * (1 - VM.adsSwayKeep);
    const bob = Math.sin(state.time * VM.swayFrequency) * VM.swayAmount * moveAmt * calm;
    const sway = Math.sin(state.time * 1.3) * VM.swayAmount * 0.3 * calm;
    const sprint = state.sprinting ? 1 : 0;

    this.rig.position.set(
      bob + VM.ads.x * state.aim,
      Math.abs(bob) * 0.8 + sway - sprint * VM.sprintLowerMetres + VM.ads.y * state.aim,
      this.kick * VM.kickBackMetres * (1 - 0.5 * state.aim) + VM.ads.z * state.aim,
    );
    this.rig.rotation.set(this.kick * VM.kickPitchRad, sprint * VM.sprintTiltRad, 0);

    if (this.reloadDuration > 0) {
      this.reloadElapsed += dt;
      const t = Math.min(1, this.reloadElapsed / this.reloadDuration);
      // drop (0..0.3), hold out (0.3..0.65), insert (0.65..0.9), settle
      let drop = 0;
      if (t < 0.3) drop = t / 0.3;
      else if (t < 0.65) drop = 1;
      else if (t < 0.9) drop = 1 - (t - 0.65) / 0.25;
      this.magazine.position.y = this.magRestY - drop * 0.18;
      this.rig.rotation.z = Math.sin(Math.min(1, t) * Math.PI) * 0.18;
      this.rig.rotation.x += Math.sin(Math.min(1, t) * Math.PI) * 0.12;
      if (t >= 1) {
        this.reloadDuration = 0;
        this.magazine.position.y = this.magRestY;
        this.rig.rotation.z = 0;
      }
    }
  }

  playFire(): void {
    this.kick = Math.min(1, this.kick + 0.7);
  }

  playReload(duration: number): void {
    this.reloadDuration = duration;
    this.reloadElapsed = 0;
  }

  dispose(): void {
    this.object3d.removeFromParent();
    // geometries/materials are released through the ResourceTracker scope
  }
}
