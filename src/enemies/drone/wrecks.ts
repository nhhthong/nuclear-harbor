import { Vector3, type Object3D } from 'three';
import type { GameContext } from '@/core/GameContext';
import { DRONE } from './tunables';

interface Wreck {
  ctx: GameContext;
  obj: Object3D;
  vel: Vector3;
  floorY: number;
  t: number;
  spin: number;
}

const wrecks: Wreck[] = [];
const fx = new Vector3();

/**
 * Falling drone wrecks (spec 29): a shot drone's model drops with gravity and a tumble, then bursts with a small
 * explosion and smoke on the floor. Stepped by the enemy manager every frame; at most `DRONE.death.cap` at once
 * (the oldest bursts early).
 */
export function addWreck(ctx: GameContext, obj: Object3D, vel: Vector3, floorY: number): void {
  if (wrecks.length >= DRONE.death.cap) burst(wrecks.shift()!);
  ctx.scene.attach(obj);
  wrecks.push({ ctx, obj, vel: vel.clone(), floorY, t: 0, spin: (Math.random() < 0.5 ? -1 : 1) * DRONE.death.spin });
}

function burst(w: Wreck): void {
  fx.copy(w.obj.position);
  w.ctx.events.emit('vfx:spawn', { kind: 'explosion', position: fx.clone(), scale: DRONE.death.explosionScale });
  w.ctx.events.emit('vfx:spawn', { kind: 'smoke', position: fx.clone(), scale: DRONE.death.explosionScale });
  w.obj.removeFromParent();
}

export function stepWrecks(dt: number): void {
  for (let i = wrecks.length - 1; i >= 0; i--) {
    const w = wrecks[i]!;
    w.t += dt;
    w.vel.y -= DRONE.death.gravity * dt;
    w.obj.position.addScaledVector(w.vel, dt);
    w.obj.rotation.z += w.spin * dt;
    w.obj.rotation.x += w.spin * 0.4 * dt;
    if (w.obj.position.y <= w.floorY + 0.2 || w.t >= DRONE.death.maxTime) {
      w.obj.position.y = Math.max(w.obj.position.y, w.floorY + 0.2);
      burst(w);
      wrecks.splice(i, 1);
    }
  }
}

export function wreckCount(): number {
  return wrecks.length;
}

/** Module dispose: remove without effects. */
export function clearWrecks(): void {
  for (const w of wrecks) w.obj.removeFromParent();
  wrecks.length = 0;
}
