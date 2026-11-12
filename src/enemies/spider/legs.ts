import { SPIDER_LOCAL } from './tunables';

/**
 * Procedural gait state: typed arrays, updated in place (no per-frame allocation). Legs are
 * ordered L0,R0,L1,R1,L2,R2 (front to back); tripods are {L0,R1,L2} and {R0,L1,R2}.
 * Feet live in world space; `homeLocal*` are body-space rest points (forward is -Z).
 */
export interface Gait {
  count: number;
  hipX: Float32Array;
  hipZ: Float32Array;
  homeLocalX: Float32Array;
  homeLocalZ: Float32Array;
  footX: Float32Array;
  footZ: Float32Array;
  footY: Float32Array;
  fromX: Float32Array;
  fromZ: Float32Array;
  toX: Float32Array;
  toZ: Float32Array;
  /** Step progress 0..1 while stepping. */
  t: Float32Array;
  stepping: Uint8Array;
  group: Uint8Array;
  /** Group that stepped most recently; the other one goes next. */
  lastGroup: number;
}

export function createGait(count: number): Gait {
  const g: Gait = {
    count,
    hipX: new Float32Array(count),
    hipZ: new Float32Array(count),
    homeLocalX: new Float32Array(count),
    homeLocalZ: new Float32Array(count),
    footX: new Float32Array(count),
    footZ: new Float32Array(count),
    footY: new Float32Array(count),
    fromX: new Float32Array(count),
    fromZ: new Float32Array(count),
    toX: new Float32Array(count),
    toZ: new Float32Array(count),
    t: new Float32Array(count),
    stepping: new Uint8Array(count),
    group: new Uint8Array(count),
    lastGroup: 1,
  };
  const perSide = Math.max(1, Math.ceil(count / 2));
  for (let i = 0; i < count; i++) {
    const side = i % 2 === 0 ? -1 : 1; // left = -x
    const row = i >> 1;
    const zc = row - (perSide - 1) / 2;
    g.hipX[i] = side * SPIDER_LOCAL.hipX;
    g.hipZ[i] = zc * SPIDER_LOCAL.hipZSpacing;
    g.homeLocalX[i] = side * SPIDER_LOCAL.homeX;
    g.homeLocalZ[i] = zc * SPIDER_LOCAL.homeZSpacing;
    g.group[i] = (row + (i & 1)) & 1;
  }
  return g;
}

/** Plants all feet at their home points (spawn, or waking from a skipped sim level). */
export function resetGait(g: Gait, px: number, pz: number, yaw: number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  for (let i = 0; i < g.count; i++) {
    const lx = g.homeLocalX[i] as number;
    const lz = g.homeLocalZ[i] as number;
    g.footX[i] = px + lx * c + lz * s;
    g.footZ[i] = pz - lx * s + lz * c;
    g.footY[i] = 0;
    g.stepping[i] = 0;
    g.t[i] = 0;
  }
}

/**
 * Advances the gait. A foot starts a step when it lags behind its (lead-shifted) home point by
 * the stride threshold and no leg of the other tripod is mid-step.
 */
export function updateGait(g: Gait, px: number, pz: number, yaw: number, speed: number, dt: number): void {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const moving = speed > SPIDER_LOCAL.idleSpeed;
  const lead = moving ? SPIDER_LOCAL.stepLead * Math.min(1, speed / 5) : 0;
  // forward in world space is (-sin yaw, -cos yaw)
  const fwdX = -s;
  const fwdZ = -c;
  let activeGroup = -1;
  for (let i = 0; i < g.count; i++) {
    if (g.stepping[i]) activeGroup = g.group[i] as number;
  }

  if (activeGroup === -1) activeGroup = pickGroup(g, px, pz, c, s, fwdX, fwdZ, lead);

  for (let i = 0; i < g.count; i++) {
    if (g.stepping[i]) {
      const t = Math.min(1, (g.t[i] as number) + dt / SPIDER_LOCAL.stepDuration);
      g.t[i] = t;
      const fx = g.fromX[i] as number;
      const fz = g.fromZ[i] as number;
      g.footX[i] = fx + ((g.toX[i] as number) - fx) * t;
      g.footZ[i] = fz + ((g.toZ[i] as number) - fz) * t;
      g.footY[i] = Math.sin(Math.PI * t) * SPIDER_LOCAL.stepHeight;
      if (t >= 1) {
        g.stepping[i] = 0;
        g.footY[i] = 0;
      }
      continue;
    }
    const lx = g.homeLocalX[i] as number;
    const lz = g.homeLocalZ[i] as number;
    const hx = px + lx * c + lz * s + fwdX * lead;
    const hz = pz - lx * s + lz * c + fwdZ * lead;
    const dx = hx - (g.footX[i] as number);
    const dz = hz - (g.footZ[i] as number);
    const grp = g.group[i] as number;
    if (dx * dx + dz * dz > SPIDER_LOCAL.strideThreshold * SPIDER_LOCAL.strideThreshold && activeGroup === grp) {
      g.stepping[i] = 1;
      g.t[i] = 0;
      g.fromX[i] = g.footX[i] as number;
      g.fromZ[i] = g.footZ[i] as number;
      g.toX[i] = hx;
      g.toZ[i] = hz;
      g.lastGroup = grp;
    }
  }
}

/** Picks the tripod to step next: the one that did not step last, if any of its feet lag. */
function pickGroup(g: Gait, px: number, pz: number, c: number, s: number, fwdX: number, fwdZ: number, lead: number): number {
  const limit = SPIDER_LOCAL.strideThreshold * SPIDER_LOCAL.strideThreshold;
  let lags0 = false;
  let lags1 = false;
  for (let i = 0; i < g.count; i++) {
    const lx = g.homeLocalX[i] as number;
    const lz = g.homeLocalZ[i] as number;
    const dx = px + lx * c + lz * s + fwdX * lead - (g.footX[i] as number);
    const dz = pz - lx * s + lz * c + fwdZ * lead - (g.footZ[i] as number);
    if (dx * dx + dz * dz > limit) {
      if (g.group[i] === 0) lags0 = true;
      else lags1 = true;
    }
  }
  const other = 1 - g.lastGroup;
  if (other === 0 ? lags0 : lags1) return other;
  if (g.lastGroup === 0 ? lags0 : lags1) return g.lastGroup;
  return -1;
}
