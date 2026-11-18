import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, type Object3D } from 'three';

export interface PlayOptions {
  /** Cross-fade time (s) when the clip changes. */
  fade?: number;
  /** Playback rate; negative plays the clip backwards. */
  timeScale?: number;
  /** Play once and hold the last pose (otherwise the clip loops). */
  once?: boolean;
  /** Start a looping clip at a random point of its cycle (robots do not step in unison). */
  randomPhase?: boolean;
  /** Start `name` again from its beginning even when it is already the active clip (a repeated one-shot). */
  restart?: boolean;
}

/**
 * One `AnimationMixer` per robot with every clip of the authored model prepared as an action; `play` switches
 * the active clip with a cross-fade and adjusts its time scale in place. Nothing is allocated while playing.
 */
export class ClipPlayer {
  readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentName = '';
  private disposed = false;

  constructor(
    private readonly root: Object3D,
    clips: ReadonlyMap<string, AnimationClip>,
  ) {
    this.mixer = new AnimationMixer(root);
    for (const [name, clip] of clips) this.actions.set(name, this.mixer.clipAction(clip));
  }

  get name(): string {
    return this.currentName;
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  duration(name: string): number {
    return this.actions.get(name)?.getClip().duration ?? 0;
  }

  /** Normalised time (0..1) of the active clip. */
  get progress(): number {
    const a = this.current;
    if (!a) return 0;
    const d = a.getClip().duration;
    return d > 0 ? (a.time % d) / d : 0;
  }

  /** Starts or continues `name`. Returns false when the model has no such clip. */
  play(name: string, opts: PlayOptions = {}): boolean {
    const next = this.actions.get(name);
    if (!next || this.disposed) return false;
    const scale = opts.timeScale ?? 1;
    if (next === this.current && !opts.restart) {
      next.setEffectiveTimeScale(scale);
      return true;
    }
    next.reset();
    next.setLoop(opts.once ? LoopOnce : LoopRepeat, opts.once ? 1 : Infinity);
    next.clampWhenFinished = opts.once === true;
    next.setEffectiveTimeScale(scale);
    next.setEffectiveWeight(1);
    if (scale < 0) next.time = next.getClip().duration;
    if (opts.randomPhase && !opts.once) next.time = Math.random() * next.getClip().duration;
    next.play();
    const prev = this.current;
    if (prev && prev !== next) {
      const fade = opts.fade ?? 0.2;
      if (fade > 0) next.crossFadeFrom(prev, fade, false);
      else prev.stop();
    }
    this.current = next;
    this.currentName = name;
    return true;
  }

  /** Changes the speed of the active clip without restarting it. */
  setTimeScale(scale: number): void {
    this.current?.setEffectiveTimeScale(scale);
  }

  update(dt: number): void {
    if (!this.disposed) this.mixer.update(dt);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.actions.clear();
    this.current = null;
  }
}
