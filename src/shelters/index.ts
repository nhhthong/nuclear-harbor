import type { GameContext } from '@/core/GameContext';
import type { GameModule } from '@/core/GameModule';
import { SHELTER, SHELTERS, insideShelter, type Shelter } from '@/world/shelters';
import { Vector3 } from 'three';

const MODULE_ID = 'shelters';
const fxPos = new Vector3();

/**
 * Safe containers: while the player stands inside one and nothing has hurt them for a moment, they
 * heal. The walls (world module colliders) do the protecting; this module only watches the player.
 * Not active in `?sandbox`.
 */
export function createSheltersModule(): GameModule {
  let ctx: GameContext | null = null;
  let offs: Array<() => void> = [];
  let current: Shelter | null = null;
  let sinceHurt = 99;
  let fxTimer = 0;
  let announced = false;

  const which = (c: GameContext): Shelter | null => {
    const p = c.player.position;
    for (const s of SHELTERS) if (insideShelter(s, p.x, p.y, p.z)) return s;
    return null;
  };

  return {
    id: MODULE_ID,

    init(context) {
      if (context.flags.sandbox) return;
      ctx = context;
      offs = [
        context.events.on('player:damaged', () => {
          sinceHurt = 0;
        }),
        context.events.on('game:respawn', () => {
          sinceHurt = 99;
          current = null;
          announced = false;
        }),
      ];
      context.testHooks[MODULE_ID] = { inside: () => current?.id ?? null, count: SHELTERS.length };
    },

    fixedUpdate(dt) {
      const c = ctx;
      if (!c || !c.state.is('playing') || !c.player.alive) return;
      sinceHurt += dt;
      const now = which(c);
      if (now !== current) {
        current = now;
        if (now && !announced && c.player.hp < c.player.maxHp) {
          announced = true;
          c.events.emit('ui:toast', { text: 'Safe container: recovering', seconds: 2.5 });
        }
        if (!now) announced = false;
      }
      if (!now || c.player.hp >= c.player.maxHp || sinceHurt < SHELTER.calmSeconds) return;
      c.player.heal(SHELTER.healPerSecond * dt);
      fxTimer -= dt;
      if (fxTimer <= 0) {
        fxTimer = 0.45;
        const p = c.player.position;
        c.events.emit('vfx:spawn', { kind: 'pickup', position: fxPos.set(p.x, p.y + 0.9, p.z), scale: 0.8 });
      }
    },

    dispose() {
      for (const off of offs) off();
      offs = [];
      if (ctx) delete ctx.testHooks[MODULE_ID];
      ctx = null;
      current = null;
    },
  };
}
