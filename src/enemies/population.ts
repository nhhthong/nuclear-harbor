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
  { id: 'yard-ns-0', axis: 'z', start: { x: -88.16, z: -59 }, end: { x: -88.16, z: 39 }, width: 6.6, length: 98 },
  { id: 'yard-ns-1', axis: 'z', start: { x: -57.02, z: -59 }, end: { x: -57.02, z: 39 }, width: 6.6, length: 98 },
  { id: 'yard-ns-2', axis: 'z', start: { x: -25.88, z: -54.5 }, end: { x: -25.88, z: 39 }, width: 6.6, length: 93.5 },
  { id: 'yard-ew-0', axis: 'x', start: { x: -119, z: -39.45 }, end: { x: -1, z: -39.45 }, width: 6.6, length: 118 },
  { id: 'yard-ew-1', axis: 'x', start: { x: -92, z: -27.67 }, end: { x: -1, z: -27.67 }, width: 6.6, length: 91 },
  { id: 'yard-ew-2', axis: 'x', start: { x: -62, z: -15.89 }, end: { x: -1, z: -15.89 }, width: 6.6, length: 61 },
  { id: 'yard-ew-3', axis: 'x', start: { x: -65, z: -4.11 }, end: { x: -1, z: -4.11 }, width: 6.6, length: 64 },
  { id: 'yard-ew-4', axis: 'x', start: { x: -119, z: 7.67 }, end: { x: -1, z: 7.67 }, width: 6.6, length: 118 },
  { id: 'yard-ew-5', axis: 'x', start: { x: -119, z: 19.45 }, end: { x: -1, z: 19.45 }, width: 6.6, length: 118 },
];

export const FALLBACK_CORRIDOR: CorridorData = { minX: -48, maxX: 48, minZ: 73, maxZ: 79 };

/** Distance kept from lane / corridor ends when placing a Duck (m). */
const LANE_INSET = 6;
/** Ducks on yard lanes (zone A); the remaining two stand in the warehouse corridor and on the open dock. */
const YARD_NS_DUCKS = 3;
/** Spots hug container walls: offset from the lane centre line (lane half-width is 3.3 m, cells are 1.5 m). */
const COVER_OFFSET = 1.6;
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
  army(ring(-72, -12, 6)), // tower 2
  army(cross(-57.02, -4.11), [-57.02, -4.11]),
  army(cross(-25.88, -27.67), [-25.88, -27.67]),
  army(cross(-25.88, 19.45), [-25.88, 19.45]),
  army(cross(-88.16, 7.67), [-88.16, 7.67]),
  spot(line([-88.16 + COVER_OFFSET, -30], [-88.16 + COVER_OFFSET, -12])),
  spot(line([-57.02, 31], [-57.02, 23])),
  spot(line([-25.88 + COVER_OFFSET, -46], [-25.88 + COVER_OFFSET, -34])),
  // B Crane Zone (4 army, 3 spot)
  army(ring(72, -12, 6)), // tower 3 (platform base)
  army(ring(20, -8, 5)),
  army(ring(10, -44, 5)),
  army(ring(105, 14, 5)),
  spot(line([40, -5.5], [52, -5.5])),
  spot(line([60, -36.5], [72, -36.5])),
  spot(line([94, 5], [94, 17])),
  // C Warehouse (3 army, 2 spot); tower 1 is lightly guarded by a single army
  army(line([30, 58], [12, 58])), // tower 1 aisle
  army(ring(-70, 68, 6)),
  army(ring(70, 68, 6)),
  spot(line([-84, 50], [-84, 62])),
  spot(line([84, 50], [84, 62])),
  // D Dock (2 army, 2 spot); everything stands within reach of tower 4
  army(ring(60, -96, 6)), // tower 4 (heaviest guard)
  army(ring(46, -80, 4)),
  spot(line([47, -108], [57, -108])),
  spot(line([58, -76], [70, -76])),
];

function laneAlong(lane: LaneData, d: number): XZ {
  const t = Math.min(Math.max(d, LANE_INSET), lane.length - LANE_INSET);
  return lane.axis === 'z' ? [lane.start.x, lane.start.z + t] : [lane.start.x + t, lane.start.z];
}

/** Yard Ducks: the longest N-S lanes (alternating the end they start from) and one long aisle. */
export function yardDucks(lanes: readonly LaneData[]): Authored[] {
  const yard = lanes.filter((l) => l.id.startsWith('yard'));
  const ns = yard.filter((l) => l.axis === 'z').sort((a, b) => b.length - a.length || a.start.x - b.start.x);
  const ew = yard
    .filter((l) => l.axis === 'x')
    .sort((a, b) => b.length - a.length || Math.abs(a.start.z + 10) - Math.abs(b.start.z + 10));
  const out: Authored[] = [];
  ns.slice(0, YARD_NS_DUCKS)
    .sort((a, b) => a.start.x - b.start.x)
    .forEach((lane, i) => {
      const a = laneAlong(lane, 0);
      const b = laneAlong(lane, lane.length);
      const patrol = i % 2 === 0 ? line(a, b) : line(b, a);
      out.push({ type: 'duck', at: patrol[0] ?? a, patrol });
    });
  const aisle = ew[0];
  if (aisle) {
    const a = laneAlong(aisle, 0);
    const b = laneAlong(aisle, aisle.length);
    out.push({ type: 'duck', at: a, patrol: line(a, b) });
  }
  return out;
}

/** Warehouse corridor Duck (west to east) and the open-dock Duck (east to west, GDD 6.3). */
export function otherDucks(corridor: CorridorData): Authored[] {
  const z = (corridor.minZ + corridor.maxZ) / 2;
  const a: XZ = [corridor.minX + 8, z];
  const b: XZ = [corridor.maxX - 8, z];
  return [
    { type: 'duck', at: a, patrol: line(a, b) },
    { type: 'duck', at: [80, -64], patrol: line([80, -64], [40, -64]) },
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
