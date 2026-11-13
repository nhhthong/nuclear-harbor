import { zoneAt } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import type { BudgetWarning } from './budgets';
import type { ResourceCounts } from './benchmark';
import { DEBUG_TUNABLES } from './tunables';

export interface PerfSnapshot {
  fps: number;
  avgMs: number;
  onePercentLowFps: number;
  maxMs: number;
  fixedTicksPerSec: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  /** Distinct live tracked resources across all scopes. */
  trackedTotal: number;
  trackedScopes: Record<string, number>;
  colliders: number;
  enemies: { total: number; active: number; simplified: number; dormant: number };
  anchors: number;
  /** NaN when `performance.memory` is not available. */
  heapMb: number;
  quality: string;
  canvasWidth: number;
  canvasHeight: number;
  gameState: string;
  player: { x: number; y: number; z: number; zone: string };
  lowFpsSustained: boolean;
  warnings: BudgetWarning[];
  /** Numeric values published by other modules in `ctx.testHooks` ("module.key"). */
  hookNumbers: Record<string, number>;
}

interface MemoryInfo {
  usedJSHeapSize: number;
}

function readHeapMb(): number {
  const mem = (performance as Performance & { memory?: MemoryInfo }).memory;
  return mem ? mem.usedJSHeapSize / DEBUG_TUNABLES.bytesPerMb : NaN;
}

export function emptySnapshot(): PerfSnapshot {
  return {
    fps: 0,
    avgMs: 0,
    onePercentLowFps: 0,
    maxMs: 0,
    fixedTicksPerSec: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    programs: 0,
    trackedTotal: 0,
    trackedScopes: {},
    colliders: 0,
    enemies: { total: 0, active: 0, simplified: 0, dormant: 0 },
    anchors: 0,
    heapMb: NaN,
    quality: '',
    canvasWidth: 0,
    canvasHeight: 0,
    gameState: '',
    player: { x: 0, y: 0, z: 0, zone: '-' },
    lowFpsSustained: false,
    warnings: [],
    hookNumbers: {},
  };
}

/** Current GPU/tracked resource counts (cheap; used for benchmark start/end and F6 baseline). */
export function readResources(ctx: GameContext, out: ResourceCounts): ResourceCounts {
  const info = ctx.renderer.webgl.info;
  out.geometries = info.memory.geometries;
  out.textures = info.memory.textures;
  out.programs = info.programs?.length ?? 0;
  out.tracked = ctx.resources.totalLiveResources;
  out.heapMb = readHeapMb();
  return out;
}

export function countEnemies(ctx: GameContext, out: PerfSnapshot['enemies']): void {
  out.total = 0;
  out.active = 0;
  out.simplified = 0;
  out.dormant = 0;
  for (const e of ctx.enemies.all()) {
    out.total++;
    if (e.simLevel === 'active') out.active++;
    else if (e.simLevel === 'simplified') out.simplified++;
    else out.dormant++;
  }
}

/** Fill the parts of a snapshot that come from the game context (frame stats are filled by the caller). */
export function collectContext(ctx: GameContext, s: PerfSnapshot): void {
  const info = ctx.renderer.webgl.info;
  s.drawCalls = info.render.calls;
  s.triangles = info.render.triangles;
  s.geometries = info.memory.geometries;
  s.textures = info.memory.textures;
  s.programs = info.programs?.length ?? 0;
  s.trackedTotal = ctx.resources.totalLiveResources;
  s.trackedScopes = ctx.resources.stats();
  s.colliders = ctx.physics.colliderCount;
  countEnemies(ctx, s.enemies);
  s.anchors = ctx.grappleAnchors.size;
  s.heapMb = readHeapMb();
  s.quality = ctx.renderer.qualityPreset;
  s.canvasWidth = ctx.canvas.width;
  s.canvasHeight = ctx.canvas.height;
  s.gameState = ctx.state.current;
  const p = ctx.player.position;
  s.player.x = p.x;
  s.player.y = p.y;
  s.player.z = p.z;
  s.player.zone = zoneAt(p.x, p.z) ?? '-';
  const hooks: Record<string, number> = {};
  for (const [moduleId, hook] of Object.entries(ctx.testHooks)) {
    if (moduleId === 'debug' || typeof hook !== 'object' || hook === null) continue;
    for (const [key, value] of Object.entries(hook)) {
      if (typeof value === 'number' && Number.isFinite(value)) hooks[`${moduleId}.${key}`] = value;
    }
  }
  s.hookNumbers = hooks;
}
