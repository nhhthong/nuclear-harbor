import type { SamplePick } from './samples';
import { AUDIO } from './tunables';

/** Common shape of a playing one-shot voice (procedural `VoiceBuilder` or recorded `SampleVoice`). */
export interface Voice {
  readonly liveSources: number;
  kill(now: number): void;
}

/** One decoded buffer played once through its own gain into the voice output (spec 32). */
export class SampleVoice implements Voice {
  private src: AudioBufferSourceNode | null;
  private readonly gain: GainNode;

  constructor(ctx: BaseAudioContext, buffer: AudioBuffer, out: AudioNode, at: number, pick: SamplePick, offset: number, onEnd: () => void) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = pick.rate;
    const gain = ctx.createGain();
    gain.gain.value = pick.gain;
    src.connect(gain);
    gain.connect(out);
    src.onended = () => {
      src.disconnect();
      gain.disconnect();
      this.src = null;
      onEnd();
    };
    src.start(at, Math.min(Math.max(0, offset), Math.max(0, buffer.duration - 0.01)));
    this.src = src;
    this.gain = gain;
  }

  get liveSources(): number {
    return this.src ? 1 : 0;
  }

  kill(now: number): void {
    const src = this.src;
    if (!src) return;
    try {
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(0.0001, now, AUDIO.stealFade / 3);
      src.stop(now + AUDIO.stealFade + 0.03);
    } catch {
      // already stopped
    }
  }
}
