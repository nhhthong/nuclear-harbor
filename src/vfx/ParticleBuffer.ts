/**
 * Fixed-capacity struct-of-arrays particle simulation (GDD 13.4). Pure: no three.js.
 * All storage is allocated once in the constructor; spawn/step/fill never allocate.
 */

/** Mutable scratch record passed to `spawn()` so callers do not allocate per particle. */
export interface ParticleInit {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  size0: number;
  size1: number;
  /** Multiplier of g (9.81 m/s^2); negative rises (smoke). */
  gravity: number;
  /** Velocity damping per second. */
  drag: number;
  r0: number;
  g0: number;
  b0: number;
  a0: number;
  r1: number;
  g1: number;
  b1: number;
  a1: number;
}

export function createParticleInit(): ParticleInit {
  return {
    x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size0: 0.1, size1: 0.1, gravity: 0, drag: 0,
    r0: 1, g0: 1, b0: 1, a0: 1, r1: 1, g1: 1, b1: 1, a1: 0,
  };
}

const GRAVITY = 9.81;

export class ParticleBuffer {
  readonly capacity: number;
  /** Soft cap (<= capacity) used for the quality budget. */
  limit: number;
  count = 0;
  dropped = 0;

  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly size0: Float32Array;
  readonly size1: Float32Array;
  readonly gravity: Float32Array;
  readonly drag: Float32Array;
  /** 8 floats per particle: start rgba, end rgba. */
  readonly color: Float32Array;

  constructor(capacity: number) {
    if (capacity <= 0) throw new Error('ParticleBuffer capacity must be > 0');
    this.capacity = capacity;
    this.limit = capacity;
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 8);
  }

  setLimit(limit: number): void {
    this.limit = Math.max(0, Math.min(this.capacity, Math.floor(limit)));
  }

  /** True when a particle of the given priority would be accepted. */
  canSpawn(lowPriority: boolean, lowFill: number): boolean {
    if (this.count >= this.limit) return false;
    return !lowPriority || this.count < this.limit * lowFill;
  }

  /** Adds a particle; returns false (and counts a drop) when the buffer is full. */
  spawn(p: ParticleInit): boolean {
    if (this.count >= this.limit) {
      this.dropped++;
      return false;
    }
    const i = this.count++;
    this.px[i] = p.x;
    this.py[i] = p.y;
    this.pz[i] = p.z;
    this.vx[i] = p.vx;
    this.vy[i] = p.vy;
    this.vz[i] = p.vz;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size0[i] = p.size0;
    this.size1[i] = p.size1;
    this.gravity[i] = p.gravity;
    this.drag[i] = p.drag;
    const c = i * 8;
    this.color[c] = p.r0;
    this.color[c + 1] = p.g0;
    this.color[c + 2] = p.b0;
    this.color[c + 3] = p.a0;
    this.color[c + 4] = p.r1;
    this.color[c + 5] = p.g1;
    this.color[c + 6] = p.b1;
    this.color[c + 7] = p.a1;
    return true;
  }

  private move(from: number, to: number): void {
    this.px[to] = this.px[from] as number;
    this.py[to] = this.py[from] as number;
    this.pz[to] = this.pz[from] as number;
    this.vx[to] = this.vx[from] as number;
    this.vy[to] = this.vy[from] as number;
    this.vz[to] = this.vz[from] as number;
    this.life[to] = this.life[from] as number;
    this.maxLife[to] = this.maxLife[from] as number;
    this.size0[to] = this.size0[from] as number;
    this.size1[to] = this.size1[from] as number;
    this.gravity[to] = this.gravity[from] as number;
    this.drag[to] = this.drag[from] as number;
    const a = from * 8;
    const b = to * 8;
    for (let k = 0; k < 8; k++) this.color[b + k] = this.color[a + k] as number;
  }

  /** Integrates and removes dead particles by swap-remove (order is not preserved). */
  step(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const life = (this.life[i] as number) - dt;
      if (life <= 0) {
        this.count--;
        if (i !== this.count) this.move(this.count, i);
        continue;
      }
      this.life[i] = life;
      const damp = Math.max(0, 1 - (this.drag[i] as number) * dt);
      const vx = (this.vx[i] as number) * damp;
      const vy = (this.vy[i] as number) * damp - (this.gravity[i] as number) * GRAVITY * dt;
      const vz = (this.vz[i] as number) * damp;
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.vz[i] = vz;
      this.px[i] = (this.px[i] as number) + vx * dt;
      this.py[i] = (this.py[i] as number) + vy * dt;
      this.pz[i] = (this.pz[i] as number) + vz * dt;
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  /**
   * Writes render attributes (position xyz, size, colour rgba) for the live particles into
   * pre-allocated arrays. Returns the live count.
   */
  fill(position: Float32Array, size: Float32Array, color: Float32Array): number {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const t = 1 - (this.life[i] as number) / (this.maxLife[i] as number);
      const p = i * 3;
      position[p] = this.px[i] as number;
      position[p + 1] = this.py[i] as number;
      position[p + 2] = this.pz[i] as number;
      const s0 = this.size0[i] as number;
      size[i] = s0 + ((this.size1[i] as number) - s0) * t;
      const c = i * 8;
      const o = i * 4;
      for (let k = 0; k < 4; k++) {
        const c0 = this.color[c + k] as number;
        color[o + k] = c0 + ((this.color[c + 4 + k] as number) - c0) * t;
      }
    }
    return n;
  }
}
