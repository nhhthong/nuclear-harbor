import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { GameContext } from '@/core/GameContext';
import { SHELTER, SHELTERS, toWorld } from '@/world/shelters';
import { createSheltersModule } from './index';

function rig(position: { x: number; y: number; z: number }) {
  const handlers = new Map<string, Array<(e: unknown) => void>>();
  const toasts: string[] = [];
  const player = {
    alive: true,
    hp: 40,
    maxHp: 100,
    position: new Vector3(position.x, position.y, position.z),
    heal(n: number) {
      this.hp = Math.min(this.maxHp, this.hp + n);
      return n;
    },
  };
  const ctx = {
    flags: { sandbox: false },
    testHooks: {} as Record<string, unknown>,
    state: { is: () => true },
    player,
    events: {
      on(name: string, fn: (e: unknown) => void) {
        handlers.set(name, [...(handlers.get(name) ?? []), fn]);
        return () => undefined;
      },
      emit(name: string, e: { text?: string }) {
        if (name === 'ui:toast' && e.text) toasts.push(e.text);
      },
    },
  } as unknown as GameContext;
  const mod = createSheltersModule();
  mod.init?.(ctx);
  const hurt = (): void => handlers.get('player:damaged')?.forEach((h) => h({}));
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds; t += 1 / 60) mod.fixedUpdate?.(1 / 60);
  };
  return { player, run, hurt, toasts };
}

describe('shelters module', () => {
  const s = SHELTERS[0]!;
  const inside = toWorld(s, 0.5, 0);

  it('heals while the player stands inside, up to the maximum', () => {
    const r = rig({ x: inside.x, y: 0, z: inside.z });
    r.run(1);
    expect(r.player.hp).toBeCloseTo(40 + SHELTER.healPerSecond, 0);
    r.run(10);
    expect(r.player.hp).toBe(100);
    expect(r.toasts).toEqual(['Safe container: recovering']);
  });

  it('does not heal outside, and not right after being hit', () => {
    const out = rig({ x: s.x + 20, y: 0, z: s.z + 20 });
    out.run(3);
    expect(out.player.hp).toBe(40);
    const r = rig({ x: inside.x, y: 0, z: inside.z });
    r.hurt();
    r.run(SHELTER.calmSeconds - 0.2);
    expect(r.player.hp).toBe(40);
    r.run(1);
    expect(r.player.hp).toBeGreaterThan(40);
  });
});
