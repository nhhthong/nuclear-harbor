import { Vector3 } from 'three';
import { type ZoneId, zoneAt } from '@/config/level';
import { ECONOMY } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { ObjectPool } from '@/core/ObjectPool';
import type { PickupKind } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { collect, dropBlinkVisible, findRestingSpot, shouldDrop } from './logic';
import { BOSS_PLACEMENTS, type PickupCandidate, ZONE_PLACEMENTS } from './placements';
import { PICKUP } from './tunables';
import { PickupRenderer } from './visuals';

/**
 * Ammo crates, medkits and enemy drops (GDD 5.4, 13.4). Owned by ticket T-09.
 *
 * Static supplies are placed on `world:ready` (boss-arena supplies on `objectives:allActivated`),
 * enemy drops come from a bounded `ObjectPool`. Collection is a flat distance test in `fixedUpdate`.
 */

interface Pickup {
  id: string;
  kind: PickupKind;
  amount: number;
  dropped: boolean;
  x: number;
  /** Height of the resting surface. */
  y: number;
  z: number;
  /** Seconds left for drops; Infinity for placed supplies. */
  life: number;
  phase: number;
}

const SANDBOX_AMMO = { x: 4, y: 0, z: 6 } as const;
const SANDBOX_MEDKIT = { x: -4, y: 0, z: 6 } as const;
const DOWN = { x: 0, y: -1, z: 0 } as const;

export function createPickupsModule(): GameModule {
  const id = 'pickups';
  let ctx: GameContext | null = null;
  let renderer: PickupRenderer | null = null;
  let pool: ObjectPool<Pickup> | null = null;
  let offs: Array<() => void> = [];
  let nextId = 0;
  let bossSpawned = false;

  const items: Pickup[] = [];
  const liveByKind: Record<PickupKind, number> = { ammo: 0, medkit: 0 };
  const dropsByZone: Record<ZoneId, number> = { A: 0, B: 0, C: 0, D: 0 };
  const scratch = new Vector3();

  const makePickup = (): Pickup => ({
    id: '',
    kind: 'ammo',
    amount: 0,
    dropped: false,
    x: 0,
    y: 0,
    z: 0,
    life: Infinity,
    phase: 0,
  });

  function add(p: Pickup, kind: PickupKind, x: number, y: number, z: number, dropped: boolean, amount: number): boolean {
    if (liveByKind[kind] >= PICKUP.capacityPerKind) return false;
    p.id = `pickup-${nextId++}`;
    p.kind = kind;
    p.amount = amount;
    p.dropped = dropped;
    p.x = x;
    p.y = y;
    p.z = z;
    p.life = dropped ? ECONOMY.dropLifetime : Infinity;
    p.phase = (nextId * 2.399) % (Math.PI * 2);
    items.push(p);
    liveByKind[kind]++;
    ctx?.events.emit('pickup:spawned', { id: p.id, kind, position: scratch.set(x, y, z), dropped });
    return true;
  }

  function removeAt(index: number): void {
    const p = items[index];
    if (!p) return;
    const last = items.pop();
    if (last && last !== p) items[index] = last;
    liveByKind[p.kind]--;
    if (p.dropped) pool?.release(p);
  }

  function rayDown(x: number, z: number, fromY: number): number | null {
    if (!ctx) return null;
    const hit = ctx.physics.raycast({ x, y: fromY, z }, DOWN, PICKUP.rayMaxDistance, {
      groups: QueryGroups.worldOnly,
    });
    return hit ? hit.point.y : null;
  }

  function placeCandidate(cand: PickupCandidate): void {
    const spot = findRestingSpot(cand.x, cand.z, cand.elevated === true, rayDown, cand.castFromY);
    if (!spot) {
      console.warn(`[pickups] ${cand.kind} candidate at (${cand.x}, ${cand.z}) has no surface (sea?), skipped`);
      return;
    }
    const amount = cand.kind === 'ammo' ? ECONOMY.ammoCrateAmount : ECONOMY.medkitHeal;
    add(makePickup(), cand.kind, spot.x, spot.y, spot.z, false, amount);
  }

  function spawnBossSupplies(): void {
    if (bossSpawned) return;
    bossSpawned = true;
    for (const cand of BOSS_PLACEMENTS) placeCandidate(cand);
  }

  function placeSandboxFixture(kind: PickupKind, at: { x: number; y: number; z: number }): void {
    const y = rayDown(at.x, at.z, PICKUP.rayStartY) ?? at.y;
    const amount = kind === 'ammo' ? ECONOMY.ammoCrateAmount : ECONOMY.medkitHeal;
    add(makePickup(), kind, at.x, y, at.z, false, amount);
  }

  function onWorldReady(): void {
    if (!ctx) return;
    if (ctx.flags.sandbox) {
      placeSandboxFixture('ammo', SANDBOX_AMMO);
      placeSandboxFixture('medkit', SANDBOX_MEDKIT);
      return;
    }
    for (const cand of ZONE_PLACEMENTS) placeCandidate(cand);
    if (ctx.flags.params.has('boss')) spawnBossSupplies();
  }

  function onEnemyDestroyed(e: { position: Vector3 }): void {
    if (!ctx || !pool) return;
    const zone = zoneAt(e.position.x, e.position.z);
    if (!zone) return;
    if (!shouldDrop(Math.random, dropsByZone[zone])) return;
    const spot = findRestingSpot(e.position.x, e.position.z, true, rayDown, e.position.y + 2);
    if (!spot) return;
    const p = pool.acquire();
    if (!p) return;
    if (!add(p, 'ammo', spot.x, spot.y, spot.z, true, ECONOMY.enemyAmmoDropAmount)) {
      pool.release(p);
      return;
    }
    dropsByZone[zone]++;
  }

  function onRespawn(): void {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i]?.dropped) removeAt(i);
    }
  }

  function tryCollect(p: Pickup): boolean {
    if (!ctx) return false;
    const player = ctx.player;
    const result = collect(p.kind, player);
    if (!result.accepted) return false;
    let amount = result.amount;
    if (p.kind === 'medkit') {
      amount = player.heal(ECONOMY.medkitHeal);
      if (amount <= 0) return false;
    } else {
      ctx.events.emit('weapon:grantAmmo', { amount });
    }
    scratch.set(p.x, p.y, p.z);
    ctx.events.emit('pickup:collected', { id: p.id, kind: p.kind, amount, position: scratch });
    ctx.events.emit('vfx:spawn', { kind: 'pickup', position: scratch });
    ctx.events.emit('ui:toast', { text: p.kind === 'ammo' ? `+${amount} ammo` : `+${amount} HP`, seconds: 1.5 });
    return true;
  }

  return {
    id,

    init(context) {
      ctx = context;
      const res = context.resources.scope(id);
      renderer = new PickupRenderer();
      res.track(renderer.meshes.ammo);
      res.track(renderer.meshes.medkit);
      context.scene.add(renderer.meshes.ammo, renderer.meshes.medkit);
      pool = new ObjectPool<Pickup>({
        create: makePickup,
        capacity: ECONOMY.maxEnemyDropsPerZone * PICKUP.zoneCount,
      });

      offs = [
        context.events.on('world:ready', onWorldReady),
        context.events.on('enemy:destroyed', onEnemyDestroyed),
        context.events.on('objectives:allActivated', spawnBossSupplies),
        context.events.on('game:respawn', onRespawn),
      ];

      context.testHooks[id] = {
        list: () =>
          items.map((p) => ({
            id: p.id,
            kind: p.kind,
            position: { x: p.x, y: p.y, z: p.z },
            dropped: p.dropped,
          })),
        counts: () => ({
          ammo: liveByKind.ammo,
          medkit: liveByKind.medkit,
          total: items.length,
          drops: items.filter((p) => p.dropped).length,
          dropPoolLive: pool?.liveCount ?? 0,
        }),
        spawn: (kind: PickupKind, position: { x: number; y: number; z: number }) => {
          const amount = kind === 'ammo' ? ECONOMY.ammoCrateAmount : ECONOMY.medkitHeal;
          const p = makePickup();
          return add(p, kind, position.x, position.y, position.z, false, amount) ? p.id : null;
        },
      };
    },

    fixedUpdate(dt) {
      if (!ctx) return;
      const pos = ctx.player.position;
      const r2 = ECONOMY.pickupRadius * ECONOMY.pickupRadius;
      const alive = ctx.player.alive;
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        if (!p) continue;
        if (p.dropped) {
          p.life -= dt;
          if (p.life <= 0) {
            removeAt(i);
            continue;
          }
        }
        if (!alive) continue;
        const dx = pos.x - p.x;
        const dz = pos.z - p.z;
        if (dx * dx + dz * dz > r2) continue;
        if (Math.abs(pos.y - p.y) > PICKUP.verticalReach) continue;
        if (tryCollect(p)) removeAt(i);
      }
    },

    update() {
      if (!ctx || !renderer) return;
      const t = ctx.clock.simTime;
      renderer.begin();
      for (const p of items) {
        if (p.dropped && !dropBlinkVisible(p.life)) continue;
        const bob = Math.sin(t * PICKUP.bobSpeed + p.phase) * PICKUP.bobAmplitude;
        renderer.push(p.kind, p.x, p.y + PICKUP.hover + bob, p.z, t * PICKUP.spinSpeed + p.phase);
      }
      renderer.end();
    },

    dispose() {
      for (const off of offs) off();
      offs = [];
      if (ctx) delete ctx.testHooks[id];
      pool?.dispose();
      pool = null;
      items.length = 0;
      liveByKind.ammo = 0;
      liveByKind.medkit = 0;
      renderer?.dispose();
      renderer = null;
      ctx?.resources.scope(id).dispose();
      ctx = null;
    },
  };
}
