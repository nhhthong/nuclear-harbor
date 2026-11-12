import { Vector3 } from 'three';
import type { ResourceTracker } from '@/assets/ResourceTracker';
import { OBJECTIVES } from '@/config/tunables';
import { TOWERS } from '@/config/level';
import type { GameContext } from '@/core/GameContext';
import { TowerActivation } from './TowerActivation';
import { createTowerModel, type TowerModel } from './towerModel';

/** Sandbox tower position (ticket T-08). */
export const SANDBOX_TOWER = { id: 1, position: { x: 8, y: 0, z: 2 } } as const;

const PROGRESS_INTERVAL = 0.1;
const MAX_DY = 2.5;
const PROMPT_TEXT = 'Hold E to activate';

interface Tower {
  id: number;
  position: Vector3;
  activation: TowerActivation;
  model: TowerModel;
  defendSent: boolean;
  lastProgressEmit: number;
}

export interface TowerState {
  id: number;
  active: boolean;
  progress: number;
}

export class TowerManager {
  private readonly towers: Tower[] = [];
  private promptShown = false;
  private time = 0;
  private pulseTime = 0;
  private readonly scratch = new Vector3();

  /** Called after each activation with (activatedCount, total). */
  onAllActivated: (() => void) | null = null;

  constructor(
    private readonly ctx: GameContext,
    private readonly res: ResourceTracker,
  ) {
    const defs = ctx.flags.sandbox ? [SANDBOX_TOWER] : TOWERS;
    for (const def of defs) this.build(def.id, def.position);
  }

  get total(): number {
    return this.towers.length;
  }

  get activatedCount(): number {
    return this.towers.filter((t) => t.activation.isActivated).length;
  }

  getState(): TowerState[] {
    return this.towers.map((t) => ({ id: t.id, active: t.activation.isActivated, progress: t.activation.progress }));
  }

  private build(id: number, pos: { x: number; y: number; z: number }): void {
    const model = createTowerModel();
    model.group.position.set(pos.x, pos.y, pos.z);
    model.setState('inactive', 0);
    this.ctx.scene.add(model.group);
    this.res.track(model.group);
    // one collider for the pillar body, none on the beam
    this.ctx.physics.addStaticBox({
      center: { x: pos.x, y: pos.y + 1.5, z: pos.z },
      halfExtents: { x: 0.55, y: 1.5, z: 0.55 },
      meta: { kind: 'static' },
    });
    this.towers.push({
      id,
      position: new Vector3(pos.x, pos.y, pos.z),
      activation: new TowerActivation(OBJECTIVES.activationHoldSeconds, OBJECTIVES.activationResetInstant),
      model,
      defendSent: false,
      lastProgressEmit: -1,
    });
  }

  registerAll(): void {
    for (const t of this.towers) {
      this.ctx.events.emit('tower:registered', { towerId: t.id, position: t.position, total: this.total });
    }
  }

  /** `?towers=n` / test hook: complete a tower through the normal activation path. */
  forceActivate(id: number): boolean {
    const t = this.towers.find((x) => x.id === id);
    if (!t || t.activation.isActivated) return false;
    this.startDefend(t);
    t.activation.forceActivate();
    this.completeTower(t);
    return true;
  }

  /** Player died: cancel any in-progress activation with reason `died`. */
  onPlayerDied(): void {
    for (const t of this.towers) {
      const r = t.activation.step(0, { inRange: false, holding: false, playerAlive: false });
      if (r.cancelled) this.afterCancel(t, r.cancelled);
    }
  }

  fixedUpdate(dt: number): void {
    this.time += dt;
    const player = this.ctx.player;
    const alive = player.alive;
    const holding = this.ctx.input.isDown('interact');

    // nearest inactive tower within range for the prompt
    let nearest: Tower | null = null;
    let nearestDist = Infinity;
    for (const t of this.towers) {
      if (t.activation.isActivated) continue;
      const d = this.distance(t);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    const inRangeTower = nearest && nearestDist <= OBJECTIVES.interactRange ? nearest : null;
    const showPrompt = alive && inRangeTower !== null;
    if (showPrompt !== this.promptShown) {
      this.promptShown = showPrompt;
      this.ctx.events.emit('interact:prompt', { text: showPrompt ? PROMPT_TEXT : null });
    }

    for (const t of this.towers) {
      if (t.activation.isActivated) continue;
      const inRange = t === inRangeTower;
      const r = t.activation.step(dt, { inRange, holding, playerAlive: alive });
      if (r.started) {
        this.ctx.events.emit('tower:activationStarted', { towerId: t.id });
        this.startDefend(t);
        t.lastProgressEmit = this.time;
      }
      if (r.cancelled) this.afterCancel(t, r.cancelled);
      if (r.activated) {
        this.completeTower(t);
        continue;
      }
      if (r.active && this.time - t.lastProgressEmit >= PROGRESS_INTERVAL - 1e-9) {
        t.lastProgressEmit = this.time;
        this.ctx.events.emit('tower:activationProgress', { towerId: t.id, progress: r.progress });
      }
    }
  }

  update(dt: number): void {
    this.pulseTime += dt;
    for (const t of this.towers) {
      if (t.activation.isActivated) continue;
      t.model.setState(t.activation.isActivating ? 'activating' : 'inactive', this.pulseTime);
    }
  }

  private distance(t: Tower): number {
    const p = this.ctx.player.position;
    if (Math.abs(p.y - t.position.y) >= MAX_DY) return Infinity;
    return Math.hypot(p.x - t.position.x, p.z - t.position.z);
  }

  private afterCancel(t: Tower, reason: 'left-range' | 'released' | 'died'): void {
    this.ctx.events.emit('tower:activationCancelled', { towerId: t.id, reason });
    t.model.setState('inactive', 0);
  }

  private startDefend(t: Tower): void {
    if (t.defendSent) return;
    t.defendSent = true;
    this.ctx.events.emit('objectives:defendStarted', {
      towerId: t.id,
      position: t.position,
      radius: OBJECTIVES.defendPullRadius,
    });
  }

  private completeTower(t: Tower): void {
    t.model.setState('active', 0);
    const ev = this.ctx.events;
    const count = this.activatedCount;
    ev.emit('tower:activated', { towerId: t.id, activatedCount: count, total: this.total, position: t.position });
    ev.emit('vfx:spawn', { kind: 'big-explosion', position: this.scratch.copy(t.position).setY(t.position.y + 1.5), scale: 1.5 });

    // safe checkpoint 2 m in front of the tower (toward the player's side), facing away from it
    const p = this.ctx.player.position;
    const dx = p.x - t.position.x;
    const dz = p.z - t.position.z;
    const len = Math.hypot(dx, dz);
    const nx = len > 0.01 ? dx / len : 0;
    const nz = len > 0.01 ? dz / len : 1;
    const cp = new Vector3(t.position.x + nx * 2, t.position.y, t.position.z + nz * 2);
    // yaw convention: forward = (-sin yaw, -cos yaw); facing away from the tower means along (nx, nz)
    const yaw = Math.atan2(-nx, -nz);
    ev.emit('game:checkpoint', { id: `tower-${t.id}`, position: cp, yaw });
    ev.emit('ui:toast', { text: `Tower ${t.id} activated (${count}/${this.total})`, seconds: 4 });

    if (count >= this.total) this.onAllActivated?.();
  }
}
