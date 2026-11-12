/**
 * Looping ambience beds built from filtered noise and slow LFOs (GDD 11 environment/machinery):
 * sea wash, wind, distant harbor hum. A fixed set of nodes, independent of the voice cap.
 */
export class Ambience {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly level: GainNode;

  constructor(ctx: BaseAudioContext, noise: AudioBuffer, destination: AudioNode, initialLevel: number) {
    this.level = ctx.createGain();
    this.level.gain.value = initialLevel;
    this.level.connect(destination);
    this.nodes.push(this.level);

    // sea wash: low-passed noise whose level swells slowly
    const sea = this.noiseLayer(ctx, noise, 'lowpass', 520, 0.5, 0.5);
    this.lfo(ctx, 0.11, 0.25, sea.gain);
    // wind: band-passed noise, drifting in level and centre frequency
    const wind = this.noiseLayer(ctx, noise, 'bandpass', 650, 0.6, 0.22);
    this.lfo(ctx, 0.07, 0.12, wind.gain);
    this.lfo(ctx, 0.05, 200, wind.filter.frequency);
    // harbor hum: mains-like pair plus a dark noise floor
    for (const [hz, g] of [[50, 0.05], [100.6, 0.025]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz;
      const gain = ctx.createGain();
      gain.gain.value = g;
      o.connect(gain);
      gain.connect(this.level);
      o.start();
      this.sources.push(o);
      this.nodes.push(gain);
    }
    const floor = this.noiseLayer(ctx, noise, 'lowpass', 140, 0.7, 0.18);
    this.lfo(ctx, 0.03, 0.06, floor.gain);
  }

  /** Smoothly move the bed to `level` (time constant in seconds). */
  fadeTo(ctx: BaseAudioContext, level: number, timeConstant: number): void {
    this.level.gain.cancelScheduledValues(ctx.currentTime);
    this.level.gain.setTargetAtTime(level, ctx.currentTime, timeConstant);
  }

  get nodeCount(): number {
    return this.nodes.length + this.sources.length;
  }

  dispose(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
      s.disconnect();
    }
    for (const n of this.nodes) n.disconnect();
    this.sources.length = 0;
    this.nodes.length = 0;
  }

  private noiseLayer(
    ctx: BaseAudioContext,
    noise: AudioBuffer,
    type: BiquadFilterType,
    freq: number,
    q: number,
    gainValue: number,
  ): { gain: AudioParam; filter: BiquadFilterNode } {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.level);
    src.start(0, Math.random() * noise.duration);
    this.sources.push(src);
    this.nodes.push(filter, gain);
    return { gain: gain.gain, filter };
  }

  private lfo(ctx: BaseAudioContext, hz: number, depth: number, target: AudioParam): void {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.value = depth;
    o.connect(g);
    g.connect(target);
    o.start();
    this.sources.push(o);
    this.nodes.push(g);
  }
}
