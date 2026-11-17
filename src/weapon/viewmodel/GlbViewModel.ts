import {
  AnimationAction,
  type AnimationClip,
  AnimationMixer,
  Group,
  LoopOnce,
  LoopRepeat,
  Mesh,
  MeshStandardMaterial,
  type Material,
  type Object3D,
  SkinnedMesh,
  Vector3,
} from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { WEAPON_LOCAL } from '../tunables';
import { type ClipMap, hasStateClips, mapClips, pickFireClip, reloadTimeScale } from './glbClips';
import { GLB_VIEW } from './glbTunables';
import type { ViewModel, ViewModelState } from './ViewModel';

const VM = WEAPON_LOCAL.viewModel;
const scratch = new Vector3();

/** What `GLTFLoader` hands back (only the parts used here). */
export interface LoadedModel {
  scene: Object3D;
  animations: AnimationClip[];
}

/**
 * First-person view model built from the converted GLB (hands + G36C, one skinned mesh).
 * Clips map to weapon states: draw on start, idle loop, shoot1..n on fire, reload scaled to the
 * weapon's reload duration. Without clips the static mesh gets a procedural kick instead.
 */
export class GlbViewModel implements ViewModel {
  readonly object3d = new Group();
  readonly muzzleLocalPosition = new Vector3(GLB_VIEW.muzzleFallback.x, GLB_VIEW.muzzleFallback.y, GLB_VIEW.muzzleFallback.z);
  readonly ejectionLocalPosition = new Vector3(GLB_VIEW.ejectFallback.x, GLB_VIEW.ejectFallback.y, GLB_VIEW.ejectFallback.z);
  /** True when skeletal clips drive the model; false = procedural motion on a static mesh. */
  readonly animated: boolean;
  readonly clipNames: string[];

  private readonly rig = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private readonly clips: ClipMap;
  private readonly muzzleNode: Object3D | null;
  private readonly ejectNode: Object3D | null;
  private current: AnimationAction | null = null;
  private busy: AnimationAction | null = null;
  private shotCounter = 0;
  private kick = 0;
  private reloadDuration = 0;
  private reloadElapsed = 0;
  /** Name of the clip last started (for tests and the debug overlay). */
  lastClip: string | null = null;

  constructor(model: LoadedModel, res: ResourceTracker) {
    const root = model.scene;
    this.rig.add(root);
    this.object3d.add(this.rig);
    this.object3d.position.set(GLB_VIEW.offset.x, GLB_VIEW.offset.y, GLB_VIEW.offset.z);
    this.rig.scale.setScalar(GLB_VIEW.scale);

    root.traverse((node) => {
      node.frustumCulled = false;
      node.renderOrder = 10;
      if ((node as Mesh).isMesh) this.useUnlitMaterial(node as Mesh);
      if ((node as SkinnedMesh).isSkinnedMesh) res.track((node as SkinnedMesh).skeleton);
    });
    this.muzzleNode = root.getObjectByName('muzzle') ?? null;
    this.ejectNode = root.getObjectByName('eject') ?? null;

    this.mixer = new AnimationMixer(root);
    for (const clip of model.animations) this.actions.set(clip.name, this.mixer.clipAction(clip));
    this.clipNames = model.animations.map((c) => c.name);
    this.clips = mapClips(this.clipNames);
    this.animated = hasStateClips(this.clips);
    res.onDispose(() => {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(root);
    });
    res.track(this.object3d);

    if (this.animated) {
      this.mixer.addEventListener('finished', (e) => {
        if (e.action === this.busy) this.returnToIdle();
      });
      const first = this.clips.draw ?? this.clips.idle;
      if (first === this.clips.draw) this.playOneShot(first, 1);
      else this.playIdle();
    }
    this.syncAttachments();
  }

  /**
   * Lit material so the rifle and hands pick up the scene's lamps, moonlight and muzzle flash. A faint
   * self-illumination from the same texture keeps them readable in unlit corners.
   */
  private useUnlitMaterial(mesh: Mesh): void {
    const old = mesh.material as Material & { map?: MeshStandardMaterial['map'] };
    const map = old.map ?? null;
    const lit = new MeshStandardMaterial({ map, roughness: 0.55, metalness: 0.2, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.06 });
    mesh.material = lit;
    old.dispose();
  }

  private action(name: string | null): AnimationAction | null {
    return name ? (this.actions.get(name) ?? null) : null;
  }

  private playIdle(): void {
    const idle = this.action(this.clips.idle);
    if (!idle) return;
    idle.reset();
    idle.setLoop(LoopRepeat, Infinity);
    idle.setEffectiveTimeScale(1);
    idle.setEffectiveWeight(1);
    if (this.current && this.current !== idle) idle.crossFadeFrom(this.current, GLB_VIEW.fadeToIdle, false);
    idle.play();
    this.current = idle;
    this.busy = null;
    this.lastClip = this.clips.idle;
  }

  private returnToIdle(): void {
    this.playIdle();
  }

  private playOneShot(name: string | null, timeScale: number, fade: number = GLB_VIEW.fadeToFire): void {
    const next = this.action(name);
    if (!next) return;
    next.reset();
    next.setLoop(LoopOnce, 1);
    next.clampWhenFinished = true;
    next.setEffectiveTimeScale(timeScale);
    next.setEffectiveWeight(1);
    if (this.current && this.current !== next) next.crossFadeFrom(this.current, fade, false);
    next.play();
    this.current = next;
    this.busy = next;
    this.lastClip = name;
  }

  /** Muzzle/eject node positions in `object3d` space (follow the animated bones). */
  private syncAttachments(): void {
    this.object3d.updateWorldMatrix(true, false);
    if (this.muzzleNode) {
      this.muzzleNode.getWorldPosition(scratch);
      this.object3d.worldToLocal(scratch);
      if (Number.isFinite(scratch.x + scratch.y + scratch.z)) this.muzzleLocalPosition.copy(scratch);
    }
    if (this.ejectNode) {
      this.ejectNode.getWorldPosition(scratch);
      this.object3d.worldToLocal(scratch);
      if (Number.isFinite(scratch.x + scratch.y + scratch.z)) this.ejectionLocalPosition.copy(scratch);
    }
  }

  update(dt: number, state: ViewModelState): void {
    const sprint = state.sprinting ? 1 : 0;
    this.rig.position.set(GLB_VIEW.ads.x * state.aim, -sprint * VM.sprintLowerMetres + GLB_VIEW.ads.y * state.aim, GLB_VIEW.ads.z * state.aim);
    this.rig.rotation.set(0, sprint * VM.sprintTiltRad, 0);

    if (this.animated) {
      this.mixer.update(dt);
    } else {
      this.kick *= Math.exp(-GLB_VIEW.staticKickRecoverPerSec * dt);
      this.rig.position.z += this.kick * GLB_VIEW.staticKickBackMetres;
      if (this.reloadDuration > 0) {
        this.reloadElapsed += dt;
        const t = Math.min(1, this.reloadElapsed / this.reloadDuration);
        this.rig.rotation.z = Math.sin(t * Math.PI) * 0.18;
        this.rig.position.y -= Math.sin(t * Math.PI) * 0.08;
        if (t >= 1) this.reloadDuration = 0;
      }
    }
    this.syncAttachments();
  }

  playFire(): void {
    if (!this.animated) {
      this.kick = Math.min(1, this.kick + 0.7);
      return;
    }
    const name = pickFireClip(this.clips, this.shotCounter++);
    this.playOneShot(name, 1);
  }

  playReload(duration: number): void {
    if (!this.animated) {
      this.reloadDuration = duration;
      this.reloadElapsed = 0;
      return;
    }
    const clip = this.action(this.clips.reload)?.getClip();
    this.playOneShot(this.clips.reload, reloadTimeScale(clip?.duration ?? 0, duration), GLB_VIEW.fadeToIdle);
  }

  dispose(): void {
    this.object3d.removeFromParent();
    // geometry, materials, textures and the skeleton are released through the ResourceTracker scope
  }
}
