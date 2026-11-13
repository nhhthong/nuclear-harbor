import { BoxGeometry, DynamicDrawUsage, InstancedMesh, MeshStandardMaterial, Object3D, Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { ECONOMY } from '@/config/tunables';
import type { GameContext } from '@/core/GameContext';
import type { PickupKind } from '@/core/types';
import { QueryGroups } from '@/physics/groups';
import { DINO } from './tunables';

interface Drop {
  id: string;
  kind: PickupKind;
  x: number;
  y: number;
  z: number;
  life: number;
  phase: number;
}

const DOWN = { x: 0, y: -1, z: 0 } as const;
const dummy = new Object3D();
const evPos = new Vector3();

/**
 * Guaranteed dinosaur loot: ammo crates and a medkit, bounded (DINO.drops.capacity). The pickups
 * module only drops 15 ammo at random per destroyed robot, so the semi-boss keeps its own small
 * pickups and announces them with the shared pickup events (see foundation-requests.md).
 */
export class DinoDrops {
  private readonly items: Drop[] = [];
  private readonly ammo: InstancedMesh;
  private readonly medkit: InstancedMesh;
  private nextId = 0;

  constructor(
    private readonly ctx: GameContext,
    res: ResourceTracker,
  ) {
    const cap = DINO.drops.capacity;
    const geo = new BoxGeometry(0.6, 0.4, 0.45);
    this.ammo = new InstancedMesh(geo, new MeshStandardMaterial({ color: 0x4a6b2a, emissive: 0x2a5a10, emissiveIntensity: 0.8 }), cap);
    this.medkit = new InstancedMesh(
      new BoxGeometry(0.5, 0.4, 0.5),
      new MeshStandardMaterial({ color: 0xf2f2f2, emissive: 0xaa1111, emissiveIntensity: 0.9 }),
      cap,
    );
    for (const m of [this.ammo, this.medkit]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      ctx.scene.add(m);
      res.track(m);
    }
  }

  get count(): number {
    return this.items.length;
  }

  list(): Array<{ id: string; kind: PickupKind; x: number; y: number; z: number }> {
    return this.items.map((d) => ({ id: d.id, kind: d.kind, x: d.x, y: d.y, z: d.z }));
  }

  private groundY(x: number, z: number): number {
    const hit = this.ctx.physics.raycast({ x, y: 30, z }, DOWN, 60, { groups: QueryGroups.worldOnly });
    return hit ? hit.point.y : 0;
  }

  /** Scatter the loot around `x, z`. */
  dropLoot(x: number, z: number): void {
    const { ammoCrates, medkits, scatter } = DINO.drops;
    const total = ammoCrates + medkits;
    for (let i = 0; i < total; i++) {
      const kind: PickupKind = i < ammoCrates ? 'ammo' : 'medkit';
      const a = (i / total) * Math.PI * 2 + 0.4;
      const px = x + Math.cos(a) * scatter;
      const pz = z + Math.sin(a) * scatter;
      this.add(kind, px, this.groundY(px, pz), pz);
    }
  }

  add(kind: PickupKind, x: number, y: number, z: number): boolean {
    if (this.items.length >= DINO.drops.capacity) return false;
    const d: Drop = { id: `dino-drop-${this.nextId++}`, kind, x, y, z, life: DINO.drops.lifetimeSeconds, phase: this.nextId * 2.1 };
    this.items.push(d);
    this.ctx.events.emit('pickup:spawned', { id: d.id, kind, position: evPos.set(x, y, z), dropped: true });
    return true;
  }

  fixedUpdate(dt: number): void {
    const ctx = this.ctx;
    const p = ctx.player;
    const r2 = DINO.drops.pickupRadius * DINO.drops.pickupRadius;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const d = this.items[i];
      if (!d) continue;
      d.life -= dt;
      if (d.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      if (!p.alive) continue;
      const dx = p.position.x - d.x;
      const dz = p.position.z - d.z;
      if (dx * dx + dz * dz > r2 || Math.abs(p.position.y - d.y) > 1.5) continue;
      let amount = 0;
      if (d.kind === 'medkit') {
        amount = p.heal(ECONOMY.medkitHeal);
        if (amount <= 0) continue;
      } else {
        amount = ECONOMY.ammoCrateAmount;
        ctx.events.emit('weapon:grantAmmo', { amount });
      }
      evPos.set(d.x, d.y, d.z);
      ctx.events.emit('pickup:collected', { id: d.id, kind: d.kind, amount, position: evPos });
      ctx.events.emit('vfx:spawn', { kind: 'pickup', position: evPos });
      ctx.events.emit('ui:toast', { text: d.kind === 'ammo' ? `+${amount} ammo` : `+${amount} HP`, seconds: 1.5 });
      this.items.splice(i, 1);
    }
  }

  update(t: number): void {
    let a = 0;
    let m = 0;
    for (const d of this.items) {
      const bob = Math.sin(t * 2 + d.phase) * 0.1;
      dummy.position.set(d.x, d.y + 0.55 + bob, d.z);
      dummy.rotation.set(0, t * 1.2 + d.phase, 0);
      dummy.updateMatrix();
      if (d.kind === 'ammo') this.ammo.setMatrixAt(a++, dummy.matrix);
      else this.medkit.setMatrixAt(m++, dummy.matrix);
    }
    this.ammo.count = a;
    this.medkit.count = m;
    this.ammo.instanceMatrix.needsUpdate = true;
    this.medkit.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.items.length = 0;
    this.ammo.removeFromParent();
    this.medkit.removeFromParent();
    this.ammo.dispose();
    this.medkit.dispose();
  }
}
