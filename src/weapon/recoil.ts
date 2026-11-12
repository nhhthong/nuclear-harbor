/** Pure spread and camera-recoil models (no three.js). Angles in degrees unless named `Rad`. */
const DEG = Math.PI / 180;

export interface SpreadConfig {
  minDeg: number;
  maxDeg: number;
  perShotDeg: number;
  recoveryDegPerSec: number;
}

export interface MovementContext {
  sprinting: boolean;
  moving: boolean;
}

export interface SpreadMovementConfig {
  moveSpreadDeg: number;
  sprintSpreadDeg: number;
}

/** Spread cone half-angle: grows per shot, recovers over time, floor raised while moving. */
export class SpreadModel {
  private spread: number;

  constructor(
    private readonly cfg: SpreadConfig,
    private readonly move: SpreadMovementConfig,
  ) {
    this.spread = cfg.minDeg;
  }

  get currentDeg(): number {
    return this.spread;
  }

  floorDeg(ctx: MovementContext): number {
    const extra = ctx.sprinting ? this.move.sprintSpreadDeg : ctx.moving ? this.move.moveSpreadDeg : 0;
    return Math.min(this.cfg.maxDeg, this.cfg.minDeg + extra);
  }

  update(dt: number, ctx: MovementContext): void {
    const floor = this.floorDeg(ctx);
    this.spread = this.spread > floor ? Math.max(floor, this.spread - this.cfg.recoveryDegPerSec * dt) : floor;
  }

  onShot(): void {
    this.spread = Math.min(this.cfg.maxDeg, this.spread + this.cfg.perShotDeg);
  }
}

/**
 * Offset inside a cone of half-angle `spreadDeg`, uniform over the disc. `r1`, `r2` are uniform
 * randoms in [0, 1). Returns tangent-plane offsets (x = right, y = up) for a unit direction.
 */
export function sampleSpread(spreadDeg: number, r1: number, r2: number, out: { x: number; y: number }): void {
  const radius = Math.tan(spreadDeg * DEG) * Math.sqrt(r1);
  const angle = r2 * Math.PI * 2;
  out.x = Math.cos(angle) * radius;
  out.y = Math.sin(angle) * radius;
}

export interface RecoilConfig {
  pitchDeg: number;
  yawDeg: number;
  recoveryPerSec: number;
  /** Share (0..1) of each kick that is later recovered. */
  recoverFraction: number;
}

export interface Kick {
  pitchRad: number;
  yawRad: number;
}

/**
 * Camera kick. `onShot` returns the kick to ADD to the player's pitch/yaw; `recover` returns the
 * (opposite) offset to apply this tick. Only the module's own accumulated offset is ever
 * recovered, so mouse input is never fought. The returned object is reused: read it immediately.
 */
export class RecoilKick {
  private accPitch = 0;
  private accYaw = 0;
  private readonly out: Kick = { pitchRad: 0, yawRad: 0 };

  constructor(private readonly cfg: RecoilConfig) {}

  get pendingPitchRad(): number {
    return this.accPitch;
  }

  get pendingYawRad(): number {
    return this.accYaw;
  }

  /** `r` is a uniform random in [0, 1) deciding the yaw direction. */
  onShot(r: number): Kick {
    const pitch = this.cfg.pitchDeg * DEG;
    const yaw = (r * 2 - 1) * this.cfg.yawDeg * DEG;
    this.accPitch += pitch * this.cfg.recoverFraction;
    this.accYaw += yaw * this.cfg.recoverFraction;
    this.out.pitchRad = pitch;
    this.out.yawRad = yaw;
    return this.out;
  }

  recover(dt: number): Kick {
    const k = 1 - Math.exp(-this.cfg.recoveryPerSec * dt);
    const dp = this.accPitch * k;
    const dy = this.accYaw * k;
    this.accPitch -= dp;
    this.accYaw -= dy;
    this.out.pitchRad = -dp;
    this.out.yawRad = -dy;
    return this.out;
  }

  reset(): void {
    this.accPitch = 0;
    this.accYaw = 0;
  }
}
