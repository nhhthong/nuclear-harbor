import { createParticleInit, type ParticleBuffer } from './ParticleBuffer';
import { RECIPES, type RecipeId } from './recipes';
import { VFX } from './tunables';

export type Rng = () => number;

/** Small seedable generator (mulberry32) so recipes are testable. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEG = Math.PI / 180;

/**
 * Turns a recipe into particles. Pure: owns two buffers (additive, alpha), a seeded RNG and one
 * scratch record; `emit` never allocates.
 */
export class ParticleEmitter {
  /** Particles that could not be spawned (buffer full or low priority refused). */
  dropped = 0;
  private readonly init = createParticleInit();

  constructor(
    readonly additive: ParticleBuffer,
    readonly alpha: ParticleBuffer,
    private readonly rng: Rng = Math.random,
  ) {}

  get live(): number {
    return this.additive.count + this.alpha.count;
  }

  get capacity(): number {
    return this.additive.limit + this.alpha.limit;
  }

  /** Spawns the recipe at a position around a unit normal. Returns the number of particles created. */
  emit(id: RecipeId, x: number, y: number, z: number, nx: number, ny: number, nz: number, scale: number): number {
    const recipe = RECIPES[id];
    const rng = this.rng;
    // tangent basis around the normal
    let tx: number;
    let ty: number;
    let tz: number;
    if (Math.abs(ny) < 0.9) {
      tx = nz; ty = 0; tz = -nx; // n x up
    } else {
      tx = 0; ty = -nz; tz = ny; // n x right-ish
    }
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty;
    const by = nz * tx - nx * tz;
    const bz = nx * ty - ny * tx;
    const speedScale = Math.sqrt(scale);
    const p = this.init;
    let spawned = 0;

    for (const layer of recipe.layers) {
      const buf = layer.buffer === 'add' ? this.additive : this.alpha;
      const n = Math.max(1, Math.round(layer.count * scale));
      const cosMax = Math.cos(Math.min(180, layer.coneDeg) * DEG);
      for (let i = 0; i < n; i++) {
        if (!buf.canSpawn(layer.lowPriority, VFX.lowPriorityFill)) {
          this.dropped += n - i;
          break;
        }
        // uniform direction inside the cone
        const cosT = 1 - rng() * (1 - cosMax);
        const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
        const phi = rng() * Math.PI * 2;
        const cx = Math.cos(phi) * sinT;
        const cy = Math.sin(phi) * sinT;
        const dx = nx * cosT + tx * cx + bx * cy;
        const dy = ny * cosT + ty * cx + by * cy;
        const dz = nz * cosT + tz * cx + bz * cy;
        const speed = (layer.speedMin + (layer.speedMax - layer.speedMin) * rng()) * speedScale;
        const spread = layer.spread * scale;
        p.x = x + (rng() - 0.5) * 2 * spread;
        p.y = y + (rng() - 0.5) * 2 * spread;
        p.z = z + (rng() - 0.5) * 2 * spread;
        p.vx = dx * speed;
        p.vy = dy * speed;
        p.vz = dz * speed;
        p.life = layer.lifeMin + (layer.lifeMax - layer.lifeMin) * rng();
        p.size0 = layer.size0 * scale;
        p.size1 = layer.size1 * scale;
        p.gravity = layer.gravity;
        p.drag = layer.drag;
        p.r0 = layer.from[0]; p.g0 = layer.from[1]; p.b0 = layer.from[2]; p.a0 = layer.from[3];
        p.r1 = layer.to[0]; p.g1 = layer.to[1]; p.b1 = layer.to[2]; p.a1 = layer.to[3];
        if (buf.spawn(p)) spawned++;
        else this.dropped++;
      }
    }
    return spawned;
  }

  /** Applies a quality budget: split between the additive and alpha buffers. */
  setBudget(total: number): void {
    const add = Math.round(total * VFX.additiveShare);
    this.additive.setLimit(add);
    this.alpha.setLimit(total - add);
  }

  step(dt: number): void {
    this.additive.step(dt);
    this.alpha.step(dt);
  }

  clear(): void {
    this.additive.clear();
    this.alpha.clear();
  }
}
