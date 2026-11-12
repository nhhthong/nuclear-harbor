import { Vector3 } from 'three';
import { ENEMY_DISTRIBUTION, PLAYER_SPAWN, ZONES, type ZoneId } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { EnemyType } from '@/core/types';
import type { EnemySpawn } from './BaseEnemy';
import { navFor } from './nav/bakeNav';
import type { NavGrid } from './nav/NavGrid';
import { ENEMY_LOCAL } from './tunables';

const TYPES: readonly EnemyType[] = ['sphere', 'spider', 'charger'];

/** Small deterministic PRNG (mulberry32) so harbor placement is reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parses `?enemies=sphere,spider|none`; the default is a single sphere robot. */
export function parseEnemyParam(value: string | null): EnemyType[] {
  if (value === null || value.trim() === '') return ['sphere'];
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

function randomWalkable(
  nav: NavGrid,
  rand: () => number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  accept: (x: number, z: number) => boolean,
): Vector3 | null {
  for (let i = 0; i < ENEMY_LOCAL.sampleAttempts; i++) {
    const x = minX + rand() * (maxX - minX);
    const z = minZ + rand() * (maxZ - minZ);
    if (nav.isWalkable(x, z) && accept(x, z)) return new Vector3(x, 0, z);
  }
  return null;
}

function patrolLoop(nav: NavGrid, rand: () => number, start: Vector3): Vector3[] {
  const { patrolPoints, patrolRadius } = ENEMY_LOCAL;
  const count = patrolPoints.min + Math.floor(rand() * (patrolPoints.max - patrolPoints.min + 1));
  const loop: Vector3[] = [start.clone()];
  for (let i = 1; i < count; i++) {
    const prev = loop[loop.length - 1] ?? start;
    const p = randomWalkable(nav, rand, start.x - patrolRadius.max, start.x + patrolRadius.max, start.z - patrolRadius.max, start.z + patrolRadius.max, (x, z) => {
      const d = Math.hypot(x - start.x, z - start.z);
      return d >= patrolRadius.min && d <= patrolRadius.max && nav.findPath(prev.x, prev.z, x, z) !== null;
    });
    if (p) loop.push(p);
  }
  return loop;
}

function harborPopulation(nav: NavGrid): EnemySpawn[] {
  const rand = seededRandom(ENEMY_LOCAL.populationSeed);
  const spawn = PLAYER_SPAWN.position;
  const out: EnemySpawn[] = [];
  for (const zone of Object.values(ZONES)) {
    const counts = ENEMY_DISTRIBUTION[zone.id as ZoneId];
    for (const type of TYPES) {
      for (let i = 0; i < counts[type]; i++) {
        const pos = randomWalkable(nav, rand, zone.minX, zone.maxX, zone.minZ, zone.maxZ, (x, z) =>
          Math.hypot(x - spawn.x, z - spawn.z) > ENEMY_LOCAL.minDistanceFromSpawn,
        );
        if (!pos) continue;
        out.push({ type, position: pos, patrol: patrolLoop(nav, rand, pos) });
      }
    }
  }
  return out;
}

/**
 * The robots to spawn after `world:ready`. Sandbox: `?enemies=` list around (0, 0, -24). Harbor:
 * ENEMY_DISTRIBUTION per zone on random walkable cells (seeded), each with a 3-4 point patrol loop,
 * more than 40 m from the player spawn. T-16 refines the placement later.
 */
export function getPopulation(
  ctx: Pick<GameContext, 'flags'>,
  nav: NavGrid | undefined = navFor(ctx),
): EnemySpawn[] {
  if (ctx.flags.sandbox) return sandboxPopulation(parseEnemyParam(ctx.flags.params.get('enemies')));
  if (!nav) return [];
  return harborPopulation(nav);
}
