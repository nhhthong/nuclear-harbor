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
  /** Spec 32: recorded samples. Loader timeout per file (ms) and fade of sample loops (s). */
  samples: { fetchTimeoutMs: 15000, loopFade: 0.6 },
  /** Recorded ambience loops layered on the procedural bed; the procedural sea/wind drop to this share. */
  ambienceSamples: { proceduralShare: 0.35 },
  /** Low-health heartbeat/breathing: level 0 at `start` of max HP, 1 at `full`; heartbeat rate range. */
  lowHealth: { start: 0.35, full: 0.1, rateMin: 1, rateMax: 1.55, breathShare: 0.8, fallbackPeriod: 0.9, smoothing: 0.25 },
  /** Surface choice for footsteps and bullet impacts (metres, world units; level layout in src/config). */
  surfaces: {
    metalAboveY: 0.5,
    floorNormalY: 0.7,
    groundY: 0.25,
    perimeter: { minX: -35.4, maxX: 35.4, maxZ: 33.4 },
  },
  /** Delay of the shell casing after a shot and of the reload parts (s; bolt/mag-in measured from the end). */
  casingDelay: 0.38,
  reload: { magOutAt: 0.12, magInBeforeEnd: 0.75, boltBeforeEnd: 0.3 },
  /** Gesture events that unlock the context. */
  gestureEvents: ['pointerdown', 'keydown'] as const,
} as const;
