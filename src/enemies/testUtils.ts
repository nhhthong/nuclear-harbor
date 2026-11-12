import { Scene } from 'three';
import { ResourceTracker } from '@/assets/ResourceTracker';
import { EventBus } from '@/core/EventBus';
import type { GameContext } from '@/core/GameContext';
import type { GameEvents } from '@/core/events';
import { PlayerState } from '@/core/PlayerState';
import { EnemyRegistry } from '@/core/registries';
import { PhysicsWorld } from '@/physics/PhysicsWorld';

/** Mutable clock for tests. */
export interface TestClock {
  simTime: number;
  fixedDt: number;
  frame: number;
  fixedTick: number;
}

export interface TestWorld {
  ctx: GameContext;
  clock: TestClock;
  physics: PhysicsWorld;
  events: EventBus<GameEvents>;
}

/** Minimal headless GameContext (real Rapier world, three Scene) for enemy unit tests. */
export async function makeTestWorld(options: { sandbox?: boolean; params?: string } = {}): Promise<TestWorld> {
  const physics = await PhysicsWorld.create();
  const events = new EventBus<GameEvents>();
  const clock: TestClock = { simTime: 0, fixedDt: 1 / 60, frame: 0, fixedTick: 0 };
  const ctx = {
    scene: new Scene(),
    physics,
    events,
    enemies: new EnemyRegistry(),
    player: new PlayerState(events),
    resources: new ResourceTracker('test'),
    clock,
    flags: {
      sandbox: options.sandbox ?? true,
      autostart: true,
      debug: false,
      params: new URLSearchParams(options.params ?? ''),
    },
    testHooks: {},
  } as unknown as GameContext;
  return { ctx, clock, physics, events };
}

/** Flat ground (top at y = 0) of the given half size. */
export function addGround(physics: PhysicsWorld, half = 40): void {
  physics.addStaticBox({ center: { x: 0, y: -0.5, z: 0 }, halfExtents: { x: half, y: 0.5, z: half } });
}
