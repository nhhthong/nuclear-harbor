/**
 * Pure grapple state machine (GDD 4.1): ready -> pulling -> cooldown -> ready, plus immediate
 * failures. No three.js, DOM or physics: the module feeds it ray results and the player's motion
 * and applies its output. `step()` returns a reused output object and a reused events array; the
 * caller must consume them before the next call.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export type GrapplePhase = 'ready' | 'pulling' | 'cooldown';
export type ReleaseReason = 'arrived' | 'manual' | 'stuck' | 'timeout' | 'death';
export type FailReason = 'no-target' | 'not-grappleable' | 'cooldown';

export interface GrappleConfig {
  maxRange: number;
  cooldown: number;
  failureCooldown: number;
  releaseDistance: number;
  maxPullDuration: number;
  stuckDistance: number;
  stuckWindow: number;
  hookTravelSpeed: number;
  maxAttachDelay: number;
  /** Extra height added to the aim point of ordinary surfaces so the capsule ends above the lip. */
  aimLift: number;
  /** Metres the aim point is moved into the surface (against the horizontal hit normal). */
  wallInset: number;
  cooldownEventInterval: number;
}

/** Result of the targeting ray (or the aim-assist fallback). */
export interface RayResult {
  hit: boolean;
  grappleable: boolean;
  distance: number;
  point: Vec3Like;
  /** Horizontal components of the hit normal (0 when unknown). */
  nx?: number;
  nz?: number;
  anchorId?: string;
  /** Present for perch anchors: where the player should end up standing. */
  landing?: Vec3Like;
}

export interface StepInput {
  dt: number;
  firePressed: boolean;
  /** Only read when a shot is taken (fire pressed while ready). */
  ray: RayResult | null;
  eye: Vec3Like;
  /** Distance the player actually moved since the previous step, metres. */
  moved: number;
}

export type GrappleEvent =
  | { type: 'fired' }
  | { type: 'attached'; distance: number; anchorId?: string }
  | { type: 'released'; reason: ReleaseReason }
  | { type: 'failed'; reason: FailReason }
  | { type: 'cooldown'; remaining: number; total: number };

export interface StepOutput {
  /** True when the player must be pulled this tick along (dirX, dirY, dirZ). */
  pulling: boolean;
  dirX: number;
  dirY: number;
  dirZ: number;
  /** Set on arrival at a perch anchor: the point the player should be placed on. */
  landing: Vec3Like | null;
  events: GrappleEvent[];
}

export class GrappleState {
  phase: GrapplePhase = 'ready';
  cooldownRemaining = 0;
  cooldownTotal = 0;

  /** Aim point of the current pull (valid while pulling). */
  readonly target: Vec3Like = { x: 0, y: 0, z: 0 };
  anchorId: string | undefined;
  private landing: Vec3Like | null = null;
  private isPerch = false;

  private pullDelay = 0;
  private pullTime = 0;
  private windowTime = 0;
  private windowMoved = 0;
  private sinceCooldownEvent = 0;

  private readonly out: StepOutput = { pulling: false, dirX: 0, dirY: 0, dirZ: 0, landing: null, events: [] };

  constructor(private readonly cfg: GrappleConfig) {}

  step(input: StepInput): StepOutput {
    const out = this.out;
    out.events.length = 0;
    out.pulling = false;
    out.landing = null;

    if (this.phase === 'cooldown') this.tickCooldown(input.dt);

    if (input.firePressed) {
      if (this.phase === 'pulling') {
        this.release('manual');
      } else if (this.phase === 'cooldown') {
        out.events.push({ type: 'failed', reason: 'cooldown' });
      } else {
        this.fire(input.ray);
      }
      return out;
    }

    if (this.phase === 'pulling') this.tickPull(input, out);
    return out;
  }

  /** External release (death). No-op unless pulling. Returns the (reused) output. */
  forceRelease(reason: ReleaseReason): StepOutput {
    const out = this.out;
    out.events.length = 0;
    out.pulling = false;
    out.landing = null;
    if (this.phase === 'pulling') this.release(reason);
    return out;
  }

  /** Silent return to ready (respawn, leaving the playing state, dispose). */
  reset(): void {
    this.phase = 'ready';
    this.cooldownRemaining = 0;
    this.cooldownTotal = 0;
    this.anchorId = undefined;
    this.landing = null;
    this.out.pulling = false;
    this.out.events.length = 0;
    this.out.landing = null;
  }

  private fire(ray: RayResult | null): void {
    const events = this.out.events;
    if (!ray || !ray.hit || ray.distance > this.cfg.maxRange) {
      events.push({ type: 'failed', reason: 'no-target' });
      this.startCooldown(this.cfg.failureCooldown);
      return;
    }
    if (!ray.grappleable) {
      events.push({ type: 'failed', reason: 'not-grappleable' });
      this.startCooldown(this.cfg.failureCooldown);
      return;
    }
    this.isPerch = ray.landing !== undefined;
    this.landing = ray.landing ?? null;
    this.anchorId = ray.anchorId;
    const inset = this.isPerch ? 0 : this.cfg.wallInset;
    this.target.x = ray.point.x - (ray.nx ?? 0) * inset;
    this.target.y = ray.point.y + (this.isPerch ? 0 : this.cfg.aimLift);
    this.target.z = ray.point.z - (ray.nz ?? 0) * inset;
    this.pullDelay = Math.min(ray.distance / this.cfg.hookTravelSpeed, this.cfg.maxAttachDelay);
    this.pullTime = 0;
    this.windowTime = 0;
    this.windowMoved = 0;
    this.phase = 'pulling';
    events.push({ type: 'fired' });
    const attached: GrappleEvent =
      ray.anchorId === undefined
        ? { type: 'attached', distance: ray.distance }
        : { type: 'attached', distance: ray.distance, anchorId: ray.anchorId };
    events.push(attached);
  }

  private tickPull(input: StepInput, out: StepOutput): void {
    const { dt, eye } = input;
    if (this.pullDelay > 0) {
      this.pullDelay -= dt;
      if (this.pullDelay > 0) return;
    }
    const dx = this.target.x - eye.x;
    const dy = this.target.y - eye.y;
    const dz = this.target.z - eye.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist <= this.cfg.releaseDistance) {
      out.landing = this.isPerch ? this.landing : null;
      this.release('arrived');
      return;
    }

    this.pullTime += dt;
    if (this.pullTime > this.cfg.maxPullDuration) {
      this.release('timeout');
      return;
    }

    this.windowTime += dt;
    this.windowMoved += input.moved;
    if (this.windowTime >= this.cfg.stuckWindow) {
      const stuck = this.windowMoved < this.cfg.stuckDistance;
      this.windowTime = 0;
      this.windowMoved = 0;
      if (stuck) {
        this.release('stuck');
        return;
      }
    }

    const inv = 1 / dist;
    out.pulling = true;
    out.dirX = dx * inv;
    out.dirY = dy * inv;
    out.dirZ = dz * inv;
  }

  private release(reason: ReleaseReason): void {
    this.out.events.push({ type: 'released', reason });
    this.out.pulling = false;
    this.startCooldown(this.cfg.cooldown);
  }

  private startCooldown(total: number): void {
    this.phase = 'cooldown';
    this.cooldownTotal = total;
    this.cooldownRemaining = total;
    this.sinceCooldownEvent = 0;
    this.out.events.push({ type: 'cooldown', remaining: total, total });
  }

  private tickCooldown(dt: number): void {
    this.cooldownRemaining = Math.max(0, this.cooldownRemaining - dt);
    this.sinceCooldownEvent += dt;
    if (this.cooldownRemaining === 0) {
      this.phase = 'ready';
      this.out.events.push({ type: 'cooldown', remaining: 0, total: this.cooldownTotal });
    } else if (this.sinceCooldownEvent >= this.cfg.cooldownEventInterval) {
      this.sinceCooldownEvent = 0;
      this.out.events.push({ type: 'cooldown', remaining: this.cooldownRemaining, total: this.cooldownTotal });
    }
  }
}
