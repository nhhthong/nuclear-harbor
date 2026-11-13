import { AUDIO } from './tunables';

interface FilterSpec {
  type: BiquadFilterType;
  f0: number;
  /** Exponential sweep target reached at the end of the element. */
  f1?: number;
  q?: number;
}

interface Shape {
  /** Start offset from the voice start (s). */
  at?: number;
  /** Length (s). */
  dur: number;
  /** Peak gain. */
  gain: number;
  /** Linear attack (s), default 0.004. */
  attack?: number;
  /** If set the level holds until `dur - release`, then decays; otherwise it decays from the peak. */
  release?: number;
  filter?: FilterSpec;
}

export interface OscSpec extends Shape {
  type: OscillatorType;
  f0: number;
  /** Exponential frequency sweep target reached at the end. */
  f1?: number;
}

export type NoiseSpec = Shape;

/** What a sound recipe sees: a tiny builder plus the request parameters. */
export interface Synth {
  /** Start time on the audio clock (s). */
  readonly t: number;
  readonly pitch: number;
  readonly intensity: number;
  /** Event duration (s), 0 when the request carried none. */
  readonly duration: number;
  readonly variant: number;
  /** Latest end time of everything added so far. */
  readonly stopTime: number;
  osc(spec: OscSpec): void;
  noise(spec: NoiseSpec): void;
}

export type SoundFn = (s: Synth) => number;

export interface VoiceParams {
  pitch: number;
  intensity: number;
  duration: number;
  variant: number;
}

const FLOOR = 0.0001;
const TAIL = 0.03;

/** One shared white-noise buffer for every noise source. */
export function createNoiseBuffer(ctx: BaseAudioContext, seconds: number = AUDIO.noiseSeconds): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Builds the nodes of one voice. Every source gets its own filter and envelope gain, connects to
 * `out` (the voice gain) and disconnects itself on `ended`. `onEmpty` fires when the last source ended.
 */
export class VoiceBuilder implements Synth {
  stopTime: number;
  readonly pitch: number;
  readonly intensity: number;
  readonly duration: number;
  readonly variant: number;
  private readonly live = new Set<AudioScheduledSourceNode>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly noiseBuffer: AudioBuffer,
    private readonly out: AudioNode,
    readonly t: number,
    params: VoiceParams,
    private readonly onEmpty: () => void,
  ) {
    this.stopTime = t;
    this.pitch = params.pitch;
    this.intensity = params.intensity;
    this.duration = params.duration;
    this.variant = params.variant;
  }

  get liveSources(): number {
    return this.live.size;
  }

  osc(spec: OscSpec): void {
    const start = this.t + (spec.at ?? 0);
    const end = start + spec.dur;
    const o = this.ctx.createOscillator();
    o.type = spec.type;
    o.frequency.setValueAtTime(spec.f0 * this.pitch, start);
    if (spec.f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(1, spec.f1 * this.pitch), end);
    this.wire(o, spec, start, end);
    o.start(start);
    o.stop(end + TAIL);
  }

  noise(spec: NoiseSpec): void {
    const start = this.t + (spec.at ?? 0);
    const end = start + spec.dur;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    n.loop = true;
    this.wire(n, spec, start, end);
    n.start(start, Math.random() * this.noiseBuffer.duration);
    n.stop(end + TAIL);
  }

  /** Fast fade-out and stop (voice stolen). */
  kill(now: number): void {
    for (const src of this.live) {
      try {
        src.stop(now + AUDIO.stealFade + TAIL);
      } catch {
        // already stopped
      }
    }
  }

  private wire(src: AudioScheduledSourceNode, spec: Shape, start: number, end: number): void {
    let tail: AudioNode = src;
    let filter: BiquadFilterNode | null = null;
    if (spec.filter) {
      filter = this.ctx.createBiquadFilter();
      filter.type = spec.filter.type;
      filter.Q.value = spec.filter.q ?? 0.7;
      filter.frequency.setValueAtTime(spec.filter.f0, start);
      if (spec.filter.f1 !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(10, spec.filter.f1), end);
      tail.connect(filter);
      tail = filter;
    }
    const gain = this.ctx.createGain();
    const attack = Math.min(spec.attack ?? 0.004, spec.dur * 0.9);
    const g = Math.max(FLOOR, spec.gain);
    gain.gain.setValueAtTime(FLOOR, start);
    gain.gain.linearRampToValueAtTime(g, start + attack);
    if (spec.release !== undefined) gain.gain.setValueAtTime(g, Math.max(start + attack, end - spec.release));
    gain.gain.exponentialRampToValueAtTime(FLOOR, end);
    tail.connect(gain);
    gain.connect(this.out);

    this.live.add(src);
    if (end + TAIL > this.stopTime) this.stopTime = end + TAIL;
    src.onended = () => {
      src.disconnect();
      filter?.disconnect();
      gain.disconnect();
      this.live.delete(src);
      if (this.live.size === 0) this.onEmpty();
    };
  }
}
