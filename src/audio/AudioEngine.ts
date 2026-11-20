import { Ambience } from './ambience';
import { soundDef, type SoundCategory, type SoundId } from './catalogue';
import { humFrequency } from './math';
import type { SoundRequest } from './eventMap';
import { SampleBank } from './sampleBank';
import { LOOPS, pickSample, SAMPLE_MANIFEST, sampleFiles, type LoopId } from './samples';
import { SampleVoice, type Voice } from './sampleVoice';
import { SOUNDS } from './sounds';
import { createNoiseBuffer, VoiceBuilder } from './synth';
import { AUDIO } from './tunables';
import { VoiceAllocator } from './voiceAllocator';

interface ActiveVoice {
  builder: Voice;
  gain: GainNode;
  panner: PannerNode | null;
  done: boolean;
}

type EngineState = AudioContextState | 'none';

/**
 * Web Audio engine: lazily created context, category buses, master gain + compressor, voice
 * allocation, positional playback and the looping beds. Every failure degrades to silence.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<SoundCategory, GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private ambience: Ambience | null = null;
  private hum: { nodes: AudioNode[]; osc: OscillatorNode[]; gain: GainNode } | null = null;
  private readonly voices = new Map<number, ActiveVoice>();
  private bank: SampleBank | null = null;
  private readonly lastFile = new Map<SoundId, string>();
  private readonly loops = new Map<LoopId, { src: AudioBufferSourceNode; gain: GainNode; level: number; rate: number }>();
  private readonly loopTargets = new Map<LoopId, { level: number; rate: number }>();
  private sampledPlays = 0;
  private readonly allocator = new VoiceAllocator<SoundId>(AUDIO.voiceCap, (id) => soundDef(id));
  private masterTarget = 1;
  private ambienceTarget: number = AUDIO.ambience.duckedLevel;
  private lx = 0;
  private ly = 0;
  private lz = 0;
  private closed = false;
  private created = false;

  get state(): EngineState {
    if (this.closed) return this.created ? 'closed' : 'none';
    return this.ctx ? this.ctx.state : 'none';
  }

  get activeVoices(): number {
    return this.allocator.activeCount;
  }

  get peakVoices(): number {
    return this.allocator.peak;
  }

  /** One-shots that played a recorded sample instead of the recipe (spec 32). */
  get samplePlays(): number {
    return this.sampledPlays;
  }

  sampleSummary(): { loading: number; ready: number; failed: number } {
    return this.bank?.summary() ?? { loading: 0, ready: 0, failed: 0 };
  }

  /** Whether `file` is decoded (test hook / fallback checks). */
  sampleReady(file: string): boolean {
    return this.bank?.isReady(file) ?? false;
  }

  playedCount(id: SoundId): number {
    return this.allocator.playedCount(id);
  }

  get masterVolume(): number {
    return this.masterTarget;
  }

  get ambienceLevel(): number {
    return this.ambienceTarget;
  }

  /** Voice sources + beds + hum currently alive (should stay bounded). */
  get liveNodes(): number {
    let n = this.ambience?.nodeCount ?? 0;
    for (const v of this.voices.values()) n += v.builder.liveSources;
    n += this.loops.size;
    if (this.hum) n += this.hum.nodes.length + this.hum.osc.length;
    return n;
  }

  /** Create the context on first call and try to resume it. Call from a user gesture. */
  unlock(): void {
    if (this.closed) return;
    try {
      if (!this.ctx) this.build();
      const ctx = this.ctx;
      if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    } catch {
      // Web Audio unavailable: stay silent
    }
  }

  setMasterVolume(v: number): void {
    this.masterTarget = Math.min(1, Math.max(0, v));
    if (this.ctx && this.master) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.masterTarget, this.ctx.currentTime, AUDIO.masterSmoothing);
    }
  }

  setAmbienceLevel(level: number, timeConstant: number): void {
    this.ambienceTarget = level;
    if (this.ctx && this.ambience) this.ambience.fadeTo(this.ctx, level, timeConstant);
  }

  setListener(px: number, py: number, pz: number, fx: number, fy: number, fz: number, ux: number, uy: number, uz: number): void {
    this.lx = px;
    this.ly = py;
    this.lz = pz;
    const l = this.ctx?.listener;
    if (!l) return;
    if (l.positionX) {
      l.positionX.value = px;
      l.positionY.value = py;
      l.positionZ.value = pz;
      l.forwardX.value = fx;
      l.forwardY.value = fy;
      l.forwardZ.value = fz;
      l.upX.value = ux;
      l.upY.value = uy;
      l.upZ.value = uz;
    }
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => undefined);
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
  }

  /** Play a catalogue sound. Returns whether a voice was started. */
  play(id: SoundId, req: Omit<SoundRequest, 'id'> = {}): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.buses || !this.noise || ctx.state !== 'running') return false;
    try {
      const def = soundDef(id);
      const pos = def.spatial ? req.position : undefined;
      if (pos) {
        const dx = pos.x - this.lx;
        const dy = pos.y - this.ly;
        const dz = pos.z - this.lz;
        if (Math.hypot(dx, dy, dz) >= AUDIO.spatial.maxDistance) return false;
      }
      const grant = this.allocator.acquire(id, performance.now());
      if (!grant.granted) return false;
      if (grant.stolen !== null) this.finish(grant.stolen, true);

      const gain = ctx.createGain();
      let panner: PannerNode | null = null;
      const bus = this.buses[def.category];
      if (pos) {
        panner = ctx.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = def.refDistance ?? AUDIO.spatial.refDistance;
        panner.maxDistance = AUDIO.spatial.maxDistance;
        panner.rolloffFactor = AUDIO.spatial.rolloff;
        panner.positionX.value = pos.x;
        panner.positionY.value = pos.y;
        panner.positionZ.value = pos.z;
        gain.connect(panner);
        panner.connect(bus);
      } else {
        gain.connect(bus);
      }

      const voiceId = grant.voiceId;
      const at = ctx.currentTime + AUDIO.lookahead + Math.max(0, req.delay ?? 0);
      // spec 32: a decoded recorded variant when there is one, the procedural recipe otherwise
      const sample = SAMPLE_MANIFEST[id];
      const bank = this.bank;
      if (sample && bank) {
        const pick = pickSample(sample, Math.random, req.intensity ?? 1, this.lastFile.get(id), (f) => bank.isReady(f));
        const buffer = pick ? bank.get(pick.file) : null;
        if (pick && buffer) {
          this.lastFile.set(id, pick.file);
          const voice = new SampleVoice(ctx, buffer, gain, at, pick, sample.offset ?? 0, () => this.finish(voiceId, false));
          this.voices.set(voiceId, { builder: voice, gain, panner, done: false });
          this.sampledPlays += 1;
          return true;
        }
      }
      const builder = new VoiceBuilder(
        ctx,
        this.noise,
        gain,
        at,
        {
          pitch: 1 + (Math.random() * 2 - 1) * AUDIO.pitchJitter,
          intensity: req.intensity ?? 1,
          duration: req.duration ?? 0,
          variant: req.variant ?? 0,
        },
        () => this.finish(voiceId, false),
      );
      this.voices.set(voiceId, { builder, gain, panner, done: false });
      SOUNDS[id](builder);
      if (builder.liveSources === 0) this.finish(voiceId, false);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Drive a recorded loop (low-health heartbeat / breathing): level 0..1 and playback rate. Returns
   * false when the sample is not decoded (the caller then uses the procedural fallback).
   */
  setLoop(id: LoopId, level: number, rate = 1): boolean {
    this.loopTargets.set(id, { level, rate });
    const ctx = this.ctx;
    const bank = this.bank;
    if (!ctx || !bank || !this.buses) return false;
    const buffer = bank.get(LOOPS[id].file);
    if (!buffer) return false;
    let loop = this.loops.get(id);
    if (!loop) {
      if (level <= 0.001) return true;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(gain);
      gain.connect(this.buses.sfx);
      src.start();
      loop = { src, gain, level: -1, rate: -1 };
      this.loops.set(id, loop);
    }
    // only touch the params on a real change (this runs every frame)
    if (Math.abs(loop.level - level) < 0.01 && Math.abs(loop.rate - rate) < 0.01) return true;
    loop.level = level;
    loop.rate = rate;
    loop.gain.gain.cancelScheduledValues(ctx.currentTime);
    loop.src.playbackRate.cancelScheduledValues(ctx.currentTime);
    loop.gain.gain.setTargetAtTime(Math.max(0.0001, level * LOOPS[id].gain), ctx.currentTime, AUDIO.samples.loopFade / 3);
    loop.src.playbackRate.setTargetAtTime(rate, ctx.currentTime, 0.2);
    return true;
  }

  /** Tower activation hum: starts once, then follows progress 0..1. */
  startHum(): void {
    const ctx = this.ctx;
    if (!ctx || !this.buses || this.hum || ctx.state !== 'running') return;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.setTargetAtTime(AUDIO.hum.gain, ctx.currentTime, 0.1);
    gain.connect(this.buses.sfx);
    const osc: OscillatorNode[] = [];
    for (const type of ['sine', 'triangle'] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = humFrequency(0) * (type === 'sine' ? 1 : 2.01);
      o.connect(gain);
      o.start();
      osc.push(o);
    }
    this.hum = { nodes: [gain], osc, gain };
  }

  setHumProgress(progress: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.hum) return;
    const f = humFrequency(progress);
    this.hum.osc.forEach((o, i) => o.frequency.setTargetAtTime(f * (i === 0 ? 1 : 2.01), ctx.currentTime, 0.05));
  }

  stopHum(): void {
    const ctx = this.ctx;
    const hum = this.hum;
    if (!ctx || !hum) return;
    this.hum = null;
    hum.gain.gain.cancelScheduledValues(ctx.currentTime);
    hum.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
    for (const o of hum.osc) {
      o.stop(ctx.currentTime + 0.3);
      o.onended = () => {
        o.disconnect();
        hum.gain.disconnect();
      };
    }
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    for (const id of [...this.voices.keys()]) this.finish(id, true);
    this.stopHum();
    for (const l of this.loops.values()) {
      try {
        l.src.stop();
      } catch {
        // already stopped
      }
      l.src.disconnect();
      l.gain.disconnect();
    }
    this.loops.clear();
    this.bank?.dispose();
    this.bank = null;
    this.ambience?.dispose();
    this.ambience = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.buses = null;
    this.master = null;
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => undefined);
  }

  private build(): void {
    if (typeof AudioContext === 'undefined') return;
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.masterTarget;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = AUDIO.compressor.threshold;
    comp.knee.value = AUDIO.compressor.knee;
    comp.ratio.value = AUDIO.compressor.ratio;
    comp.attack.value = AUDIO.compressor.attack;
    comp.release.value = AUDIO.compressor.release;
    master.connect(comp);
    comp.connect(ctx.destination);

    const mk = (level: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = level;
      g.connect(master);
      return g;
    };
    this.buses = { sfx: mk(AUDIO.buses.sfx), ambience: mk(AUDIO.buses.ambience), ui: mk(AUDIO.buses.ui) };
    this.noise = createNoiseBuffer(ctx);
    this.master = master;
    this.ctx = ctx;
    this.created = true;
    this.ambience = new Ambience(ctx, this.noise, this.buses.ambience, this.ambienceTarget);
    // initial fade-in if the game is already playing
    this.ambience.fadeTo(ctx, this.ambienceTarget, AUDIO.ambience.fadeIn);
    // spec 32: recorded samples load in the background; until then (or if they fail) recipes play
    const bank = new SampleBank(ctx, sampleFiles());
    this.bank = bank;
    bank.onReady((file) => {
      for (const id of ['wind', 'sea'] as const) {
        if (LOOPS[id].file !== file) continue;
        const buffer = bank.get(file);
        if (buffer && this.ambience) this.ambience.addLoop(ctx, buffer, LOOPS[id].gain);
      }
      // a loop requested before its file was ready starts now
      for (const [id, t] of this.loopTargets) if (LOOPS[id].file === file) this.setLoop(id, t.level, t.rate);
    });
  }

  /** Stop and release one voice. Idempotent; independent of `ended` events. */
  private finish(voiceId: number, kill: boolean): void {
    const v = this.voices.get(voiceId);
    this.allocator.release(voiceId);
    if (!v || v.done) return;
    v.done = true;
    this.voices.delete(voiceId);
    const ctx = this.ctx;
    if (kill && ctx) {
      v.gain.gain.cancelScheduledValues(ctx.currentTime);
      v.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, AUDIO.stealFade / 3);
      v.builder.kill(ctx.currentTime);
    }
    // disconnect the voice from the graph right away on normal end, shortly after on kill
    const detach = (): void => {
      v.gain.disconnect();
      v.panner?.disconnect();
    };
    if (kill) setTimeout(detach, (AUDIO.stealFade + 0.05) * 1000);
    else detach();
  }
}
