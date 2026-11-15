/**
 * Tiny synthesised sounds for the scorpion (roar, warning pulse, stomp thud). The shared audio
 * module has no hook for the scorpion:* events yet (see foundation-requests.md), so the module owns a
 * lazily created AudioContext. Everything is wrapped: audio must never break the game.
 */
export class ScorpionAudio {
  private ac: AudioContext | null = null;

  constructor(private readonly volume: () => number) {}

  private ctx(): AudioContext | null {
    try {
      if (!this.ac) this.ac = new AudioContext();
      if (this.ac.state === 'suspended') void this.ac.resume().catch(() => undefined);
      return this.ac;
    } catch {
      return null;
    }
  }

  roar(): void {
    const ac = this.ctx();
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.5 * this.volume() + 0.0001, t + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(120, t + 1.8);
      filter.connect(gain).connect(ac.destination);
      for (const [type, f0, f1] of [
        ['sawtooth', 120, 38],
        ['square', 61, 29],
      ] as const) {
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        o.frequency.exponentialRampToValueAtTime(f1, t + 1.8);
        o.connect(filter);
        o.start(t);
        o.stop(t + 1.9);
      }
    } catch {
      /* ignore */
    }
  }

  /** Pulsing alarm for the length of a telegraph. */
  warn(seconds: number): void {
    const ac = this.ctx();
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const beeps = Math.max(2, Math.round(seconds / 0.2));
      for (let i = 0; i < beeps; i++) {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'square';
        o.frequency.value = i % 2 === 0 ? 520 : 390;
        const s = t + i * 0.2;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.12 * this.volume() + 0.0001, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
        o.connect(g).connect(ac.destination);
        o.start(s);
        o.stop(s + 0.18);
      }
    } catch {
      /* ignore */
    }
  }

  thud(): void {
    const ac = this.ctx();
    if (!ac) return;
    try {
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(90, t);
      o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      g.gain.setValueAtTime(0.6 * this.volume() + 0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    } catch {
      /* ignore */
    }
  }

  dispose(): void {
    try {
      void this.ac?.close();
    } catch {
      /* ignore */
    }
    this.ac = null;
  }
}
