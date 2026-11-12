/** Feature-local audio numbers (GDD 11). All values are `proposed` engineering defaults. */
export const AUDIO = {
  /** Maximum simultaneously playing one-shot voices. */
  voiceCap: 24,
  /** Positional model (PannerNode, equalpower, inverse). */
  spatial: { refDistance: 3, maxDistance: 120, rolloff: 1 },
  /** Bus levels (linear gain) and master dynamics. */
  buses: { sfx: 0.9, ambience: 0.35, ui: 0.7 },
  compressor: { threshold: -14, knee: 12, ratio: 6, attack: 0.003, release: 0.2 },
  /** Random pitch variation applied to every one-shot (+-fraction). */
  pitchJitter: 0.04,
  /** Seconds between "now" and the scheduled start of a voice. */
  lookahead: 0.005,
  /** Fade used when a voice is stolen. */
  stealFade: 0.015,
  /** Ambience level while not playing, and fade time constants (seconds). */
  ambience: { playingLevel: 1, duckedLevel: 0.12, fadeIn: 1.2, fadeOut: 0.4 },
  /** Master volume smoothing time constant (seconds): short enough to feel immediate. */
  masterSmoothing: 0.01,
  noiseSeconds: 2,
  /** Tower beacon ping: interval as a function of distance to the nearest inactive tower. */
  beacon: { nearDistance: 8, farDistance: 100, minInterval: 0.4, maxInterval: 3 },
  /** Countdown: from this many seconds remaining the final beeps play. */
  finalBeepSeconds: 10,
  /** Tower hum frequency range over activation progress 0..1. */
  hum: { baseHz: 60, topHz: 200, gain: 0.25 },
  /** Gesture events that unlock the context. */
  gestureEvents: ['pointerdown', 'keydown'] as const,
} as const;
