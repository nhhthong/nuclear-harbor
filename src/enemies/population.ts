import { Vector3 } from 'three';
import { PLAYER_SPAWN } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { EnemyType } from '@/core/types';
import type { EnemySpawn } from './BaseEnemy';
import { navFor } from './nav/bakeNav';
import type { NavGrid, PathPoint } from './nav/NavGrid';
import { ENEMY_LOCAL } from './tunables';

const TYPES: readonly EnemyType[] = ['army', 'spot', 'duck'];

/** Parses `?enemies=army,spot|none`; the default is a single army robot. */
export function parseEnemyParam(value: string | null): EnemyType[] {
  if (value === null || value.trim() === '') return ['army'];
  const out: EnemyType[] = [];
  for (const raw of value.split(',')) {
    const token = raw.trim().toLowerCase();
    if (token === 'none') return [];
    if ((TYPES as readonly string[]).includes(token)) out.push(token as EnemyType);
  }
  return out;
}

function sandboxPopulation(types: readonly EnemyType[]): EnemySpawn[] {
  const { sandboxCenter: c, sandboxRingRadius: ring, sandboxPatrolHalf: h } = ENEMY_LOCAL;
  return types.map((type, i) => {
    const angle = (i / Math.max(1, types.length)) * Math.PI * 2;
    const r = types.length > 1 ? ring : 0;
    const x = c.x + Math.cos(angle) * r;
    const z = c.z + Math.sin(angle) * r;
    return {
      type,
      position: new Vector3(x, 0, z),
      patrol: [
        new Vector3(c.x - h, 0, c.z - h),
        new Vector3(c.x + h, 0, c.z - h),
        new Vector3(c.x + h, 0, c.z + h),
        new Vector3(c.x - h, 0, c.z + h),
      ],
    };
  });
}

// ---- authored harbor population (GDD 6, 6.3; ticket T-16) -----------------------------------

type XZ = readonly [number, number];

export interface Authored {
  readonly type: EnemyType;
  readonly at: XZ;
  readonly patrol: readonly XZ[];
}

/** A straight obstacle-free strip as reported by the world module (`testHooks.world.lanes`). */
export interface LaneData {
  readonly id: string;
  readonly axis: 'x' | 'z';
  readonly start: { readonly x: number; readonly z: number };
  readonly end: { readonly x: number; readonly z: number };
  readonly width: number;
  readonly length: number;
}

export interface CorridorData {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/**
 * Copy of the world generator's yard lanes, used when the world hook is absent (unit tests,
 * partial boots). A unit test compares it with the real generator so drift is caught.
 */
export const FALLBACK_LANES: readonly LaneData[] = [
  { id: 'yard-ns-1', axis: 'z', start: { x: -21.34, z: -27 }, end: { x: -21.34, z: 23 }, width: 6.6, length: 50 },
  { id: 'yard-ew-0', axis: 'x', start: { x: -71, z: -14.78 }, end: { x: -1.5, z: -14.78 }, width: 6.6, length: 69.5 },
  { id: 'yard-ew-2', axis: 'x', start: { x: -41.5, z: 8.78 }, end: { x: -1, z: 8.78 }, width: 6.6, length: 40.5 },
];

export const FALLBACK_CORRIDOR: CorridorData = { minX: -28, maxX: 28, minZ: 40, maxZ: 46 };

/** Distance kept from lane / corridor ends when placing a Duck (m). */
const LANE_INSET = 6;
/** Ducks on yard lanes (zone A); the remaining two stand in the warehouse corridor and on the open dock. */
const YARD_DUCKS = 4;
/** Arm length of the plus-shaped patrol at lane intersections (m). */
const ARM = 8;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseLanes(raw: unknown): LaneData[] | null {
  if (!Array.isArray(raw)) return null;
  const out: LaneData[] = [];
  for (const l of raw as unknown[]) {
    if (typeof l !== 'object' || l === null) return null;
    const r = l as Record<string, unknown>;
    const s = r.start as Record<string, unknown> | undefined;
    const e = r.end as Record<string, unknown> | undefined;
    if (
      typeof r.id !== 'string' ||
      (r.axis !== 'x' && r.axis !== 'z') ||
      !s || !e || !isNum(s.x) || !isNum(s.z) || !isNum(e.x) || !isNum(e.z) || !isNum(r.width) || !isNum(r.length)
    ) {
      return null;
    }
    out.push({ id: r.id, axis: r.axis, start: { x: s.x, z: s.z }, end: { x: e.x, z: e.z }, width: r.width, length: r.length });
  }
  return out.length > 0 ? out : null;
}

function parseCorridor(raw: unknown): CorridorData | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  return isNum(r.minX) && isNum(r.maxX) && isNum(r.minZ) && isNum(r.maxZ)
    ? { minX: r.minX, maxX: r.maxX, minZ: r.minZ, maxZ: r.maxZ }
    : null;
}

export interface HarborInputs {
  lanes: readonly LaneData[];
  corridor: CorridorData;
}

/** Reads the world module's lane data (read-only, same world:ready tick); falls back to the copy. */
export function harborInputs(ctx: Partial<Pick<GameContext, 'testHooks'>>): HarborInputs {
  const world = ctx.testHooks?.world;
  const w = typeof world === 'object' && world !== null ? (world as Record<string, unknown>) : {};
  return { lanes: parseLanes(w.lanes) ?? FALLBACK_LANES, corridor: parseCorridor(w.corridor) ?? FALLBACK_CORRIDOR };
}

const line = (a: XZ, b: XZ): XZ[] => [a, b];
const ring = (cx: number, cz: number, r: number): XZ[] => [
  [cx + r, cz],
  [cx, cz + r],
  [cx - r, cz],
  [cx, cz - r],
];
const cross = (cx: number, cz: number): XZ[] => [
  [cx, cz - ARM],
  [cx + ARM, cz],
  [cx, cz + ARM],
  [cx - ARM, cz],
];
const army = (patrol: XZ[], at: XZ = patrol[0] ?? [0, 0]): Authored => ({ type: 'army', at, patrol });
const spot = (patrol: XZ[]): Authored => ({ type: 'spot', at: patrol[0] ?? [0, 0], patrol });

/** Army loops (towers, intersections) and spot cover spots; Ducks come from lane data. */
const ARMY_SPOT_POSTS: readonly Authored[] = [
  // A Container Yard (5 army, 3 spot)
  army(ring(-36, -3, 5)), // tower 2
  army(cross(-21.34, -14.78), [-21.34, -14.78]),
  army(cross(-21.34, 8.78), [-21.34, 8.78]),
  army(cross(-46.3, -14.78), [-46.3, -14.78]),
  army(line([-44, 21], [-10, 21])), // apron between the yard and the warehouse
  spot(line([-46.3, -28], [-46.3, -18])),
  spot(line([-66, -14.78], [-53, -14.78])),
  spot(line([-3, -10], [-3, 6])),
  // B Crane Zone (4 army, 3 spot)
  army(ring(38, -4, 6)), // tower 3 (around the gantry legs)
  army(ring(34, -25, 4)),
  army(ring(39, 19, 3.5)),
  army(line([66, -2], [66, 18])),
  spot(line([4, -28], [24, -28])),
  spot(line([29, -4], [29, -14])),
  spot(line([6, 22], [28, 22])),
  // C Warehouse (3 army, 2 spot); tower 1 is lightly guarded by a single army, out of sight of the door
  army(line([25, 36], [16, 36])), // tower 1 hall
  army(ring(-50, 40, 5)), // west side yard
  army(ring(50, 40, 5)), // east side yard
  spot(line([-45, 29], [-60, 29])),
  spot(line([45, 29], [60, 29])),
  // D Dock (2 army, 2 spot); everything stands within reach of tower 4
  army(ring(32, -56, 5)), // tower 4 (heaviest guard)
  army(line([22, -62], [42, -66])),
  spot(line([40, -46], [40, -56])),
  spot(line([26, -47], [26, -62])),
];

function laneAlong(lane: LaneData, d: number): XZ {
  const t = Math.min(Math.max(d, LANE_INSET), lane.length - LANE_INSET);
  return lane.axis === 'z' ? [lane.start.x, lane.start.z + t] : [lane.start.x + t, lane.start.z];
}

/** Yard Ducks: one per yard lane, longest first; further Ducks reuse the lanes from the other end. */
export function yardDucks(lanes: readonly LaneData[]): Authored[] {
  const yard = lanes
    .filter((l) => l.id.startsWith('yard'))
    .sort((a, b) => b.length - a.length || a.id.localeCompare(b.id));
  const out: Authored[] = [];
  for (let i = 0; i < YARD_DUCKS && yard.length > 0; i++) {
    const lane = yard[i % yard.length] as LaneData;
    const a = laneAlong(lane, 0);
    const b = laneAlong(lane, lane.length);
    const reversed = Math.floor(i / yard.length) % 2 === 1;
    const patrol = reversed ? line(b, a) : line(a, b);
    out.push({ type: 'duck', at: patrol[0] ?? a, patrol });
  }
  return out;
}

/**
 * Warehouse corridor Duck (west half, hidden from the south door so it does not see the spawn) and
 * the open-dock Duck (east to west along the yard / dock border).
 */
export function otherDucks(corridor: CorridorData): Authored[] {
  const z = (corridor.minZ + corridor.maxZ) / 2;
  const a: XZ = [corridor.minX + 2, z];
  const b: XZ = [corridor.minX + 16, z];
  return [
    { type: 'duck', at: a, patrol: line(a, b) },
    { type: 'duck', at: [64, -34], patrol: line([64, -34], [6, -34]) },
  ];
}

/** The unvalidated authored harbor population. Pure and deterministic. */
export function authoredHarbor(inputs: HarborInputs): Authored[] {
  return [...ARMY_SPOT_POSTS, ...yardDucks(inputs.lanes), ...otherDucks(inputs.corridor)];
}

const scratchPoint: PathPoint = { x: 0, z: 0 };

/** Keeps the point when walkable, otherwise nudges it to the nearest walkable cell and warns. */
function validated(nav: NavGrid, p: XZ, what: string): XZ {
  if (nav.isWalkable(p[0], p[1])) return p;
  const n = nav.nearestWalkable(p[0], p[1], scratchPoint);
  if (!n) {
    console.warn(`[population] ${what} (${p[0]}, ${p[1]}) is blocked and no walkable cell exists nearby`);
    return p;
  }
  console.warn(`[population] ${what} (${p[0]}, ${p[1]}) was not walkable, moved to (${n.x.toFixed(1)}, ${n.z.toFixed(1)})`);
  return [n.x, n.z];
}

export function toSpawns(list: readonly Authored[], nav: NavGrid | null): EnemySpawn[] {
  const spawn = PLAYER_SPAWN.position;
  return list.map((a, i) => {
    const label = `${a.type} #${i}`;
    const at = nav ? validated(nav, a.at, `${label} spawn`) : a.at;
    if (Math.hypot(at[0] - spawn.x, at[1] - spawn.z) <= ENEMY_LOCAL.minDistanceFromSpawn) {
      console.warn(`[population] ${label} is within ${ENEMY_LOCAL.minDistanceFromSpawn} m of the player spawn`);
    }
    return {
      type: a.type,
      position: new Vector3(at[0], 0, at[1]),
      patrol: a.patrol.map((p) => {
        const q = nav ? validated(nav, p, `${label} patrol point`) : p;
        return new Vector3(q[0], 0, q[1]);
      }),
    };
  });
}

/**
 * The robots to spawn after `world:ready`. Sandbox: `?enemies=` list around (0, 0, -24). Harbor:
 * authored data honouring ENEMY_DISTRIBUTION (14 army / 10 spot / 6 duck): Ducks on the
 * yard lanes reported by the world module, in the warehouse corridor and on the open dock; army
 * loops around towers and lane intersections; spots beside container walls. Every point is
 * checked against the nav grid (warn and nudge when blocked).
 */
export function getPopulation(
  ctx: Pick<GameContext, 'flags'> & Partial<Pick<GameContext, 'testHooks'>>,
  nav: NavGrid | undefined = navFor(ctx),
): EnemySpawn[] {
  if (ctx.flags.sandbox) return sandboxPopulation(parseEnemyParam(ctx.flags.params.get('enemies')));
  if (!nav) return [];
  return toSpawns(authoredHarbor(harborInputs(ctx)), nav);
}
