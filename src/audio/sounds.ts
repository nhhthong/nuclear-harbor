import type { SoundId } from './catalogue';
import type { SoundFn, Synth } from './synth';

/**
 * One synthesis recipe per sound id: `(synth) => stopTime`. Recipes only describe oscillators,
 * noise bursts, envelopes and filter sweeps; `VoiceBuilder` creates the nodes. Frequencies are in
 * Hz, times in seconds relative to the voice start. Numbers here are sound design, not gameplay.
 */

const lp = (f0: number, f1?: number, q = 0.7) => ({ type: 'lowpass' as const, f0, ...(f1 === undefined ? {} : { f1 }), q });
const hp = (f0: number, f1?: number, q = 0.7) => ({ type: 'highpass' as const, f0, ...(f1 === undefined ? {} : { f1 }), q });
const bp = (f0: number, f1?: number, q = 1) => ({ type: 'bandpass' as const, f0, ...(f1 === undefined ? {} : { f1 }), q });

/** Low explosion: filtered noise decay plus a sub drop. */
function explosion(s: Synth, at: number, size: number): void {
  s.noise({ at, dur: 0.7 * size, gain: 0.8, attack: 0.005, filter: lp(2200, 90) });
  s.osc({ at, type: 'sine', f0: 130, f1: 28, dur: 0.6 * size, gain: 0.9, attack: 0.005 });
  s.noise({ at, dur: 0.12, gain: 0.35, filter: hp(2500) });
}

export const SOUNDS: Record<SoundId, SoundFn> = {
  // ---- player ------------------------------------------------------------------------
  rifleShot: (s) => {
    s.noise({ dur: 0.12, gain: 0.9, filter: bp(3200, 800, 0.8) });
    s.noise({ dur: 0.25, gain: 0.6, filter: lp(700, 120) });
    s.osc({ type: 'sine', f0: 150, f1: 45, dur: 0.22, gain: 0.9 });
    return s.stopTime;
  },
  dryClick: (s) => {
    s.noise({ dur: 0.03, gain: 0.4, filter: hp(3000) });
    s.osc({ type: 'square', f0: 900, f1: 400, dur: 0.03, gain: 0.12 });
    return s.stopTime;
  },
  reload: (s) => {
    const dur = s.duration > 0 ? s.duration : 1.6;
    // magazine out, then magazine in / bolt, timed against the reload duration
    s.noise({ at: 0.12, dur: 0.05, gain: 0.5, filter: bp(2500, undefined, 1.5) });
    s.osc({ at: 0.12, type: 'square', f0: 320, f1: 150, dur: 0.05, gain: 0.12 });
    const second = Math.max(0.3, dur - 0.22);
    s.noise({ at: second, dur: 0.07, gain: 0.6, filter: bp(1800, undefined, 1.5) });
    s.osc({ at: second, type: 'square', f0: 220, f1: 80, dur: 0.09, gain: 0.18 });
    return s.stopTime;
  },
  footstepWalk: (s) => {
    s.noise({ dur: 0.09, gain: 0.35, filter: lp(500, 200) });
    s.osc({ type: 'sine', f0: 90, f1: 50, dur: 0.08, gain: 0.3 });
    return s.stopTime;
  },
  footstepSprint: (s) => {
    s.noise({ dur: 0.07, gain: 0.5, filter: lp(750, 220) });
    s.osc({ type: 'sine', f0: 105, f1: 55, dur: 0.07, gain: 0.4 });
    return s.stopTime;
  },
  land: (s) => {
    const k = Math.min(1.5, Math.max(0.3, s.intensity));
    s.osc({ type: 'sine', f0: 110, f1: 35, dur: 0.28, gain: 0.7 * k });
    s.noise({ dur: 0.2, gain: 0.5 * k, filter: lp(450, 120) });
    return s.stopTime;
  },
  hurt: (s) => {
    s.osc({ type: 'sawtooth', f0: 230, f1: 110, dur: 0.3, gain: 0.4, filter: lp(1200) });
    s.noise({ dur: 0.15, gain: 0.3, filter: bp(800) });
    return s.stopTime;
  },
  death: (s) => {
    s.osc({ type: 'sawtooth', f0: 300, f1: 40, dur: 1.2, gain: 0.5, filter: lp(900, 100) });
    s.noise({ dur: 1.0, gain: 0.4, filter: lp(700, 80) });
    s.osc({ type: 'sine', f0: 60, f1: 30, dur: 1.5, gain: 0.6 });
    return s.stopTime;
  },
  grappleFire: (s) => {
    s.noise({ dur: 0.35, gain: 0.5, attack: 0.05, filter: bp(400, 3500, 2) });
    s.osc({ type: 'triangle', f0: 300, f1: 900, dur: 0.25, gain: 0.15 });
    return s.stopTime;
  },
  grappleAttach: (s) => {
    s.osc({ type: 'square', f0: 520, dur: 0.25, gain: 0.2, filter: bp(520, undefined, 4) });
    s.osc({ type: 'square', f0: 783, dur: 0.2, gain: 0.15, filter: bp(783, undefined, 4) });
    s.noise({ dur: 0.05, gain: 0.5, filter: hp(2000) });
    return s.stopTime;
  },
  grappleRelease: (s) => {
    s.noise({ dur: 0.2, gain: 0.25, filter: bp(1200, 300) });
    s.osc({ type: 'sine', f0: 400, f1: 200, dur: 0.12, gain: 0.15 });
    return s.stopTime;
  },
  grappleFail: (s) => {
    s.osc({ type: 'square', f0: 160, f1: 90, dur: 0.1, gain: 0.2, filter: lp(400) });
    s.noise({ dur: 0.06, gain: 0.2, filter: lp(600) });
    return s.stopTime;
  },
  pickupAmmo: (s) => {
    s.osc({ type: 'triangle', f0: 660, dur: 0.08, gain: 0.25 });
    s.osc({ at: 0.07, type: 'triangle', f0: 990, dur: 0.12, gain: 0.25 });
    s.noise({ dur: 0.03, gain: 0.3, filter: hp(3000) });
    return s.stopTime;
  },
  pickupMedkit: (s) => {
    s.osc({ type: 'sine', f0: 523, dur: 0.35, gain: 0.22 });
    s.osc({ at: 0.09, type: 'sine', f0: 659, dur: 0.35, gain: 0.22 });
    s.osc({ at: 0.18, type: 'sine', f0: 784, dur: 0.45, gain: 0.22 });
    return s.stopTime;
  },
  hitMarker: (s) => {
    s.osc({ type: 'sine', f0: 1600 * s.intensity, dur: 0.05, gain: 0.25 });
    return s.stopTime;
  },
  hitArmor: (s) => {
    s.osc({ type: 'square', f0: 2100, f1: 1400, dur: 0.1, gain: 0.2, filter: bp(1800, undefined, 3) });
    s.noise({ dur: 0.04, gain: 0.3, filter: hp(3000) });
    return s.stopTime;
  },
  impact: (s) => {
    s.noise({ dur: 0.12, gain: 0.3, filter: bp(3500, 1200) });
    s.osc({ type: 'sine', f0: 2800, f1: 900, dur: 0.1, gain: 0.08 });
    return s.stopTime;
  },

  // ---- enemies -----------------------------------------------------------------------
  enemyAlert: (s) => {
    if (s.variant === 1) {
      // spot: dry skittering ticks
      for (let i = 0; i < 4; i++) s.noise({ at: i * 0.05, dur: 0.025, gain: 0.35, filter: bp(4200, undefined, 3) });
    } else if (s.variant === 2) {
      // duck: short snort
      s.osc({ type: 'sawtooth', f0: 130, f1: 90, dur: 0.35, gain: 0.4, filter: lp(500) });
    } else {
      // army: two rising chirps
      s.osc({ type: 'sine', f0: 800, f1: 1600, dur: 0.1, gain: 0.3 });
      s.osc({ at: 0.12, type: 'sine', f0: 1000, f1: 2000, dur: 0.12, gain: 0.3 });
    }
    return s.stopTime;
  },
  enemyShot: (s) => {
    s.osc({ type: 'sawtooth', f0: 2400, f1: 300, dur: 0.18, gain: 0.25 });
    s.osc({ type: 'square', f0: 1200, f1: 200, dur: 0.15, gain: 0.1 });
    return s.stopTime;
  },
  enemyDestroyed: (s) => {
    explosion(s, 0, 1);
    return s.stopTime;
  },
  /** Rising low growl that lasts the telegraph duration (GDD 11, AC7). */
  duckWindup: (s) => {
    const dur = s.duration > 0 ? s.duration : 1.2;
    s.osc({ type: 'sawtooth', f0: 60, f1: 180, dur, gain: 0.35, attack: dur * 0.2, release: 0.08, filter: lp(250, 1100, 1.5) });
    s.osc({ type: 'sawtooth', f0: 63, f1: 190, dur, gain: 0.3, attack: dur * 0.2, release: 0.08, filter: lp(250, 1100, 1.5) });
    s.osc({ type: 'square', f0: 30, f1: 60, dur, gain: 0.25, attack: dur * 0.2, release: 0.08, filter: lp(200) });
    s.noise({ dur, gain: 0.25, attack: dur * 0.3, release: 0.08, filter: bp(300, 900, 1.5) });
    return s.stopTime;
  },
  duckHit: (s) => {
    s.noise({ dur: 0.25, gain: 0.6, filter: lp(1000) });
    s.osc({ type: 'sine', f0: 100, f1: 40, dur: 0.3, gain: 0.8 });
    return s.stopTime;
  },

  // ---- objective ---------------------------------------------------------------------
  towerCancel: (s) => {
    s.osc({ type: 'sine', f0: 600, f1: 300, dur: 0.15, gain: 0.25 });
    return s.stopTime;
  },
  towerActivated: (s) => {
    for (const f of [261.6, 329.6, 392]) s.osc({ type: 'sine', f0: f, dur: 1.4, gain: 0.2, attack: 0.02 });
    s.osc({ type: 'triangle', f0: 523.3, dur: 1.2, gain: 0.12, attack: 0.02 });
    return s.stopTime;
  },
  /** Two-tone nuclear siren, one cycle per second. */
  alarm: (s) => {
    s.osc({ type: 'sawtooth', f0: 880, dur: 0.48, gain: 0.3, release: 0.05, filter: lp(2500) });
    s.osc({ at: 0.5, type: 'sawtooth', f0: 660, dur: 0.48, gain: 0.3, release: 0.05, filter: lp(2500) });
    return s.stopTime;
  },
  beep: (s) => {
    s.osc({ type: 'sine', f0: 1000, dur: 0.12, gain: 0.35, attack: 0.005, release: 0.03 });
    return s.stopTime;
  },
  countdownExpired: (s) => {
    s.noise({ dur: 2.5, gain: 1, attack: 0.01, filter: lp(2500, 60) });
    s.osc({ type: 'sine', f0: 90, f1: 20, dur: 2.5, gain: 1, attack: 0.01 });
    s.osc({ type: 'sawtooth', f0: 80, f1: 30, dur: 2, gain: 0.5, filter: lp(400) });
    return s.stopTime;
  },
  beacon: (s) => {
    s.osc({ type: 'sine', f0: 1200, dur: 0.18, gain: 0.35, attack: 0.005 });
    s.osc({ type: 'sine', f0: 1800, dur: 0.12, gain: 0.1, attack: 0.005 });
    return s.stopTime;
  },

  // ---- boss --------------------------------------------------------------------------
  bossSpawn: (s) => {
    s.osc({ type: 'sawtooth', f0: 55, dur: 2.5, gain: 0.4, attack: 0.3, release: 0.5, filter: lp(400, 800) });
    s.osc({ type: 'sawtooth', f0: 82.5, dur: 2.5, gain: 0.3, attack: 0.3, release: 0.5, filter: lp(400, 800) });
    s.osc({ type: 'sine', f0: 27, dur: 2.5, gain: 0.6, attack: 0.3, release: 0.5 });
    return s.stopTime;
  },
  /** Per attack type (variant): a rising sweep plus pulses, faster for the target lock. */
  bossTelegraph: (s) => {
    const dur = s.duration > 0 ? s.duration : 1;
    const f0 = 200 + s.variant * 90;
    s.osc({ type: 'square', f0, f1: f0 * 1.8, dur, gain: 0.18, release: 0.05, filter: lp(1500) });
    const step = s.variant === 4 ? 0.12 : 0.25;
    const pulses = Math.min(12, Math.floor(dur / step));
    for (let i = 0; i < pulses; i++) s.osc({ at: i * step, type: 'sine', f0: 1000 + s.variant * 150, dur: 0.07, gain: 0.25 });
    return s.stopTime;
  },
  bossCannon: (s) => {
    s.noise({ dur: 0.8, gain: 1, attack: 0.003, filter: lp(3000, 100) });
    s.osc({ type: 'sine', f0: 100, f1: 25, dur: 0.9, gain: 1, attack: 0.003 });
    s.osc({ type: 'sawtooth', f0: 200, f1: 40, dur: 0.5, gain: 0.4, filter: lp(800) });
    return s.stopTime;
  },
  bossSlam: (s) => {
    const k = Math.max(0.5, s.intensity);
    s.osc({ type: 'sine', f0: 70, f1: 20, dur: 1.2 * k, gain: 1 });
    s.noise({ dur: 1.0 * k, gain: 0.9, attack: 0.003, filter: lp(600, 50) });
    return s.stopTime;
  },
  bossMissile: (s) => {
    for (let i = 0; i < 3; i++) s.noise({ at: i * 0.12, dur: 0.7, gain: 0.35, attack: 0.1, filter: bp(300, 2500, 1) });
    explosion(s, 1.0, 1);
    return s.stopTime;
  },
  bossEmp: (s) => {
    s.osc({ type: 'sine', f0: 80, f1: 1600, dur: 0.6, gain: 0.4 });
    s.osc({ type: 'square', f0: 40, dur: 0.6, gain: 0.25, filter: lp(300) });
    s.noise({ dur: 0.5, gain: 0.2, filter: hp(4000) });
    return s.stopTime;
  },
  weakPing: (s) => {
    s.osc({ type: 'sine', f0: 1500 * s.intensity, dur: 0.5, gain: 0.3 });
    s.osc({ type: 'sine', f0: 2250 * s.intensity, dur: 0.25, gain: 0.15 });
    return s.stopTime;
  },
  weakCrunch: (s) => {
    s.noise({ dur: 0.7, gain: 0.9, filter: lp(1800, 200) });
    s.osc({ type: 'square', f0: 140, f1: 50, dur: 0.4, gain: 0.35, filter: lp(500) });
    s.osc({ type: 'sine', f0: 80, f1: 25, dur: 0.6, gain: 0.8 });
    s.noise({ dur: 0.2, gain: 0.4, filter: hp(3000) });
    return s.stopTime;
  },
  coreRiser: (s) => {
    s.osc({ type: 'sawtooth', f0: 80, f1: 800, dur: 2, gain: 0.35, attack: 1.5, release: 0.3, filter: lp(300, 3000) });
    s.noise({ dur: 2, gain: 0.3, attack: 1.5, filter: bp(500, 4000) });
    s.osc({ type: 'sine', f0: 40, f1: 200, dur: 2, gain: 0.5, attack: 1.5 });
    return s.stopTime;
  },
  bossDefeat: (s) => {
    [0, 0.5, 1.1, 1.8, 2.6].forEach((at, i) => explosion(s, at, 1 + i * 0.1));
    explosion(s, 3.4, 2);
    s.osc({ type: 'sawtooth', f0: 400, f1: 25, dur: 4.5, gain: 0.35, filter: lp(900, 100) });
    return s.stopTime;
  },

  // ---- game flow ---------------------------------------------------------------------
  defeatSting: (s) => {
    s.osc({ type: 'sawtooth', f0: 220, f1: 55, dur: 1.6, gain: 0.35, filter: lp(600) });
    s.osc({ type: 'sawtooth', f0: 262, f1: 65, dur: 1.6, gain: 0.25, filter: lp(600) });
    return s.stopTime;
  },
  victoryFanfare: (s) => {
    [261.6, 329.6, 392, 523.3].forEach((f, i) => s.osc({ at: i * 0.18, type: 'triangle', f0: f, dur: i === 3 ? 1.4 : 0.6, gain: 0.25, attack: 0.01 }));
    return s.stopTime;
  },
};
